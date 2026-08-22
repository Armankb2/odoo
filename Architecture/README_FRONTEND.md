# Dayflow HRMS — Frontend Architecture

Vite + React 19 + React Router v7 + TanStack Query + React Hook Form +
Tailwind + shadcn/ui.

TypeScript is assumed. **If plain JavaScript is chosen instead, drop the type
annotations — every structural decision below is unchanged.**

---

## 1. Folder layout

```
client/
├── index.html
├── vite.config.ts            # dev proxy /api → localhost:4000
└── src/
    ├── main.tsx              # QueryClientProvider, RouterProvider
    ├── routes.tsx            # the whole route tree, one file
    ├── lib/
    │   ├── api.ts            # axios instance, withCredentials: true
    │   ├── queryKeys.ts      # every cache key, centralised
    │   └── format.ts         # ₹ currency, dates, hh:mm durations
    ├── hooks/
    │   ├── useAuth.ts        # current user, login, logout
    │   ├── useEmployees.ts
    │   ├── useAttendance.ts
    │   ├── useLeave.ts
    │   └── useSalary.ts
    ├── components/
    │   ├── ui/               # shadcn — generated, rarely hand-edited
    │   ├── layout/           # AppShell, TopNav, AvatarMenu
    │   └── shared/           # StatusDot, EmployeeCard, DataTable, PageHeader
    ├── pages/
    │   ├── auth/             # SignIn, SignUp, ChangePassword
    │   ├── employees/        # List, Detail, New
    │   ├── attendance/       # MyAttendance, AdminAttendance
    │   ├── timeoff/          # MyTimeOff, AdminTimeOff, RequestDialog
    │   └── profile/          # MyProfile + tab panels
    └── styles/index.css
```

**One rule worth stating:** pages compose, hooks fetch, `components/ui` stays
generated. Any `axios` call outside `hooks/` is a mistake — it bypasses the
cache and the loading conventions.

## 2. Routing

The wireframe has a persistent top nav (`Company Logo | Employees | Attendance |
Time Off`), so the app is a nested layout with an `<Outlet/>`.

```
/signin                       public
/signup                       public
/change-password              auth, blocks everything else while required

/ (AppShell)                  auth required
├── /employees                index — the post-login landing page
├── /employees/new            ADMIN only
├── /employees/:id            view-only profile
├── /profile                  own profile, form view
├── /attendance               role-switched: employee month / admin day
└── /time-off                 role-switched: own records / all + approve
```

Two guard components:

- **`<ProtectedRoute>`** — redirects to `/signin` when unauthenticated, and to
  `/change-password` when `mustChangePassword` is set. The backend enforces the
  same thing; this only makes it pleasant rather than a wall of 403s.
- **`<AdminRoute>`** — wraps admin-only routes, redirects employees away.

**Landing after login is `/employees`**, per the wireframe's "After login the
user must land on this page" — *not* a card dashboard as the PDF describes.

### Role-switched pages

`/attendance` and `/time-off` render meaningfully different views per role. Two
components each, selected at the page level:

```tsx
export default function AttendancePage() {
  const { user } = useAuth();
  return user.role === 'ADMIN' ? <AdminAttendance /> : <MyAttendance />;
}
```

Preferred over branching inside one component — the two layouts share almost
nothing but a table.

## 3. Data layer

**axios instance** with `withCredentials: true` so the httpOnly auth cookie
travels; a response interceptor redirects to `/signin` on 401.

**TanStack Query owns all server state.** Consequences worth being deliberate
about:

- No `useEffect` + `useState` fetching anywhere.
- No Redux, no Zustand. The only genuinely client-side state is dialog
  open/closed and form drafts, which `useState` and React Hook Form handle.
- Mutations invalidate keys rather than hand-patching the cache.

**Centralised query keys** in `queryKeys.ts`:

```ts
export const qk = {
  me: ['me'],
  employees: (search?: string) => ['employees', search ?? ''],
  employee: (id: number) => ['employees', id],
  attendanceMe: (month: string) => ['attendance', 'me', month],
  attendanceDay: (date: string) => ['attendance', 'day', date],
  leaveBalance: ['leave', 'balance'],
  leaveRequests: (scope: 'me' | 'all') => ['leave', 'requests', scope],
};
```

Scattered inline key arrays are how "approve doesn't refresh the list" bugs
happen. Invalidation after approving leave, for example, hits
`leaveRequests('all')` **and** `leaveBalance`.

## 4. Forms

This app is almost entirely forms, so the pattern is fixed:
**React Hook Form + `zodResolver`, with the Zod schemas imported from the
server's `schemas/`** so validation rules cannot drift between client and
server.

```tsx
const form = useForm<TimeOffInput>({ resolver: zodResolver(timeOffSchema) });
```

Applies to: sign-in, sign-up, change password, employee create, all profile
tabs, the salary structure, and the time-off request dialog.

Submit buttons disable while `isPending`. Server field errors map back onto the
form via `setError` rather than appearing only as a toast.

## 5. Component inventory — wireframe to shadcn

| Wireframe element | Components |
|---|---|
| Top nav + company logo | `layout/TopNav` |
| Avatar → My Profile / Log Out | `DropdownMenu`, `Avatar` |
| Employee cards with status icon | `Card`, `Avatar`, `Badge` + `StatusDot` |
| Search bar | `Input` + debounced query param |
| `NEW` button | `Button` |
| Profile tabs (Resume / Private Info / Salary Info / Security) | `Tabs` |
| Attendance & time-off tables | `Table` |
| Month / day navigation (`< >`, `Oct v`) | `Button` + `Select` |
| Summary tiles (days present, leaves, working days) | `Card` |
| Time-off request modal | `Dialog` + `Form` |
| Validity period pickers | `Popover` + `Calendar` |
| Approve / Reject | `Button` variants `default` / `destructive` |
| Attachment upload | `Input type="file"` |
| Check In / Check Out | `Button` + live timer |

shadcn components are **copied into the repo**, so editing them is normal rather
than a fight with a library's theme API.

## 6. Three details worth getting right

### 6.1 Status indicators

The wireframe is specific: 🟢 present, ✈️ on leave, 🟡 absent ("has not applied
time off and is absent"). A single `<StatusDot status="present|leave|absent" />`
renders all three. **The value is computed by the backend and sent with the
list** — the frontend never derives it, so both cannot disagree.

### 6.2 Check In / Check Out

The only genuinely live piece of UI. Wireframe: a red dot turns green on
check-in, with a "Since 00:00PM" elapsed label. A `useCheckInStatus` hook
returns today's record; a 1-second `setInterval` drives the elapsed label from
`checkIn`. Optimistic update on the mutation so the dot flips instantly, rolled
back on error.

### 6.3 Salary Info tab

**Rendered only for admins** — and it must be genuinely absent, not
`visibility: hidden`. The backend already omits salary from non-admin
responses, so there is nothing to leak; the frontend simply does not render the
tab when `user.role !== 'ADMIN'`.

Component amounts recalculate live as the wage field changes, mirroring the
server's `computeSalary`. Two options: recompute client-side for instant
feedback (duplicating the formula, with drift risk) or debounce a preview call
to the server. **Prefer the server preview endpoint** — one implementation of
the formula, and the numbers on screen are the numbers that will be saved.

## 7. Loading, empty and error states

Handled once, not per page:

- **Loading** — `Skeleton` matching the eventual layout, not a spinner. Tables
  get skeleton rows, cards get skeleton cards.
- **Empty** — a shared `<EmptyState>` with an action. "No employees yet" plus a
  `NEW` button reads as finished; a blank panel reads as broken.
- **Error** — inline `Alert` with a retry, since TanStack Query already exposes
  `refetch`.
- **Mutation feedback** — toasts (`sonner`), success and failure both.

Under time pressure these are the first things to get skipped and the first
things a judge notices.

## 8. Styling

Tailwind, with shadcn's CSS-variable theme. Set the brand colour once in
`index.css` rather than sprinkling literal colours.

Currency, dates and durations go through `lib/format.ts` — `₹50,000.00`,
`28/10/2025` and `09:00` all appear in the wireframe and should be formatted in
exactly one place. Use `Intl.NumberFormat('en-IN')`, which produces Indian
digit grouping (`₹1,50,000`) rather than `₹150,000`.

Desktop-first. The wireframe is a desktop app and responsive work is not worth
the hours here — but tables should scroll horizontally rather than overflow.

## 9. Dev setup

```ts
// vite.config.ts
server: { proxy: { '/api': 'http://localhost:4000' } }
```

The proxy means the client calls `/api/...` with no base URL and **no CORS
configuration to debug** — worth the thirty seconds it takes to set up.

`npm run dev` in both `client/` and `server/`, or one `concurrently` script at
the repo root.

## 10. Build order

1. Vite + Tailwind + shadcn init, `AppShell` and `TopNav`
2. Auth pages, `useAuth`, `ProtectedRoute`, change-password flow
3. Employee list with cards, search and status dots — the landing page
4. Employee detail (view-only) and `/profile` with tabs
5. Attendance: Check In/Out widget, then both list views
6. Time Off: balance tiles, table, request dialog, approve/reject
7. Salary Info tab
8. Polish — empty states, skeletons, toasts

Matches the backend order so the two halves meet at each step rather than
integrating at the end. Steps 1–3 give a demoable app; everything after is
additive, which is what you want when the clock runs out mid-feature.

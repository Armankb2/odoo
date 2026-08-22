# Dayflow — Human Resource Management System

> Every workday, perfectly aligned.

An HRMS that digitizes core HR operations: employee onboarding and profiles,
attendance tracking, leave and time-off management, payroll visibility, and
approval workflows for HR/Admin.

**Status:** backend API in progress. Database schema, authentication,
role-based access, attendance and time-off are implemented and tested against
a live MySQL instance. Salary engine and the React frontend are not started.

### API surface so far

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/{signup,login,logout,change-password}`, `GET /api/auth/me` |
| Employees | `GET /api/employees`, `GET/PATCH /api/employees/:id`, `POST /api/employees`, `PATCH /api/employees/:id/deactivate` |
| Attendance | `GET /api/attendance/{today,me}`, `POST /api/attendance/{check-in,check-out}`, `GET /api/attendance` (admin), `GET /api/attendance/{user,payable}/:id` |
| Time Off | `GET /api/leave/{types,balance,requests}`, `POST /api/leave/requests`, `PATCH /api/leave/requests/:id/{approve,reject}`, `DELETE /api/leave/requests/:id`, `POST /api/leave/allocations` |
| Salary | `GET /api/salary/:userId` (own, or any for admin), `POST /api/salary/:userId/preview` (admin), `PATCH /api/salary/:userId` (admin) |

Employees can **view** their own salary but never change it: reads allow the
own record, writes are admin-only, and salary appears in neither profile edit
allow-list.

**Stack:** React 19 (Vite) + Node (Express 5) + MySQL 8, with Prisma, React
Router 7 and plain hand-written CSS. TypeScript on both sides.

## Running it

Requires Node 22+ and a local MySQL 8 instance. Two terminals.

```bash
# 1 — API
cd server
npm install
cp .env.example .env        # then set DATABASE_URL and JWT_SECRET
npm run db:migrate          # create the schema
npm run db:seed             # company config, 9 users, attendance, leave
npm run dev                 # http://localhost:4000

# 2 — web app
cd client
npm install
npm run dev                 # http://localhost:5173
```

Vite proxies `/api` and `/uploads` to the API, so everything is same-origin in
development and there is no CORS to configure.

`npm run db:studio` (in `server/`) opens a browsable view of the database.

### Signing in

Dayflow is a **single company**, so there is nothing to register an
organisation for — sign-up asks for a person and the role they want, and
sign-in asks which role you are signing in as. The role on the sign-in form is
checked against the account, not trusted: pick the wrong one and you get a
clear error rather than a half-working session.

**The hardcoded admin**, created by `db:seed`:

| Field | Value |
|---|---|
| Role | **Admin / HR** |
| Login ID | `DFSYAD20260001` |
| Email | `admin@dayflow.local` |
| Password | `Admin@12345` |

Either the Login ID or the email works. The `2026` in that Login ID is the
year you seeded in, so it will differ on a later run — `db:seed` prints the
exact value it created, and the email and password never change.

Two more demo accounts, both with password `password123`:

| Login ID | Role |
|---|---|
| `DFDHMO20220001` | Admin / HR |
| `DFARKH20220002` | Employee |

> ⚠️ **Sign-up lets the caller choose ADMIN**, which means anyone who can reach
> the page can grant themselves full access to every employee record and
> salary. That is deliberate for the demo. Gate it behind an invite code, or
> drop `ADMIN` from the accepted values, before this faces anything real.

> **If the password contains `#`** (or any of `#?@/:`), percent-encode it in
> `DATABASE_URL` — `#` starts a URL fragment and silently truncates the rest.
> `#` becomes `%23`.

## Styling

The markup and the stylesheet were built by two people, and they meet through
hooks rather than through edits to each other. Every screen shipped first as
semantic, completely unstyled markup; `client/src/styles/index.css` was then
written against it and imported once from `client/src/main.tsx` — **without
changing a single component**.

Keep that split. Style through the hooks below; if a screen needs new visual
state, add another hook rather than an inline style. No Tailwind, no component
library.

Every element carries a semantic `className`, and state that matters visually
is exposed as a data attribute rather than baked in:

- `data-status="present|leave|absent"` on employee cards — the wireframe's
  🟢 / ✈️ / 🟡 indicators
- `data-state="in|out|done"` on the check-in widget — its red/green dot
- `data-status="PENDING|APPROVED|REJECTED"` on leave rows
- `data-missing-checkout` on attendance rows where someone forgot to check out

Some hooks are interpolated from API values — `employee-status-${status}`,
`status-dot-${state}` — so the casing of the `CardStatus` and `LeaveStatus`
enums is load-bearing. Change either and the styling disappears silently, with
no build error.

## What's here

```
.
├── README.md                  # You are here
├── client/                    # React 19 + Vite + React Router 7
│   └── src/
│       ├── pages/             # One file per screen
│       ├── components/        # AppShell, ProfileTabs, SalaryPanel, ...
│       ├── hooks/             # useAuth, useAsync
│       ├── lib/               # api.ts (thin fetch wrapper), format.ts
│       └── styles/index.css   # The whole stylesheet — see "Styling" above
├── server/                    # Express 5 + Prisma
│   ├── src/
│   │   ├── routes/            # HTTP layer
│   │   ├── services/          # Business logic, incl. the salary engine
│   │   ├── policies/          # Row- and field-level access rules
│   │   ├── middleware/        # Auth, role guards, error handling
│   │   └── lib/
│   └── prisma/                # schema.prisma, migrations, seed.ts
├── Architecture/
│   ├── ANALYSIS.md            # Both sources reconciled — read this first
│   ├── TASKS.md               # Task list and status
│   ├── architect.md           # System design
│   ├── README_DATABASE.md     # Schema and the derived-not-stored rule
│   ├── README_BACKEND.md      # API surface and the RBAC layers
│   ├── README_FRONTEND.md     # Screens and the styling hook contract
│   └── Dayflow_HRMS_Tech_Stack.docx
└── docs/
    ├── Dayflow - ... .pdf     # The requirements document — the spec
    └── PROBLEM_STATEMENT.md   # That PDF, extracted to text
```

**`docs/Dayflow - Human Resource Management System.pdf`** is the specification;
`docs/PROBLEM_STATEMENT.md` is its extracted text. An Excalidraw wireframe used
to sit alongside it and was treated as authoritative where the two disagreed —
it has since been deleted, so the PDF stands alone. Code comments that justify
behaviour with "the wireframe shows…" predate that and should be checked
against the PDF rather than trusted.

## Who sees what

Per PDF §2 and §3.2.2, an employee has **no directory**: they see their own
profile, their own attendance, their own leave and their own salary. The
employee list, the company-wide attendance day view and every write to another
person's record are Admin / HR only.

This is enforced on the server — `GET /api/employees` is role-gated and
per-record reads go through `assertCanAccessUser` — and mirrored in the UI so
an employee is never shown a link to a 403.

## Attendance

Employees get a **month calendar**, coloured per day:

| Colour | Meaning |
|---|---|
| 🟩 Green | Present — an attendance row exists for that day |
| 🟥 Red | Absent — a working day with no attendance and no approved leave |
| 🟨 Yellow | Time off — covered by an approved leave request |
| ⬜ Grey | Week off — always Sunday, plus Saturday on a five-day week |
| ▫️ Blank | Later than today, so nothing has happened yet |

Precedence runs top to bottom with two deliberate exceptions: an attendance row
wins over everything, so a Sunday someone actually worked reads green; and a
non-working day beats leave, so a leave request spanning a weekend does not
paint the Sunday yellow. The status is computed server-side and handed to the
stylesheet as `data-status` — the colours are defined once, in
`client/src/styles/index.css` §16.

Admins keep the whole-company day view instead, and can open any employee's
month calendar from their record.

## Features (from the spec)

| Area | Employee | Admin / HR |
|---|---|---|
| Auth | Sign up with name, email, password and role; sign in as Employee | same, signing in as Admin / HR |
| Dashboard | Profile, attendance, leave request cards; recent activity | Employee list, attendance records, leave approvals |
| Profile | View all; edit address, phone, picture | View and edit all employee details |
| Attendance | Check-in / check-out; own daily & weekly view | All employees' records |
| Leave | Apply (Paid / Sick / Unpaid) with date range and remarks | Approve or reject with comments |
| Payroll | Read-only view of own salary | View all; update salary structure |

Leave statuses: Pending, Approved, Rejected.
Attendance statuses: Present, Absent, Half-day, Leave.

Future enhancements listed in the spec: email/notification alerts, and an
analytics & reports dashboard (salary slips, attendance reports).

## Working on this repo

**One branch per task — `main` is never committed to directly.** Branches are
named `<type>/<short-slug>`, where `<type>` is one of `feat`, `fix`, `chore`,
`docs`, or `refactor`.

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/<short-slug>
```

Do the work on that branch, keep `docs/TASKS.md` current, then push the branch
and open a PR. Never force-push or rewrite history on `main` — this repo is
shared.

## Note on this repository

`origin` is `github.com/Armankb2/odoo`, shared with a teammate. Never
force-push or rewrite published history. The files `first file1`, `second
file`, and `Third file` on `main` are pre-existing scratch files from testing
push access and are intentionally left untouched.

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

**Stack:** React (Vite) + Node (Express) + MySQL 8, with Prisma, TanStack
Query, React Hook Form and Tailwind/shadcn.

## Running it

Requires Node 22+ and a local MySQL 8 instance. Two terminals.

```bash
# 1 — API
cd server
npm install
cp .env.example .env        # then set DATABASE_URL and JWT_SECRET
npm run db:migrate          # create the schema
npm run db:seed             # demo company, 8 users, attendance, leave
npm run dev                 # http://localhost:4000

# 2 — web app
cd client
npm install
npm run dev                 # http://localhost:5173
```

Vite proxies `/api` and `/uploads` to the API, so everything is same-origin in
development and there is no CORS to configure.

`npm run db:studio` (in `server/`) opens a browsable view of the database.

**Demo logins** — both with password `password123`:

| Login ID | Role |
|---|---|
| `OIDHMO20220001` | Admin / HR |
| `OIARKH20220002` | Employee |

> **If the password contains `#`** (or any of `#?@/:`), percent-encode it in
> `DATABASE_URL` — `#` starts a URL fragment and silently truncates the rest.
> `#` becomes `%23`.

## Styling

**The React app ships deliberately unstyled** — no CSS file, no colours, no
layout rules. Structure and behaviour are complete; the visual design is a
separate piece of work.

Every element carries a semantic `className`, and state that matters visually
is exposed as a data attribute rather than baked in:

- `data-status="present|leave|absent"` on employee cards — the wireframe's
  🟢 / ✈️ / 🟡 indicators
- `data-state="in|out|done"` on the check-in widget — its red/green dot
- `data-status="PENDING|APPROVED|REJECTED"` on leave rows
- `data-missing-checkout` on attendance rows where someone forgot to check out

To add styles, drop a stylesheet in and import it from `client/src/main.tsx`
(or link it in `client/index.html`) — both carry a comment marking the spot.

## What's here

```
.
├── README.md              # You are here
└── docs/
    ├── ANALYSIS.md            # Both sources reconciled — read this first
    ├── WIREFRAME_SPEC.md      # Screens, fields and rules from the wireframe
    ├── TECH_STACK.md          # Stack and the reasoning behind it
    ├── PROBLEM_STATEMENT.md   # The original PDF brief, extracted
    ├── Dayflow - ... .pdf     # Original requirements document
    ├── ... - 8 hours.excalidraw  # Original wireframes
    └── TASKS.md               # Task list and status
```

Read `docs/ANALYSIS.md` first. There are two requirement sources and they
**contradict each other** on registration, attendance, leave balances and
payroll — the wireframe is the authoritative one.

## Features (from the spec)

| Area | Employee | Admin / HR |
|---|---|---|
| Auth | Sign up with Employee ID, email, password, role; email verification | same |
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

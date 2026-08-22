# Dayflow — Human Resource Management System

> Every workday, perfectly aligned.

An HRMS that digitizes core HR operations: employee onboarding and profiles,
attendance tracking, leave and time-off management, payroll visibility, and
approval workflows for HR/Admin.

**Status:** backend foundation in progress — database schema, authentication
and role-based access are written; the frontend has not been started.

**Stack:** React (Vite) + Node (Express) + MySQL 8, with Prisma, TanStack
Query, React Hook Form and Tailwind/shadcn.

## Running the backend

Requires Node 22+ and a local MySQL 8 instance.

```bash
cd server
npm install
cp .env.example .env        # then set DATABASE_URL and JWT_SECRET
npm run db:migrate          # create the schema
npm run db:seed             # demo company, 8 users, attendance, leave
npm run dev                 # http://localhost:4000
```

`npm run db:studio` opens a browsable view of the database.

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

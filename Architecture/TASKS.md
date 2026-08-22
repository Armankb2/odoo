# Tasks

Status: `todo` → `in-progress` → `done`. One branch per task; never commit to
`main` directly.

| # | Task | Branch | Status |
|---|------|--------|--------|
| 1 | Repo scaffolding: README, requirements docs, task list | `chore/project-isolation-setup` | done |
| 2 | Analyse the requirements PDF → `docs/ANALYSIS.md` | `chore/project-isolation-setup` | done |
| 3 | Analyse the wireframes → `docs/WIREFRAME_SPEC.md` | `chore/project-isolation-setup` | done |
| 4 | Choose tech stack → `docs/TECH_STACK.md` | `chore/project-isolation-setup` | done |
| 5 | Resolve the open questions in `ANALYSIS.md` §6 | — | partly |
| 6 | Data model / Prisma schema design | `feat-database-schema-and-rbac` | done |
| 7 | Auth: company sign-up, sign in, forced password change | `feat-database-schema-and-rbac` | done |
| 8 | HR creates employee → Login ID + password generation | `feat-database-schema-and-rbac` | done |
| 9 | Role-based access (Employee vs Admin/HR) | `feat-database-schema-and-rbac` | done |
| 10 | Employee list API: search + derived status icons | `feat-attendance-and-timeoff` | done (API) |
| 11 | Attendance: Check In/Out, employee month view, admin day view | `feat-attendance-and-timeoff` | done (API) |
| 12 | Time Off: request, approve/reject, balance tiles | `feat-attendance-and-timeoff` | done (API) |
| 13 | Salary Info tab + component calculation engine | `feat-attendance-and-timeoff` | done |
| 14 | Profile editing — employee's own fields | `feat-attendance-and-timeoff` | done |
| 14b | Admin UI to edit any employee's details + deactivate | `feat-attendance-and-timeoff` | done |
| 15 | Frontend: React app, all screens, **unstyled** | `feat-attendance-and-timeoff` | done |
| 16 | CSS / visual design | — | todo (owned by someone else) |

"done (API)" means the backend endpoint exists and is tested. Task 15 delivers
every screen as working, semantic, **completely unstyled** markup — no CSS
file, no colours, no layout rules. Every element carries a semantic
`className` (and `data-status` / `data-state` where meaning matters) for the
stylesheet to hook onto. Add the stylesheet via `client/index.html` or
`client/src/main.tsx`.

Build order 7→14 follows the 8-hour triage in `ANALYSIS.md` §5. Task 13 is the
most heavily specified module and the most expensive; it is deliberately late.

Out of scope unless everything above is done: payslip generation, allocation
management UI, Security tab, multi-company, document uploads.

## Next up

**Task 5 — the four open questions in `docs/ANALYSIS.md` §6.** Everything else
in the requirements is settled. Questions 2 (Admin vs HR) and 3 (multi-company)
shape the schema, so answer them before task 6.

Stack is decided: React + Node + MySQL (mandated) with Express, Prisma,
TanStack Query, React Hook Form, Tailwind + shadcn/ui. Full rationale and the
one open call (TypeScript vs plain JS) in `docs/TECH_STACK.md`.

**No application code until Dhanush says to start coding.**

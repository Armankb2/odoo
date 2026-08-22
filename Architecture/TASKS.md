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
| 16 | CSS / visual design | `feature-client-styling` | done |
| 17 | Style the hooks the stylesheet had missed | `chore/post-styling-cleanup` | done |

"done (API)" means the backend endpoint exists and is tested.

Task 15 delivered every screen as working, semantic, **completely unstyled**
markup: every element carries a semantic `className` (and `data-status` /
`data-state` where meaning matters) for a stylesheet to hook onto. Task 16 then
supplied that stylesheet — `client/src/styles/index.css`, imported once from
`client/src/main.tsx` — without touching a single component, because the hooks
were already there. Keep that split: **style through the existing class and
data-attribute hooks; if a screen needs new visual state, add another hook
rather than an inline style.**

Build order 7→14 follows the 8-hour triage in `ANALYSIS.md` §5. Task 13 is the
most heavily specified module and the most expensive; it is deliberately late.

Out of scope unless everything above is done: payslip generation, allocation
management UI, Security tab, multi-company, document uploads.

## Next up

Every task above is done except task 5, which stays `partly` — see the three
unconfirmed assumptions at the bottom of this section. The app runs end to end:
auth, employee management, attendance, time off, salary, and the stylesheet
over all of it.

Stack as built: React 19 + React Router 7 on the client, Express + Prisma +
MySQL on the server, TypeScript both sides. **Plain hand-written CSS — no
Tailwind, no shadcn/ui, no component library**, which supersedes the
Tailwind + shadcn call in `Dayflow_HRMS_Tech_Stack.docx`. TanStack Query was
dropped too; a thin `lib/api.ts` plus a `useAsync` hook covers the screen count.

Three assumptions are shipped but never formally confirmed, and are the first
things to revisit if the brief is re-read: payslip documents are out of scope
(the app reports a payable-day count instead), Admin and HR are one combined
`ADMIN` role, and the app assumes a single company throughout.

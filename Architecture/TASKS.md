# Tasks

Status: `todo` → `in-progress` → `done`. One branch per task; never commit to
`main` directly.

> **Source of truth (2026-08-22):** the Excalidraw wireframe and
> `docs/WIREFRAME_SPEC.md` were deleted. **`docs/Dayflow - Human Resource
> Management System.pdf`** (extracted to `docs/PROBLEM_STATEMENT.md`) is the
> base specification. Code comments that justify behaviour with "the wireframe
> shows…" are stale — one of them was hiding the bug fixed in task 19.

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
| 18 | Single company; role chosen at sign-up and sign-in; fixed admin | `feat-single-company-auth` | done |
| 19 | Fix: employees could list every colleague (admin-only now) | `fix-employee-scope-and-calendar` | done |
| 20 | Employee attendance as a colour-coded month calendar | `fix-employee-scope-and-calendar` | done |
| 21 | Email verification: OTP mailed at sign-up | `feat-email-otp-verification` | done |
| 22 | Profile picture upload (replaces the initials fallback) | `feat-avatar-upload` | done |
| 23 | Move the OTP from sign-up to sign-in; clearer error when the API is down | `fix-otp-on-signin` | done |

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

Two of the three long-standing assumptions are now settled decisions rather
than guesses (task 18): **Admin and HR are one combined `ADMIN` role**, and
**Dayflow is a single company** — sign-up no longer asks for a company name or
code, and the `Company` row is the app's configuration record (PF rates,
professional tax, working days) rather than a tenant. Only one assumption is
still open: payslip documents are out of scope, and the app reports a
payable-day count instead.

⚠️ Task 18 also made **role a self-service choice at sign-up**, so anyone
reaching the sign-up page can become an Admin. Deliberate for the demo, and the
first thing to close before this is exposed to anyone real.

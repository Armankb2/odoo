# Dayflow HRMS — Requirements Analysis

Two sources, analysed:

1. `Dayflow - Human Resource Management System.pdf` — 5 pages, ~3.4k chars.
   Verbatim in `PROBLEM_STATEMENT.md`.
2. `Human Resource Management System - 8 hours.excalidraw` — 574 elements.
   Extracted in `WIREFRAME_SPEC.md`.

**The wireframe supersedes the PDF.** It is markedly more detailed, more
internally consistent, and it resolves most of the questions the brief left
open. Where they disagree, build the wireframe.

**The wireframe filename states the budget: 8 hours.** That reframes
everything below — see §5.

**Status: analysis only. No code until Dhanush says start coding.**

---

## 1. What each source is good for

The **PDF** is a functional brief: which modules exist, who can see what. Its
own numbering jumps 3 → 6, and although §1.1 promises "functional and
non-functional requirements" it contains **zero NFRs** — nothing on security,
performance, availability, retention, or audit.

The **wireframe** is the real specification. It carries screen layouts, field
lists, explicit business rules in annotation blocks, and worked numeric
examples. Almost everything I flagged as undefined in the brief is answered
here.

## 2. Direct conflicts — wireframe wins

| # | PDF says | Wireframe says | Take |
|---|---|---|---|
| 1 | Users self-register and **pick their own role** (§3.1.1) | "**Normal user cannot register.** HR officer or Admin creates the user"; Sign Up captures Company Name + logo, i.e. it is *company/admin* registration | Wireframe. This closes the privilege hole I flagged. |
| 2 | "Email verification is required" (§3.1.1) | No verification anywhere; instead the system **auto-generates a first password** the user must change after first login | Wireframe. Drops an email dependency entirely. |
| 3 | Attendance has four stored statuses: Present / Absent / Half-day / Leave (§3.4.1) | Attendance stores **check-in, check-out, work hours, extra hours**. Presence is *derived* into three card icons: 🟢 present, ✈️ on leave, 🟡 absent | Wireframe. No Half-day concept exists. |
| 4 | Leave has no balance concept | **Allocations exist**: "Paid time Off — 24 Days Available", "Sick time off — 07 Days Available", plus an `Allocation` admin sub-nav | Wireframe. Fills the gap. |
| 5 | Payroll = view a "salary structure", undefined (§3.6) | A full **component engine**: Basic/HRA/Standard/Bonus/LTA/Fixed with computation types, auto-recalculation on wage change, PF at 12% both sides, Professional Tax ₹200 | Wireframe. This is the biggest single module. |
| 6 | Salary slips are a *future* enhancement (§6) | "Attendance data serves as the basis for **payslip generation**… unpaid leave reduces payable days" | Unresolved — see §4.1. |
| 7 | Landing page is a card dashboard (§3.2.1) | "After login the user must land on this page" points at the **Employees list**. No card dashboard is drawn | Wireframe. |
| 8 | Roles are Employee / HR | "Admin & HR Officer" used as one unit throughout; also "Time off officers" appears once | Two effective roles. See §4.2. |

## 3. What the wireframe resolves outright

- **Login ID format** — `OIJODO20220001` = company code + 2 letters of first
  name + 2 of last name + joining year + 4-digit serial, serial resetting per
  year. Needs a per-company-per-year counter with a uniqueness constraint.
- **Account creation flow** — HR creates employee → system generates Login ID
  and password → employee logs in and is forced to change it. Implies a
  `must_change_password` flag.
- **Profile structure** — four tabs (Resume, Private Info, Salary Info,
  Security) with the full field list captured in `WIREFRAME_SPEC.md` §3,
  including bank details (Account No, IFSC, PAN, UAN).
- **Salary Info is Admin-only** — stated explicitly.
- **Employee cards, not tables**, clickable into a **view-only** profile.
- **Attendance views** — employee sees own month with three summary tiles;
  admin sees all employees for the current day, with search.
- **Time off request form** — Employee, Type, Validity Period, Allocation in
  days, Attachment (for sick-leave certificates), Submit/Discard.
- **Time off types** — Paid Time off, Sick Leave, Unpaid Leaves.

## 4. What is still open

### 4.1 Are payslips in scope? — blocking
The PDF defers them; the wireframe justifies attendance tracking *by* payslip
generation and specifies payable-day computation. But **no payslip screen is
drawn**. Most likely reading: the payable-day logic is in scope, the payslip
document is not. Needs confirming — it is the difference between a computed
number and a whole reporting module.

### 4.2 Admin vs HR Officer
Consistently written as one combined actor ("Admin & HR Officer"), with one
stray reference to "Time off officers". Simplest defensible read: **two roles,
Employee and Admin/HR**. Confirm before building the permission layer.

### 4.3 The salary sample numbers don't add up
The drawn components total ₹48,750 against a ₹50,000 wage. By the stated rule
(`Fixed Allowance = wage − total of all components`) Fixed Allowance should be
₹4,168, not the ₹2,918 shown. I intend to **implement the rule and ignore the
drawn figure** unless told otherwise.

Also: the annotation says "Percentage of Wage", but every component except
Basic is plainly a percentage **of Basic** in the drawn table. Implementing per
the table.

### 4.4 Multi-tenancy
Sign-up takes a Company Name and logo, the Login ID embeds a company code, and
the nav shows a company logo. That reads as **multi-company**. For an 8-hour
build I would scope to a single company created at sign-up, with the schema
carrying a `company_id` so it isn't a rewrite later. Confirm.

### 4.5 Smaller gaps
- **Security tab** is drawn but empty — presumably change-password. Assuming so.
- **No employee edit form is drawn**, though PDF §3.3.2 requires editing.
- **Working schedule** — "No of working days in a week" and "Break Time" exist
  on the salary tab, and work-hours computation depends on them, but no
  holiday calendar is defined.
- **Attachment upload** for sick leave — storage approach undecided.
- No offboarding, notifications, or reports in either source.

## 5. The 8-hour constraint changes the priority order

This is the single most important fact in either document, and it makes the
scope in §2 undeliverable in full. Realistic triage:

**Must build (the demo is not credible without these)**
1. Auth: sign-up (company + admin), sign in, forced password change.
2. HR creates employee → Login ID + password generation.
3. Employee list with cards, search, status icons; view-only profile.
4. Check In / Check Out + attendance list (both views).
5. Time off: request, approve/reject, balance tiles.

**Should build if time allows**
6. Salary Info tab with the component calculation engine.
7. Private Info / Resume tab editing.

**Cut unless everything else is done**
8. Payslip generation, allocation management UI, Security tab, multi-company,
   documents/attachments.

The salary engine (§4 of `WIREFRAME_SPEC.md`) is the most *specified* part of
the wireframe and also the most time-expensive. It is a genuine trap: it looks
like the centrepiece because it has the most annotation, but a demo with no
working auth and a beautiful salary calculator is a worse demo than the
reverse. Build it sixth, not first.

## 6. Questions for Dhanush

1. **Payslips** — in scope, or is the payable-day count enough? (§4.1)
2. **Admin and HR Officer** — one role or two? (§4.2)
3. **Multi-company** — one company for the demo, with `company_id` in the
   schema for later? (§4.4)
4. Confirm I should follow the salary **rules** over the drawn sample numbers.
   (§4.3)

Everything else I can now proceed on without asking.

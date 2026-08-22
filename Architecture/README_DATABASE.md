# Dayflow HRMS — Database Architecture

MySQL 8.0 accessed through Prisma (`provider = "mysql"`).

**Assumptions made where requirements are still open** (see `ANALYSIS.md` §6 in
the repo). Each is marked ⚠️ below and is cheap to change *now*, expensive later:

- ⚠️ **Two roles only** — `ADMIN` (Admin / HR Officer) and `EMPLOYEE`.
- ⚠️ **Multi-company ready, single-company in the demo** — every tenant-owned
  table carries `companyId` so this never needs a migration, but only one
  company is created.
- ⚠️ **Payslips out of scope** — attendance yields a *payable days* count; no
  payslip document is modelled.
- ⚠️ Salary follows the wireframe's stated **rules**, not its drawn sample
  numbers (which sum to ₹48,750 against a ₹50,000 wage).

---

## 1. Entity overview

```
Company 1─────* User ──┬─1:1─ SalaryStructure ──* SalaryComponent
   │                   ├──*── Attendance
   │                   ├──*── LeaveAllocation ──* ─┐
   │                   ├──*── LeaveRequest ────────┘ (both → LeaveType)
   │                   ├──*── Skill
   │                   ├──*── Certification
   │                   └──1── manager (self-reference)
   ├──*── LeaveType
   └──1:1─ LoginIdSequence (per company per year)
```

`User` is intentionally **one table, not a `User` + `Employee` split**. In this
system every employee *is* a login and vice versa; splitting them would add a
join to nearly every query and buy nothing inside an 8-hour build.

## 2. Schema

### 2.1 Company

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` PK autoincrement | |
| `name` | `VARCHAR(150)` | From the sign-up form |
| `code` | `CHAR(2)` unique | `OI` for Odoo India — the Login ID prefix |
| `logoUrl` | `VARCHAR(255)` null | Uploaded at sign-up |
| `pfRateEmployee` | `DECIMAL(5,2)` default `12.00` | Configurable per the wireframe |
| `pfRateEmployer` | `DECIMAL(5,2)` default `12.00` | |
| `professionalTax` | `DECIMAL(10,2)` default `200.00` | Flat ₹/month |
| `createdAt` | `DATETIME` | |

Statutory rates live here because the wireframe calls them configuration, not
per-employee data. A `SalaryStructure` may override them if needed later.

### 2.2 User

Auth and identity:

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` PK | |
| `companyId` | `Int` FK → Company | Indexed |
| `loginId` | `VARCHAR(20)` unique | `OIJODO20220001` — see §4 |
| `email` | `VARCHAR(150)` unique | Work email |
| `passwordHash` | `VARCHAR(255)` | bcrypt, cost 10 |
| `role` | `ENUM('ADMIN','EMPLOYEE')` | |
| `mustChangePassword` | `BOOLEAN` default `true` | Forced first-login change |
| `isActive` | `BOOLEAN` default `true` | Soft deactivation instead of delete |

Profile header (drawn on every profile screen):

| Column | Type |
|---|---|
| `firstName`, `lastName` | `VARCHAR(80)` |
| `mobile` | `VARCHAR(20)` null |
| `avatarUrl` | `VARCHAR(255)` null |
| `jobPosition`, `department`, `location` | `VARCHAR(100)` null |
| `managerId` | `Int` null, FK → User (self) |
| `dateOfJoining` | `DATE` |
| `joiningYear`, `joiningSerial` | `Int` — components of the Login ID |

Private Info tab:

| Column | Type |
|---|---|
| `dateOfBirth` | `DATE` null |
| `nationality` | `VARCHAR(60)` null |
| `gender` | `ENUM('MALE','FEMALE','OTHER')` null |
| `maritalStatus` | `ENUM('SINGLE','MARRIED','OTHER')` null |
| `personalEmail` | `VARCHAR(150)` null |
| `residingAddress` | `TEXT` null |
| `accountNumber`, `bankName`, `ifscCode`, `panNo`, `uanNo`, `empCode` | `VARCHAR(50)` null |

Resume tab: `about`, `whatILoveAboutJob`, `interestsAndHobbies` — all `TEXT` null.

**Indexes:** `@@index([companyId])`, `@@index([companyId, role])`,
`@@unique([loginId])`, `@@unique([email])`,
`@@unique([companyId, joiningYear, joiningSerial])`.

### 2.3 Skill and Certification

Separate tables because the wireframe shows "+ Add Skills" as a repeating list.

`Skill(id, userId, name)` and `Certification(id, userId, name, issuer?, year?)`,
both indexed on `userId`, both cascade-deleting with the user.

### 2.4 SalaryStructure — one per user

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` PK | |
| `userId` | `Int` unique FK | 1:1 |
| `wageType` | `ENUM('FIXED')` | Only "Fixed wage" is specified |
| `monthlyWage` | `DECIMAL(12,2)` | Yearly is derived — never stored |
| `workingDaysPerWeek` | `Int` default `5` | |
| `breakMinutes` | `Int` default `60` | Feeds work-hour computation |
| `effectiveFrom` | `DATE` | |

`DECIMAL`, never `FLOAT` — binary floating point on money produces the kind of
₹0.01 drift that is embarrassing on a demo screen.

**Yearly wage is `monthlyWage * 12`, computed on read.** Storing it invites the
two values to disagree.

### 2.5 SalaryComponent

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` PK | |
| `salaryStructureId` | `Int` FK, indexed | |
| `name` | `VARCHAR(80)` | Basic, HRA, Standard Allowance, … |
| `computationType` | `ENUM('PERCENT','FIXED','REMAINDER')` | |
| `basis` | `ENUM('WAGE','BASIC')` null | Which figure the % applies to |
| `value` | `DECIMAL(10,4)` | Percentage or fixed amount |
| `sortOrder` | `Int` | Display and evaluation order |

**Amounts are not stored.** They are derived from `monthlyWage` and these rules
every time they are read — that is precisely what "salary component values
should auto-update when the wage amount changes" requires. Storing them creates
a second source of truth that silently goes stale.

Seeded defaults per the wireframe:

| Name | computationType | basis | value |
|---|---|---|---|
| Basic Salary | PERCENT | WAGE | 50.00 |
| House Rent Allowance | PERCENT | BASIC | 50.00 |
| Standard Allowance | PERCENT | BASIC | 16.67 |
| Performance Bonus | PERCENT | BASIC | 8.33 |
| Leave Travel Allowance | PERCENT | BASIC | 8.33 |
| Fixed Allowance | REMAINDER | — | — |

`REMAINDER` implements `wage − sum(all other components)` and is what makes the
invariant **"total of all components must not exceed the wage"** hold by
construction rather than by validation.

### 2.6 Attendance

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` PK | |
| `userId` | `Int` FK, indexed | |
| `date` | `DATE` | Local date of the check-in |
| `checkIn` | `DATETIME` null | |
| `checkOut` | `DATETIME` null | |

**`@@unique([userId, date])`** — one row per person per day. This is the
constraint that makes double check-in impossible at the database level rather
than relying on application logic.

**Work hours and extra hours are computed, not stored:**
`workMinutes = (checkOut − checkIn) − breakMinutes`, and
`extraMinutes = max(0, workMinutes − standardDayMinutes)`.
Storing them would go stale the moment `breakMinutes` changes.

`checkOut` nullable handles the "checked in, never checked out" case the
wireframe doesn't address — such a row simply has no work hours.

**Index:** `@@index([userId, date])` and `@@index([date])` — the second serves
the admin's "all employees today" view.

### 2.7 LeaveType

`LeaveType(id, companyId, name, isPaid, requiresAttachment, colorHint?)`

Seeded per the wireframe: **Paid Time off** (`isPaid=true`), **Sick Leave**
(`isPaid=true, requiresAttachment=true`), **Unpaid Leaves** (`isPaid=false`).

A table rather than an enum because HR realistically adds types, and the
`requiresAttachment` flag has to live *somewhere* — the wireframe's
"(For sick leave certificate)" note is per-type behaviour.

**Unique:** `@@unique([companyId, name])`.

### 2.8 LeaveAllocation — the balance

`LeaveAllocation(id, userId, leaveTypeId, year, allocatedDays DECIMAL(5,2))`

**`@@unique([userId, leaveTypeId, year])`.**

This is the table behind "24 Days Available" and "07 Days Available". Balance is
**never stored as a running total** — it is:

```
remaining = allocatedDays − SUM(days of APPROVED requests for that user/type/year)
```

A stored counter would need updating on approve, reject, cancel and edit, and
one missed path leaves a permanently wrong number on screen.

### 2.9 LeaveRequest

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` PK | |
| `userId` | `Int` FK, indexed | |
| `leaveTypeId` | `Int` FK | |
| `startDate`, `endDate` | `DATE` | "Validity Period" |
| `days` | `DECIMAL(5,2)` | "Allocation — 01.00 Days" |
| `remarks` | `TEXT` null | |
| `attachmentUrl` | `VARCHAR(255)` null | Sick-leave certificate |
| `status` | `ENUM('PENDING','APPROVED','REJECTED')` default `PENDING` | |
| `reviewedById` | `Int` null FK → User | |
| `reviewComment` | `TEXT` null | |
| `reviewedAt` | `DATETIME` null | |

**Indexes:** `@@index([userId, status])`, `@@index([leaveTypeId])`,
`@@index([startDate, endDate])`.

`days` is stored rather than derived from the date range because the wireframe
shows it as an editable field, and half-days (`0.50`) are representable.

### 2.10 LoginIdSequence

`LoginIdSequence(companyId, year, lastSerial)` with a composite PK on
`(companyId, year)`. See §4 for why this exists.

## 3. Derived data — the design rule

Four things the UI displays are **never columns**:

| Displayed | Derived from |
|---|---|
| Yearly wage | `monthlyWage × 12` |
| Salary component amounts | `monthlyWage` + component rules |
| Work hours / extra hours | `checkOut − checkIn − breakMinutes` |
| Leave balance remaining | `allocatedDays − approved days` |
| Card status 🟢 / ✈️ / 🟡 | today's attendance + approved leave |

The card status specifically:

```
if an APPROVED LeaveRequest covers today        → ✈️  on leave
else if an Attendance row exists for today      → 🟢  present
else                                            → 🟡  absent
```

This matches the wireframe's own wording — yellow means "has not applied time
off and is absent" — and means the icon is always correct without a nightly job
flipping statuses.

## 4. Login ID generation

Format: `OI` + `JO` + `DO` + `2022` + `0001` → **`OIJODO20220001`**
(company code, first two letters of first name, first two of last name, joining
year, 4-digit serial that **resets each year**).

The serial is the only hard part. `SELECT COUNT(*) + 1` is wrong under
concurrency — two employees created at once get the same serial. Instead:

```sql
START TRANSACTION;
INSERT INTO LoginIdSequence (companyId, year, lastSerial) VALUES (?, ?, 1)
  ON DUPLICATE KEY UPDATE lastSerial = lastSerial + 1;
SELECT lastSerial FROM LoginIdSequence WHERE companyId = ? AND year = ?;
-- build loginId, INSERT the user
COMMIT;
```

`@@unique([companyId, joiningYear, joiningSerial])` on `User` is the backstop:
even if the sequence logic were wrong, the database refuses the duplicate.

**Edge cases the format doesn't handle**, worth deciding before demo data:
single-word names (no last name), names shorter than two letters, non-ASCII
names, and more than 9,999 joiners in a year. Suggested: right-pad short names
with `X`, strip non-alphabetic characters, uppercase everything.

## 5. Referential integrity

| Relation | On delete |
|---|---|
| Company → everything | `RESTRICT` — never cascade a whole tenant away |
| User → Skill, Certification, SalaryStructure | `CASCADE` |
| User → Attendance, LeaveRequest | `RESTRICT` — history is a record; deactivate the user instead |
| SalaryStructure → SalaryComponent | `CASCADE` |
| User.managerId → User | `SET NULL` |

Employees are **deactivated (`isActive = false`), never deleted.** Attendance
and leave history must survive an employee leaving.

## 6. Migrations and seeding

- `npx prisma migrate dev --name <change>` for every schema change. Never edit
  the database by hand — the drift is invisible until it isn't.
- `prisma/seed.ts` should create: one company (`OI`), one ADMIN, ~8 EMPLOYEE
  users with varied joining years, salary structures, **30 days of attendance
  including gaps and missing check-outs**, leave allocations, and leave
  requests in all three statuses.

Seed data quality is a demo feature, not a chore. Empty tables make a finished
app look broken. The gaps and missing check-outs matter specifically because
they exercise the yellow-dot and null-checkout paths that an all-happy dataset
hides.

## 7. Connection and configuration

```
DATABASE_URL="mysql://root:<password>@localhost:3306/dayflow"
```

MySQL 8.0 runs locally as service `MYSQL80`. Use `utf8mb4` /
`utf8mb4_unicode_ci` (the default in MySQL 8) so names and the ₹ symbol behave.
Store all `DATETIME` values in UTC and format in the client — the attendance
month view is otherwise subtly wrong across a timezone change.

## 8. Known risks

1. **Timezone handling on `Attendance.date`.** The date is derived from the
   check-in instant; a late-night check-in near midnight UTC can land on the
   wrong local day. Fix by computing `date` in the company's local timezone.
2. **No holiday calendar exists** in either requirements source, so "total
   working days" can only be `workingDaysPerWeek`-based, not holiday-aware.
3. **No audit trail on salary edits**, despite an admin being able to change any
   employee's pay. Nothing in the requirements asks for one; worth adding a
   simple `SalaryChangeLog` if time permits.
4. **`REMAINDER` can go negative** if the fixed and percentage components exceed
   the wage. Validate on save and surface an error rather than displaying a
   negative allowance.

# Dayflow HRMS — Backend Architecture

Node 22 + Express 5 + Prisma + MySQL 8.

TypeScript is assumed throughout. **If plain JavaScript is chosen instead, drop
the type annotations — every structural decision below is unchanged.**

---

## 1. Folder layout

```
server/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── index.ts              # app bootstrap, listen
│   ├── app.ts                # express instance, middleware chain
│   ├── lib/
│   │   ├── prisma.ts         # single PrismaClient instance
│   │   ├── jwt.ts            # sign / verify
│   │   └── errors.ts         # AppError + error codes
│   ├── middleware/
│   │   ├── requireAuth.ts
│   │   ├── requireRole.ts
│   │   ├── validate.ts       # Zod body/query validation
│   │   └── errorHandler.ts   # terminal handler
│   ├── routes/               # thin — parse, delegate, respond
│   │   ├── auth.routes.ts
│   │   ├── employee.routes.ts
│   │   ├── attendance.routes.ts
│   │   ├── leave.routes.ts
│   │   └── salary.routes.ts
│   ├── services/             # all business logic lives here
│   │   ├── auth.service.ts
│   │   ├── loginId.service.ts
│   │   ├── employee.service.ts
│   │   ├── attendance.service.ts
│   │   ├── leave.service.ts
│   │   └── salary.service.ts
│   └── schemas/              # Zod schemas, shared with the client
└── uploads/                  # multer target, gitignored
```

**The one structural rule: routes contain no business logic.** A route parses
the request, calls one service function, and shapes the response. This keeps
the salary engine and the leave-balance maths callable and testable without an
HTTP request, which matters when the numbers are wrong at hour six.

## 2. Middleware chain

```
cors → cookieParser → express.json → [routes] → errorHandler
                                        ↑
                    requireAuth → requireRole('ADMIN') → validate(schema)
```

- **`requireAuth`** — reads the JWT from the httpOnly cookie, verifies it,
  attaches `req.user = { id, companyId, role }`. 401 on failure.
- **`requireRole(...roles)`** — runs after `requireAuth`; 403 on mismatch.
- **`validate(schema)`** — parses `req.body`/`req.query` with Zod, replacing it
  with the parsed value so handlers receive typed, coerced data.
- **`errorHandler`** — the only place that formats errors. Four arguments, so
  Express recognises it; registered last.

Every request also carries `companyId` from the token, and **every Prisma query
filters on it**. That is the single mechanism keeping tenants separate — it
must never be omitted, even while only one company exists.

## 3. Authentication

### 3.1 Flow

```
POST /api/auth/signup    → creates Company + first ADMIN user
POST /api/auth/login     → sets httpOnly cookie, returns user
POST /api/auth/logout    → clears cookie
GET  /api/auth/me        → current user (frontend bootstrap)
POST /api/auth/change-password → clears mustChangePassword
```

- Passwords hashed with **bcrypt, cost 10**.
- JWT payload: `{ sub, companyId, role }`, 8-hour expiry, signed with
  `JWT_SECRET`.
- Cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure` in production only.
  Not localStorage — a single XSS should not hand over the session.

### 3.2 Login accepts Login ID *or* email

The sign-in screen labels the field `Login Id/Email`, so the lookup is
`where: { OR: [{ loginId: input }, { email: input }] }`.

### 3.3 Forced password change

New users are created with `mustChangePassword = true` and a generated
password. After login, the flag is returned with the user; the frontend routes
to the change-password screen and **the backend rejects every other endpoint
with 403 `PASSWORD_CHANGE_REQUIRED`** while the flag is set. Enforcing it only
in the UI would make it a suggestion.

### 3.4 Employees never self-register

Per the wireframe: *"Normal user cannot register."* There is no public employee
registration endpoint. `POST /api/employees` is `ADMIN`-only and is the sole way
a user comes into existence after the initial company sign-up.

## 4. Login ID generation — `loginId.service.ts`

Produces `OIJODO20220001`. Runs **inside the same transaction** that creates the
user:

```ts
await prisma.$transaction(async (tx) => {
  const serial = await nextSerial(tx, companyId, joiningYear);
  const loginId = buildLoginId(company.code, firstName, lastName, joiningYear, serial);
  return tx.user.create({ data: { ...input, loginId, joiningSerial: serial } });
});
```

`nextSerial` uses `INSERT … ON DUPLICATE KEY UPDATE lastSerial = lastSerial + 1`
against `LoginIdSequence`, which is atomic. A `COUNT(*) + 1` approach races and
produces duplicate IDs when two employees are created together.

Normalisation before building: uppercase, strip non-alphabetic characters,
right-pad names shorter than two characters with `X`.

## 5. Salary engine — `salary.service.ts`

The most rule-dense part of the system, and a **pure function** at its core:

```ts
computeSalary(monthlyWage: Decimal, components: Component[], config: StatutoryConfig)
  → { components: {name, amount, percent}[], gross, deductions, netBeforeTax }
```

Evaluation order:

1. **Basic** — `PERCENT of WAGE` → `50,000 × 50% = 25,000`
2. **Percentage components of Basic** — HRA 50%, Standard 16.67%, Performance
   Bonus 8.33%, LTA 8.33%
3. **`REMAINDER`** (Fixed Allowance) — `wage − sum(everything above)`
4. **PF** — `basic × 12%` for employee and employer separately
5. **Professional Tax** — flat `₹200`

Invariants enforced on save: components must not exceed the wage, and
`REMAINDER` must not be negative — reject with a clear message rather than
rendering a negative allowance.

⚠️ **Two known defects in the wireframe**, both resolved in favour of the
stated rules:

- Its sample components total ₹48,750 against a ₹50,000 wage. Under the stated
  rule, Fixed Allowance is `50,000 − 45,832 = 4,168`, not the ₹2,918 drawn.
- Its annotation says "percentage of Wage", but the drawn table plainly uses
  percentages **of Basic** for everything except Basic itself.

Because amounts are never persisted (see the database README §2.5), changing a
wage recalculates everything for free — which is exactly the behaviour the
requirement asks for.

This function is the one thing worth writing **two or three assertions** for.
It is pure, it has published expected values (`25,000` / `12,500`), and it is
the hardest thing to eyeball at 3 a.m.

## 6. Attendance — `attendance.service.ts`

```
POST /api/attendance/check-in    → creates today's row (409 if it exists)
POST /api/attendance/check-out   → sets checkOut (409 if not checked in)
GET  /api/attendance/me?month=   → own month + summary tiles
GET  /api/attendance?date=       → ADMIN: all employees for a day
```

- The `@@unique([userId, date])` constraint makes double check-in a database
  error, caught and returned as 409. No read-then-write race.
- `workMinutes = (checkOut − checkIn) − breakMinutes`;
  `extraMinutes = max(0, workMinutes − standardDayMinutes)`. Both computed on
  read, never stored.
- A row with `checkIn` but no `checkOut` is valid and reports zero work hours —
  this is the "forgot to check out" case neither requirements source addresses.
- Summary tiles: `daysPresent` (rows in month), `leavesCount` (approved leave
  days in month), `totalWorkingDays` (from `workingDaysPerWeek`; **not
  holiday-aware — no holiday calendar exists in the requirements**).

### Payable days

The wireframe states attendance is the basis for payslip computation and that
unpaid leave and missing days reduce payable days. Implemented as a service
function returning the number; **no payslip document is generated** (⚠️ open
question in `ANALYSIS.md` §6).

## 7. Leave — `leave.service.ts`

```
GET  /api/leave/types
GET  /api/leave/balance          → per-type allocated / used / remaining
GET  /api/leave/requests         → own; ADMIN sees all, with search
POST /api/leave/requests         → multipart when an attachment is attached
PATCH /api/leave/requests/:id/approve
PATCH /api/leave/requests/:id/reject
```

Balance is computed, never stored:

```
remaining = allocatedDays − SUM(days WHERE status = 'APPROVED')
```

Validation on create: end ≥ start; sufficient remaining balance for paid types;
no overlap with an existing PENDING or APPROVED request; attachment present when
the type sets `requiresAttachment`.

**Approval is the only place a balance changes**, and it changes implicitly by
the request becoming `APPROVED`. There is no counter to keep in sync, so reject,
cancel and edit paths cannot corrupt it.

Approve/reject are `ADMIN`-only and record `reviewedById`, `reviewComment` and
`reviewedAt`.

## 8. Employees — `employee.service.ts`

```
GET    /api/employees            → cards: avatar, basics, derived status
GET    /api/employees/:id        → full profile (Salary Info omitted for non-admins)
POST   /api/employees            → ADMIN: create + generate Login ID & password
PATCH  /api/employees/:id        → ADMIN: any field; EMPLOYEE: own limited set
PATCH  /api/employees/:id/deactivate
```

**Field-level authorisation** matters here and is easy to get wrong. An
employee may edit only address, mobile and avatar; an admin may edit everything.
Implement as an allow-list per role applied *server-side* before the Prisma
call — never by trusting which fields the client sent.

The `GET /api/employees/:id` response omits salary entirely for non-admins.
Sending it and hiding it in the UI would leak pay data to anyone with dev tools
open.

**Derived card status** is computed in a single query per list request — fetch
today's attendance and today's approved leave for all listed users, then map —
rather than N+1 queries per card.

## 9. File uploads

Multer, disk storage into `uploads/`, filename `<uuid><ext>`, 5 MB limit,
whitelist `jpg|jpeg|png|pdf`. The stored path goes on the record; `uploads/` is
served statically and is gitignored.

Three upload sites: company logo (sign-up), avatar (profile), sick-leave
certificate (leave request).

**Validate the MIME type, not just the extension**, and never serve uploads from
a path the user controls.

## 10. Error handling

One shape, everywhere:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

| Code | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN` | 403 |
| `PASSWORD_CHANGE_REQUIRED` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` (double check-in, duplicate email) | 409 |
| `INTERNAL` | 500 |

Services throw `AppError`; `errorHandler` is the only place that formats. Prisma
errors are translated there too — `P2002` (unique violation) becomes 409, not a
500 with a stack trace.

## 11. Environment

```
DATABASE_URL=mysql://root:<password>@localhost:3306/dayflow
JWT_SECRET=<random 32+ bytes>
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
UPLOAD_DIR=./uploads
```

`.env` is gitignored; commit a `.env.example`.

## 12. Security notes

Honest about an 8-hour build:

**Done:** bcrypt hashing, httpOnly cookies, server-side role checks on every
protected route, Zod validation on all input, Prisma's parameterised queries
(no SQL injection surface), field-level edit allow-lists, salary omitted from
non-admin responses.

**Knowingly not done:** rate limiting on login, CSRF tokens (mitigated by
`sameSite: 'lax'`), password complexity rules (the PDF says "must follow
security rules" and never states them), account lockout, audit logging of salary
changes, and refresh-token rotation.

If a judge asks, these are deliberate scope cuts with known mitigations — not
oversights.

## 13. Build order

1. `prisma init`, schema, first migration, seed
2. Express skeleton, error handler, `prisma.ts`
3. Auth: signup, login, me, requireAuth, requireRole
4. Employee create with Login ID generation
5. Employee list and detail
6. Attendance check-in/out and views
7. Leave requests, balances, approvals
8. Salary engine and Salary Info endpoints
9. Uploads

Salary is eighth deliberately. It is the most specified module in the wireframe
and therefore feels central, but a demo with working auth and a broken salary
tab beats the reverse.

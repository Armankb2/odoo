import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePasswordChanged } from '../middleware/requireAuth';
import { assertCanAccessUser, requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validate';
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  updateEmployee,
} from '../services/employee.service';
import { prisma } from '../lib/prisma';
import { validation } from '../lib/errors';
import { statusForUsers } from '../services/attendance.service';

export const employeeRouter = Router();

employeeRouter.use(requireAuth, requirePasswordChanged);

/** Both roles may list — the wireframe shows the employee list as the landing
 *  page for everyone. Scoped to the caller's company. */
employeeRouter.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim();
    const employees = await prisma.user.findMany({
      where: {
        companyId: req.user!.companyId,
        isActive: true,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { loginId: { contains: search } },
                { email: { contains: search } },
                { jobPosition: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        loginId: true,
        firstName: true,
        lastName: true,
        email: true,
        jobPosition: true,
        department: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });

    // The 🟢 / ✈️ / 🟡 card indicator. Resolved for the whole list in two
    // queries by statusForUsers — deriving it per card would be an N+1 on the
    // landing page.
    const statuses = await statusForUsers(employees.map((e) => e.id));

    res.json({
      employees: employees.map((e) => ({ ...e, status: statuses.get(e.id) ?? 'absent' })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Legal for both roles, so the row-level check is what protects it: an
 * employee requesting another id is refused. Without it every salary and bank
 * detail in the company is one URL edit away.
 */
employeeRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw validation('Invalid employee id');
    assertCanAccessUser(req.user, id);
    res.json({ employee: await getEmployee(req.user!, id) });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  dateOfJoining: z.coerce.date(),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  jobPosition: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  managerId: z.number().int().optional(),
  mobile: z.string().max(20).optional(),
});

/** Admin only — this is the sole way an account comes into existence after
 *  company sign-up. */
employeeRouter.post(
  '/',
  requireRole('ADMIN'),
  validateBody(createSchema),
  async (req, res, next) => {
    try {
      const { user, tempPassword } = await createEmployee(req.user!.companyId, req.body);
      res.status(201).json({
        employee: { id: user.id, loginId: user.loginId, email: user.email, role: user.role },
        // Shown to HR once, at creation. Never retrievable again.
        tempPassword,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Coerces the wire format into what Prisma expects: `<input type="date">`
 * sends "2026-01-15", checkboxes send booleans-as-strings, and selects send
 * numeric ids as text.
 *
 * `.passthrough()` is essential — Zod strips unknown keys by default, which
 * would silently discard a disallowed field before `filterPatch` ever saw it.
 * That would turn a deliberate 403 into a quiet no-op, exactly the "returns
 * 200 and the user believes it worked" failure the policy exists to prevent.
 */
const emptyToNull = (v: unknown) => (v === '' ? null : v);

const patchSchema = z
  .object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    email: z.string().email().optional(),
    mobile: z.preprocess(emptyToNull, z.string().max(20).nullable()).optional(),
    jobPosition: z.preprocess(emptyToNull, z.string().max(100).nullable()).optional(),
    department: z.preprocess(emptyToNull, z.string().max(100).nullable()).optional(),
    location: z.preprocess(emptyToNull, z.string().max(100).nullable()).optional(),
    managerId: z.preprocess(emptyToNull, z.coerce.number().int().nullable()).optional(),
    dateOfJoining: z.coerce.date().optional(),
    dateOfBirth: z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
    nationality: z.preprocess(emptyToNull, z.string().max(60).nullable()).optional(),
    gender: z.preprocess(emptyToNull, z.enum(['MALE', 'FEMALE', 'OTHER']).nullable()).optional(),
    maritalStatus: z
      .preprocess(emptyToNull, z.enum(['SINGLE', 'MARRIED', 'OTHER']).nullable())
      .optional(),
    personalEmail: z.preprocess(emptyToNull, z.string().email().nullable()).optional(),
    residingAddress: z.preprocess(emptyToNull, z.string().nullable()).optional(),
    accountNumber: z.preprocess(emptyToNull, z.string().max(50).nullable()).optional(),
    bankName: z.preprocess(emptyToNull, z.string().max(100).nullable()).optional(),
    ifscCode: z.preprocess(emptyToNull, z.string().max(20).nullable()).optional(),
    panNo: z.preprocess(emptyToNull, z.string().max(20).nullable()).optional(),
    uanNo: z.preprocess(emptyToNull, z.string().max(30).nullable()).optional(),
    empCode: z.preprocess(emptyToNull, z.string().max(30).nullable()).optional(),
    about: z.preprocess(emptyToNull, z.string().nullable()).optional(),
    whatILoveAboutJob: z.preprocess(emptyToNull, z.string().nullable()).optional(),
    interestsAndHobbies: z.preprocess(emptyToNull, z.string().nullable()).optional(),
    role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .passthrough();

/** Field-level policy decides what actually lands — an employee patching their
 *  own salary is rejected, not silently ignored. */
employeeRouter.patch('/:id', validateBody(patchSchema), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw validation('Invalid employee id');
    assertCanAccessUser(req.user, id);
    res.json({ employee: await updateEmployee(req.user!, id, req.body) });
  } catch (err) {
    next(err);
  }
});

employeeRouter.patch('/:id/deactivate', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw validation('Invalid employee id');
    res.json(await deactivateEmployee(req.user!.companyId, id, req.user!.id));
  } catch (err) {
    next(err);
  }
});

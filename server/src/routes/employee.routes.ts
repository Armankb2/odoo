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
    res.json({ employees });
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

/** Field-level policy decides what actually lands — an employee patching their
 *  own salary is rejected, not silently ignored. */
employeeRouter.patch('/:id', async (req, res, next) => {
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
    res.json(await deactivateEmployee(req.user!.companyId, id));
  } catch (err) {
    next(err);
  }
});

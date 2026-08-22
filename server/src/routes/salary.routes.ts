import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePasswordChanged } from '../middleware/requireAuth';
import { requireRole, assertCanAccessUser } from '../middleware/requireRole';
import { validateBody } from '../middleware/validate';
import { previewSalary, salaryFor, updateSalary } from '../services/salary.service';
import { validation } from '../lib/errors';

export const salaryRouter = Router();
salaryRouter.use(requireAuth, requirePasswordChanged);

/**
 * View a salary.
 *
 * Employees may read their OWN — "Payroll data is read-only for employees"
 * (PDF §3.6.1) — and `assertCanAccessUser` refuses any other id. Admins may
 * read anyone's. Read access and write access are deliberately different
 * rules here.
 */
salaryRouter.get('/:userId', async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) throw validation('Invalid employee id');
    assertCanAccessUser(req.user, userId);
    res.json({ salary: await salaryFor(userId) });
  } catch (err) {
    next(err);
  }
});

const previewSchema = z.object({ monthlyWage: z.coerce.number().min(0) });

/**
 * Live recalculation for the wage field. Admin-only — an employee has no
 * reason to model hypothetical pay, and this is the same engine that writes.
 */
salaryRouter.post(
  '/:userId/preview',
  requireRole('ADMIN'),
  validateBody(previewSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId)) throw validation('Invalid employee id');
      res.json({ salary: await previewSalary(userId, req.body.monthlyWage) });
    } catch (err) {
      next(err);
    }
  },
);

const componentSchema = z.object({
  name: z.string().min(1).max(80),
  computationType: z.enum(['PERCENT', 'FIXED', 'REMAINDER']),
  basis: z.enum(['WAGE', 'BASIC']).nullable().optional(),
  value: z.coerce.number(),
  sortOrder: z.coerce.number().int(),
});

const updateSchema = z.object({
  monthlyWage: z.coerce.number().min(0).optional(),
  workingDaysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
  breakMinutes: z.coerce.number().int().min(0).optional(),
  components: z.array(componentSchema).optional(),
});

/** Admin-only. This is the boundary that makes employee access read-only. */
salaryRouter.patch(
  '/:userId',
  requireRole('ADMIN'),
  validateBody(updateSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId)) throw validation('Invalid employee id');
      res.json({
        salary: await updateSalary(req.user!.companyId, userId, {
          ...req.body,
          components: req.body.components?.map((c: any) => ({ ...c, basis: c.basis ?? null })),
        }),
      });
    } catch (err) {
      next(err);
    }
  },
);

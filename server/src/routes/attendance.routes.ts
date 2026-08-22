import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePasswordChanged } from '../middleware/requireAuth';
import { requireRole, assertCanAccessUser } from '../middleware/requireRole';
import { validateBody } from '../middleware/validate';
import {
  checkIn,
  checkOut,
  companyDay,
  myMonth,
  payableDays,
  todayStatus,
} from '../services/attendance.service';
import { currentMonthKey } from '../lib/dates';
import { validation } from '../lib/errors';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth, requirePasswordChanged);

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM')
  .optional();

attendanceRouter.get('/today', async (req, res, next) => {
  try {
    res.json(await todayStatus(req.user!.id));
  } catch (err) {
    next(err);
  }
});

attendanceRouter.post('/check-in', async (req, res, next) => {
  try {
    res.status(201).json(await checkIn(req.user!.id));
  } catch (err) {
    next(err);
  }
});

attendanceRouter.post('/check-out', async (req, res, next) => {
  try {
    res.json(await checkOut(req.user!.id));
  } catch (err) {
    next(err);
  }
});

/** Employee's own month — the default view per the wireframe. */
attendanceRouter.get('/me', async (req, res, next) => {
  try {
    const month = monthSchema.parse(req.query.month) ?? currentMonthKey();
    res.json(await myMonth(req.user!.id, month));
  } catch (err) {
    next(err);
  }
});

/** Any specific employee's month. Row-level guard: employees get only their own. */
attendanceRouter.get('/user/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw validation('Invalid employee id');
    assertCanAccessUser(req.user, id);
    const month = monthSchema.parse(req.query.month) ?? currentMonthKey();
    res.json(await myMonth(id, month));
  } catch (err) {
    next(err);
  }
});

/** Admin/HR: everyone, for one day. */
attendanceRouter.get('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const raw = String(req.query.date ?? '');
    const date = raw ? new Date(raw) : new Date();
    if (Number.isNaN(date.getTime())) throw validation('Invalid date');
    const search = req.query.search ? String(req.query.search) : undefined;
    res.json(await companyDay(req.user!.companyId, date, search));
  } catch (err) {
    next(err);
  }
});

/** Payable-day computation — the basis the wireframe says payslips would use. */
attendanceRouter.get('/payable/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw validation('Invalid employee id');
    assertCanAccessUser(req.user, id);
    const month = monthSchema.parse(req.query.month) ?? currentMonthKey();
    res.json(await payableDays(id, month));
  } catch (err) {
    next(err);
  }
});

export { validateBody };

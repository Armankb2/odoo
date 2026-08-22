import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePasswordChanged } from '../middleware/requireAuth';
import { requireRole, assertCanAccessUser } from '../middleware/requireRole';
import { validateBody } from '../middleware/validate';
import { upload, publicUrlFor } from '../lib/upload';
import { validation } from '../lib/errors';
import {
  approveRequest,
  balanceFor,
  cancelRequest,
  createRequest,
  listLeaveTypes,
  listRequests,
  rejectRequest,
  upsertAllocation,
} from '../services/leave.service';

export const leaveRouter = Router();
leaveRouter.use(requireAuth, requirePasswordChanged);

leaveRouter.get('/types', async (req, res, next) => {
  try {
    res.json({ types: await listLeaveTypes(req.user!.companyId) });
  } catch (err) {
    next(err);
  }
});

/** Balance tiles. Employees see their own; admins may query anyone's. */
leaveRouter.get('/balance', async (req, res, next) => {
  try {
    const id = req.query.userId ? Number(req.query.userId) : req.user!.id;
    if (!Number.isInteger(id)) throw validation('Invalid employee id');
    assertCanAccessUser(req.user, id);
    const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
    res.json({ balances: await balanceFor(id, year) });
  } catch (err) {
    next(err);
  }
});

leaveRouter.get('/requests', async (req, res, next) => {
  try {
    const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
    res.json({
      requests: await listRequests(req.user!, {
        scope: req.query.scope === 'me' ? 'me' : 'all',
        status,
        search: req.query.search ? String(req.query.search) : undefined,
      }),
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  userId: z.coerce.number().int().optional(),
  leaveTypeId: z.coerce.number().int(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  days: z.coerce.number().positive().optional(),
  remarks: z.string().max(2000).optional(),
});

/**
 * `upload.single` runs first so multipart bodies are parsed before validation;
 * a JSON body without a file passes straight through.
 */
leaveRouter.post('/requests', upload.single('attachment'), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const attachmentUrl = req.file ? publicUrlFor(req.file.filename) : undefined;
    const request = await createRequest(req.user!, { ...body, attachmentUrl });
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

const decisionSchema = z.object({ comment: z.string().max(2000).optional() });

leaveRouter.patch(
  '/requests/:id/approve',
  requireRole('ADMIN'),
  validateBody(decisionSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw validation('Invalid request id');
      res.json({ request: await approveRequest(req.user!, id, req.body.comment) });
    } catch (err) {
      next(err);
    }
  },
);

leaveRouter.patch(
  '/requests/:id/reject',
  requireRole('ADMIN'),
  validateBody(decisionSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw validation('Invalid request id');
      res.json({ request: await rejectRequest(req.user!, id, req.body.comment) });
    } catch (err) {
      next(err);
    }
  },
);

leaveRouter.delete('/requests/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw validation('Invalid request id');
    await cancelRequest(req.user!, id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const allocationSchema = z.object({
  userId: z.coerce.number().int(),
  leaveTypeId: z.coerce.number().int(),
  year: z.coerce.number().int(),
  allocatedDays: z.coerce.number().min(0),
});

leaveRouter.post(
  '/allocations',
  requireRole('ADMIN'),
  validateBody(allocationSchema),
  async (req, res, next) => {
    try {
      res.json({ allocation: await upsertAllocation(req.user!.companyId, req.body) });
    } catch (err) {
      next(err);
    }
  },
);

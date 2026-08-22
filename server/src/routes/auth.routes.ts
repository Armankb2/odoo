import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/requireAuth';
import { COOKIE_NAME, cookieOptions, signToken } from '../lib/jwt';
import { changePassword, signIn, signUpCompany } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { unauthenticated } from '../lib/errors';

export const authRouter = Router();

const signUpSchema = z.object({
  companyName: z.string().min(2).max(150),
  companyCode: z.string().length(2),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

authRouter.post('/signup', validateBody(signUpSchema), async (req, res, next) => {
  try {
    const { company, admin } = await signUpCompany(req.body);
    const token = signToken({ sub: admin.id, companyId: company.id, role: admin.role });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(201).json({
      company: { id: company.id, name: company.name, code: company.code },
      user: { id: admin.id, loginId: admin.loginId, email: admin.email, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Login ID or email is required'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const user = await signIn(req.body.identifier, req.body.password);
    const token = signToken({ sub: user.id, companyId: user.companyId, role: user.role });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({
      user: {
        id: user.id,
        loginId: user.loginId,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        loginId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        mustChangePassword: true,
        company: { select: { id: true, name: true, code: true, logoUrl: true } },
      },
    });
    if (!user) throw unauthenticated();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

authRouter.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  async (req, res, next) => {
    try {
      const result = await changePassword(
        req.user!.id,
        req.body.currentPassword,
        req.body.newPassword,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

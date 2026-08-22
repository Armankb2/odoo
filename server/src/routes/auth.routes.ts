import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/requireAuth';
import { COOKIE_NAME, cookieOptions, signToken } from '../lib/jwt';
import { changePassword, signIn, signUp } from '../services/auth.service';
import { consumeOtp, sendSignUpOtp, verifyOtp } from '../services/otp.service';
import { prisma } from '../lib/prisma';
import { unauthenticated } from '../lib/errors';

export const authRouter = Router();

/**
 * Step 1 of sign-up: email a six-digit code to the address the caller typed.
 *
 * PDF §3.1.1 requires email verification. It matters more here than it
 * normally would, because sign-up lets the caller pick the ADMIN role — at
 * least the address has to be real and theirs.
 */
const sendOtpSchema = z.object({ email: z.string().email() });

authRouter.post('/send-otp', validateBody(sendOtpSchema), async (req, res, next) => {
  try {
    const { expiresAt, delivered } = await sendSignUpOtp(req.body.email);
    // `delivered: false` means SMTP is not configured and the code was logged
    // to the server console instead. The client surfaces that so a developer
    // on a fresh clone knows where to look rather than waiting for an email
    // that will never arrive. The code itself is never in the response.
    res.json({ sent: true, delivered, expiresAt });
  } catch (err) {
    next(err);
  }
});

// Dayflow is a single company, so sign-up asks for a person, not an
// organisation. `role` is the caller's own choice — see the warning on
// `signUp()` about what that means.
const signUpSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'EMPLOYEE'], {
    errorMap: () => ({ message: 'Choose Admin or Employee' }),
  }),
  otp: z
    .string()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
});

authRouter.post('/signup', validateBody(signUpSchema), async (req, res, next) => {
  try {
    // Checked but NOT consumed yet: if account creation fails after this, the
    // caller must still be able to retry with the same code.
    const otpId = await verifyOtp(req.body.email, req.body.otp);

    const { company, user } = await signUp(req.body);
    await consumeOtp(otpId);
    const token = signToken({ sub: user.id, companyId: company.id, role: user.role });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(201).json({
      user: { id: user.id, loginId: user.loginId, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Login ID or email is required'),
  password: z.string().min(1, 'Password is required'),
  // Verified against the account, never trusted as a grant of authority.
  role: z.enum(['ADMIN', 'EMPLOYEE'], {
    errorMap: () => ({ message: 'Choose Admin or Employee' }),
  }),
});

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const user = await signIn(req.body.identifier, req.body.password, req.body.role);
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

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/requireAuth';
import { COOKIE_NAME, cookieOptions, signToken } from '../lib/jwt';
import { changePassword, signIn, signUp } from '../services/auth.service';
import { consumeOtp, maskEmail, sendLoginOtp, verifyOtp } from '../services/otp.service';
import { prisma } from '../lib/prisma';
import { unauthenticated } from '../lib/errors';

export const authRouter = Router();

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
});

authRouter.post('/signup', validateBody(signUpSchema), async (req, res, next) => {
  try {
    const { company, user } = await signUp(req.body);
    const token = signToken({ sub: user.id, companyId: company.id, role: user.role });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(201).json({
      user: { id: user.id, loginId: user.loginId, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

const credentialsSchema = z.object({
  identifier: z.string().min(1, 'Login ID or email is required'),
  password: z.string().min(1, 'Password is required'),
  // Verified against the account, never trusted as a grant of authority.
  role: z.enum(['ADMIN', 'EMPLOYEE'], {
    errorMap: () => ({ message: 'Choose Admin or Employee' }),
  }),
});

/**
 * Step 1 of sign-in: prove the password, then mail a six-digit code to the
 * address on the account (PDF §3.1.1).
 *
 * `signIn` runs first on purpose. Issuing a code to anyone who names an
 * address would turn this endpoint into a mailbomb relay and would confirm
 * which accounts exist; behind the password it does neither. The address is
 * returned masked so you can tell which mailbox to open without the endpoint
 * handing out a full address.
 */
authRouter.post('/send-otp', validateBody(credentialsSchema), async (req, res, next) => {
  try {
    const user = await signIn(req.body.identifier, req.body.password, req.body.role);
    const { expiresAt, delivered } = await sendLoginOtp(user.email);
    // `delivered: false` means SMTP is not configured and the code went to the
    // server console instead. Surfaced so nobody waits on an email that is
    // never coming. The code itself is never in the response.
    res.json({ sent: true, delivered, expiresAt, sentTo: maskEmail(user.email) });
  } catch (err) {
    next(err);
  }
});

const loginSchema = credentialsSchema.extend({
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
});

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    // The password is re-checked here rather than trusted from step 1: that
    // step issued no token, so nothing carries between the two requests.
    const user = await signIn(req.body.identifier, req.body.password, req.body.role);

    // Keyed on the account's own address, not anything the caller sent, so a
    // code mailed to one account cannot be replayed against another.
    const otpId = await verifyOtp(user.email, req.body.otp);
    await consumeOtp(otpId);

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

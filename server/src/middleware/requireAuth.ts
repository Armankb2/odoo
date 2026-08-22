import type { NextFunction, Request, Response } from 'express';
import { AppError, unauthenticated } from '../lib/errors';
import { COOKIE_NAME, verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: number;
        companyId: number;
        role: 'ADMIN' | 'EMPLOYEE';
        mustChangePassword: boolean;
      };
    }
  }
}

/**
 * Verifies the session cookie and loads the current user.
 *
 * The token is re-checked against the database on every request rather than
 * trusted wholesale. A token stays valid for 8 hours, so without this a
 * deactivated employee — or one whose role was just changed — would keep their
 * old access until it expired.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw unauthenticated();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw unauthenticated('Session expired or invalid');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, companyId: true, role: true, isActive: true, mustChangePassword: true },
    });

    if (!user) throw unauthenticated('Account no longer exists');
    if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated');

    req.user = {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Blocks every route while a generated password is still in place.
 *
 * Enforced server-side deliberately: doing it only in the UI would make a
 * security requirement a suggestion, since the API is reachable directly.
 * Mounted globally and opted out of by the handful of routes below.
 */
const PASSWORD_CHANGE_EXEMPT = new Set([
  'POST /api/auth/change-password',
  'POST /api/auth/logout',
  'GET /api/auth/me',
]);

export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  const key = `${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, '');
  if (req.user?.mustChangePassword && !PASSWORD_CHANGE_EXEMPT.has(key)) {
    return next(
      new AppError('PASSWORD_CHANGE_REQUIRED', 'You must change your password before continuing'),
    );
  }
  next();
}

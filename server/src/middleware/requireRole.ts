import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthenticated } from '../lib/errors';

/**
 * Route-level role gate. Always mounted *after* requireAuth — it reads
 * req.user and has no way to authenticate on its own.
 *
 *   router.post('/', requireAuth, requireRole('ADMIN'), createEmployee)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthenticated());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Your role does not have access to this resource'));
    }
    next();
  };
}

/**
 * Row-level gate: an employee may only reach their own record, an admin may
 * reach anyone's.
 *
 * This is the check that route-level roles cannot express. `GET
 * /api/employees/:id` is legal for both roles, but an employee requesting
 * someone else's id must be refused — otherwise every salary and bank detail
 * in the company is one URL edit away.
 */
export function canAccessUser(
  actor: { id: number; role: Role },
  targetUserId: number,
): boolean {
  return actor.role === 'ADMIN' || actor.id === targetUserId;
}

export function assertCanAccessUser(
  actor: { id: number; role: Role } | undefined,
  targetUserId: number,
): void {
  if (!actor) throw unauthenticated();
  if (!canAccessUser(actor, targetUserId)) {
    throw forbidden('You can only access your own record');
  }
}

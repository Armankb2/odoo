import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

export interface TokenPayload {
  sub: number;
  companyId: number;
  role: Role;
}

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  // Fail at boot rather than signing every token with `undefined`, which
  // jsonwebtoken would happily accept in some configurations.
  throw new Error('JWT_SECRET is not set — copy .env.example to .env');
}

export const COOKIE_NAME = 'dayflow_token';
const EXPIRY = '8h';

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET as string) as unknown as TokenPayload;
}

/**
 * httpOnly so a single XSS cannot lift the session; sameSite 'lax' blunts CSRF
 * without breaking the normal navigation flow; secure only in production so
 * plain-http localhost still works in development.
 */
export function cookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

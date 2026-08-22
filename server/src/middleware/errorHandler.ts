import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

/**
 * Names the field(s) behind a P2002 unique-constraint violation.
 *
 * The shape is provider-dependent and this is a real trap: on PostgreSQL
 * `meta.target` is a string[], but on **MySQL it is a plain string** holding
 * the index name (e.g. "User_email_key"). Assuming the array shape throws
 * `target.join is not a function` inside the error handler itself, which makes
 * Express fall back to its default handler and return an HTML stack trace.
 */
function uniqueTargetName(target: unknown): string {
  if (Array.isArray(target)) return target.join(', ');
  if (typeof target === 'string') {
    // "User_email_key" / "User_loginId_key" → "email" / "loginId"
    const m = /^[A-Za-z]+_(.+)_key$/.exec(target);
    return m ? m[1] : target;
  }
  return 'value';
}

/**
 * The only place in the codebase that formats an error response.
 * Must be registered last, and must take four arguments or Express will treat
 * it as ordinary middleware and never call it.
 *
 * The whole body is wrapped: if the handler itself throws, Express's default
 * handler takes over and returns an HTML page containing a full stack trace —
 * paths, line numbers and all — to the client.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  try {
    return formatError(err, res);
  } catch (handlerErr) {
    console.error('[errorHandler failed]', handlerErr, '\noriginal:', err);
    if (res.headersSent) return next(err);
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  }
}

function formatError(err: unknown, res: Response) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      },
    });
  }

  // Translate Prisma's error codes here rather than leaking a 500 with a stack
  // trace for what is really a user-facing conflict.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: `That ${uniqueTargetName(err.meta?.target)} is already in use` },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'Related record is missing or still in use' },
      });
    }
  }

  console.error('[unhandled]', err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong' },
  });
}

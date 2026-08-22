/**
 * One error shape for the whole API. Services throw AppError; only the
 * errorHandler middleware formats it. Nothing else should build an error body.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'ACCOUNT_INACTIVE'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  ACCOUNT_INACTIVE: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const unauthenticated = (m = 'Not signed in') => new AppError('UNAUTHENTICATED', m);
export const forbidden = (m = 'Not allowed') => new AppError('FORBIDDEN', m);
export const notFound = (m = 'Not found') => new AppError('NOT_FOUND', m);
export const conflict = (m: string) => new AppError('CONFLICT', m);
export const validation = (m: string, details?: unknown) =>
  new AppError('VALIDATION_ERROR', m, details);

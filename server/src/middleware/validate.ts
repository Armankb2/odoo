import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject } from 'zod';

/**
 * Parses and *replaces* the request body with the validated value, so handlers
 * receive coerced, typed data rather than whatever arrived on the wire.
 * ZodErrors are formatted by errorHandler.
 */
export const validateBody =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };

export const validateQuery =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      Object.assign(req.query, schema.parse(req.query));
      next();
    } catch (err) {
      next(err);
    }
  };

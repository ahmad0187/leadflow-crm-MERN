import mongoose from 'mongoose';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Parses `req.body` with a zod schema and replaces it with the clean result. */
export const validate = (schema, where = 'body') => (req, _res, next) => {
  const parsed = schema.safeParse(req[where]);
  if (!parsed.success) return next(parsed.error);
  req[where === 'body' ? 'body' : 'validQuery'] = parsed.data;
  next();
};

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Please check the highlighted fields', fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'Not found' });
  if (err?.code === 11000) return res.status(409).json({ error: 'That email is already in use' });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

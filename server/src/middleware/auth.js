import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError } from './error.js';

export const COOKIE = 'leadflow_token';

export function issueToken(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 3600 * 1000,
  });
  return token;
}

/** Accepts the httpOnly cookie (browser) or an `Authorization: Bearer` header (API clients). */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const token = req.cookies?.[COOKIE] || header;
    if (!token) throw new HttpError(401, 'Please sign in');
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'Please sign in');
    req.user = user;
    next();
  } catch (err) {
    next(err instanceof HttpError ? err : new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
}

export function requireRole(role) {
  return (req, _res, next) => (req.user?.role === role ? next() : next(new HttpError(403, 'You do not have permission to do that')));
}

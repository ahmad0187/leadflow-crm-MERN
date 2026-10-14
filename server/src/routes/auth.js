import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { COOKIE, issueToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, validate } from '../middleware/error.js';
import { User } from '../models/User.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });

const Register = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
});
const Login = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

router.post('/register', limiter, validate(Register), asyncHandler(async (req, res) => {
  if (!config.allowRegistration) throw new HttpError(403, 'Registration is closed. Ask an admin to invite you.');
  const isFirst = (await User.estimatedDocumentCount()) === 0;
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash: await User.hashPassword(req.body.password),
    role: isFirst ? 'admin' : 'rep',
  });
  issueToken(res, user);
  res.status(201).json({ user });
}));

router.post('/login', limiter, validate(Login), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await user.checkPassword(req.body.password))) throw new HttpError(401, 'Wrong email or password');
  const token = issueToken(res, user);
  res.json({ user, token });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;

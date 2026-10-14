import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './middleware/auth.js';
import { asyncHandler, errorHandler, notFound } from './middleware/error.js';
import { User } from './models/User.js';
import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import { pipelineStats } from './services/stats.js';

const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
      },
    },
  }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true, ai: process.env.ANTHROPIC_API_KEY ? 'claude' : 'rules' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/leads', requireAuth, leadRoutes);
  app.get('/api/stats', requireAuth, asyncHandler(async (_req, res) => res.json(await pipelineStats())));
  app.get('/api/users', requireAuth, asyncHandler(async (_req, res) => res.json({ users: await User.find().sort({ name: 1 }) })));
  app.use('/api', notFound);

  // In production the API also serves the built React app.
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

// server/routes/health.routes.ts
import { Router }     from 'express';
import { asyncHandler } from '../lib/errors';
import { getSettings }  from '../lib/settings';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(async (_req, res) => {
  const s = getSettings();
  res.json({
    status:   'ok',
    name:     s.server.name,
    version:  s.server.version,
    build:    s.server.build,
    locale:   s.server.locale,
    env:      s.server.environment,
    uptime:   process.uptime(),
    timestamp: new Date().toISOString(),
  });
}));

healthRouter.get('/ping', (_req, res) => {
  res.json({ pong: true, ts: Date.now() });
});

healthRouter.get('/version', (_req, res) => {
  const s = getSettings();
  res.json({ version: s.server.version, build: s.server.build });
});
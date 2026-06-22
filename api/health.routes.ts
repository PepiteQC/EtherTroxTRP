// server/api/health.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createHealthRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const uptime  = Date.now() - ctx.SERVER_START;
    const minutes = Math.floor(uptime / 60000);

    res.json({
      ok:          true,
      status:      'online',
      uptime:      `${minutes}m`,
      uptimeMs:    uptime,
      players:     ctx.gateway.getPlayerCount(),
      world:       ctx.worldState.serialize(),
      timestamp:   Date.now(),
    });
  });

  return router;
}
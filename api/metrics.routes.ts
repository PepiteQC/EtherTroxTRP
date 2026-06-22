// server/api/metrics.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createMetricsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok:          true,
      players:     ctx.gateway.getPlayerCount(),
      entities:    ctx.entityManager.count?.() ?? 0,
      uptime:      Date.now() - ctx.SERVER_START,
      worldState:  ctx.worldState.serialize(),
      timestamp:   Date.now(),
    });
  });

  return router;
}
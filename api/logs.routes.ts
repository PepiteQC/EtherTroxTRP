// server/api/logs.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createLogsRouter(_ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok:      true,
      message: 'Logs disponibles via pino — voir fichier logs/server.log',
    });
  });

  return router;
}
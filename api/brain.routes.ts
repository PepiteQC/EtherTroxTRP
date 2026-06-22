// server/api/brain.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createBrainRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    if (!ctx.brain) {
      return res.json({ ok: true, active: false });
    }
    res.json({
      ok:     true,
      active: true,
      status: ctx.brain.getStatus?.() ?? 'running',
    });
  });

  router.get('/thirdeye', (_req, res) => {
    if (!ctx.thirdEye) {
      return res.json({ ok: true, active: false });
    }
    res.json({
      ok:      true,
      active:  true,
      metrics: ctx.thirdEye.getMetrics?.() ?? {},
    });
  });

  router.post('/task', async (req, res) => {
    if (!ctx.brain) {
      return res.status(503).json({ ok: false, error: 'Brain inactif' });
    }
    try {
      const result = await ctx.brain.processTask?.(req.body);
      res.json({ ok: true, result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
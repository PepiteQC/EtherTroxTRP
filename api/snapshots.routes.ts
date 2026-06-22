// server/api/snapshots.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createSnapshotsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ ok: true, snapshots: ctx.snapshotter.list?.() ?? [] });
  });

  router.post('/create', (req, res) => {
    const label = req.body.label ?? 'manual';
    const snap  = ctx.snapshotter.create('manual', label);
    res.json({ ok: true, snapshot: snap });
  });

  router.post('/restore/:id', (req, res) => {
    const { id } = req.params;
    const success = ctx.snapshotter.restore?.(id);
    res.json({ ok: !!success, id });
  });

  return router;
}
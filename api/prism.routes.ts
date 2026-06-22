// server/api/prism.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createPrismRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/tables', (_req, res) => {
    try {
      const stats = ctx.db.getStats();
      res.json({ ok: true, stats });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get('/query', (req, res) => {
    const { table } = req.query;
    if (!table || typeof table !== 'string') {
      return res.status(400).json({ ok: false, error: 'table requis' });
    }
    try {
      const rows = ctx.db.getTable?.(table) ?? [];
      res.json({ ok: true, table, rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
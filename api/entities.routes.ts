// server/api/entities.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createEntitiesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok:       true,
      entities: ctx.entityManager.serializeAll?.() ?? [],
    });
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    ctx.entityManager.remove?.(id);
    res.json({ ok: true, removed: id });
  });

  return router;
}
// server/api/world.admin.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createWorldAdminRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/state', (_req, res) => {
    res.json({ ok: true, state: ctx.worldState.serialize() });
  });

  router.post('/weather', (req, res) => {
    const { weather } = req.body;
    ctx.worldState.setWeather?.(weather);
    ctx.bus.emit('world:weather:change', { weather });
    res.json({ ok: true, weather });
  });

  router.post('/time', (req, res) => {
    const { timeOfDay } = req.body;
    ctx.worldState.setTimeOfDay?.(timeOfDay);
    res.json({ ok: true, timeOfDay });
  });

  return router;
}
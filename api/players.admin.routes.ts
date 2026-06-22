// server/api/players.admin.routes.ts
import { Router }          from 'express';
import type { AppContext } from '../types/context.js';

export function createPlayersAdminRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok:      true,
      count:   ctx.gateway.getPlayerCount(),
      players: ctx.gateway.getPlayers?.() ?? [],
    });
  });

  router.post('/kick/:playerId', (req, res) => {
    const { playerId } = req.params;
    ctx.gateway.kick?.(playerId, 'Kicked by admin');
    res.json({ ok: true, kicked: playerId });
  });

  return router;
}
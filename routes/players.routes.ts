// server/routes/players.routes.ts
import { Router } from 'express';
import { asyncHandler, NotFoundError, ValidationError } from '../lib/errors';
import { getGateway } from '../network/WebSocketGateway';
import { getLogger }  from '../lib/logger';

export const playersRouter = Router();

// ── Liste ──
playersRouter.get('/', asyncHandler(async (_req, res) => {
  const gateway = getGateway();
  const players = gateway.getPlayers().map(p => ({
    id:       p.id,
    name:     p.state.name,
    color:    p.state.color,
    position: p.state.position,
    health:   p.state.health,
    ping:     p.pingMs,
    isAdmin:  p.isAdmin,
    joinedAt: p.state.joinedAt,
    playtime: Math.floor((Date.now() - p.state.joinedAt) / 1000),
  }));
  res.json({ players, count: players.length });
}));

// ── Kick ──
playersRouter.post('/:id/kick', asyncHandler(async (req, res) => {
  const gateway = getGateway();
  const reason  = req.body.reason ?? 'Kicked by admin';
  if (!gateway.kickPlayer(req.params.id, reason)) {
    throw new NotFoundError(`Joueur ${req.params.id}`);
  }
  getLogger().warn('admin:kick', `Kicked: ${req.params.id}`, { reason });
  res.json({ success: true, message: `${req.params.id} expulsé` });
}));

// ── Téléporter ──
playersRouter.post('/:id/teleport', asyncHandler(async (req, res) => {
  const { position } = req.body;
  if (!Array.isArray(position) || position.length !== 3 || position.some(isNaN)) {
    throw new ValidationError('position doit être [x, y, z] valide');
  }
  const gateway = getGateway();
  if (!gateway.getPlayer(req.params.id)) throw new NotFoundError(`Joueur ${req.params.id}`);
  gateway.teleportPlayer(req.params.id, position as [number, number, number]);
  res.json({ success: true });
}));

// ── SetAdmin ──
playersRouter.post('/:id/admin', asyncHandler(async (req, res) => {
  const gateway = getGateway();
  if (!gateway.getPlayer(req.params.id)) throw new NotFoundError(`Joueur ${req.params.id}`);
  gateway.setPlayerAdmin(req.params.id, !!req.body.isAdmin);
  getLogger().warn('admin:setadmin', `${req.params.id} → admin: ${req.body.isAdmin}`);
  res.json({ success: true });
}));
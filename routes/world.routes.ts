// server/routes/world.routes.ts
import { Router }     from 'express';
import { asyncHandler, ValidationError } from '../lib/errors';
import { getWorldState }  from '../engine/WorldStateManager';
import { getPhysicsWorld } from '../engine/PhysicsWorld';
import { getGateway }     from '../network/WebSocketGateway';
import { getLogger }      from '../lib/logger';
import { createPacket }   from '../../shared/utils';
import { getSettings }    from '../lib/settings';

// World Registry (catalogue assets)
import { worldRegistryRouter } from '../modules/TroxTMod/world-registry';

export const worldRouter = Router();

// ── Monter le catalogue ──
worldRouter.use('/', worldRegistryRouter);

// ── État du monde ──
worldRouter.get('/state', asyncHandler(async (_req, res) => {
  res.json(getWorldState().serializeExtended());
}));

// ── Modifier ──
worldRouter.patch('/state', asyncHandler(async (req, res) => {
  const { timeOfDay, weather, serverStatus, gravity } = req.body;
  const wState  = getWorldState();
  const physics = getPhysicsWorld();
  const gateway = getGateway();
  const settings = getSettings();
  const logger  = getLogger();

  if (timeOfDay !== undefined) {
    if (timeOfDay < 0 || timeOfDay > 23) throw new ValidationError('timeOfDay doit être entre 0 et 23');
    wState.setTimeOfDay(timeOfDay);
  }

  if (weather !== undefined) {
    const allowed = settings.world?.allowedWeathers ?? ['clear', 'rain', 'snow', 'fog', 'storm'];
    if (!allowed.includes(weather)) {
      throw new ValidationError(`Météo non autorisée: ${weather}`, { allowed });
    }
    wState.setWeather(weather);
    gateway.broadcast(createPacket('WORLD_STATE', { state: wState.serializeExtended() }));
  }

  if (serverStatus !== undefined) wState.setServerStatus(serverStatus);

  if (gravity !== undefined) {
    if (typeof gravity !== 'number') throw new ValidationError('gravity doit être un nombre');
    wState.setGravity(gravity);
    physics.setGravity(-Math.abs(gravity));
  }

  logger.info('admin:world', 'World state updated', req.body);
  res.json({ success: true, state: wState.serialize() });
}));
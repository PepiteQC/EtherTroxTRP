// server/routes/game.routes.ts
// ============================================================
//  /api/game — Game world REST routes
//  Injection propre via middleware, types dans shared/
// ============================================================

import { Router }      from 'express';
import { asyncHandler, AppError } from '../lib/errors.js';
import type { GameWorld }  from '../engine/GameWorld.js';
import type { EntityType } from '../../shared/types/server.types.js';
import type { Request, Response, NextFunction } from 'express';

// ── Augmentation (une seule fois dans ce fichier) ─────────────
declare global {
  namespace Express {
    interface Request {
      gameWorld: GameWorld;
    }
  }
}

// ── Middleware d'injection ────────────────────────────────────
export function injectGameWorld(world: GameWorld) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.gameWorld = world;
    next();
  };
}

// ── Router factory ────────────────────────────────────────────
export function createGameRouter(world: GameWorld): Router {
  const router = Router();

  router.use(injectGameWorld(world));

  // ── GET /api/game/state ─────────────────────────────────
  router.get('/state', asyncHandler(async (req, res) => {
    res.json({ ok: true, data: req.gameWorld.getState() });
  }));

  // ── GET /api/game/metrics ───────────────────────────────
  router.get('/metrics', asyncHandler(async (req, res) => {
    res.json({
      ok:   true,
      data: {
        entityCount: req.gameWorld.getEntityCount(),
        timeOfDay:   req.gameWorld.getTimeOfDay(),
        weather:     req.gameWorld.getWeather(),
        scene:       req.gameWorld.getScene(),
        tick:        req.gameWorld.getState().tick,
        uptime:      process.uptime(),
        memoryMb:    Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  }));

  // ── GET /api/game/entities ──────────────────────────────
  router.get('/entities', asyncHandler(async (req, res) => {
    const type = req.query['type'] as EntityType | undefined;
    const tag  = req.query['tag']  as string      | undefined;

    const entities = req.gameWorld.findEntities({
      type,
      tags: tag ? [tag] : undefined,
    });

    res.json({ ok: true, data: { entities, count: entities.length } });
  }));

  // ── POST /api/game/entity ───────────────────────────────
  router.post('/entity', asyncHandler(async (req, res) => {
    const body = req.body as Partial<{
      type:       EntityType;
      name:       string;
      position:   { x: number; y: number; z: number };
      tags:       string[];
      properties: Record<string, unknown>;
    }>;

    if (!body.type) throw AppError.badRequest('body.type requis');
    if (!body.name) throw AppError.badRequest('body.name requis');

    const entity = req.gameWorld.registerEntity({
      type:       body.type,
      name:       body.name,
      position:   body.position   ?? { x: 0, y: 0, z: 0 },
      tags:       body.tags       ?? [],
      properties: body.properties ?? {},
    });

    res.status(201).json({ ok: true, data: entity });
  }));

  // ── DELETE /api/game/entity/:id ─────────────────────────
  router.delete('/entity/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw AppError.badRequest('id requis');

    const removed = req.gameWorld.removeEntity(id);
    if (!removed) throw AppError.notFound(`Entité ${id} introuvable`);

    res.json({ ok: true, data: { id, removed: true } });
  }));

  // ── POST /api/game/action ───────────────────────────────
  router.post('/action', asyncHandler(async (req, res) => {
    const action = req.body as Record<string, unknown>;

    if (!action['type'] || typeof action['type'] !== 'string') {
      throw AppError.badRequest('body.type requis (string)');
    }

    const result = req.gameWorld.applyAction(action as any);
    res.status(result.ok ? 200 : 422).json(result);
  }));

  return router;
}
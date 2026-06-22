// server/routes/entities.routes.ts
// ============================================================
//  ENTITIES ROUTES — Props, NPCs, Véhicules, Outils
// ============================================================

import { Router } from 'express';
import { asyncHandler, NotFoundError, ValidationError } from '../lib/errors.js';
import { getEntityManager } from '../engine/EntityManager.js';
import { getGateway }       from '../network/WebSocketGateway.js';
import { getModuleLoader }  from '../modules/ModuleLoader.js';
import { getLogger }        from '../lib/logger.js';
import { createPacket }     from '../../shared/utils.js';
import { getSettings }      from '../lib/settings.js';

export const entitiesRouter = Router();

// ── Liste toutes les entités ──────────────────────────────
entitiesRouter.get('/', asyncHandler(async (req, res) => {
  const em      = getEntityManager();
  const type    = req.query.type    as string | undefined;
  const ownerId = req.query.ownerId as string | undefined;
  const tag     = req.query.tag     as string | undefined;
  const limit   = Math.min(parseInt(req.query.limit as string) || 500, 2000);

  let entities = type
    ? em.getByType(type as any)
    : em.getAll();

  if (ownerId) {
    entities = entities.filter((e: any) =>
      e.getProperty?.('ownerId') === ownerId ||
      e.state?.ownerId === ownerId
    );
  }

  if (tag) {
    entities = entities.filter((e: any) =>
      e.tags?.includes(tag) || e.state?.tags?.includes(tag)
    );
  }

  const serialized = entities
    .slice(0, limit)
    .map((e: any) => e.serialize?.() ?? e);

  res.json({
    entities: serialized,
    count:    serialized.length,
    total:    em.getAll().length,
    stats:    em.getStats(),
  });
}));

// ── Stats ─────────────────────────────────────────────────
entitiesRouter.get('/stats', asyncHandler(async (_req, res) => {
  const em = getEntityManager();
  res.json(em.getStats());
}));

// ── Catalogue d'entités spawnable ─────────────────────────
entitiesRouter.get('/catalog', asyncHandler(async (_req, res) => {
  const ml       = getModuleLoader();
  const settings = getSettings();

  const all      = ml.listEntities();
  const enabled  = (settings.categories ?? [])
    .filter((c: any) => c.enabled)
    .map((c: any) => c.id);

  const catalog = all.map((e: any) => ({
    ...e,
    available: enabled.some((cat: string) =>
      e.id?.startsWith(cat) || e.category === cat
    ),
  }));

  res.json({
    catalog,
    count:      catalog.length,
    categories: settings.categories ?? [],
  });
}));

// ── Plateformes ───────────────────────────────────────────
entitiesRouter.get('/platforms', asyncHandler(async (_req, res) => {
  const em    = getEntityManager();
  const props = em.getByType('prop');

  res.json({
    platforms:   props.map((e: any) => e.serialize?.() ?? e),
    count:       props.length,
    playerCount: getGateway().getPlayerCount(),
  });
}));

// ── Générer plateformes ───────────────────────────────────
entitiesRouter.post('/platforms/generate', asyncHandler(async (req, res) => {
  const em      = getEntityManager();
  const gateway = getGateway();
  const seed    = req.body.seed ?? Math.floor(Math.random() * 100_000);

  const existing = em.getByType('prop');
  existing.forEach((e: any) => em.remove(e.id));

  gateway.broadcast(createPacket('WORLD_RESET', { entities: [] }));

  getLogger().info('entities.generate', `Seed=${seed}`);

  res.json({
    success: true,
    seed,
    cleared: existing.length,
    count:   0,
  });
}));

// ── Une entité par ID ─────────────────────────────────────
entitiesRouter.get('/:id', asyncHandler(async (req, res) => {
  const em     = getEntityManager();
  const entity = em.getById(req.params.id);

  if (!entity) throw new NotFoundError(`Entité ${req.params.id}`);

  res.json({
    success: true,
    entity:  entity.serialize?.() ?? entity,
  });
}));

// ── Spawn une entité ──────────────────────────────────────
entitiesRouter.post('/spawn', asyncHandler(async (req, res) => {
  const { modelId, position, rotation, ownerId } = req.body;

  if (!modelId) throw new ValidationError('modelId requis');
  if (!position || !Array.isArray(position) || position.length !== 3) {
    throw new ValidationError('position [x, y, z] requis');
  }

  const ml       = getModuleLoader();
  const settings = getSettings();
  const gateway  = getGateway();

  const def = ml.getEntity(modelId);
  if (!def) throw new NotFoundError(`Entité: ${modelId}`);

  const category = modelId.split('_')[0];
  const catDef   = (settings.categories ?? []).find((c: any) => c.id === category);
  if (catDef && !catDef.enabled) {
    throw new ValidationError(`Catégorie désactivée: ${catDef.label}`);
  }

  gateway.broadcast(createPacket('ENTITY_SPAWN', {
    modelId,
    position,
    rotation:   rotation ?? [0, 0, 0],
    ownerId:    ownerId  ?? 'server',
    definition: def,
  }));

  getLogger().info('entity.spawn', `Spawn: ${modelId}`);

  res.status(201).json({
    success: true,
    modelId,
    position,
    definition: def,
  });
}));

// ── Supprimer une entité ──────────────────────────────────
entitiesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const em = getEntityManager();
  const ok = em.remove(req.params.id);

  if (!ok) throw new NotFoundError(`Entité ${req.params.id}`);

  getGateway().broadcast(
    createPacket('ENTITY_REMOVE', { entityId: req.params.id })
  );

  res.json({ success: true, id: req.params.id });
}));

// ── Supprimer tous les props d'un joueur ─────────────────
entitiesRouter.delete('/owner/:playerId', asyncHandler(async (req, res) => {
  const em      = getEntityManager();
  const gateway = getGateway();

  const owned = em.getAll().filter((e: any) =>
    e.getProperty?.('ownerId') === req.params.playerId ||
    e.state?.ownerId === req.params.playerId
  );

  let removed = 0;
  for (const entity of owned) {
    if (em.remove(entity.id)) {
      gateway.broadcast(createPacket('ENTITY_REMOVE', { entityId: entity.id }));
      removed++;
    }
  }

  res.json({ success: true, removed, playerId: req.params.playerId });
}));

// ── Clear all ─────────────────────────────────────────────
entitiesRouter.delete('/clear/all', asyncHandler(async (req, res) => {
  const em      = getEntityManager();
  const gateway = getGateway();
  const type    = req.query.type as string | undefined;

  const targets = type ? em.getByType(type as any) : em.getByType('prop');
  let   cleared = 0;

  for (const entity of targets) {
    if (em.remove(entity.id)) cleared++;
  }

  gateway.broadcast(createPacket('WORLD_RESET', { entities: [] }));

  res.json({ success: true, cleared });
}));
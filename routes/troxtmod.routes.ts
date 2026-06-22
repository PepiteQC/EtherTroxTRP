// server/routes/troxtmod.routes.ts
// ============================================================
//  TROXTMOD ROUTES — Module TroxT RP complet
//  Props · NPCs · Véhicules · Outils · Effets · Économie
// ============================================================

import { Router } from 'express';
import { asyncHandler, NotFoundError, ValidationError } from '../lib/errors.js';
import { getModuleLoader }  from '../modules/ModuleLoader.js';
import { getEntityManager } from '../engine/EntityManager.js';
import { getGateway }       from '../network/WebSocketGateway.js';
import { getSettings }      from '../lib/settings.js';
import { getLogger }        from '../lib/logger.js';
import { createPacket }     from '../../shared/utils.js';
import { getDatabase }      from '../persistence/DatabaseAdapter.js';

export const troxtmodRouter = Router();

// ── Status ────────────────────────────────────────────────
troxtmodRouter.get('/status', asyncHandler(async (_req, res) => {
  const ml = getModuleLoader();
  res.json({
    success: true,
    status:  'active',
    name:    'TroxTMod',
    version: '5.0.0',
    stats:   ml.getStats(),
    modules: ml.listModules(),
  });
}));

// ── Catalogue complet ─────────────────────────────────────
troxtmodRouter.get('/catalog', asyncHandler(async (_req, res) => {
  const ml       = getModuleLoader();
  const settings = getSettings();

  res.json({
    success:    true,
    entities:   ml.listEntities(),
    tools:      ml.listTools(),
    modules:    ml.listModules(),
    categories: settings.categories ?? [],
    stats:      ml.getStats(),
  });
}));

// ── Props ─────────────────────────────────────────────────
troxtmodRouter.get('/props', asyncHandler(async (req, res) => {
  const ml       = getModuleLoader();
  const settings = getSettings();
  const category = req.query.category as string | undefined;

  let all = ml.listEntities().filter((e: any) =>
    e.category === 'prop' || e.type === 'prop' || e.id?.startsWith('prop_')
  );

  if (category) {
    all = all.filter((e: any) =>
      e.subCategory === category || e.id?.startsWith(category)
    );
  }

  const result = all.map((e: any) => ({
    ...e,
    available: (settings.categories ?? []).some(
      (c: any) => c.enabled && (e.id?.startsWith(c.id) || e.category === c.id)
    ),
  }));

  res.json({ success: true, props: result, count: result.length });
}));

// ── NPCs ──────────────────────────────────────────────────
troxtmodRouter.get('/npcs', asyncHandler(async (_req, res) => {
  const ml  = getModuleLoader();
  const all = ml.listEntities().filter((e: any) =>
    e.category === 'npc' || e.type === 'npc'
  );
  res.json({ success: true, npcs: all, count: all.length });
}));

troxtmodRouter.post('/npcs/spawn', asyncHandler(async (req, res) => {
  const { modelId, position, rotation, name } = req.body;

  if (!modelId)  throw new ValidationError('modelId requis');
  if (!position) throw new ValidationError('position [x,y,z] requis');

  const ml  = getModuleLoader();
  const def = ml.getEntity(modelId);
  if (!def) throw new NotFoundError(`NPC: ${modelId}`);

  getGateway().broadcast(createPacket('ENTITY_SPAWN', {
    modelId,
    position,
    rotation:   rotation ?? [0, 0, 0],
    name:       name     ?? def.name ?? modelId,
    type:       'npc',
    definition: def,
    ownerId:    'server',
  }));

  getLogger().info('npc.spawn', `${modelId} @ ${JSON.stringify(position)}`);
  res.status(201).json({ success: true, modelId, position });
}));

// ── Véhicules ─────────────────────────────────────────────
troxtmodRouter.get('/vehicles', asyncHandler(async (_req, res) => {
  const ml      = getModuleLoader();
  const em      = getEntityManager();
  const catalog = ml.listEntities().filter((e: any) =>
    e.category === 'vehicle' || e.type === 'vehicle'
  );
  const spawned = em.getByType('vehicle');

  res.json({
    success:  true,
    catalog,
    spawned:  spawned.map((v: any) => v.serialize?.() ?? v),
    count:    catalog.length,
    inWorld:  spawned.length,
  });
}));

troxtmodRouter.post('/vehicles/spawn', asyncHandler(async (req, res) => {
  const { modelId, position, rotation, ownerId, color } = req.body;
  const settings = getSettings();

  if (!modelId)  throw new ValidationError('modelId requis');
  if (!position) throw new ValidationError('position requis');

  const em         = getEntityManager();
  const maxSpawned = settings.vehicles?.maxSpawnedPerServer ?? 50;
  if (em.getByType('vehicle').length >= maxSpawned) {
    throw new ValidationError(`Limite serveur: ${maxSpawned} véhicules`);
  }

  const ml  = getModuleLoader();
  const def = ml.getEntity(modelId);
  if (!def) throw new NotFoundError(`Véhicule: ${modelId}`);

  getGateway().broadcast(createPacket('ENTITY_SPAWN', {
    modelId,
    position,
    rotation:   rotation ?? [0, 0, 0],
    ownerId:    ownerId  ?? 'server',
    color:      color    ?? '#ffffff',
    type:       'vehicle',
    definition: def,
  }));

  getLogger().info('vehicle.spawn', `${modelId} par ${ownerId ?? 'server'}`);
  res.status(201).json({ success: true, modelId, position });
}));

// ── Outils ────────────────────────────────────────────────
troxtmodRouter.get('/tools', asyncHandler(async (_req, res) => {
  const ml = getModuleLoader();
  res.json({ success: true, tools: ml.listTools(), count: ml.listTools().length });
}));

troxtmodRouter.get('/tools/:id', asyncHandler(async (req, res) => {
  const ml   = getModuleLoader();
  const tool = ml.getTool(req.params.id);
  if (!tool) throw new NotFoundError(`Outil: ${req.params.id}`);
  res.json({ success: true, tool });
}));

// ── Effets ────────────────────────────────────────────────
troxtmodRouter.get('/effects', asyncHandler(async (_req, res) => {
  const ml  = getModuleLoader();
  const all = ml.listEntities().filter((e: any) =>
    e.category === 'effect' || e.type === 'effect'
  );
  res.json({ success: true, effects: all, count: all.length });
}));

troxtmodRouter.post('/effects/play', asyncHandler(async (req, res) => {
  const { effectId, position, scale, duration } = req.body;
  if (!effectId)  throw new ValidationError('effectId requis');
  if (!position)  throw new ValidationError('position requis');

  getGateway().broadcast(createPacket('EFFECT_PLAY', {
    effectId,
    position,
    scale:    scale    ?? 1,
    duration: duration ?? 3000,
  }));

  res.json({ success: true, effectId, position });
}));

// ── Jobs ──────────────────────────────────────────────────
troxtmodRouter.get('/jobs', asyncHandler(async (_req, res) => {
  const settings = getSettings();
  const jobs     = settings.jobs?.available ?? [];

  res.json({
    success:     true,
    jobs:        jobs.map(j => ({ id: j, name: j, enabled: true })),
    count:       jobs.length,
    payInterval: settings.jobs?.payIntervalMs ?? 300_000,
    maxBonus:    settings.jobs?.maxOnDutyBonus ?? 0.25,
  });
}));

// ── Économie ──────────────────────────────────────────────
troxtmodRouter.get('/economy/snapshot', asyncHandler(async (_req, res) => {
  const db       = getDatabase();
  const settings = getSettings();
  const players  = db.findAll('players').data ?? [];

  const totalCash = players.reduce((a: number, p: any) => a + (p.cash ?? 0), 0);
  const totalBank = players.reduce((a: number, p: any) => a + (p.bank ?? 0), 0);

  res.json({
    success: true,
    economy: {
      currency:     settings.economy?.currency     ?? 'ETC',
      totalCash,
      totalBank,
      totalWealth:  totalCash + totalBank,
      players:      players.length,
      taxRate:      settings.economy?.taxRate       ?? 0.05,
      startingCash: settings.economy?.startingCash  ?? 5000,
      startingBank: settings.economy?.startingBank  ?? 2500,
    },
  });
}));

// ── Features ──────────────────────────────────────────────
troxtmodRouter.patch('/features', asyncHandler(async (req, res) => {
  const settings = getSettings();
  const updates  = req.body;

  if (!updates || typeof updates !== 'object') {
    throw new ValidationError('Body doit être { featureId: boolean }');
  }

  for (const [key, val] of Object.entries(updates)) {
    if (typeof val === 'boolean') {
      settings.features[key] = val;
    }
  }

  getLogger().warn('features.update', 'Features modifiées', updates);
  res.json({ success: true, features: settings.features });
}));

// ── Broadcast ─────────────────────────────────────────────
troxtmodRouter.post('/server/broadcast', asyncHandler(async (req, res) => {
  const { text, sender, type } = req.body;
  if (!text) throw new ValidationError('text requis');

  getGateway().broadcast(createPacket('CHAT', {
    sender: sender ?? 'TroxTMod',
    text,
    type:   type ?? 'system',
  }));

  res.json({ success: true });
}));

// ── Announcement ──────────────────────────────────────────
troxtmodRouter.post('/server/announcement', asyncHandler(async (req, res) => {
  const { message, from } = req.body;
  if (!message) throw new ValidationError('message requis');

  getGateway().broadcast(createPacket('ANNOUNCEMENT', { message, from }));
  getGateway().broadcast(createPacket('CHAT', {
    sender: '📢 Annonce',
    text:   message,
    type:   'admin',
  }));

  res.json({ success: true });
}));
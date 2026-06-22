// server/modules/TroxTMod/router.ts
// ============================================================
//  TroxTMod — Router Express style Garry's Mod
//  Branché sur server/index.ts via app.use('/api/troxtmod', troxtmodRouter)
// ============================================================

import express from 'express';
import { EventBus } from '../../engine/EventBus';

// ============================================================
//  TYPES
// ============================================================

export interface TroxTProp {
  id:          string;
  type:        string;
  category:    string;
  name:        string;
  position:    { x: number; y: number; z: number };
  rotation:    { x: number; y: number; z: number; w: number };
  scale:       number;
  mass:        number;
  restitution: number;
  friction:    number;
  velocity:    { x: number; y: number; z: number };
  frozen:      boolean;
  ownerId?:    string;
  metadata:    Record<string, any>;
  createdAt:   number;
  updatedAt:   number;
}

export interface TroxTEntity {
  id:        string;
  type:      string;
  name:      string;
  position:  { x: number; y: number; z: number };
  rotation:  { x: number; y: number; z: number; w: number };
  scale:     number;
  active:    boolean;
  visible:   boolean;
  health?:   number;
  maxHealth?: number;
  tags:      string[];
  metadata:  Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface TroxTEffect {
  id:        string;
  type:      string;
  position:  { x: number; y: number; z: number };
  duration:  number;
  metadata:  Record<string, any>;
  createdAt: number;
}

export interface TroxTPlatform {
  id:        string;
  position:  { x: number; y: number; z: number };
  size:      { x: number; y: number; z: number };
  color?:    string;
  type?:     string;
  createdAt: number;
}

// ============================================================
//  WORLD STATE (In-memory, Garry's Mod style)
// ============================================================

export const troxtmodWorld = {
  props:     new Map<string, TroxTProp>(),
  entities:  new Map<string, TroxTEntity>(),
  platforms: [] as TroxTPlatform[],
  effects:   [] as TroxTEffect[],
  players:   new Map<string, any>(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================
//  CATALOG — Items disponibles
// ============================================================

const PROP_CATALOG = [
  { type: 'explosive_barrel',  name: 'Explosive Barrel',  category: 'dangerous',    mass: 80,   description: 'Explodes on high-velocity impact' },
  { type: 'wooden_crate',      name: 'Wooden Crate',      category: 'destructible', mass: 50,   description: 'Destructible wooden container' },
  { type: 'metal_crate',       name: 'Metal Crate',       category: 'destructible', mass: 120,  description: 'Heavy metal container' },
  { type: 'bomb',              name: 'Timed Bomb',        category: 'dangerous',    mass: 5,    description: 'Timer-based explosive' },
  { type: 'sign_panel',        name: 'Sign Panel',        category: 'decorative',   mass: 15,   description: 'Configurable sign' },
  { type: 'chair',             name: 'Chair',             category: 'furniture',    mass: 10,   description: 'Sittable furniture' },
  { type: 'table',             name: 'Table',             category: 'furniture',    mass: 30,   description: 'Interactive table' },
  { type: 'lamp_post',         name: 'Lamp Post',         category: 'lighting',     mass: 30,   description: 'Emissive light source' },
  { type: 'wrecked_car',       name: 'Wrecked Car',       category: 'vehicle',      mass: 1200, description: 'Damaged vehicle prop' },
  { type: 'neon_sign',         name: 'Neon Sign',         category: 'decorative',   mass: 8,    description: 'Glowing neon sign' },
  { type: 'checkpoint',        name: 'Checkpoint',        category: 'interactive',  mass: 0,    description: 'Save / respawn point' },
  { type: 'trampoline',        name: 'Trampoline',        category: 'interactive',  mass: 0,    description: 'High-bounce surface' },
  { type: 'land_mine',         name: 'Land Mine',         category: 'dangerous',    mass: 3,    description: 'Proximity explosive' },
  { type: 'portal',            name: 'Portal',            category: 'interactive',  mass: 0,    description: 'Teleportation device' },
  { type: 'shield',            name: 'Shield',            category: 'protective',   mass: 15,   description: 'Blocks projectiles' },
  { type: 'drivable_vehicle',  name: 'Drivable Vehicle',  category: 'vehicle',      mass: 900,  description: 'Physics-based vehicle' },
  { type: 'barrel',            name: 'Barrel',            category: 'basic',        mass: 60,   description: 'Standard physics barrel' },
  { type: 'pallet',            name: 'Pallet',            category: 'basic',        mass: 20,   description: 'Wooden pallet' },
  { type: 'dumpster',          name: 'Dumpster',          category: 'street',       mass: 300,  description: 'Heavy dumpster' },
  { type: 'traffic_cone',      name: 'Traffic Cone',      category: 'street',       mass: 3,    description: 'Lightweight cone' },
];

const ENTITY_CATALOG = [
  { type: 'guard_npc',      name: 'Guard NPC',      category: 'enemy',    health: 200,  description: 'Patrols and attacks players' },
  { type: 'merchant_npc',   name: 'Merchant NPC',   category: 'friendly', health: 50,   description: 'Dialogue and trading' },
  { type: 'boss_npc',       name: 'Boss NPC',       category: 'enemy',    health: 1000, description: 'Multi-phase enemy boss' },
  { type: 'civilian_npc',   name: 'Civilian NPC',   category: 'friendly', health: 50,   description: 'Ambient NPC' },
  { type: 'turret',         name: 'Turret',         category: 'defense',               description: 'Auto-targeting turret' },
  { type: 'spawn_point',    name: 'Spawn Point',    category: 'system',                description: 'Player spawn location' },
  { type: 'vehicle_spawn',  name: 'Vehicle Spawn',  category: 'system',                description: 'Vehicle spawn manager' },
  { type: 'effect_zone',    name: 'Effect Zone',    category: 'system',                description: 'Apply effects in zone' },
];

const TOOL_CATALOG = [
  { type: 'physics_gun',  name: 'Physics Gun',  icon: '🔫', description: 'Attract / repulse props' },
  { type: 'gravity_gun',  name: 'Gravity Gun',  icon: '🌀', description: 'Pick up and launch objects' },
  { type: 'weld_tool',    name: 'Weld Tool',    icon: '🔩', description: 'Connect two props' },
  { type: 'thruster',     name: 'Thruster',     icon: '🚀', description: 'Propulse a prop' },
  { type: 'rope_tool',    name: 'Rope Tool',    icon: '🪢', description: 'Link two props with rope' },
  { type: 'color_tool',   name: 'Color Tool',   icon: '🎨', description: 'Change prop color' },
  { type: 'delete_tool',  name: 'Delete Tool',  icon: '🗑️', description: 'Remove prop from world' },
  { type: 'clone_tool',   name: 'Clone Tool',   icon: '📋', description: 'Duplicate a prop' },
  { type: 'inflater',     name: 'Inflater',     icon: '📐', description: 'Scale prop up/down' },
  { type: 'freezer',      name: 'Freezer',      icon: '🧊', description: 'Freeze / unfreeze physics' },
  { type: 'spawner',      name: 'Spawner Tool', icon: '✨', description: 'Spawn new props in world' },
];

const EFFECT_CATALOG = [
  { type: 'explosion',        name: 'Explosion',        icon: '💥', description: 'Radial force + particles' },
  { type: 'fire',             name: 'Fire',             icon: '🔥', description: 'Emissive flames + DoT' },
  { type: 'water_pool',       name: 'Water Pool',       icon: '💧', description: 'Slowdown zone' },
  { type: 'wind_zone',        name: 'Wind Zone',        icon: '💨', description: 'Directional force field' },
  { type: 'smoke',            name: 'Smoke',            icon: '🌫️', description: 'Visibility reduction' },
  { type: 'lightning',        name: 'Lightning',        icon: '⚡', description: 'Flash + stun effect' },
  { type: 'antigravity_zone', name: 'Antigravity Zone', icon: '🔄', description: 'Reverse gravity in zone' },
  { type: 'speed_zone',       name: 'Speed Zone',       icon: '⚡', description: 'Velocity multiplier' },
  { type: 'freeze_zone',      name: 'Freeze Zone',      icon: '❄️', description: 'Stop all physics' },
  { type: 'vortex',           name: 'Vortex',           icon: '🌪️', description: 'Pull entities to center' },
];

const PROP_TYPES = new Set(PROP_CATALOG.map(p => p.type));

// ============================================================
//  HELPERS
// ============================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function validate(
  res: express.Response,
  body: any,
  required: string[]
): boolean {
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      res.status(400).json({
        success: false,
        error:   `Champ requis manquant: ${field}`,
      });
      return false;
    }
  }
  return true;
}

// ============================================================
//  ROUTER
// ============================================================

export const troxtmodRouter = express.Router();

// ── Stats header (chaque requête) ──
troxtmodRouter.use((_req, res, next) => {
  res.setHeader('X-TroxTMod-Props',    troxtmodWorld.props.size.toString());
  res.setHeader('X-TroxTMod-Entities', troxtmodWorld.entities.size.toString());
  next();
});

// ──────────────────────────────────────────────────────────────
//  PROPS
// ──────────────────────────────────────────────────────────────

// GET /props
troxtmodRouter.get('/props', (_req, res) => {
  res.json({
    success: true,
    count:   troxtmodWorld.props.size,
    props:   [...troxtmodWorld.props.values()],
  });
});

// GET /props/:id
troxtmodRouter.get('/props/:id', (req, res) => {
  const p = troxtmodWorld.props.get(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Prop not found' });
  res.json({ success: true, prop: p });
});

// POST /props
troxtmodRouter.post('/props', (req, res) => {
  const prop: TroxTProp = {
    id:          req.body.id          ?? generateId('prop'),
    type:        req.body.type        ?? 'physics_prop',
    category:    req.body.category    ?? 'basic',
    name:        req.body.name        ?? 'New Prop',
    position:    req.body.position    ?? { x: 0, y: 0, z: 0 },
    rotation:    req.body.rotation    ?? { x: 0, y: 0, z: 0, w: 1 },
    scale:       req.body.scale       ?? 1,
    mass:        req.body.mass        ?? 1,
    restitution: req.body.restitution ?? 0.3,
    friction:    req.body.friction    ?? 0.5,
    velocity:    req.body.velocity    ?? { x: 0, y: 0, z: 0 },
    frozen:      req.body.frozen      ?? false,
    ownerId:     req.body.ownerId,
    metadata:    req.body.metadata    ?? {},
    createdAt:   Date.now(),
    updatedAt:   Date.now(),
  };

  troxtmodWorld.props.set(prop.id, prop);
  troxtmodWorld.updatedAt = Date.now();

  // Notifier via EventBus
  EventBus.getInstance().emit('troxtmod:prop:spawn', { prop });

  res.status(201).json({ success: true, prop });
});

// PUT /props/:id
troxtmodRouter.put('/props/:id', (req, res) => {
  const prop = troxtmodWorld.props.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Prop not found' });

  const updated: TroxTProp = {
    ...prop,
    ...req.body,
    id:        prop.id,      // Conserver l'ID original
    updatedAt: Date.now(),
  };

  troxtmodWorld.props.set(prop.id, updated);
  troxtmodWorld.updatedAt = Date.now();

  EventBus.getInstance().emit('troxtmod:prop:update', { prop: updated });

  res.json({ success: true, prop: updated });
});

// PATCH /props/:id/freeze
troxtmodRouter.patch('/props/:id/freeze', (req, res) => {
  const prop = troxtmodWorld.props.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Prop not found' });

  prop.frozen    = req.body.frozen ?? !prop.frozen;
  prop.updatedAt = Date.now();
  troxtmodWorld.props.set(prop.id, prop);

  EventBus.getInstance().emit('troxtmod:prop:freeze', {
    propId: prop.id,
    frozen: prop.frozen,
  });

  res.json({ success: true, prop });
});

// DELETE /props/:id
troxtmodRouter.delete('/props/:id', (req, res) => {
  const prop = troxtmodWorld.props.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Prop not found' });

  troxtmodWorld.props.delete(req.params.id);
  troxtmodWorld.updatedAt = Date.now();

  EventBus.getInstance().emit('troxtmod:prop:remove', { propId: req.params.id });

  res.json({ success: true, deleted: prop });
});

// DELETE /props (clear all)
troxtmodRouter.delete('/props', (_req, res) => {
  const count = troxtmodWorld.props.size;
  troxtmodWorld.props.clear();
  troxtmodWorld.updatedAt = Date.now();
  res.json({ success: true, deletedCount: count });
});

// ──────────────────────────────────────────────────────────────
//  ENTITIES
// ──────────────────────────────────────────────────────────────

// GET /entities
troxtmodRouter.get('/entities', (_req, res) => {
  res.json({
    success:  true,
    count:    troxtmodWorld.entities.size,
    entities: [...troxtmodWorld.entities.values()],
  });
});

// GET /entities/:id
troxtmodRouter.get('/entities/:id', (req, res) => {
  const e = troxtmodWorld.entities.get(req.params.id);
  if (!e) return res.status(404).json({ success: false, error: 'Entity not found' });
  res.json({ success: true, entity: e });
});

// POST /entities
troxtmodRouter.post('/entities', (req, res) => {
  const entity: TroxTEntity = {
    id:        req.body.id       ?? generateId('entity'),
    type:      req.body.type     ?? 'base_entity',
    name:      req.body.name     ?? 'New Entity',
    position:  req.body.position ?? { x: 0, y: 0, z: 0 },
    rotation:  req.body.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
    scale:     req.body.scale    ?? 1,
    active:    req.body.active   ?? true,
    visible:   req.body.visible  ?? true,
    health:    req.body.health,
    maxHealth: req.body.maxHealth,
    tags:      req.body.tags     ?? [],
    metadata:  req.body.metadata ?? {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  troxtmodWorld.entities.set(entity.id, entity);
  troxtmodWorld.updatedAt = Date.now();

  EventBus.getInstance().emit('troxtmod:entity:spawn', { entity });

  res.status(201).json({ success: true, entity });
});

// PUT /entities/:id
troxtmodRouter.put('/entities/:id', (req, res) => {
  const entity = troxtmodWorld.entities.get(req.params.id);
  if (!entity) return res.status(404).json({ success: false, error: 'Entity not found' });

  const updated: TroxTEntity = {
    ...entity,
    ...req.body,
    id:        entity.id,
    updatedAt: Date.now(),
  };

  troxtmodWorld.entities.set(entity.id, updated);
  troxtmodWorld.updatedAt = Date.now();

  EventBus.getInstance().emit('troxtmod:entity:update', { entity: updated });

  res.json({ success: true, entity: updated });
});

// DELETE /entities/:id
troxtmodRouter.delete('/entities/:id', (req, res) => {
  const entity = troxtmodWorld.entities.get(req.params.id);
  if (!entity) return res.status(404).json({ success: false, error: 'Entity not found' });

  troxtmodWorld.entities.delete(req.params.id);
  troxtmodWorld.updatedAt = Date.now();

  EventBus.getInstance().emit('troxtmod:entity:remove', { entityId: req.params.id });

  res.json({ success: true, deleted: entity });
});

// ──────────────────────────────────────────────────────────────
//  PLATFORMS
// ──────────────────────────────────────────────────────────────

troxtmodRouter.get('/platforms', (_req, res) => {
  res.json({
    success:   true,
    count:     troxtmodWorld.platforms.length,
    platforms: troxtmodWorld.platforms,
  });
});

troxtmodRouter.post('/platforms', (req, res) => {
  const platform: TroxTPlatform = {
    id:        generateId('platform'),
    position:  req.body.position ?? { x: 0, y: 0, z: 0 },
    size:      req.body.size     ?? { x: 4, y: 0.5, z: 4 },
    color:     req.body.color    ?? '#2a3d50',
    type:      req.body.type     ?? 'static',
    createdAt: Date.now(),
  };

  troxtmodWorld.platforms.push(platform);
  troxtmodWorld.updatedAt = Date.now();

  res.status(201).json({ success: true, platform });
});

troxtmodRouter.delete('/platforms/:id', (req, res) => {
  const idx = troxtmodWorld.platforms.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Platform not found' });

  const deleted = troxtmodWorld.platforms.splice(idx, 1)[0];
  troxtmodWorld.updatedAt = Date.now();

  res.json({ success: true, deleted });
});

troxtmodRouter.delete('/platforms', (_req, res) => {
  const count = troxtmodWorld.platforms.length;
  troxtmodWorld.platforms = [];
  troxtmodWorld.updatedAt = Date.now();
  res.json({ success: true, deletedCount: count });
});

// ──────────────────────────────────────────────────────────────
//  EFFECTS
// ──────────────────────────────────────────────────────────────

troxtmodRouter.get('/effects', (_req, res) => {
  res.json({
    success: true,
    count:   troxtmodWorld.effects.length,
    effects: troxtmodWorld.effects,
  });
});

troxtmodRouter.post('/effects', (req, res) => {
  if (!validate(res, req.body, ['type', 'position'])) return;

  const effect: TroxTEffect = {
    id:        generateId('effect'),
    type:      req.body.type,
    position:  req.body.position,
    duration:  req.body.duration  ?? 2,
    metadata:  req.body.metadata  ?? {},
    createdAt: Date.now(),
  };

  troxtmodWorld.effects.push(effect);

  EventBus.getInstance().emit('troxtmod:effect:spawn', { effect });

  res.status(201).json({ success: true, effect });

  // Auto-cleanup si durée courte
  if (effect.duration > 0 && effect.duration < 60) {
    setTimeout(() => {
      troxtmodWorld.effects = troxtmodWorld.effects.filter(e => e.id !== effect.id);
      EventBus.getInstance().emit('troxtmod:effect:expire', { effectId: effect.id });
    }, effect.duration * 1000);
  }
});

troxtmodRouter.delete('/effects/:id', (req, res) => {
  const idx = troxtmodWorld.effects.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Effect not found' });

  const deleted = troxtmodWorld.effects.splice(idx, 1)[0];
  res.json({ success: true, deleted });
});

troxtmodRouter.delete('/effects', (_req, res) => {
  const count = troxtmodWorld.effects.length;
  troxtmodWorld.effects = [];
  res.json({ success: true, deletedCount: count });
});

// ──────────────────────────────────────────────────────────────
//  PLAYERS
// ──────────────────────────────────────────────────────────────

troxtmodRouter.get('/players', (_req, res) => {
  res.json({
    success: true,
    count:   troxtmodWorld.players.size,
    players: [...troxtmodWorld.players.values()],
  });
});

troxtmodRouter.get('/players/:id', (req, res) => {
  const p = troxtmodWorld.players.get(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Player not found' });
  res.json({ success: true, player: p });
});

// ──────────────────────────────────────────────────────────────
//  WORLD SNAPSHOT
// ──────────────────────────────────────────────────────────────

troxtmodRouter.get('/world', (_req, res) => {
  res.json({
    success: true,
    world: {
      props:     [...troxtmodWorld.props.values()],
      entities:  [...troxtmodWorld.entities.values()],
      platforms: troxtmodWorld.platforms,
      effects:   troxtmodWorld.effects,
      players:   [...troxtmodWorld.players.values()],
      stats: {
        propsCount:     troxtmodWorld.props.size,
        entitiesCount:  troxtmodWorld.entities.size,
        platformsCount: troxtmodWorld.platforms.length,
        effectsCount:   troxtmodWorld.effects.length,
        playersCount:   troxtmodWorld.players.size,
      },
      createdAt: troxtmodWorld.createdAt,
      updatedAt: troxtmodWorld.updatedAt,
    },
  });
});

troxtmodRouter.post('/world/clear', (_req, res) => {
  const counts = {
    props:     troxtmodWorld.props.size,
    entities:  troxtmodWorld.entities.size,
    platforms: troxtmodWorld.platforms.length,
    effects:   troxtmodWorld.effects.length,
  };

  troxtmodWorld.props.clear();
  troxtmodWorld.entities.clear();
  troxtmodWorld.platforms = [];
  troxtmodWorld.effects   = [];
  troxtmodWorld.updatedAt = Date.now();

  EventBus.getInstance().emit('troxtmod:world:clear', counts);

  res.json({ success: true, cleared: counts });
});

troxtmodRouter.post('/world/save', (_req, res) => {
  res.json({
    success: true,
    saved: {
      propsCount:     troxtmodWorld.props.size,
      entitiesCount:  troxtmodWorld.entities.size,
      platformsCount: troxtmodWorld.platforms.length,
      effectsCount:   troxtmodWorld.effects.length,
      timestamp:      Date.now(),
    },
  });
});

// ──────────────────────────────────────────────────────────────
//  ITEMS CATALOG
// ──────────────────────────────────────────────────────────────

troxtmodRouter.get('/items/catalog', (_req, res) => {
  res.json({
    success: true,
    items: {
      props:    PROP_CATALOG,
      entities: ENTITY_CATALOG,
      tools:    TOOL_CATALOG,
      effects:  EFFECT_CATALOG,
    },
  });
});

// POST /items/spawn — Spawn rapide depuis le catalog
troxtmodRouter.post('/items/spawn', (req, res) => {
  if (!validate(res, req.body, ['type', 'position'])) return;

  const { type, position, rotation, metadata, ownerId } = req.body;

  const item = {
    id:        generateId('item'),
    type,
    position,
    rotation:  rotation  ?? { x: 0, y: 0, z: 0, w: 1 },
    scale:     1,
    ownerId:   ownerId   ?? null,
    metadata:  metadata  ?? {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (PROP_TYPES.has(type)) {
    const prop: TroxTProp = {
      ...item,
      category:    PROP_CATALOG.find(p => p.type === type)?.category ?? 'basic',
      name:        PROP_CATALOG.find(p => p.type === type)?.name     ?? type,
      mass:        PROP_CATALOG.find(p => p.type === type)?.mass     ?? 1,
      restitution: 0.3,
      friction:    0.5,
      velocity:    { x: 0, y: 0, z: 0 },
      frozen:      false,
    };
    troxtmodWorld.props.set(prop.id, prop);
    EventBus.getInstance().emit('troxtmod:prop:spawn', { prop });
  } else {
    const entity: TroxTEntity = {
      ...item,
      name:    ENTITY_CATALOG.find(e => e.type === type)?.name ?? type,
      health:  ENTITY_CATALOG.find(e => e.type === type)?.health,
      active:  true,
      visible: true,
      tags:    [],
    };
    troxtmodWorld.entities.set(entity.id, entity);
    EventBus.getInstance().emit('troxtmod:entity:spawn', { entity });
  }

  troxtmodWorld.updatedAt = Date.now();
  res.status(201).json({ success: true, item });
});

// ──────────────────────────────────────────────────────────────
//  STATS
// ──────────────────────────────────────────────────────────────

troxtmodRouter.get('/stats', (_req, res) => {
  res.json({
    success: true,
    stats: {
      props:     troxtmodWorld.props.size,
      entities:  troxtmodWorld.entities.size,
      platforms: troxtmodWorld.platforms.length,
      effects:   troxtmodWorld.effects.length,
      players:   troxtmodWorld.players.size,
      uptime:    Date.now() - troxtmodWorld.createdAt,
      updatedAt: troxtmodWorld.updatedAt,
    },
  });
});
// server/routes/admin.routes.ts
// ============================================================
//  ADMIN ROUTES V2
//  Health · Metrics · Logs · Players · Entities
//  Snapshots · Modules · Config · Physics · World · SSE
// ============================================================

import { Router, Request, Response } from 'express';
import os                            from 'os';
import { asyncHandler }              from '../lib/errors';
import { getLogger }                 from '../lib/logger';
import { formatUptime }              from '../../shared/utils';
import { NotFoundError, ValidationError } from '../lib/errors';

import { getEntityManager }  from '../engine/EntityManager';
import { getPhysicsWorld }   from '../engine/PhysicsWorld';
import { getWorldState }     from '../engine/WorldStateManager';
import { getGateway }        from '../network/WebSocketGateway';
import { getSnapshotter }    from '../persistence/Snapshotter';
import { getModuleLoader }   from '../modules/ModuleLoader';

export const adminRouter = Router();

// ─────────────────────────────────────────────────────────────
//  METRICS HISTORY
// ─────────────────────────────────────────────────────────────

const SERVER_START = Date.now();

interface MetricSample {
  ts:          number;
  players:     number;
  entities:    number;
  heap_mb:     number;
  rss_mb:      number;
  physics_ms?: number;
}

const metricsHistory: MetricSample[] = [];

setInterval(() => {
  try {
    const mem = process.memoryUsage();
    metricsHistory.push({
      ts:         Date.now(),
      players:    getGateway().getPlayerCount(),
      entities:   getEntityManager().count,
      heap_mb:    Math.round(mem.heapUsed / 1024 / 1024),
      rss_mb:     Math.round(mem.rss      / 1024 / 1024),
      physics_ms: getPhysicsWorld().getStats()?.stepMs ?? undefined,
    });
    if (metricsHistory.length > 60) metricsHistory.shift();
  } catch { /* engine not ready */ }
}, 5000);

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function uptimeSec(): number {
  return Math.floor((Date.now() - SERVER_START) / 1000);
}

function memoryStats() {
  const m = process.memoryUsage();
  return {
    used_mb:     Math.round(m.heapUsed  / 1024 / 1024),
    total_mb:    Math.round(m.heapTotal / 1024 / 1024),
    rss_mb:      Math.round(m.rss       / 1024 / 1024),
    external_mb: Math.round(m.external  / 1024 / 1024),
    percent:     Math.round((m.heapUsed / m.heapTotal) * 100),
  };
}

function osStats() {
  const cpus    = os.cpus();
  const loadAvg = os.loadavg();
  return {
    platform:        os.platform(),
    arch:            os.arch(),
    node_version:    process.version,
    cpus:            cpus.length,
    cpu_model:       cpus[0]?.model ?? 'unknown',
    load_avg:        { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] },
    free_memory_mb:  Math.round(os.freemem()  / 1024 / 1024),
    total_memory_mb: Math.round(os.totalmem() / 1024 / 1024),
    hostname:        os.hostname(),
  };
}

// Live config store
const liveConfig: Record<string, any> = {
  max_players:       32,
  tick_rate:         20,
  save_interval_sec: 300,
  pvp_enabled:       true,
  whitelist_enabled: false,
  debug_mode:        false,
  chat_rate_limit:   5,
};

const CONFIG_SCHEMA: Record<string, { type: string; min?: number; max?: number }> = {
  max_players:       { type: 'number',  min: 1,  max: 256  },
  tick_rate:         { type: 'number',  min: 1,  max: 128  },
  save_interval_sec: { type: 'number',  min: 30, max: 3600 },
  pvp_enabled:       { type: 'boolean' },
  whitelist_enabled: { type: 'boolean' },
  debug_mode:        { type: 'boolean' },
  chat_rate_limit:   { type: 'number',  min: 1,  max: 60   },
};

// ─────────────────────────────────────────────────────────────
//  HEALTH
// ─────────────────────────────────────────────────────────────

adminRouter.get('/health', (_req, res) => {
  try {
    const wState = getWorldState();
    const ok     = wState.serverStatus === 'running';
    res.status(ok ? 200 : 503).json({
      status:    ok ? 'ok' : 'degraded',
      server:    wState.serverStatus,
      uptime_s:  uptimeSec(),
      timestamp: Date.now(),
    });
  } catch {
    res.status(503).json({ status: 'starting', uptime_s: uptimeSec(), timestamp: Date.now() });
  }
});

// ─────────────────────────────────────────────────────────────
//  METRICS
// ─────────────────────────────────────────────────────────────

adminRouter.get('/metrics', asyncHandler(async (_req, res) => {
  const em     = getEntityManager();
  const phy    = getPhysicsWorld();
  const ws     = getGateway();
  const ml     = getModuleLoader();
  const wState = getWorldState();
  const snap   = getSnapshotter();
  const logger = getLogger();
  const upSec  = uptimeSec();

  res.json({
    uptime_seconds:   upSec,
    uptime_formatted: formatUptime(upSec),
    server_status:    wState.serverStatus,
    players: {
      count: ws.getPlayerCount(),
      max:   ws.getMaxPlayers?.() ?? null,
    },
    entities: {
      count:   em.count,
      by_type: em.getStats().byType,
    },
    snapshots: {
      count:  snap.count(),
      latest: snap.latest?.()?.id ?? null,
    },
    physics:    phy.getStats(),
    memory:     memoryStats(),
    os:         osStats(),
    world:      wState.serializeExtended(),
    gateway:    ws.getStats(),
    modules:    ml.getStats(),
    statistics: wState.statistics,
    logs:       logger.getStats(),
    recorded_at: Date.now(),
  });
}));

adminRouter.get('/metrics/history', (_req, res) => {
  res.json({
    samples:     metricsHistory,
    count:       metricsHistory.length,
    interval_ms: 5000,
    window_min:  Math.round((metricsHistory.length * 5) / 60),
  });
});

// ─────────────────────────────────────────────────────────────
//  METRICS SSE
// ─────────────────────────────────────────────────────────────

adminRouter.get('/metrics/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'connected', ts: Date.now() });

  const interval = setInterval(() => {
    try {
      const mem = process.memoryUsage();
      send({
        type:       'metrics',
        ts:         Date.now(),
        players:    getGateway().getPlayerCount(),
        entities:   getEntityManager().count,
        heap_mb:    Math.round(mem.heapUsed / 1024 / 1024),
        rss_mb:     Math.round(mem.rss      / 1024 / 1024),
        physics_ms: getPhysicsWorld().getStats()?.stepMs ?? null,
        uptime_s:   uptimeSec(),
      });
    } catch {
      send({ type: 'error', message: 'Engine not ready' });
    }
  }, 2000);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(interval); clearInterval(heartbeat); });
});

// ─────────────────────────────────────────────────────────────
//  LOGS
// ─────────────────────────────────────────────────────────────

adminRouter.get('/logs', asyncHandler(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  as string) || 100, 500);
  const level  = req.query.level  as any;
  const source = req.query.source as string | undefined;
  const since  = req.query.since  ? parseInt(req.query.since as string) : undefined;
  const logger = getLogger();

  let logs = logger.getLogs(limit, level);
  if (source) logs = logs.filter((l: any) => l.source === source);
  if (since)  logs = logs.filter((l: any) => l.ts     >= since);

  res.json({ logs, count: logs.length, stats: logger.getStats() });
}));

adminRouter.get('/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send    = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const logger  = getLogger();
  const lvlFilter = req.query.level as string | undefined;

  send({ type: 'connected', ts: Date.now() });

  const onLog = (entry: any) => {
    if (lvlFilter && entry.level !== lvlFilter) return;
    send({ type: 'log', entry });
  };

  logger.on?.('log', onLog);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    logger.off?.('log', onLog);
  });
});

// ─────────────────────────────────────────────────────────────
//  SERVER ACTIONS
// ─────────────────────────────────────────────────────────────

adminRouter.post('/server/:action', asyncHandler(async (req, res) => {
  const wState  = getWorldState();
  const gateway = getGateway();
  const snap    = getSnapshotter();
  const logger  = getLogger();
  const { createPacket } = await import('../../shared/utils');

  switch (req.params.action) {

    case 'pause': {
      wState.setServerStatus('paused');
      gateway.broadcast(createPacket('CHAT', {
        sender: 'System',
        text:   req.body.message ?? '⏸️ Serveur en pause',
      }));
      logger.warn('admin:server', 'Server paused');
      res.json({ success: true, status: 'paused', ts: Date.now() });
      break;
    }

    case 'resume': {
      wState.setServerStatus('running');
      gateway.broadcast(createPacket('CHAT', {
        sender: 'System',
        text:   req.body.message ?? '▶️ Serveur repris',
      }));
      logger.info('admin:server', 'Server resumed');
      res.json({ success: true, status: 'running', ts: Date.now() });
      break;
    }

    case 'save': {
      const s = snap.create('manual', req.body.description ?? 'Admin save');
      if (!s) return res.status(500).json({ error: 'Snapshot failed' });
      wState.incrementSaves();
      logger.info('admin:save', `Snapshot: ${s.id.slice(0, 8)}`);
      res.json({ success: true, snapshot: { id: s.id, createdAt: s.createdAt ?? Date.now() } });
      break;
    }

    case 'backup': {
      const s = snap.create('backup', req.body.description ?? 'Backup');
      if (!s) return res.status(500).json({ error: 'Backup failed' });
      res.json({ success: true, snapshot: { id: s.id } });
      break;
    }

    case 'broadcast': {
      const { text, sender = 'Admin', type = 'info' } = req.body;
      if (!text) throw new ValidationError('text requis');
      const prefix = type === 'warning' ? '⚠️' : type === 'error' ? '🚨' : '📢';
      gateway.broadcast(createPacket('CHAT', { sender, text: `${prefix} ${text}` }));
      res.json({ success: true, sent_to: gateway.getPlayerCount() });
      break;
    }

    case 'gc': {
      if (typeof (global as any).gc === 'function') {
        (global as any).gc();
        res.json({ success: true, message: 'GC triggered', memory: memoryStats() });
      } else {
        res.json({ success: false, message: 'GC non disponible (--expose-gc requis)' });
      }
      break;
    }

    default:
      throw new ValidationError(`Action inconnue: ${req.params.action}`);
  }
}));

// ─────────────────────────────────────────────────────────────
//  BROADCAST
// ─────────────────────────────────────────────────────────────

adminRouter.post('/broadcast', asyncHandler(async (req, res) => {
  const { text, sender = 'Admin', type = 'info', target } = req.body;
  if (!text) throw new ValidationError('text requis');

  const gateway = getGateway();
  const { createPacket } = await import('../../shared/utils');
  const prefix = type === 'warning' ? '⚠️' : type === 'error' ? '🚨' : type === 'success' ? '✅' : '📢';
  const packet = createPacket('CHAT', { sender, text: `${prefix} ${text}` });

  if (target) {
    const sent = gateway.sendTo?.(target, packet) ?? false;
    if (!sent) throw new NotFoundError(`Player ${target} introuvable`);
    res.json({ success: true, target, sent_to: 1 });
  } else {
    gateway.broadcast(packet);
    res.json({ success: true, target: 'all', sent_to: gateway.getPlayerCount() });
  }
}));

// ─────────────────────────────────────────────────────────────
//  PLAYERS
// ─────────────────────────────────────────────────────────────

adminRouter.get('/players', asyncHandler(async (_req, res) => {
  const ws      = getGateway();
  const em      = getEntityManager();
  const players = (ws.getPlayers?.() ?? []).map((p: any) => ({
    ...p,
    entity: em.getByOwner?.(p.id) ?? null,
  }));
  res.json({ count: players.length, max: ws.getMaxPlayers?.() ?? null, players });
}));

adminRouter.get('/players/:id', asyncHandler(async (req, res) => {
  const ws     = getGateway();
  const em     = getEntityManager();
  const player = ws.getPlayer?.(req.params.id);
  if (!player) throw new NotFoundError(`Player ${req.params.id} introuvable`);
  res.json({ player, entity: em.getByOwner?.(req.params.id) ?? null });
}));

adminRouter.post('/players/:id/kick', asyncHandler(async (req, res) => {
  const ws     = getGateway();
  const logger = getLogger();
  const { id } = req.params;
  const reason  = req.body.reason ?? 'Kicked by admin';
  const { createPacket } = await import('../../shared/utils');

  ws.sendTo?.(id, createPacket('CHAT', { sender: 'System', text: `🚫 ${reason}` }));
  const kicked = ws.kick?.(id, reason) ?? false;
  if (!kicked) throw new NotFoundError(`Player ${id} introuvable`);

  logger.warn('admin:kick', `Player ${id} kicked: ${reason}`);
  res.json({ success: true, playerId: id, reason });
}));

adminRouter.post('/players/:id/teleport', asyncHandler(async (req, res) => {
  const em     = getEntityManager();
  const entity = em.getByOwner?.(req.params.id);
  if (!entity) throw new NotFoundError(`Entité de ${req.params.id} introuvable`);

  const { x = 0, y = 0, z = 0 } = req.body;
  entity.position = { x, y, z };
  em.update?.(entity);
  res.json({ success: true, playerId: req.params.id, position: { x, y, z } });
}));

// ─────────────────────────────────────────────────────────────
//  ENTITIES
// ─────────────────────────────────────────────────────────────

adminRouter.get('/entities', asyncHandler(async (req, res) => {
  const em     = getEntityManager();
  const type   = req.query.type  as string | undefined;
  const owner  = req.query.owner as string | undefined;
  const limit  = Math.min(parseInt(req.query.limit as string) || 100, 1000);

  let entities = em.getAll?.() ?? [];
  if (type)  entities = entities.filter((e: any) => e.type     === type);
  if (owner) entities = entities.filter((e: any) => e.ownerId  === owner);

  res.json({ count: entities.length, total: em.count, entities: entities.slice(0, limit), stats: em.getStats() });
}));

adminRouter.get('/entities/:id', asyncHandler(async (req, res) => {
  const entity = getEntityManager().get?.(req.params.id);
  if (!entity) throw new NotFoundError(`Entity ${req.params.id} introuvable`);
  res.json({ entity });
}));

adminRouter.delete('/entities/:id', asyncHandler(async (req, res) => {
  const em     = getEntityManager();
  const logger = getLogger();
  const entity = em.get?.(req.params.id);
  if (!entity) throw new NotFoundError(`Entity ${req.params.id} introuvable`);

  em.remove?.(req.params.id);
  logger.warn('admin:entity', `Entity ${req.params.id} (${entity.type}) removed`);
  res.json({ success: true, removed: { id: req.params.id, type: entity.type } });
}));

adminRouter.post('/entities/:id/freeze', asyncHandler(async (req, res) => {
  const em     = getEntityManager();
  const entity = em.get?.(req.params.id);
  if (!entity) throw new NotFoundError(`Entity ${req.params.id} introuvable`);

  entity.frozen = !(entity.frozen ?? false);
  em.update?.(entity);
  res.json({ success: true, id: req.params.id, frozen: entity.frozen });
}));

// ─────────────────────────────────────────────────────────────
//  SNAPSHOTS
// ─────────────────────────────────────────────────────────────

adminRouter.get('/snapshots', asyncHandler(async (req, res) => {
  const snap  = getSnapshotter();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const type  = req.query.type as string | undefined;

  let list = snap.list?.() ?? [];
  if (type) list = list.filter((s: any) => s.type === type);

  res.json({
    count:     list.length,
    total:     snap.count(),
    snapshots: list.slice(0, limit).map((s: any) => ({
      id:          s.id,
      type:        s.type,
      description: s.description,
      createdAt:   s.createdAt,
      size_kb:     s.size ? Math.round(s.size / 1024) : null,
    })),
  });
}));

adminRouter.get('/snapshots/:id', asyncHandler(async (req, res) => {
  const s = getSnapshotter().get?.(req.params.id);
  if (!s) throw new NotFoundError(`Snapshot ${req.params.id} introuvable`);
  res.json({ snapshot: s });
}));

adminRouter.post('/snapshots/:id/restore', asyncHandler(async (req, res) => {
  const snap   = getSnapshotter();
  const logger = getLogger();
  const s      = snap.get?.(req.params.id);
  if (!s) throw new NotFoundError(`Snapshot ${req.params.id} introuvable`);

  const ok = await snap.restore?.(req.params.id) ?? false;
  if (!ok) return res.status(500).json({ error: 'Restore failed' });

  logger.info('admin:snapshot', `Snapshot ${req.params.id.slice(0, 8)} restored`);
  res.json({ success: true, restored: req.params.id });
}));

adminRouter.delete('/snapshots/:id', asyncHandler(async (req, res) => {
  const ok = getSnapshotter().delete?.(req.params.id) ?? false;
  if (!ok) throw new NotFoundError(`Snapshot ${req.params.id} introuvable`);
  res.json({ success: true, deleted: req.params.id });
}));

// ─────────────────────────────────────────────────────────────
//  MODULES
// ─────────────────────────────────────────────────────────────

adminRouter.get('/modules', asyncHandler(async (_req, res) => {
  const ml = getModuleLoader();
  res.json({ modules: ml.list?.() ?? [], stats: ml.getStats() });
}));

adminRouter.get('/modules/:id', asyncHandler(async (req, res) => {
  const mod = getModuleLoader().get?.(req.params.id);
  if (!mod) throw new NotFoundError(`Module ${req.params.id} introuvable`);
  res.json({ module: mod });
}));

adminRouter.post('/modules/:id/reload', asyncHandler(async (req, res) => {
  const ml  = getModuleLoader();
  const mod = ml.get?.(req.params.id);
  if (!mod) throw new NotFoundError(`Module ${req.params.id} introuvable`);

  const ok = await ml.reload?.(req.params.id) ?? false;
  if (!ok) return res.status(500).json({ error: 'Reload failed' });

  res.json({ success: true, module: req.params.id });
}));

adminRouter.post('/modules/:id/disable', asyncHandler(async (req, res) => {
  const ok = getModuleLoader().disable?.(req.params.id) ?? false;
  if (!ok) throw new NotFoundError(`Module ${req.params.id} introuvable`);
  res.json({ success: true, module: req.params.id, enabled: false });
}));

adminRouter.post('/modules/:id/enable', asyncHandler(async (req, res) => {
  const ok = getModuleLoader().enable?.(req.params.id) ?? false;
  if (!ok) throw new NotFoundError(`Module ${req.params.id} introuvable`);
  res.json({ success: true, module: req.params.id, enabled: true });
}));

// ─────────────────────────────────────────────────────────────
//  CONFIG LIVE
// ─────────────────────────────────────────────────────────────

adminRouter.get('/config', (_req, res) => {
  res.json({ config: liveConfig, schema: CONFIG_SCHEMA });
});

adminRouter.get('/config/:key', (req, res) => {
  const val = liveConfig[req.params.key];
  if (val === undefined) throw new NotFoundError(`Config key ${req.params.key} introuvable`);
  res.json({ key: req.params.key, value: val });
});

adminRouter.put('/config', asyncHandler(async (req, res) => {
  const logger  = getLogger();
  const errors: string[]           = [];
  const changed: Record<string, any> = {};

  for (const [key, value] of Object.entries(req.body)) {
    const schema = CONFIG_SCHEMA[key];
    if (!schema) { errors.push(`Clé inconnue: ${key}`); continue; }

    if (schema.type === 'number') {
      const n = Number(value);
      if (isNaN(n))                                    { errors.push(`${key}: doit être un nombre`); continue; }
      if (schema.min !== undefined && n < schema.min)  { errors.push(`${key}: min ${schema.min}`);   continue; }
      if (schema.max !== undefined && n > schema.max)  { errors.push(`${key}: max ${schema.max}`);   continue; }
      liveConfig[key] = n; changed[key] = n;
    } else if (schema.type === 'boolean') {
      liveConfig[key] = Boolean(value); changed[key] = Boolean(value);
    } else {
      liveConfig[key] = value; changed[key] = value;
    }
  }

  if (Object.keys(changed).length > 0) {
    logger.info('admin:config', `Updated: ${JSON.stringify(changed)}`);
  }

  if (errors.length > 0 && Object.keys(changed).length === 0) {
    return res.status(400).json({ success: false, errors });
  }

  res.json({ success: true, changed, errors, config: liveConfig });
}));

// ─────────────────────────────────────────────────────────────
//  PHYSICS
// ─────────────────────────────────────────────────────────────

adminRouter.get('/physics', asyncHandler(async (_req, res) => {
  const phy = getPhysicsWorld();
  res.json({ stats: phy.getStats(), bodies: phy.getBodies?.() ?? [] });
}));

adminRouter.post('/physics/step', asyncHandler(async (req, res) => {
  const phy = getPhysicsWorld();
  const dt  = Math.min(parseFloat(req.body.dt) || 0.016, 0.1);
  phy.step?.(dt);
  res.json({ success: true, dt, stats: phy.getStats() });
}));

// ─────────────────────────────────────────────────────────────
//  WORLD
// ─────────────────────────────────────────────────────────────

adminRouter.get('/world', asyncHandler(async (_req, res) => {
  const wState = getWorldState();
  res.json({ world: wState.serializeExtended(), statistics: wState.statistics });
}));

adminRouter.post('/world/reset', asyncHandler(async (req, res) => {
  if (req.body.confirm !== true) {
    return res.status(400).json({
      error:   'Confirmation requise',
      message: 'Envoyez { "confirm": true }',
    });
  }

  const wState  = getWorldState();
  const gateway = getGateway();
  const logger  = getLogger();
  const { createPacket } = await import('../../shared/utils');

  gateway.broadcast(createPacket('CHAT', {
    sender: 'System',
    text:   '⚠️ Réinitialisation du monde...',
  }));

  await wState.reset?.();
  logger.warn('admin:world', 'World reset by admin');
  res.json({ success: true, message: 'Monde réinitialisé' });
}));
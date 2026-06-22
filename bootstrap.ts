// server/bootstrap.ts
// ============================================================
//  BOOTSTRAP — Initialisation ordonnée des 14 systèmes
//  Chaque système a sa responsabilité unique
// ============================================================

import path              from 'path';
import { fileURLToPath } from 'url';
import fs                from 'fs';
import { createServer }  from 'http';
import express           from 'express';
import cors              from 'cors';

// ── Settings ──────────────────────────────────────────────
import { loadSettings }          from './lib/settings.js';
import { logger, requestLogger } from './lib/logger.js';
import { errorHandler }          from './lib/errors.js';
import { rateLimitMiddleware }   from './security/rateLimit.js';

// ── Engine ────────────────────────────────────────────────
import { PhysicsWorld }      from './engine/PhysicsWorld.js';
import { EntityManager }     from './engine/EntityManager.js';
import { WorldStateManager } from './engine/WorldState.js';
import { EventBus }          from './engine/EventBus.js';

// ── Network ───────────────────────────────────────────────
import { PacketHandler }    from './network/PacketHandler.js';
import { Authority }        from './network/Authority.js';
import { WebSocketGateway } from './network/WebSocketGateway.js';

// ── Persistence ───────────────────────────────────────────
import { Snapshotter }     from './persistence/Snapshotter.js';
import { DatabaseAdapter } from './persistence/DatabaseAdapter.js';
import { seedWorldData }   from './persistence/world-seed.js';

// ── Modules ───────────────────────────────────────────────
import { ModuleLoader } from './modules/ModuleLoader.js';
import { TroxTMod }     from './modules/TroxTMod/index.js';

// ── TroxT Brain & Third Eye ───────────────────────────────
import { TroxTBrain } from './troxt-core/Brain.js';
import { ThirdEye }   from './troxt-core/ThirdEye.js';

// ── API Routers ───────────────────────────────────────────
import { createHealthRouter }       from './api/health.routes.js';
import { createMetricsRouter }      from './api/metrics.routes.js';
import { createWorldAdminRouter }   from './api/world.admin.routes.js';
import { createPlayersAdminRouter } from './api/players.admin.routes.js';
import { createSnapshotsRouter }    from './api/snapshots.routes.js';
import { createLogsRouter }         from './api/logs.routes.js';
import { createEntitiesRouter }     from './api/entities.routes.js';
import { createPrismRouter }        from './api/prism.routes.js';
import { createAgentsRouter } from './api/agents.routes.js';
import { createBrainRouter }        from './api/brain.routes.js';
import { troxtmodRouter }           from './modules/TroxTMod/router.js';
import { worldRegistryRouter,
         initWorldRegistry }        from './modules/TroxTMod/world-registry.js';
import { propertyRouter }           from './modules/TroxTMod/PropertySystem.js';

// ── Bus Events & Commands ─────────────────────────────────
import { setupBusEvents } from './bus/BusEvents.js';
import { CommandHandler } from './commands/CommandHandler.js';

// ── Shared ────────────────────────────────────────────────
import { NETWORK, WORLD } from '../packages/shared/src/constants/index.js';
import { formatUptime, getPublicSettings } from '../packages/shared/src/utils/index.js';

// ── Types ─────────────────────────────────────────────────
import type { ServerSettings } from './lib/settings.js';
import type { AppContext }      from './types/context.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
//  BOOTSTRAP
// ============================================================

export async function bootstrap(): Promise<void> {

  // ── 0. Settings ───────────────────────────────────────────
  const settings  = loadSettings();
  const PORT      = Number(process.env['PORT']) || settings.server.port || NETWORK.DEFAULT_PORT;
  const PUBLIC_DIR = path.resolve(__dirname, 'public');

  printBanner(settings, 'start');

  // ── 1. Dossiers ───────────────────────────────────────────
  ensureDirectories(settings);

  // ── 2. Event Bus ──────────────────────────────────────────
  const bus = EventBus.getInstance();
  logger.info('[Bootstrap] EventBus initialisé');

  // ── 3. Physique ───────────────────────────────────────────
  const gravityY = settings.world.gravity?.y ?? -9.81;
  const physics  = new PhysicsWorld(gravityY);
  physics.start();
  logger.info(`[Bootstrap] PhysicsWorld démarré (gravity: ${gravityY})`);

  // ── 4. EntityManager ──────────────────────────────────────
  const entityManager = new EntityManager(physics);
  logger.info('[Bootstrap] EntityManager initialisé');

  // ── 5. WorldStateManager ──────────────────────────────────
  const worldState = new WorldStateManager({
    worldName:  settings.world.name,
    timeOfDay:  settings.world.timeOfDay,
    weather:    settings.world.weather as any,
    gravity:    Math.abs(gravityY),
    maxPlayers: settings.websocket.maxConnections,
  });
  logger.info(`[Bootstrap] WorldState: ${settings.world.name}`);

  // ── 6. Persistence ────────────────────────────────────────
  const DATA_DIR  = path.join(__dirname, 'data');
  const SNAPS_DIR = path.join(__dirname, settings.snapshots?.dir  ?? 'data/snapshots');
  const DB_FILE   = path.join(__dirname, settings.database?.file  ?? 'data/etherprism_db.json');

  const snapshotter = new Snapshotter(SNAPS_DIR, settings.snapshots?.maxSnapshots ?? 10);
  const db          = new DatabaseAdapter(DB_FILE);

  if (settings.database?.seedOnEmpty) {
    const stats = db.getStats();
    if ((stats.totalRows ?? 0) === 0) {
      db.seed();
      seedWorldData(db);
      logger.info('[Bootstrap] 🌱 Seed automatique effectué');
    }
  }

  // ── 7. Modules ────────────────────────────────────────────
  const moduleLoader = new ModuleLoader();
  TroxTMod.init(moduleLoader);
  logger.info(`[Bootstrap] Modules: ${moduleLoader.getStats().total} chargés`);

  // ── 8. TroxT Brain ────────────────────────────────────────
  let brain: TroxTBrain | null = null;
  if (settings.features?.troxtBrain !== false) {
    brain = TroxTBrain.getInstance();
    logger.info('[Bootstrap] 🧠 TroxT Brain activé');
  }

  // ── 9. Third Eye ──────────────────────────────────────────
  let thirdEye: ThirdEye | null = null;
  if (settings.features?.troxtThirdEye !== false) {
    thirdEye = ThirdEye.getInstance();
    logger.info('[Bootstrap] 👁️  TroxT Third Eye activé');
  }

  // ── 10. Express + HTTP ────────────────────────────────────
  const app    = express();
  const server = createServer(app);
  const SERVER_START = Date.now();

  // ── 11. Middlewares Express ───────────────────────────────
  applyMiddlewares(app, settings, PUBLIC_DIR);

  // ── 12. WebSocket Gateway ─────────────────────────────────
  const authority = new Authority();
  const handler   = new PacketHandler(bus);
  const gateway   = new WebSocketGateway(server, bus, handler, authority);
  logger.info('[Bootstrap] WebSocket Gateway prêt');

  // ── 13. Context partagé ───────────────────────────────────
  const ctx: AppContext = {
    settings,
    bus,
    physics,
    entityManager,
    worldState,
    snapshotter,
    db,
    moduleLoader,
    brain,
    thirdEye,
    gateway,
    SERVER_START,
  };

  // ── 14. Bus Events ────────────────────────────────────────
  const commandHandler = new CommandHandler(ctx);
  setupBusEvents(ctx, commandHandler);
  logger.info('[Bootstrap] Bus Events configurés');

  // ── 15. Snapshotter ───────────────────────────────────────
  setupSnapshotter(ctx);

  // ── 16. Game Loop ─────────────────────────────────────────
  startGameLoop(ctx);

  // ── 17. Routes API ────────────────────────────────────────
  mountRoutes(app, ctx, PUBLIC_DIR);
  logger.info('[Bootstrap] Routes API montées');

  // ── 18. Graceful Shutdown ─────────────────────────────────
  setupShutdown(server, ctx);

  // ── 19. Démarrage HTTP ────────────────────────────────────
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      logger.info(`[Server] Démarré sur le port ${PORT}`);
      printBanner(settings, 'ready', PORT);
      resolve();
    });
  });
}

// ============================================================
//  MIDDLEWARES
// ============================================================

function applyMiddlewares(
  app:        express.Application,
  settings:   ServerSettings,
  publicDir:  string,
): void {

  // Inject logger
  app.use((req, _res, next) => {
    (req as any).log = logger;
    next();
  });

  // CORS
  app.use(cors({
    origin:         settings.security.allowedOrigins,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Player-Id'],
    credentials:    true,
  }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options',        'DENY');
    res.setHeader('X-Powered-By',           'TroxT City RP');
    next();
  });

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Rate limiting
  if (settings.security?.rateLimiting) {
    app.use('/api', rateLimitMiddleware(settings.security.maxRequestsPerMin));
  }

  // Request logging
  app.use(requestLogger);

  // Static
  app.use(express.static(publicDir, { maxAge: '1d' }));
}

// ============================================================
//  ROUTES
// ============================================================

function mountRoutes(
  app:       express.Application,
  ctx:       AppContext,
  publicDir: string,
): void {
  const { settings } = ctx;

  // ── Core modules ──────────────────────────────────────────
  app.use('/api/troxtmod', troxtmodRouter);
  app.use('/api/world',    worldRegistryRouter);
  initWorldRegistry();
  app.use('/api/property', propertyRouter);

  // ── API routeurs ──────────────────────────────────────────
  app.use('/api/health',          createHealthRouter(ctx));
  app.use('/api/admin/metrics',   createMetricsRouter(ctx));
  app.use('/api/admin/world',     createWorldAdminRouter(ctx));
  app.use('/api/admin/players',   createPlayersAdminRouter(ctx));
  app.use('/api/admin/snapshots', createSnapshotsRouter(ctx));
  app.use('/api/admin/logs',      createLogsRouter(ctx));
  app.use('/api/entities',        createEntitiesRouter(ctx));
  app.use('/api/prism',           createPrismRouter(ctx));
  app.use('/api/agents', createAgentsRouter(ctx));
  app.use('/api/brain',  createBrainRouter(ctx));

  // ── Settings publics ──────────────────────────────────────
  app.get('/api/settings/public', (_req, res) => {
    res.json({ ok: true, settings: getPublicSettings(settings) });
  });

  // ── SPA Fallback ──────────────────────────────────────────
  app.get('*', (_req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        ok:      false,
        error:   'Frontend non compilé',
        hint:    'pnpm build',
        version: settings.server.version,
      });
    }
  });

  // ── Error handler ─────────────────────────────────────────
  app.use(errorHandler);
}

// ============================================================
//  SNAPSHOTTER
// ============================================================

function setupSnapshotter(ctx: AppContext): void {
  const { snapshotter, worldState, entityManager, gateway, settings } = ctx;

  snapshotter.onSave(() => ({
    worldState:  worldState.serialize(),
    entities:    entityManager.serializeAll(),
    playerCount: gateway.playerCount,
    timestamp:   Date.now(),
  }));

  snapshotter.onRestore((snap: any) => {
    worldState.restore(snap.worldState);
    entityManager.clear();
    gateway.broadcast({ type: 'WORLD_STATE', payload: { state: worldState.serializeExtended() }, timestamp: Date.now() });
    gateway.broadcast({ type: 'WORLD_RESET',  payload: { entities: snap.entities ?? [] },          timestamp: Date.now() });
    logger.warn(`[Snapshotter] Restauré: ${snap.id?.slice(0, 8)}`);
  });

  if (settings.snapshots?.autoSave) {
    snapshotter.startAutoSave(settings.snapshots.autoSaveIntervalMs ?? WORLD.AUTO_SAVE_MS);
    logger.info(`[Bootstrap] AutoSave: ${settings.snapshots.autoSaveIntervalMs}ms`);
  }
}

// ============================================================
//  GAME LOOP
// ============================================================

function startGameLoop(ctx: AppContext): void {
  const { settings, worldState, entityManager } = ctx;
  const TICK_MS = Math.round(1000 / Math.max(1, settings.server.tickRate));
  let lastTick  = Date.now();

  setInterval(() => {
    const now = Date.now();
    const dt  = Math.min((now - lastTick) / 1000, 0.1);
    lastTick  = now;

    if (!worldState.isRunning) return;
    worldState.update(dt);
    entityManager.update(dt);
  }, TICK_MS);

  logger.info(`[Bootstrap] Game Loop: ${settings.server.tickRate} tick/s (${TICK_MS}ms)`);
}

// ============================================================
//  GRACEFUL SHUTDOWN
// ============================================================

function setupShutdown(
  server: ReturnType<typeof createServer>,
  ctx:    AppContext,
): void {
  const { snapshotter, settings, physics, db, gateway, bus } = ctx;

  const shutdown = async (signal: string): Promise<void> => {
    logger.warn(`[Server] ${signal} — arrêt propre...`);

    if (settings.snapshots?.onShutdown) {
      const snap = snapshotter.create('backup', `Shutdown — ${signal}`);
      if (snap) logger.info(`[Server] 💾 Backup: ${snap.id.slice(0, 8)}`);
    }

    try {
      gateway.broadcast({
        type:      'CHAT',
        payload:   { sender: 'System', text: `🔴 Serveur en arrêt (${signal})`, type: 'system' },
        timestamp: Date.now(),
      });
      await new Promise(r => setTimeout(r, 500));
    } catch { /* ignore */ }

    // Dispose dans l'ordre inverse de l'init
    const disposables = [physics, snapshotter, db, gateway, bus];
    for (const d of disposables) {
      try { (d as any).dispose?.(); } catch { /* ignore */ }
    }

    server.close((err) => {
      if (err) {
        logger.error('[Server] Erreur fermeture:', err);
        process.exit(1);
      } else {
        logger.info('[Server] ✅ Arrêt propre terminé');
        process.exit(0);
      }
    });

    // Force exit après 8s
    setTimeout(() => {
      logger.error('[Server] ⚠️ Force exit');
      process.exit(1);
    }, 8_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  process.on('uncaughtException', (err: Error) => {
    logger.error('[Server] 💥 UncaughtException:', err);
    setTimeout(() => process.exit(1), 1_000);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const msg = (reason as Error)?.message ?? String(reason);
    logger.error('[Server] 💥 UnhandledRejection:', msg);
  });
}

// ============================================================
//  UTILS
// ============================================================

function ensureDirectories(settings: ServerSettings): void {
  const __dir  = path.dirname(fileURLToPath(import.meta.url));
  const dirs   = [
    path.join(__dir, 'data'),
    path.join(__dir, settings.snapshots?.dir  ?? 'data/snapshots'),
    path.join(__dir, '..', settings.logging?.dir ?? 'logs'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
      logger.debug(`[Bootstrap] Dossier créé: ${d}`);
    }
  }
}

// ============================================================
//  BANNER
// ============================================================

function printBanner(
  settings: ServerSettings,
  phase:    'start' | 'ready',
  port?:    number,
): void {
  const B  = '║';
  const T  = '╔' + '═'.repeat(56) + '╗';
  const M  = '╠' + '═'.repeat(56) + '╣';
  const E  = '╚' + '═'.repeat(56) + '╝';
  const ln = (s: string) =>
    `${B} ${s.slice(0, 54).padEnd(54)} ${B}`;

  if (phase === 'start') {
    console.log('');
    console.log(T);
    console.log(ln(`🎮 ${settings.server.name}`));
    console.log(ln(`📌 v${settings.server.version} — Build: ${settings.server.build}`));
    console.log(ln(`🌍 ${settings.world.name} — ${settings.server.locale}`));
    console.log(ln(`🕐 ${new Date().toLocaleString(settings.server.locale)}`));
    console.log(E);
    console.log('');
    return;
  }

  // Phase ready
  console.log('');
  console.log(T);
  console.log(ln('✅  SERVEUR EN LIGNE'));
  console.log(M);
  console.log(ln(`🌐  HTTP      → http://localhost:${port}`));
  console.log(ln(`🔌  WebSocket → ws://localhost:${port}`));
  console.log(M);
  console.log(ln('📊  /api/admin/metrics        Métriques live'));
  console.log(ln('🗄️   /api/prism/tables         EtherPrism DB'));
  console.log(ln('🌍  /api/world/stats          Catalogue assets'));
  console.log(ln('🏠  /api/property/catalog     Immobilier RP'));
  console.log(ln('🧠  /api/brain/status         TroxT Brain'));
  console.log(ln('👁️   /api/brain/thirdeye       Third Eye'));
  console.log(ln('❤️   /api/health               Health check'));
  console.log(M);
  console.log(ln(`⏱️   Tick: ${settings.server.tickRate}/s | Max: ${settings.server.maxEntities} entités`));
  console.log(ln(`👥  Max: ${settings.websocket.maxConnections} joueurs`));
  console.log(ln(`🧠  Brain: ${settings.features?.troxtBrain ? '🟢 ACTIF' : '🔴 INACTIF'} | Eye: ${settings.features?.troxtThirdEye ? '🟢 ACTIF' : '🔴 INACTIF'}`));
  console.log(ln(`💾  AutoSave: ${settings.snapshots?.autoSave ? `${(settings.snapshots.autoSaveIntervalMs ?? 60000) / 1000}s` : 'OFF'}`));
  console.log(E);
  console.log('');
}

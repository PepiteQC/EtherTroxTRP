// server/lib/settings.ts
// ============================================================
//  Settings loader — Lit, valide et expose settings.json
//  Type-safe, avec valeurs par défaut
// ============================================================

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Types ─────────────────────────────────────────────────────
export interface ServerConfig {
  name:        string;
  version:     string;
  environment: 'development' | 'production' | 'test';
  port:        number;
  tickRate:    number;
  maxEntities: number;
  sandbox:     boolean;
  debug:       boolean;
  locale:      string;
  timezone:    string;
  build:       string;
}

export interface SecurityConfig {
  rateLimiting:        boolean;
  maxRequestsPerMin:   number;
  banOnCheat:          boolean;
  logSuspiciousActions: boolean;
  allowedOrigins:      string[];
  jwtEnabled:          boolean;
  jwtSecret:           string;
  adminIPs:            string[];
}

export interface DatabaseConfig {
  type:            string;
  file:            string;
  autoSeed:        boolean;
  seedOnEmpty:     boolean;
  flushIntervalMs: number;
  tables:          string[];
}

export interface WebsocketConfig {
  path:               string;
  heartbeatIntervalMs: number;
  broadcastRateMs:    number;
  maxConnections:     number;
  compression:        boolean;
  pingTimeoutMs:      number;
  maxMessageSizeKb:   number;
}

export interface LoggingConfig {
  label:           string;
  level:           string;
  toFile:          boolean;
  dir:             string;
  rotateDaily:     boolean;
  maxFileSizeMb:   number;
  maxFiles:        number;
  format:          string;
  includeTimestamp: boolean;
}

export interface ServerSettings {
  server:    ServerConfig;
  security:  SecurityConfig;
  database:  DatabaseConfig;
  websocket: WebsocketConfig;
  logging:   LoggingConfig;
  [key: string]: unknown;
}

// ── Valeurs par défaut ────────────────────────────────────────
const DEFAULTS: Partial<ServerSettings> = {
  server: {
    name:        'TroxT City RP',
    version:     '1.0.0',
    environment: 'development',
    port:        5000,
    tickRate:    20,
    maxEntities: 2000,
    sandbox:     true,
    debug:       false,
    locale:      'fr-CA',
    timezone:    'America/Montreal',
    build:       'green',
  },
  security: {
    rateLimiting:         true,
    maxRequestsPerMin:    120,
    banOnCheat:           false,
    logSuspiciousActions: true,
    allowedOrigins:       ['http://localhost:3000'],
    jwtEnabled:           false,
    jwtSecret:            'CHANGE_ME',
    adminIPs:             ['127.0.0.1'],
  },
};

// ── Loader ────────────────────────────────────────────────────
export function loadSettings(
  settingsPath?: string,
): ServerSettings {
  const filePath = settingsPath
    ?? path.join(__dirname, '../../settings.json');

  if (!fs.existsSync(filePath)) {
    logger.warn(`[Settings] Fichier introuvable: ${filePath} — utilisation des valeurs par défaut`);
    return DEFAULTS as ServerSettings;
  }

  try {
    const raw  = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ServerSettings;

    // Merge superficiel avec les defaults pour les clés manquantes
    const merged = {
      ...DEFAULTS,
      ...data,
      server:   { ...DEFAULTS.server,   ...data.server   },
      security: { ...DEFAULTS.security, ...data.security },
    } as ServerSettings;

    // Surcharge par variables d'environnement
    if (process.env['PORT']) {
      merged.server.port = Number(process.env['PORT']);
    }
    if (process.env['NODE_ENV']) {
      merged.server.environment = process.env['NODE_ENV'] as ServerConfig['environment'];
    }
    if (process.env['JWT_SECRET']) {
      merged.security.jwtSecret = process.env['JWT_SECRET'];
    }

    logger.info(`[Settings] Chargé: ${merged.server.name} v${merged.server.version}`);
    return merged;
  } catch (err) {
    logger.error(`[Settings] Erreur de parsing: ${(err as Error).message}`);
    throw new Error(`Impossible de charger settings.json: ${(err as Error).message}`);
  }
}

// ── Utilitaires ───────────────────────────────────────────────
export function getPublicSettings(
  settings: ServerSettings,
): Omit<ServerSettings, 'security' | 'dev' | 'logging'> {
  const { security: _s, dev: _d, logging: _l, ...pub } = settings;
  return pub;
}
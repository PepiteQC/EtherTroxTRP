// server/lib/logger.ts
// ============================================================
//  Logger — Winston structuré + Request middleware
//  Remplace le logger minimal précédent
// ============================================================

import winston                from 'winston';
import path                   from 'path';
import { fileURLToPath }      from 'url';
import type { Request, Response, NextFunction } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Format ───────────────────────────────────────────────────
const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n  ${JSON.stringify(meta, null, 2)}`
      : '';
    return `${ts} [${level}] ${stack ?? message}${metaStr}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

// ── Transport helpers ─────────────────────────────────────────
function makeFileTransports(logDir: string) {
  return [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level:    'error',
      maxsize:  20 * 1024 * 1024,
      maxFiles: 14,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize:  20 * 1024 * 1024,
      maxFiles: 14,
      tailable: true,
    }),
  ];
}

// ── Factory ───────────────────────────────────────────────────
export function createLogger(options?: {
  level?:  string;
  toFile?: boolean;
  dir?:    string;
  label?:  string;
}) {
  const isDev    = process.env['NODE_ENV'] !== 'production';
  const logDir   = options?.dir   ?? path.join(__dirname, '../../logs');
  const logLevel = options?.level ?? (isDev ? 'debug' : 'info');

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: isDev ? devFormat : prodFormat,
    }),
  ];

  if (options?.toFile) {
    transports.push(...makeFileTransports(logDir));
  }

  return winston.createLogger({
    level:       logLevel,
    defaultMeta: { service: options?.label ?? 'TroxT' },
    transports,
  });
}

// ── Singleton partagé ─────────────────────────────────────────
export const logger = createLogger({
  level:  process.env['LOG_LEVEL'] ?? 'info',
  toFile: process.env['NODE_ENV'] === 'production',
  dir:    path.join(__dirname, '../../logs'),
  label:  'TroxTAudit',
});

// ── Express middleware ────────────────────────────────────────
export function requestLogger(
  req:  Request,
  res:  Response,
  next: NextFunction,
): void {
  const start = Date.now();

  res.on('finish', () => {
    const ms     = Date.now() - start;
    const level  = res.statusCode >= 500
      ? 'error'
      : res.statusCode >= 400
        ? 'warn'
        : 'info';

    logger[level]({
      method:  req.method,
      path:    req.path,
      status:  res.statusCode,
      ms,
      ip:      req.ip,
      ua:      req.headers['user-agent'] ?? '',
    });
  });

  next();
}

export type AppLogger = typeof logger;
// ── Compat export — getLogger() retourne le singleton ────────
export function getLogger() {
  return logger;
}

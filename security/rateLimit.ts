// server/security/rateLimit.ts
// ============================================================
//  RATE LIMITER — Limite requêtes par IP
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../lib/errors';
import { getLogger }      from '../lib/logger';

interface RateLimitEntry {
  count: number;
  reset: number;
}

const _store = new Map<string, RateLimitEntry>();

// Nettoyer les entrées expirées toutes les minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _store.entries()) {
    if (now > entry.reset) _store.delete(key);
  }
}, 60000);

export function rateLimitMiddleware(maxPerMin: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip  = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    const entry = _store.get(ip);

    if (!entry || now > entry.reset) {
      _store.set(ip, { count: 1, reset: now + 60000 });
      next();
      return;
    }

    entry.count++;

    if (entry.count > maxPerMin) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      try {
        getLogger().warn('security:rate_limit', `Rate limit: ${ip}`, { ip, count: entry.count });
      } catch {}
      next(new RateLimitError(retryAfter));
      return;
    }

    next();
  };
}

export function getRequestCount(ip: string): number {
  return _store.get(ip)?.count ?? 0;
}
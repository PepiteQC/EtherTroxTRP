// server/lib/errors.ts
// ============================================================
//  ERRORS — Gestion centralisée des erreurs API
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js'; // Correction: import logger, pas getLogger

// ──────────────────────────────────────────
//  CUSTOM ERRORS
// ──────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code:       string,
    message:                    string,
    public readonly data?:      any,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} introuvable`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, data?: any) {
    super(400, 'VALIDATION_ERROR', message, data);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non autorisé') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(429, 'RATE_LIMIT', `Trop de requêtes. Réessayer dans ${retryAfter}s`, { retryAfter });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(503, 'SERVICE_UNAVAILABLE', `${service} temporairement indisponible`);
  }
}

// ──────────────────────────────────────────
//  ERROR HANDLER MIDDLEWARE
// ──────────────────────────────────────────

export function errorHandler(
  err:  Error,
  _req: Request,
  res:  Response,
  _next: NextFunction,
): void {
  try {
    // Utilisation directe du logger exporté
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error(`api:error — ${err.message}`, { code: err.code, data: err.data });
      } else {
        logger.warn(`api:client_error — ${err.message}`, { code: err.code });
      }

      res.status(err.statusCode).json({
        success: false,
        error:   err.message,
        code:    err.code,
        ...(err.data ? { details: err.data } : {}),
      });
    } else {
      logger.error(`api:unhandled — ${err.message}`, { stack: err.stack });

      res.status(500).json({
        success: false,
        error:   'Erreur interne du serveur',
        code:    'INTERNAL_ERROR',
      });
    }
  } catch (criticalErr) {
    console.error('Erreur dans le errorHandler:', criticalErr);
    res.status(500).json({ success: false, error: 'Erreur critique' });
  }
}

// ──────────────────────────────────────────
//  ASYNC WRAPPER
// ──────────────────────────────────────────

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
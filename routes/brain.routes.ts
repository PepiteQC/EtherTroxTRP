// server/routes/brain.routes.ts
// ============================================================
//  TroxT Brain API — 7 endpoints
//  Injection via middleware, pas de singleton global
// ============================================================

import { Router }      from 'express';
import { asyncHandler, AppError } from '../lib/errors.js';
import type { Request, Response, NextFunction } from 'express';
import type { TroxtBrain }        from '@workspace/troxt-brain';
import type { TaskPacket, AgentName, TaskPriority } from '../../shared/types/server.types.js';

// ── Augmentation du type Request pour injecter le Brain ───────
declare global {
  namespace Express {
    interface Request {
      brain: TroxtBrain;
    }
  }
}

// ── Middleware d'injection ────────────────────────────────────
export function injectBrain(brain: TroxtBrain) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.brain = brain;
    next();
  };
}

// ── Validation helpers ────────────────────────────────────────
function requireString(
  value: unknown,
  name:  string,
  maxLength = 2000,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw AppError.badRequest(`${name} requis (string non vide)`);
  }
  if (value.length > maxLength) {
    throw AppError.badRequest(`${name} trop long (max ${maxLength} caractères)`);
  }
  return value.trim();
}

// ── Router factory ────────────────────────────────────────────
export function createBrainRouter(brain: TroxtBrain): Router {
  const router = Router();

  // Injection sur toutes les routes de ce routeur
  router.use(injectBrain(brain));

  // ── GET /api/brain/status ───────────────────────────────
  router.get('/status', asyncHandler(async (_req, res) => {
    const status = _req.brain.getStatus();
    res.json({ ok: true, data: status });
  }));

  // ── GET /api/brain/history ──────────────────────────────
  router.get('/history', asyncHandler(async (req, res) => {
    const limit   = Math.min(Number(req.query['limit'] ?? 20), 100);
    const records = req.brain.history.recent(limit);
    const stats   = req.brain.history.stats();
    res.json({ ok: true, data: { records, stats, limit } });
  }));

  // ── POST /api/brain/process ─────────────────────────────
  router.post('/process', asyncHandler(async (req, res) => {
    const input  = requireString((req.body as Record<string, unknown>)['input'], 'input');
    const record = await req.brain.process(input);
    res.json({ ok: true, data: record });
  }));

  // ── GET /api/brain/agents ───────────────────────────────
  router.get('/agents', asyncHandler(async (req, res) => {
    const telemetry  = req.brain.bus.getAllTelemetry();
    const stats      = req.brain.bus.getAllStats();
    const scores     = req.brain.scoreHistory.allAgentSummary();
    const agentNames = req.brain.bus.getAgentNames();
    res.json({ ok: true, data: { telemetry, stats, scores, agentNames } });
  }));

  // ── POST /api/brain/task ────────────────────────────────
  router.post('/task', asyncHandler(async (req, res) => {
    const body = req.body as Partial<{
      targetAgent: AgentName;
      mission:     string;
      priority:    TaskPriority;
      input:       Record<string, unknown>;
    }>;

    const targetAgent = requireString(body.targetAgent, 'targetAgent') as AgentName;
    const mission     = requireString(body.mission,     'mission');

    const packet: TaskPacket = {
      id:             crypto.randomUUID(),
      targetAgent,
      mission,
      context:        'Manuel — Admin Console',
      input:          body.input    ?? {},
      expectedOutput: 'Structured result',
      rules:          ["Respecter le rôle de l'agent", 'Retourner un résultat structuré'],
      priority:       body.priority ?? 'medium',
      dependencies:   [],
      validationBy:   'TroxTBrain',
      createdAt:      Date.now(),
    };

    const result = await req.brain.bus.dispatch(packet);
    const score  = req.brain.thirdEye.scoreResult(result);
    res.json({ ok: true, data: { result, score, packet } });
  }));

  // ── GET /api/brain/thirdeye ─────────────────────────────
  router.get('/thirdeye', asyncHandler(async (req, res) => {
    const level           = req.query['level'] as string | undefined;
    const includeResolved = req.query['resolved'] === 'true';
    const alerts          = req.brain.thirdEye.getAlerts(level as any, includeResolved);
    const thirdEyeStatus  = req.brain.thirdEye.getStatus();
    res.json({ ok: true, data: { ...thirdEyeStatus, alerts } });
  }));

  // ── POST /api/brain/thirdeye/resolve ────────────────────
  router.post('/thirdeye/resolve', asyncHandler(async (req, res) => {
    const alertId = requireString((req.body as Record<string, unknown>)['alertId'], 'alertId');
    req.brain.thirdEye.resolveAlert(alertId);
    res.json({ ok: true, data: { resolved: alertId, at: Date.now() } });
  }));

  return router;
}

// Export par défaut — utilisé si le Brain est instancié à l'extérieur
export { createBrainRouter as brainRouter };
// server/routes/agents.routes.ts
// ============================================================
//  AGENTS ROUTES V2
//  Brain · AgentBus · Intellectus · ThirdEye · Tasks · SSE
// ============================================================

import { Router, Request, Response } from 'express';
import { TroxTBrain }        from '../troxt-core/Brain';
import { ServerIntellectus } from '../intellectus/ServerIntellectus';
import { ThirdEye }          from '../troxt-core/ThirdEye';
import { AgentBus }          from '../troxt-core/AgentBus';
import { EventBus }          from '../engine/EventBus';
import { asyncHandler }      from '../lib/errors';
import { getLogger }         from '../lib/logger';
import { NotFoundError, ValidationError } from '../lib/errors';
import type { AgentId }      from '../troxt-core/types';
import { v4 as uuidv4 }      from 'uuid';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────

const VALID_AGENTS: AgentId[] = [
  'ether-forge',
  'ether-weave',
  'ether-guard',
  'ether-lens',
  'ether-prism',
  'ether-ui',
  'ether-sim',
  'forge-factory',
];

const VALID_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;

// ─────────────────────────────────────────────────────────────
//  TASK STORE
// ─────────────────────────────────────────────────────────────

interface TaskEntry {
  id:          string;
  prompt:      string;
  agentId:     string | null;
  status:      'pending' | 'running' | 'done' | 'failed';
  priority:    string;
  startedAt:   number;
  endedAt?:    number;
  result?:     any;
  error?:      string;
  source:      string;
  score?:      number;
}

// ─────────────────────────────────────────────────────────────
//  FACTORY
// ─────────────────────────────────────────────────────────────

export function createAgentsRouter(
  brain:       TroxTBrain,
  intellectus: ServerIntellectus,
  thirdEye:    ThirdEye,
): Router {
  const router  = Router();
  const bus     = AgentBus.getInstance();
  const eventBus = EventBus.getInstance();
  const logger  = getLogger();

  const tasks   = new Map<string, TaskEntry>();

  // ─────────────────────────────────────────────────────────
  //  GET /  — Overview global
  // ─────────────────────────────────────────────────────────

  router.get('/', asyncHandler(async (req, res) => {
    const memLimit  = Math.min(parseInt(req.query.memLimit  as string) || 20, 100);
    const histLimit = Math.min(parseInt(req.query.histLimit as string) || 20, 100);

    const counts = { total: 0, running: 0, done: 0, failed: 0, pending: 0 };
    for (const t of tasks.values()) { counts.total++; counts[t.status]++; }

    res.json({
      ok:        true,
      timestamp: Date.now(),

      brain: {
        status:  brain.getStatus(),
        history: brain.getHistory(histLimit),
      },

      agents: {
        list:      VALID_AGENTS,
        status:    bus.getAgentStatus(),
        scheduler: bus.getSchedulerMetrics(),
      },

      memory: {
        entries: intellectus.memory.query({ limit: memLimit }),
        metrics: intellectus.memory.getMetrics(),
      },

      thirdEye: {
        health:  thirdEye.getHealth(),
        status:  thirdEye.getStatus(),
        alerts:  thirdEye.getAlerts(5),
      },

      tasks: {
        counts,
        recent: [...tasks.values()]
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, 5),
      },

      intellectus: intellectus.snapshot(),
    });
  }));

  // ─────────────────────────────────────────────────────────
  //  GET /agents  — Liste agents enrichie
  // ─────────────────────────────────────────────────────────

  router.get('/agents', asyncHandler(async (_req, res) => {
    const status    = bus.getAgentStatus();
    const scheduler = bus.getSchedulerMetrics();

    const agents = VALID_AGENTS.map(id => ({
      id,
      status:   status[id]              ?? 'unknown',
      circuit:  thirdEye.getCircuit(id),
      baseline: thirdEye.getBaseline(id),
      recentAlerts: thirdEye.getAlerts(100)
        .filter(a => a.agentId === id)
        .slice(0, 3),
    }));

    res.json({
      ok:        true,
      count:     agents.length,
      agents,
      scheduler,
    });
  }));

  // ─────────────────────────────────────────────────────────
  //  GET /agents/:id  — Détail agent
  // ─────────────────────────────────────────────────────────

  router.get('/agents/:id', asyncHandler(async (req, res) => {
    const agentId = req.params.id as AgentId;
    if (!VALID_AGENTS.includes(agentId)) {
      throw new NotFoundError(`Agent inconnu: ${agentId}`);
    }

    const agentTasks = [...tasks.values()]
      .filter(t => t.agentId === agentId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 20);

    const successCount = agentTasks.filter(t => t.status === 'done').length;
    const avgScore     = agentTasks.filter(t => t.score).length
      ? Math.round(agentTasks.reduce((s, t) => s + (t.score ?? 0), 0) / agentTasks.filter(t => t.score).length)
      : null;

    res.json({
      ok:       true,
      agentId,
      status:   (bus.getAgentStatus())[agentId] ?? 'unknown',
      circuit:  thirdEye.getCircuit(agentId),
      baseline: thirdEye.getBaseline(agentId),
      alerts:   thirdEye.getAlerts(100).filter(a => a.agentId === agentId).slice(0, 10),
      memory:   intellectus.memory.query({ tags: [agentId], limit: 20 }),
      tasks: {
        list:         agentTasks,
        total:        agentTasks.length,
        successCount,
        failCount:    agentTasks.filter(t => t.status === 'failed').length,
        avgScore,
      },
    });
  }));

  // ─────────────────────────────────────────────────────────
  //  POST /agents/:id/task  — Dispatch tâche directe
  // ─────────────────────────────────────────────────────────

  router.post('/agents/:id/task', asyncHandler(async (req, res) => {
    const agentId = req.params.id as AgentId;

    if (!VALID_AGENTS.includes(agentId)) {
      throw new ValidationError(
        `Agent invalide: ${agentId}. Valides: ${VALID_AGENTS.join(', ')}`,
      );
    }

    const {
      mission,
      input    = { validated: true },
      priority = 'normal',
      timeout  = 15000,
      expected = 'Résultat agent',
    } = req.body;

    if (!mission || typeof mission !== 'string') {
      throw new ValidationError('mission (string) requis');
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      throw new ValidationError(
        `priority invalide. Valides: ${VALID_PRIORITIES.join(', ')}`,
      );
    }

    const taskId  = uuidv4();
    const entry: TaskEntry = {
      id:        taskId,
      prompt:    mission,
      agentId,
      status:    'running',
      priority,
      startedAt: Date.now(),
      source:    'agents-api',
    };

    tasks.set(taskId, entry);

    // Prédiction ThirdEye avant dispatch
    const prediction = thirdEye.predict(agentId, mission, input);
    if (prediction.severity === 'high') {
      logger.warn('agents:dispatch', `High risk for ${agentId}: ${prediction.risk}`);
    }

    try {
      const result = await bus.dispatch({
        taskId,
        planId:  'direct-api',
        agent:   agentId,
        mission,
        input,
        expected,
        priority,
        timeout,
        sentAt:  Date.now(),
      });

      const score = thirdEye.scoreResult(result);

      tasks.set(taskId, {
        ...entry,
        status:  result.success ? 'done' : 'failed',
        endedAt: Date.now(),
        result,
        error:   result.error,
        score,
      });

      logger.info(
        'agents:task',
        `${agentId} → ${result.success ? 'OK' : 'FAIL'} (score: ${score})`,
      );

      res.json({
        ok:         result.success,
        taskId,
        agentId,
        result,
        score,
        prediction,
        duration:   Date.now() - entry.startedAt,
      });

    } catch (err: any) {
      tasks.set(taskId, {
        ...entry,
        status:  'failed',
        endedAt: Date.now(),
        error:   err.message,
      });
      throw err;
    }
  }));

  // ─────────────────────────────────────────────────────────
  //  POST /task  — Brain complet prompt → plan → exécution
  // ─────────────────────────────────────────────────────────

  router.post('/task', asyncHandler(async (req, res) => {
    const prompt = (
      req.body?.prompt    ||
      req.body?.objective ||
      req.body?.mission   ||
      ''
    ).trim();

    if (!prompt) {
      throw new ValidationError('prompt / objective / mission requis');
    }

    if (prompt.length > 4000) {
      throw new ValidationError('Prompt trop long (max 4000 caractères)');
    }

    const requestedBy = req.body?.requestedBy ?? req.body?.source ?? 'agents-api';
    const taskId      = uuidv4();

    const entry: TaskEntry = {
      id:        taskId,
      prompt,
      agentId:   null,
      status:    'running',
      priority:  req.body?.priority ?? 'normal',
      startedAt: Date.now(),
      source:    requestedBy,
    };

    tasks.set(taskId, entry);
    logger.info('agents:brain', `Process: "${prompt.slice(0, 80)}..." by ${requestedBy}`);

    try {
      const decision = await brain.process(prompt, requestedBy);

      tasks.set(taskId, {
        ...entry,
        status:  decision.success ? 'done' : 'failed',
        endedAt: Date.now(),
        result:  decision,
      });

      res.json({
        ok:       true,
        taskId,
        decision,
        thirdEye: {
          health: thirdEye.getHealth(),
          alerts: thirdEye.getAlerts(3),
        },
      });

    } catch (err: any) {
      tasks.set(taskId, {
        ...entry,
        status:  'failed',
        endedAt: Date.now(),
        error:   err.message,
      });
      throw err;
    }
  }));

  // ─────────────────────────────────────────────────────────
  //  TASKS CRUD
  // ─────────────────────────────────────────────────────────

  router.get('/tasks', asyncHandler(async (req, res) => {
    const limit    = Math.min(parseInt(req.query.limit  as string) || 50, 200);
    const status   = req.query.status  as string | undefined;
    const agentId  = req.query.agent   as string | undefined;
    const source   = req.query.source  as string | undefined;

    let list = [...tasks.values()];

    if (status)  list = list.filter(t => t.status  === status);
    if (agentId) list = list.filter(t => t.agentId === agentId);
    if (source)  list = list.filter(t => t.source  === source);

    list = list.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);

    const counts = { total: 0, pending: 0, running: 0, done: 0, failed: 0 };
    for (const t of tasks.values()) { counts.total++; counts[t.status]++; }

    res.json({
      ok:     true,
      tasks:  list,
      count:  list.length,
      counts,
      filter: { status: status ?? 'all', agent: agentId ?? 'all', source: source ?? 'all', limit },
    });
  }));

  router.get('/tasks/:id', asyncHandler(async (req, res) => {
    const task = tasks.get(req.params.id);
    if (!task) throw new NotFoundError(`Task ${req.params.id} introuvable`);

    const score = task.taskId ? thirdEye.getScore(req.params.id) : null;
    res.json({ ok: true, task, score });
  }));

  router.delete('/tasks/:id', asyncHandler(async (req, res) => {
    const task = tasks.get(req.params.id);
    if (!task) throw new NotFoundError(`Task ${req.params.id} introuvable`);

    if (task.status === 'running') {
      return res.status(409).json({
        ok:    false,
        error: 'Impossible de supprimer une tâche en cours',
      });
    }

    tasks.delete(req.params.id);
    res.json({ ok: true, deleted: req.params.id });
  }));

  router.post('/tasks/:id/retry', asyncHandler(async (req, res) => {
    const task = tasks.get(req.params.id);
    if (!task) throw new NotFoundError(`Task ${req.params.id} introuvable`);

    if (task.status === 'running') {
      return res.status(409).json({ ok: false, error: 'Tâche déjà en cours' });
    }

    if (task.status !== 'failed') {
      return res.status(400).json({
        ok:    false,
        error: `Retry uniquement sur tâches échouées (actuel: ${task.status})`,
      });
    }

    tasks.set(task.id, {
      ...task,
      status:    'running',
      startedAt: Date.now(),
      endedAt:   undefined,
      result:    undefined,
      error:     undefined,
    });

    const decision = await brain.process(task.prompt, task.source);

    tasks.set(task.id, {
      ...task,
      status:  decision.success ? 'done' : 'failed',
      endedAt: Date.now(),
      result:  decision,
    });

    res.json({ ok: true, taskId: task.id, decision });
  }));

  router.delete('/tasks', asyncHandler(async (_req, res) => {
    let removed = 0;
    for (const [id, t] of tasks.entries()) {
      if (t.status !== 'running') { tasks.delete(id); removed++; }
    }
    res.json({ ok: true, removed });
  }));

  // ─────────────────────────────────────────────────────────
  //  MEMORY CRUD
  // ─────────────────────────────────────────────────────────

  router.get('/memory', asyncHandler(async (req, res) => {
    const tags      = (req.query.tags as string)?.split(',').filter(Boolean) ?? [];
    const source    = req.query.source    as string | undefined;
    const keyPrefix = req.query.keyPrefix as string | undefined;
    const limit     = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const entries = intellectus.memory.query({
      tags:      tags.length ? tags : undefined,
      source,
      keyPrefix,
      limit,
    });

    res.json({
      ok:      true,
      entries,
      count:   entries.length,
      metrics: intellectus.memory.getMetrics(),
    });
  }));

  router.get('/memory/:key', asyncHandler(async (req, res) => {
    const value = intellectus.memory.get(req.params.key);
    if (value === null) throw new NotFoundError(`Clé ${req.params.key} introuvable`);
    res.json({ ok: true, key: req.params.key, value });
  }));

  router.post('/memory', asyncHandler(async (req, res) => {
    const { key, value, tags = [], source = 'api', ttl } = req.body;
    if (!key || typeof key !== 'string') throw new ValidationError('key (string) requis');
    if (value === undefined)             throw new ValidationError('value requis');

    const entry = intellectus.memory.set(key, value, { source, tags, ttl });
    res.status(201).json({ ok: true, entry });
  }));

  router.delete('/memory/:key', asyncHandler(async (req, res) => {
    const ok = intellectus.memory.delete(req.params.key);
    if (!ok) throw new NotFoundError(`Clé ${req.params.key} introuvable`);
    res.json({ ok: true, deleted: req.params.key });
  }));

  router.delete('/memory', asyncHandler(async (_req, res) => {
    intellectus.memory.clear();
    res.json({ ok: true, message: 'Mémoire vidée' });
  }));

  // ─────────────────────────────────────────────────────────
  //  THIRDEYE
  // ─────────────────────────────────────────────────────────

  router.get('/thirdeye', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    res.json({
      ok:     true,
      health: thirdEye.getHealth(),
      status: thirdEye.getStatus(),
      alerts: thirdEye.getAlerts(limit),
    });
  }));

  router.get('/thirdeye/alerts', asyncHandler(async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const level  = req.query.level as string | undefined;
    const agent  = req.query.agent as string | undefined;

    let alerts = thirdEye.getAlerts(limit);
    if (level) alerts = alerts.filter(a => a.level  === level.toUpperCase());
    if (agent) alerts = alerts.filter(a => a.agentId === agent);

    res.json({ ok: true, alerts, count: alerts.length });
  }));

  router.post('/thirdeye/predict', asyncHandler(async (req, res) => {
    const { agentId, action = 'execute', context = {} } = req.body;

    if (!agentId) throw new ValidationError('agentId requis');
    if (!VALID_AGENTS.includes(agentId as AgentId)) {
      throw new ValidationError(`Agent invalide: ${agentId}`);
    }

    const prediction = thirdEye.predict(agentId as AgentId, action, context);
    res.json({ ok: true, agentId, action, prediction });
  }));

  router.get('/thirdeye/circuit/:agentId', asyncHandler(async (req, res) => {
    const agentId = req.params.agentId as AgentId;
    if (!VALID_AGENTS.includes(agentId)) {
      throw new NotFoundError(`Agent inconnu: ${agentId}`);
    }
    res.json({
      ok:       true,
      agentId,
      circuit:  thirdEye.getCircuit(agentId),
      baseline: thirdEye.getBaseline(agentId),
    });
  }));

  router.get('/thirdeye/score/:taskId', asyncHandler(async (req, res) => {
    const score = thirdEye.getScore(req.params.taskId);
    if (!score) throw new NotFoundError(`Score task ${req.params.taskId} introuvable`);
    res.json({ ok: true, score });
  }));

  // ─────────────────────────────────────────────────────────
  //  SCHEDULER
  // ─────────────────────────────────────────────────────────

  router.get('/scheduler', asyncHandler(async (req, res) => {
    const status = req.query.status as any;
    res.json({
      ok:      true,
      tasks:   intellectus.scheduler.list(status),
      metrics: intellectus.scheduler.getMetrics(),
    });
  }));

  router.delete('/scheduler/:id', asyncHandler(async (req, res) => {
    const ok = intellectus.scheduler.cancel(req.params.id, 'Cancelled via API');
    if (!ok) throw new NotFoundError(`Scheduled task ${req.params.id} introuvable`);
    res.json({ ok: true, cancelled: req.params.id });
  }));

  router.post('/scheduler/clear', asyncHandler(async (_req, res) => {
    const removed = intellectus.scheduler.clearCompleted();
    res.json({ ok: true, removed });
  }));

  // ─────────────────────────────────────────────────────────
  //  STATS
  // ─────────────────────────────────────────────────────────

  router.get('/stats', asyncHandler(async (_req, res) => {
    const counts = { total: 0, pending: 0, running: 0, done: 0, failed: 0 };
    for (const t of tasks.values()) { counts.total++; counts[t.status]++; }

    const agentActivity: Record<string, number> = {};
    for (const t of tasks.values()) {
      if (t.agentId) agentActivity[t.agentId] = (agentActivity[t.agentId] ?? 0) + 1;
    }

    res.json({
      ok:            true,
      timestamp:     Date.now(),
      tasks:         counts,
      agentActivity,
      memory:        intellectus.memory.getMetrics(),
      scheduler:     intellectus.scheduler.getMetrics(),
      thirdEye:      thirdEye.getStatus(),
      brain:         brain.getStatus(),
      agents:        bus.getAgentStatus(),
    });
  }));

  // ─────────────────────────────────────────────────────────
  //  SSE STREAM
  // ─────────────────────────────────────────────────────────

  router.get('/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type',      'text/event-stream');
    res.setHeader('Cache-Control',     'no-cache');
    res.setHeader('Connection',        'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify({ ...data, ts: Date.now() })}\n\n`);
    };

    send('connected', { agents: VALID_AGENTS, health: thirdEye.getHealth() });

    const onAlert    = (a: any) => send('alert',    { alert: a });
    const onDecision = (d: any) => send('decision', { decision: d });
    const onTelem    = (t: any) => send('telemetry',{ telem: t });

    const pulse = setInterval(() => {
      try {
        const counts = { running: 0, done: 0, failed: 0 };
        for (const t of tasks.values()) {
          if (t.status === 'running') counts.running++;
          if (t.status === 'done')    counts.done++;
          if (t.status === 'failed')  counts.failed++;
        }
        send('pulse', { health: thirdEye.getHealth(), tasks: counts });
      } catch { /* engine not ready */ }
    }, 5000);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

    eventBus.on('thirdeye:alert',  onAlert);
    eventBus.on('brain:decision',  onDecision);
    eventBus.on('agent:telemetry', onTelem);

    req.on('close', () => {
      clearInterval(pulse);
      clearInterval(heartbeat);
      eventBus.off('thirdeye:alert',  onAlert);
      eventBus.off('brain:decision',  onDecision);
      eventBus.off('agent:telemetry', onTelem);
    });
  });

  return router;
}

// ─────────────────────────────────────────────────────────────
//  EXPORT LEGACY
// ─────────────────────────────────────────────────────────────

export default function agentsRoutes(
  brain:       TroxTBrain,
  intellectus: ServerIntellectus,
  thirdEye:    ThirdEye,
): Router {
  return createAgentsRouter(brain, intellectus, thirdEye);
}
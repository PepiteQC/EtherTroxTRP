// server/intellectus/IntellectusRoutes.ts
// ============================================================
//  INTELLECTUS ROUTES — API complète pour le dashboard
//  Exposé dans server/index.ts sous /api/intellectus
// ============================================================

import { Router }            from 'express';
import { ServerIntellectus } from './ServerIntellectus';
import { AgentBus }          from '../troxt-core/AgentBus';
import { TroxTBrain }        from '../troxt-core/Brain';
import { ThirdEye }          from '../troxt-core/ThirdEye';
import { v4 as uuidv4 }     from 'uuid';

export const intellectusRouter = Router();

const si = () => ServerIntellectus.getInstance();

// ── Snapshot global ──────────────────────────────────────────
intellectusRouter.get('/snapshot', (_req, res) => {
  const brain    = TroxTBrain.getInstance();
  const eye      = ThirdEye.getInstance();
  const bus      = AgentBus.getInstance();

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    intellectus: si().snapshot(),
    brain:       brain.getStatus(),
    thirdEye:    eye.getStatus(),
    agents:      bus.getAgentStatus(),
  });
});

// ── Memory ───────────────────────────────────────────────────
intellectusRouter.get('/memory', (req, res) => {
  const tags      = (req.query.tags as string)?.split(',').filter(Boolean) ?? [];
  const source    = req.query.source    as string;
  const keyPrefix = req.query.keyPrefix as string;
  const limit     = Math.min(parseInt(req.query.limit as string) || 50, 200);

  const entries = si().memory.query({ tags: tags.length ? tags : undefined, source, keyPrefix, limit });
  const metrics = si().memory.getMetrics();

  res.json({
    success: true,
    entries,
    count:   entries.length,
    metrics,
  });
});

intellectusRouter.get('/memory/:key', (req, res) => {
  const value = si().memory.get(req.params.key);
  if (value === null) return res.status(404).json({ error: 'Clé introuvable' });
  res.json({ success: true, key: req.params.key, value });
});

intellectusRouter.delete('/memory/:key', (req, res) => {
  const ok = si().memory.delete(req.params.key);
  res.json({ success: ok });
});

intellectusRouter.delete('/memory', (_req, res) => {
  si().memory.clear();
  res.json({ success: true });
});

// ── Scheduler ────────────────────────────────────────────────
intellectusRouter.get('/scheduler', (req, res) => {
  const status = req.query.status as any;
  const tasks  = si().scheduler.list(status);
  res.json({
    success: true,
    tasks,
    count:   tasks.length,
    metrics: si().scheduler.getMetrics(),
  });
});

intellectusRouter.delete('/scheduler/:id', (req, res) => {
  const ok = si().scheduler.cancel(req.params.id, 'Cancelled via API');
  res.json({ success: ok });
});

intellectusRouter.post('/scheduler/clear', (_req, res) => {
  const removed = si().scheduler.clearCompleted();
  res.json({ success: true, removed });
});

// ── Contracts ────────────────────────────────────────────────
intellectusRouter.get('/contracts', (_req, res) => {
  const names     = si().contracts.list();
  const contracts = names.map(n => si().contracts.get(n));
  res.json({ success: true, contracts, count: names.length });
});

intellectusRouter.get('/contracts/:name', (req, res) => {
  const contract = si().contracts.get(req.params.name);
  if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });
  res.json({ success: true, contract });
});

intellectusRouter.post('/contracts/validate', (req, res) => {
  const { contract, data } = req.body;
  if (!contract) return res.status(400).json({ error: 'contract requis' });
  const result = si().contracts.validate(contract, data ?? {});
  res.json({ success: result.success, valid: result.success, issues: result.issues });
});

// ── Agents ───────────────────────────────────────────────────
intellectusRouter.get('/agents', (_req, res) => {
  const bus = AgentBus.getInstance();
  res.json({
    success: true,
    agents:  bus.getAgentStatus(),
    scheduler: bus.getSchedulerMetrics(),
  });
});

intellectusRouter.post('/agents/:agentId/task', async (req, res) => {
  const { mission, input, priority = 'normal', timeout = 15000 } = req.body;
  if (!mission) return res.status(400).json({ error: 'mission requis' });

  const valid = ['ether-forge', 'ether-lens', 'ether-prism', 'ether-weave', 'forge-factory'];
  if (!valid.includes(req.params.agentId)) {
    return res.status(400).json({ error: `Agent invalide`, valid });
  }

  const bus    = AgentBus.getInstance();
  const result = await bus.dispatch({
    taskId:   uuidv4(),
    planId:   'direct-api',
    agent:    req.params.agentId as any,
    mission,
    input:    input ?? { validated: true },
    expected: 'Résultat agent',
    priority,
    timeout,
    sentAt:   Date.now(),
  });

  res.json({ success: true, result });
});

// ── Brain ─────────────────────────────────────────────────────
intellectusRouter.get('/brain', (_req, res) => {
  const brain = TroxTBrain.getInstance();
  res.json({ success: true, status: brain.getStatus(), history: brain.getHistory(10) });
});

intellectusRouter.post('/brain/process', async (req, res) => {
  const { request: raw, requestedBy } = req.body;
  if (!raw) return res.status(400).json({ error: 'request requis' });

  const brain    = TroxTBrain.getInstance();
  const decision = await brain.process(raw, requestedBy ?? 'api');
  res.json({ success: true, decision });
});

// ── ThirdEye ─────────────────────────────────────────────────
intellectusRouter.get('/thirdeye', (_req, res) => {
  const eye   = ThirdEye.getInstance();
  const limit = parseInt('20');
  res.json({
    success: true,
    status:  eye.getStatus(),
    alerts:  eye.getAlerts(limit),
  });
});

// ── Metrics globales ──────────────────────────────────────────
intellectusRouter.get('/metrics', (_req, res) => {
  const brain = TroxTBrain.getInstance();
  const eye   = ThirdEye.getInstance();
  const bus   = AgentBus.getInstance();

  res.json({
    success:     true,
    timestamp:   Date.now(),
    intellectus: si().getMetrics(),
    brain:       brain.getStatus(),
    thirdEye: {
      status:  eye.getStatus(),
      alerts:  eye.getAlerts(5),
    },
    agents: {
      status:    bus.getAgentStatus(),
      scheduler: bus.getSchedulerMetrics(),
    },
  });
});
// server/intellectus/ServerIntellectus.ts
// ============================================================
//  INTELLECTUS SERVEUR — Noyaux côté serveur
//  Bus événements agents + Mémoire cognitive + Scheduler tasks
//  + Validation contrats + Orchestration commandes
// ============================================================

import { EventBus }     from '../engine/EventBus';
import type { AgentId } from '../troxt-core/types';

// ============================================================
//  TYPES PARTAGÉS INTELLECTUS
// ============================================================

export type Priority = 'critical' | 'high' | 'normal' | 'low' | 'idle';

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 100,
  high:     75,
  normal:   50,
  low:      25,
  idle:     0,
};

export interface TraceContext {
  traceId:       string;
  spanId:        string;
  parentSpanId?: string;
  correlationId?: string;
  causationId?:  string;
}

export interface Result<T, E = Error> {
  ok:     boolean;
  value?: T;
  error?: E;
}

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
//  AGENT EVENT — Événement structuré pour les agents
// ============================================================

export interface AgentEvent {
  id:        string;
  type:      string;
  source:    AgentId | 'brain' | 'thirdeye' | 'system';
  payload:   any;
  priority:  Priority;
  timestamp: number;
  trace:     TraceContext;
  metadata:  Record<string, any>;
}

// ============================================================
//  COGNITIVE MEMORY — Mémoire cognitive serveur (Lotus-like)
// ============================================================

export interface MemoryEntry<T = unknown> {
  key:           string;
  value:         T;
  source:        string;
  tags:          string[];
  version:       number;
  createdAt:     number;
  updatedAt:     number;
  lastAccessedAt: number;
  accessCount:   number;
  ttl?:          number;
  expiresAt?:    number;
}

export class CognitiveMemory {

  private _store    = new Map<string, MemoryEntry>();
  private _maxSize: number;
  private _hits     = 0;
  private _misses   = 0;
  private _writes   = 0;
  private _evictions = 0;
  private _cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: { maxEntries?: number; cleanupMs?: number } = {}) {
    this._maxSize = options.maxEntries ?? 5000;

    if (options.cleanupMs) {
      this._cleanupTimer = setInterval(() => this.cleanup(), options.cleanupMs);
    }
  }

  set<T>(
    key:   string,
    value: T,
    options: {
      source?: string;
      tags?:   string[];
      ttl?:    number;
      metadata?: Record<string, any>;
    } = {}
  ): MemoryEntry<T> {
    const now      = Date.now();
    const existing = this._store.get(key);
    const ttl      = options.ttl;

    const entry: MemoryEntry<T> = {
      key,
      value:          structuredClone(value),
      source:         options.source ?? 'system',
      tags:           [...new Set(options.tags ?? existing?.tags ?? [])],
      version:        (existing?.version ?? 0) + 1,
      createdAt:      existing?.createdAt ?? now,
      updatedAt:      now,
      lastAccessedAt: now,
      accessCount:    existing?.accessCount ?? 0,
      ttl,
      expiresAt:      ttl ? now + ttl : undefined,
    };

    this._store.set(key, entry);
    this._writes++;
    this._evictIfNeeded();
    return entry;
  }

  get<T>(key: string): T | null {
    const entry = this._store.get(key) as MemoryEntry<T> | undefined;
    if (!entry) { this._misses++; return null; }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this._misses++;
      return null;
    }

    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this._hits++;
    return structuredClone(entry.value);
  }

  has(key: string): boolean {
    const entry = this._store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this._store.delete(key);
  }

  query(options: {
    tags?:      string[];
    source?:    string;
    keyPrefix?: string;
    limit?:     number;
  } = {}): MemoryEntry[] {
    const now = Date.now();
    let results = [...this._store.values()].filter(e => {
      if (e.expiresAt && e.expiresAt <= now) return false;
      if (options.keyPrefix && !e.key.startsWith(options.keyPrefix)) return false;
      if (options.source && e.source !== options.source) return false;
      if (options.tags?.length) {
        return options.tags.some(t => e.tags.includes(t));
      }
      return true;
    });

    results.sort((a, b) => b.updatedAt - a.updatedAt);
    if (options.limit) results = results.slice(0, options.limit);
    return results;
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this._store) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this._store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  snapshot(): Record<string, any> {
    this.cleanup();
    const out: Record<string, any> = {};
    for (const [key, entry] of this._store) {
      out[key] = structuredClone(entry.value);
    }
    return out;
  }

  clear(): void {
    this._store.clear();
  }

  size(): number {
    return this._store.size;
  }

  getMetrics() {
    return {
      size:      this._store.size,
      maxSize:   this._maxSize,
      hits:      this._hits,
      misses:    this._misses,
      writes:    this._writes,
      evictions: this._evictions,
      hitRate:   this._hits + this._misses > 0
        ? Math.round((this._hits / (this._hits + this._misses)) * 100)
        : 0,
    };
  }

  dispose(): void {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._store.clear();
  }

  private _evictIfNeeded(): void {
    while (this._store.size > this._maxSize) {
      // LRU eviction
      let oldest: { key: string; at: number } | null = null;
      for (const [key, entry] of this._store) {
        if (!oldest || entry.lastAccessedAt < oldest.at) {
          oldest = { key, at: entry.lastAccessedAt };
        }
      }
      if (oldest) {
        this._store.delete(oldest.key);
        this._evictions++;
      } else break;
    }
  }
}

// ============================================================
//  TASK SCHEDULER — Planification de tâches agents (Momentus-like)
// ============================================================

export interface ScheduledTask {
  id:         string;
  agentId:    AgentId;
  mission:    string;
  priority:   Priority;
  scheduledAt: number;
  timeoutMs:  number;
  retryMax:   number;
  retryCount: number;
  status:     'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  result?:    any;
  error?:     string;
  startedAt?: number;
  endedAt?:   number;
  trace:      TraceContext;
}

export class TaskScheduler {

  private _tasks: Map<string, ScheduledTask> = new Map();
  private _queue: string[] = [];
  private _running     = 0;
  private _concurrency: number;
  private _counters    = { scheduled: 0, succeeded: 0, failed: 0, cancelled: 0 };

  constructor(options: { concurrency?: number } = {}) {
    this._concurrency = options.concurrency ?? 4;
  }

  schedule(
    agentId:  AgentId,
    mission:  string,
    executor: (task: ScheduledTask) => Promise<any>,
    options: {
      priority?:  Priority;
      timeoutMs?: number;
      retryMax?:  number;
      trace?:     Partial<TraceContext>;
    } = {}
  ): ScheduledTask {
    const id = createId('task');
    const traceId = options.trace?.traceId ?? createId('trace');

    const task: ScheduledTask = {
      id,
      agentId,
      mission,
      priority:    options.priority   ?? 'normal',
      scheduledAt: Date.now(),
      timeoutMs:   options.timeoutMs  ?? 15000,
      retryMax:    options.retryMax   ?? 1,
      retryCount:  0,
      status:      'queued',
      trace: {
        traceId,
        spanId:       createId('span'),
        parentSpanId: options.trace?.parentSpanId,
        correlationId: options.trace?.correlationId ?? traceId,
        causationId:   options.trace?.causationId,
      },
    };

    this._tasks.set(id, task);
    this._queue.push(id);
    this._counters.scheduled++;

    // Tri par priorité
    this._queue.sort((a, b) => {
      const tA = this._tasks.get(a)!;
      const tB = this._tasks.get(b)!;
      return PRIORITY_WEIGHT[tB.priority] - PRIORITY_WEIGHT[tA.priority];
    });

    // Pump
    this._pump(executor);

    return task;
  }

  cancel(id: string, reason = 'Cancelled'): boolean {
    const task = this._tasks.get(id);
    if (!task || task.status !== 'queued') return false;

    task.status = 'cancelled';
    task.error  = reason;
    task.endedAt = Date.now();
    this._queue = this._queue.filter(q => q !== id);
    this._counters.cancelled++;
    return true;
  }

  getTask(id: string): ScheduledTask | null {
    return this._tasks.get(id) ?? null;
  }

  list(status?: ScheduledTask['status']): ScheduledTask[] {
    const all = [...this._tasks.values()];
    if (status) return all.filter(t => t.status === status);
    return all.sort((a, b) => b.scheduledAt - a.scheduledAt);
  }

  getMetrics() {
    return {
      ...this._counters,
      running:  this._running,
      queued:   this._queue.length,
      total:    this._tasks.size,
    };
  }

  clearCompleted(): number {
    let removed = 0;
    for (const [id, task] of this._tasks) {
      if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled') {
        this._tasks.delete(id);
        removed++;
      }
    }
    return removed;
  }

  private async _pump(executor: (task: ScheduledTask) => Promise<any>): Promise<void> {
    while (this._running < this._concurrency && this._queue.length > 0) {
      const id = this._queue.shift();
      if (!id) break;

      const task = this._tasks.get(id);
      if (!task || task.status !== 'queued') continue;

      this._running++;
      task.status    = 'running';
      task.startedAt = Date.now();

      try {
        // Timeout wrapper
        const result = await Promise.race([
          executor(task),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${task.timeoutMs}ms`)), task.timeoutMs)
          ),
        ]);

        task.status  = 'succeeded';
        task.result  = result;
        task.endedAt = Date.now();
        this._counters.succeeded++;

      } catch (e: any) {
        task.retryCount++;

        if (task.retryCount < task.retryMax) {
          // Retry
          task.status = 'queued';
          this._queue.push(id);
          console.warn(`[TaskScheduler] Retry ${task.retryCount}/${task.retryMax}: ${task.id}`);
        } else {
          task.status  = 'failed';
          task.error   = e?.message ?? 'Unknown error';
          task.endedAt = Date.now();
          this._counters.failed++;
        }

      } finally {
        this._running--;
      }
    }
  }
}

// ============================================================
//  CONTRACT VALIDATOR — Validation des résultats agents (Benedictus-like)
// ============================================================

export interface ContractRule {
  field:    string;
  type:     'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
  required: boolean;
  min?:     number;
  max?:     number;
  pattern?: string;
  message?: string;
}

export interface ContractDef {
  name:        string;
  description: string;
  rules:       ContractRule[];
}

export interface ValidationIssue {
  field:   string;
  code:    string;
  message: string;
  received?: any;
}

export class ContractValidator {

  private _contracts = new Map<string, ContractDef>();

  register(name: string, def: ContractDef): void {
    this._contracts.set(name, def);
  }

  validate(name: string, data: any): {
    success: boolean;
    issues:  ValidationIssue[];
  } {
    const contract = this._contracts.get(name);
    if (!contract) {
      return { success: false, issues: [{ field: '', code: 'CONTRACT_NOT_FOUND', message: `Contract "${name}" not found` }] };
    }

    const issues: ValidationIssue[] = [];

    for (const rule of contract.rules) {
      const value = data?.[rule.field];

      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        issues.push({
          field:   rule.field,
          code:    'REQUIRED',
          message: rule.message ?? `${rule.field} is required`,
        });
        continue;
      }

      if (value === undefined || value === null) continue;

      // Type check
      if (rule.type !== 'any') {
        const actual = Array.isArray(value) ? 'array' : typeof value;
        if (actual !== rule.type) {
          issues.push({
            field:    rule.field,
            code:     'TYPE_MISMATCH',
            message:  `${rule.field}: expected ${rule.type}, got ${actual}`,
            received: actual,
          });
          continue;
        }
      }

      // Min/Max
      if (rule.min !== undefined) {
        const len = typeof value === 'string' ? value.length : typeof value === 'number' ? value : Array.isArray(value) ? value.length : 0;
        if (len < rule.min) {
          issues.push({
            field:    rule.field,
            code:     'TOO_SMALL',
            message:  `${rule.field}: minimum ${rule.min}`,
            received: len,
          });
        }
      }

      if (rule.max !== undefined) {
        const len = typeof value === 'string' ? value.length : typeof value === 'number' ? value : Array.isArray(value) ? value.length : 0;
        if (len > rule.max) {
          issues.push({
            field:    rule.field,
            code:     'TOO_LARGE',
            message:  `${rule.field}: maximum ${rule.max}`,
            received: len,
          });
        }
      }

      // Pattern
      if (rule.pattern && typeof value === 'string') {
        if (!new RegExp(rule.pattern).test(value)) {
          issues.push({
            field:    rule.field,
            code:     'PATTERN_MISMATCH',
            message:  `${rule.field}: does not match pattern ${rule.pattern}`,
            received: value,
          });
        }
      }
    }

    return { success: issues.length === 0, issues };
  }

  list(): string[] {
    return [...this._contracts.keys()].sort();
  }

  get(name: string): ContractDef | null {
    return this._contracts.get(name) ?? null;
  }
}

// ============================================================
//  SERVER INTELLECTUS — Instance centralisée
// ============================================================

export class ServerIntellectus {

  readonly memory:    CognitiveMemory;
  readonly scheduler: TaskScheduler;
  readonly contracts: ContractValidator;
  readonly bus:       EventBus;

  private static _instance: ServerIntellectus | null = null;

  static getInstance(): ServerIntellectus {
    if (!ServerIntellectus._instance) {
      ServerIntellectus._instance = new ServerIntellectus();
    }
    return ServerIntellectus._instance;
  }

  constructor() {
    this.memory    = new CognitiveMemory({ maxEntries: 5000, cleanupMs: 30000 });
    this.scheduler = new TaskScheduler({ concurrency: 4 });
    this.contracts = new ContractValidator();
    this.bus       = EventBus.getInstance();

    this._registerDefaultContracts();

    console.log('[ServerIntellectus] ⚡ Initialisé — Memory + Scheduler + Contracts');
  }

  // ── Métriques ──────────────────────────────────────────────

  getMetrics() {
    return {
      memory:    this.memory.getMetrics(),
      scheduler: this.scheduler.getMetrics(),
      contracts: this.contracts.list().length,
    };
  }

  // ── Snapshot ───────────────────────────────────────────────

  snapshot() {
    return {
      memory:         this.memory.getMetrics(),
      scheduler:      this.scheduler.getMetrics(),
      contractCount:  this.contracts.list().length,
      contracts:      this.contracts.list(),
      activeTasks:    this.scheduler.list('running').length,
      queuedTasks:    this.scheduler.list('queued').length,
    };
  }

  // ── Dispose ────────────────────────────────────────────────

  dispose(): void {
    this.memory.dispose();
    console.log('[ServerIntellectus] Disposé');
  }

  // ── Contrats par défaut ────────────────────────────────────

  private _registerDefaultContracts(): void {

    // Résultat agent générique
    this.contracts.register('agent:result', {
      name: 'Agent Result',
      description: 'Résultat standard retourné par un agent',
      rules: [
        { field: 'taskId',     type: 'string',  required: true },
        { field: 'agentId',    type: 'string',  required: true },
        { field: 'success',    type: 'boolean', required: true },
        { field: 'output',     type: 'any',     required: false },
        { field: 'confidence', type: 'number',  required: false, min: 0, max: 100 },
        { field: 'duration',   type: 'number',  required: false, min: 0 },
      ],
    });

    // Brain decision
    this.contracts.register('brain:decision', {
      name: 'Brain Decision',
      description: 'Décision finale du TroxT Brain',
      rules: [
        { field: 'requestId',     type: 'string',  required: true },
        { field: 'success',       type: 'boolean', required: true },
        { field: 'summary',       type: 'string',  required: true, min: 1 },
        { field: 'agentsUsed',    type: 'array',   required: true },
        { field: 'duration',      type: 'number',  required: true, min: 0 },
        { field: 'completedSteps',type: 'array',   required: true },
        { field: 'failedSteps',   type: 'array',   required: true },
      ],
    });

    // Third Eye alert
    this.contracts.register('thirdeye:alert', {
      name: 'Third Eye Alert',
      description: 'Alerte émise par Third Eye',
      rules: [
        { field: 'level',     type: 'string',  required: true, pattern: '^(GREEN|BLUE|YELLOW|ORANGE|RED|BLACK)$' },
        { field: 'message',   type: 'string',  required: true, min: 1 },
        { field: 'taskId',    type: 'string',  required: true },
        { field: 'agentId',   type: 'string',  required: true },
        { field: 'action',    type: 'string',  required: true },
        { field: 'timestamp', type: 'number',  required: true },
      ],
    });

    // Property purchase
    this.contracts.register('property:purchase', {
      name: 'Property Purchase',
      description: 'Demande d\'achat immobilier',
      rules: [
        { field: 'propertyId', type: 'string',  required: true },
        { field: 'playerId',   type: 'string',  required: true },
        { field: 'price',      type: 'number',  required: true, min: 0 },
      ],
    });

    // Spawn entity
    this.contracts.register('entity:spawn', {
      name: 'Entity Spawn',
      description: 'Demande de spawn d\'entité',
      rules: [
        { field: 'modelId',  type: 'string', required: true },
        { field: 'position', type: 'array',  required: true, min: 3, max: 3 },
        { field: 'ownerId',  type: 'string', required: false },
      ],
    });

    // Chat message
    this.contracts.register('chat:message', {
      name: 'Chat Message',
      description: 'Message chat joueur',
      rules: [
        { field: 'text',     type: 'string', required: true, min: 1, max: 500 },
        { field: 'playerId', type: 'string', required: true },
        { field: 'channel',  type: 'string', required: false },
      ],
    });

    console.log(`[ServerIntellectus] 📋 ${this.contracts.list().length} contrats enregistrés`);
  }
}
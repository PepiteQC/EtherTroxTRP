// server/agents/BaseAgent.ts
// ============================================================
//  BASE AGENT — Classe abstraite commune à tous les agents
//  Branché sur ServerIntellectus : mémoire, scheduler, contrats
// ============================================================

import { ServerIntellectus, createId, ok, err, type Result, type Priority } from '../intellectus/ServerIntellectus';
import { EventBus } from '../engine/EventBus';

// ============================================================
//  TYPES
// ============================================================

export type AgentId =
  | 'ether-forge'
  | 'ether-lens'
  | 'ether-prism'
  | 'ether-weave'
  | 'forge-factory';

export interface AgentTaskPacket {
  taskId:   string;
  planId:   string;
  agent:    AgentId;
  mission:  string;
  input:    any;
  expected: string;
  priority: Priority;
  timeout:  number;
  sentAt:   number;
  context?: Record<string, any>;
}

export interface AgentTaskResult {
  taskId:     string;
  agentId:    AgentId;
  success:    boolean;
  output:     any;
  error?:     string;
  duration:   number;
  timestamp:  number;
  confidence: number;
  warnings?:  string[];
  artifacts?: string[];
}

export interface AgentTelemetry {
  agentId:     AgentId;
  taskId:      string;
  status:      'working' | 'done' | 'error' | 'waiting' | 'idle';
  confidence:  number;
  riskLevel:   'low' | 'medium' | 'high';
  dependencies?: string[];
  estimatedMs?: number;
  metadata?:    Record<string, any>;
}

export interface AgentMetrics {
  taskCount:     number;
  successCount:  number;
  failCount:     number;
  avgDurationMs: number;
  lastActive:    number;
  status:        'idle' | 'working' | 'error';
}

// ============================================================
//  BASE AGENT
// ============================================================

export abstract class BaseAgent {

  readonly agentId: AgentId;

  protected readonly intellectus: ServerIntellectus;
  protected readonly bus:         EventBus;

  private _metrics: AgentMetrics;
  private _totalDurationMs = 0;

  constructor(agentId: AgentId) {
    this.agentId     = agentId;
    this.intellectus = ServerIntellectus.getInstance();
    this.bus         = EventBus.getInstance();

    this._metrics = {
      taskCount:     0,
      successCount:  0,
      failCount:     0,
      avgDurationMs: 0,
      lastActive:    Date.now(),
      status:        'idle',
    };

    console.log(`[${this.agentId}] Agent initialisé`);
  }

  // ──────────────────────────────────────────
  //  EXECUTE — Point d'entrée principal
  // ──────────────────────────────────────────

  async execute(packet: AgentTaskPacket): Promise<AgentTaskResult> {
    const startTime = Date.now();
    this._metrics.taskCount++;
    this._metrics.lastActive = Date.now();
    this._metrics.status     = 'working';

    // Émettre télémétrie démarrage
    this._emitTelemetry(packet.taskId, 'working', 70);

    // Stocker en mémoire cognitive
    this.intellectus.memory.set(`task:${packet.taskId}:start`, {
      agentId:   this.agentId,
      mission:   packet.mission,
      startedAt: startTime,
    }, {
      source: this.agentId,
      tags:   ['task', 'active'],
      ttl:    60000,
    });

    try {
      const output = await this._process(packet);

      const duration = Date.now() - startTime;
      this._metrics.successCount++;
      this._totalDurationMs    += duration;
      this._metrics.avgDurationMs = Math.round(this._totalDurationMs / this._metrics.taskCount);
      this._metrics.status        = 'idle';

      const result: AgentTaskResult = {
        taskId:    packet.taskId,
        agentId:   this.agentId,
        success:   true,
        output,
        duration,
        timestamp: Date.now(),
        confidence: this._scoreConfidence(output),
        warnings:  this._extractWarnings(output),
        artifacts: this._extractArtifacts(output),
      };

      // Valider contre contrat
      const validation = this.intellectus.contracts.validate('agent:result', result);
      if (!validation.success) {
        console.warn(`[${this.agentId}] ⚠️ Résultat hors contrat:`, validation.issues.map(i => i.message).join(', '));
      }

      // Stocker résultat en mémoire
      this.intellectus.memory.set(`task:${packet.taskId}:result`, result, {
        source: this.agentId,
        tags:   ['task', 'result', 'success'],
        ttl:    300000, // 5 min
      });

      // Télémétrie succès
      this._emitTelemetry(packet.taskId, 'done', result.confidence);
      this.bus.emit('agent:result', { taskId: packet.taskId, result });

      return result;

    } catch (e: any) {
      const duration = Date.now() - startTime;
      this._metrics.failCount++;
      this._metrics.status = 'error';

      const result: AgentTaskResult = {
        taskId:    packet.taskId,
        agentId:   this.agentId,
        success:   false,
        output:    null,
        error:     e?.message ?? 'Erreur inconnue',
        duration,
        timestamp: Date.now(),
        confidence: 0,
      };

      // Stocker erreur en mémoire
      this.intellectus.memory.set(`task:${packet.taskId}:error`, {
        error:    e?.message,
        agentId:  this.agentId,
        mission:  packet.mission,
        failedAt: Date.now(),
      }, {
        source: this.agentId,
        tags:   ['task', 'error'],
        ttl:    300000,
      });

      // Télémétrie erreur
      this._emitTelemetry(packet.taskId, 'error', 0, 'high');
      this.bus.emit('agent:result', { taskId: packet.taskId, result });

      return result;
    }
  }

  // ──────────────────────────────────────────
  //  ABSTRACT — À implémenter dans chaque agent
  // ──────────────────────────────────────────

  protected abstract _process(packet: AgentTaskPacket): Promise<any>;

  // ──────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────

  protected _scoreConfidence(output: any): number {
    if (!output) return 0;
    if (typeof output !== 'object') return 75;

    let score = 70;
    if (output.status === 'completed')  score += 15;
    if (output.warnings?.length === 0)  score += 10;
    if (output.artifacts?.length > 0)   score += 5;
    if (output.errors?.length > 0)      score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  protected _extractWarnings(output: any): string[] {
    if (!output) return [];
    return [
      ...(output.warnings ?? []),
      ...(output.risks?.map((r: any) => `RISK: ${r.description ?? r}`) ?? []),
    ].slice(0, 10);
  }

  protected _extractArtifacts(output: any): string[] {
    if (!output) return [];
    return [
      ...(output.files?.map((f: any) => f.path ?? f) ?? []),
      ...(output.artifacts ?? []),
    ].slice(0, 20);
  }

  protected _emitTelemetry(
    taskId:     string,
    status:     AgentTelemetry['status'],
    confidence: number,
    riskLevel:  AgentTelemetry['riskLevel'] = 'low'
  ): void {
    const telem: AgentTelemetry = {
      agentId:    this.agentId,
      taskId,
      status,
      confidence,
      riskLevel,
      metadata: { avgDuration: this._metrics.avgDurationMs },
    };

    this.bus.emit('agent:telemetry', telem);

    // Stocker télémétrie en mémoire Intellectus
    this.intellectus.memory.set(`telemetry:${this.agentId}:latest`, telem, {
      source: this.agentId,
      tags:   ['telemetry', this.agentId],
      ttl:    30000, // 30s
    });
  }

  // ──────────────────────────────────────────
  //  METRICS
  // ──────────────────────────────────────────

  getMetrics(): AgentMetrics {
    return { ...this._metrics };
  }

  getStatus(): AgentMetrics['status'] {
    return this._metrics.status;
  }
}
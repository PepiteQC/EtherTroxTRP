// ============================================================
// TROXT LAB BRIDGE
// C:\TroxTServerRP\server\agents\lab-bridge.ts
// Pont entre BaseAgent.ts et TroxT Lab
// Branche chaque agent sur le bus sans modifier BaseAgent
// ============================================================

import { agentBus } from '../../agentBus.js'

export interface LabBridgeOptions {
  agentId:  string
  labUrl?:  string
  useHttp?: boolean
}

export class LabBridge {
  private agentId:  string
  private labUrl:   string
  private useHttp:  boolean
  private hbTimer:  NodeJS.Timeout | null = null
  private cmdTimer: NodeJS.Timeout | null = null
  private handlers: Record<string, (payload: any) => Promise<void>> = {}

  constructor(options: LabBridgeOptions) {
    this.agentId = options.agentId
    this.labUrl  = options.labUrl  || 'http://localhost:4242'
    this.useHttp = options.useHttp ?? false
  }

  // ── CONNEXION ────────────────────────────────────────────
  async connect(): Promise<void> {
    // Mode interne : passe par agentBus directement
    if (!this.useHttp) {
      agentBus.registerAgent(this.agentId)
      this._startInternalHeartbeat()
      this._startInternalCommandPoll()
      console.log(`[LabBridge:${this.agentId}] Connecté via AgentBus interne`)
      return
    }

    // Mode HTTP : appels REST vers telemetry-server
    await this._httpEvent('registered', 'idle', `${this.agentId} connecté`)
    this._startHttpHeartbeat()
    this._startHttpCommandPoll()
    console.log(`[LabBridge:${this.agentId}] Connecté via HTTP ${this.labUrl}`)
  }

  // ── ENVOI ÉVÉNEMENT ──────────────────────────────────────
  async sendEvent(
    type:    string,
    status:  string,
    message: string = '',
    meta:    Record<string, any> = {}
  ): Promise<void> {
    if (!this.useHttp) {
      agentBus.updateAgent(this.agentId, {
        type, status, message, meta
      })
      return
    }
    await this._httpEvent(type, status, message, meta)
  }

  // ── ENVOI RÉSULTAT AVEC SCORE ────────────────────────────
  async sendResult(
    taskId:        string,
    message:       string,
    qualityScore:  Record<string, number> = {},
    filesProduced: string[] = []
  ): Promise<void> {
    if (!this.useHttp) {
      agentBus.updateAgent(this.agentId, {
        type:          'task_completed',
        status:        'idle',
        message,
        qualityScore,
        filesProduced,
        currentTask:   taskId
      })
      return
    }
    await this._httpEvent('task_completed', 'idle', message, {
      task_id:        taskId,
      quality_score:  qualityScore,
      files_produced: filesProduced
    })
  }

  // ── ENREGISTREMENT HANDLER COMMANDE ─────────────────────
  onCommand(
    type:    string,
    handler: (payload: any) => Promise<void>
  ): this {
    this.handlers[type] = handler
    return this
  }

  // ── DÉCONNEXION ──────────────────────────────────────────
  async disconnect(): Promise<void> {
    if (this.hbTimer)  clearInterval(this.hbTimer)
    if (this.cmdTimer) clearInterval(this.cmdTimer)
    await this.sendEvent('stopped', 'offline', `${this.agentId} déconnecté`)
  }

  // ── INTERNE : BUS DIRECT ─────────────────────────────────
  private _startInternalHeartbeat(ms = 10000): void {
    this.hbTimer = setInterval(() => {
      agentBus.updateAgent(this.agentId, {
        type:    'heartbeat',
        status:  'idle',
        message: `${this.agentId} actif`
      })
    }, ms)
  }

  private _startInternalCommandPoll(ms = 2000): void {
    this.cmdTimer = setInterval(async () => {
      const cmds = agentBus.pullCommands(this.agentId)
      for (const cmd of cmds) {
        await this._handleCommand(cmd)
      }
    }, ms)
  }

  // ── HTTP : APPELS REST ───────────────────────────────────
  private async _httpEvent(
    type:    string,
    status:  string,
    message: string,
    meta:    Record<string, any> = {}
  ): Promise<void> {
    try {
      await fetch(`${this.labUrl}/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id:  this.agentId,
          type, status, message,
          timestamp: new Date().toISOString(),
          meta
        })
      })
    } catch(e: any) {
      console.error(`[LabBridge:${this.agentId}] HTTP error:`, e.message)
    }
  }

  private _startHttpHeartbeat(ms = 10000): void {
    this.hbTimer = setInterval(() => {
      this._httpEvent('heartbeat', 'idle', `${this.agentId} actif`)
    }, ms)
  }

  private _startHttpCommandPoll(ms = 2000): void {
    this.cmdTimer = setInterval(async () => {
      try {
        const res  = await fetch(`${this.labUrl}/agents/${this.agentId}/commands`)
        const cmds = await res.json() as any[]
        for (const cmd of cmds) {
          await this._handleCommand(cmd)
        }
      } catch(e) {}
    }, ms)
  }

  // ── GESTION COMMANDE ─────────────────────────────────────
  private async _handleCommand(cmd: any): Promise<void> {
    await this.sendEvent(
      'command_received', 'busy',
      `Commande: ${cmd.type}`
    )

    const handler = this.handlers[cmd.type]
    if (handler) {
      try {
        await handler(cmd.payload || {})
        await this.sendEvent('command_ack', 'idle', `Exécuté: ${cmd.type}`)
      } catch(e: any) {
        await this.sendEvent('error', 'error', e.message)
      }
    } else {
      await this.sendEvent('warning', 'idle', `Non géré: ${cmd.type}`)
    }
  }
}

// ── FACTORY RAPIDE ───────────────────────────────────────────
export function createBridge(agentId: string): LabBridge {
  return new LabBridge({ agentId, useHttp: false })
}

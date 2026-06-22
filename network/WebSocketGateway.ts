// server/network/WebSocketGateway.ts

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { sanitizeString } from '../../shared/utils';
import { EntityManager } from '../engine/EntityManager';
import { WorldStateManager } from '../engine/WorldState';
import { EventBus } from '../engine/EventBus';
import type { Packet } from '../../shared/types';

type Vec3 = [number, number, number];

export interface ConnectedPlayer {
  id: string;
  name: string;
  color: string;
  ws: WebSocket;
  joinedAt: number;
  position: Vec3;
  rotation: Vec3;
  velocity: Vec3;
  animation: string;
  health: number;
  isAlive: boolean;
}

export class WebSocketGateway {
  private _wss: WebSocketServer;
  private _players: Map<string, ConnectedPlayer> = new Map();

  private _entityManager: EntityManager;
  private _worldState: WorldStateManager;
  private _bus: EventBus;

  private _pingInterval: NodeJS.Timeout;

  constructor(
    server: any,
    entityManager: EntityManager,
    worldState: WorldStateManager,
    bus: EventBus
  ) {
    this._entityManager = entityManager;
    this._worldState = worldState;
    this._bus = bus;

    this._wss = new WebSocketServer({ server });

    this._wss.on('connection', (ws) => {
      const player = this._handleConnection(ws);

      ws.on('message', (raw) => {
        const message = this._rawToString(raw);
        if (!message) return;

        this._handleMessage(player, message);
      });

      ws.on('pong', () => {
        player.isAlive = true;
      });

      ws.on('close', () => {
        this._handleClose(player);
      });

      ws.on('error', (err) => {
        console.warn(`[WS] Error ${player.id}:`, err.message);
      });
    });

    this._pingInterval = setInterval(() => {
      this._pingAll();
    }, 30000);

    this._wss.on('close', () => {
      clearInterval(this._pingInterval);
    });

    console.log('[WebSocketGateway] Initialisé');
  }

  // ──────────────────────────────────────────
  // CONNEXION / DÉCONNEXION
  // ──────────────────────────────────────────

  private _handleConnection(ws: WebSocket): ConnectedPlayer {
    const id = uuidv4().slice(0, 8);
    const color = `hsl(${Math.floor(Math.random() * 360)},70%,60%)`;

    const player: ConnectedPlayer = {
      id,
      name: `Player_${id}`,
      color,
      ws,
      joinedAt: Date.now(),
      position: [0, 2, 0],
      rotation: [0, 0, 0],
      velocity: [0, 0, 0],
      animation: 'idle',
      health: 100,
      isAlive: true,
    };

    this._players.set(id, player);
    this._worldState.incrementJoins();

    this.send(player, {
      type: 'INIT',
      payload: {
        playerId: id,
        color,
        worldState: this._worldState.serializeExtended(),
        players: this.getPlayersState(),
        entities: this._entityManager.serializeAll(),
      },
      timestamp: Date.now(),
    });

    this.broadcast(
      {
        type: 'PLAYER_JOIN',
        payload: {
          id,
          name: player.name,
          color,
          position: player.position,
          rotation: player.rotation,
          animation: player.animation,
        },
        timestamp: Date.now(),
      },
      id
    );

    this._bus.emit('player:join', player);

    console.log(
      `[WS] Player ${player.name} (${id}) joined — ${this._players.size} online`
    );

    return player;
  }

  private _handleClose(player: ConnectedPlayer): void {
    if (!this._players.has(player.id)) return;

    this._players.delete(player.id);

    this.broadcast({
      type: 'PLAYER_LEAVE',
      payload: { id: player.id },
      timestamp: Date.now(),
    });

    this._bus.emit('player:leave', player.id);

    console.log(`[WS] Player ${player.id} left — ${this._players.size} online`);
  }

  // ──────────────────────────────────────────
  // TRAITEMENT MESSAGES
  // ──────────────────────────────────────────

  private _handleMessage(player: ConnectedPlayer, raw: string): void {
    let packet: Packet;

    try {
      packet = JSON.parse(raw);
    } catch {
      return;
    }

    if (!packet || typeof packet.type !== 'string') {
      return;
    }

    switch (packet.type) {
      case 'PLAYER_MOVE': {
        const payload: any = packet.payload;

        if (!payload || !this._isVec3(payload.position)) {
          return;
        }

        player.position = payload.position;

        if (this._isVec3(payload.rotation)) {
          player.rotation = payload.rotation;
        }

        if (this._isVec3(payload.velocity)) {
          player.velocity = payload.velocity;
        }

        if (typeof payload.animation === 'string') {
          player.animation = sanitizeString(payload.animation, 30) || 'idle';
        }

        break;
      }

      case 'CHAT': {
        const payload: any = packet.payload;

        if (!payload || typeof payload.text !== 'string') {
          return;
        }

        const text = sanitizeString(payload.text, 200);

        if (!text) {
          return;
        }

        const channel =
          typeof payload.channel === 'string'
            ? sanitizeString(payload.channel, 30) || 'global'
            : 'global';

        this.broadcast({
          type: 'CHAT',
          payload: {
            sender: player.name,
            text,
            channel,
          },
          timestamp: Date.now(),
          senderId: player.id,
        });

        this._bus.emit('chat', player.id, player.name, text);

        break;
      }

      case 'PLAYER_RENAME': {
        const payload: any = packet.payload;

        if (!payload || typeof payload.name !== 'string') {
          return;
        }

        const newName = sanitizeString(payload.name, 20);

        if (!newName) {
          return;
        }

        player.name = newName;

        this.broadcast({
          type: 'PLAYER_RENAME',
          payload: {
            id: player.id,
            name: player.name,
          },
          timestamp: Date.now(),
        });

        break;
      }

      case 'SPAWN_REQUEST': {
        this._bus.emit('spawn:request', player.id, packet.payload);
        break;
      }

      case 'TOOL_ACTION': {
        this._bus.emit('tool:action', player.id, packet.payload);
        break;
      }

      case 'PING': {
        this.send(player, {
          type: 'PONG',
          payload: {
            serverTime: Date.now(),
          },
          timestamp: Date.now(),
        });

        break;
      }

      default:
        break;
    }
  }

  // ──────────────────────────────────────────
  // ENVOI RÉSEAU
  // ──────────────────────────────────────────

  public send(player: ConnectedPlayer, data: any): void {
    if (player.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      player.ws.send(JSON.stringify(data));
    } catch (e) {
      console.warn(`[WS] Send error to ${player.id}:`, e);
    }
  }

  public sendToId(playerId: string, data: any): void {
    const player = this._players.get(playerId);

    if (!player) {
      return;
    }

    this.send(player, data);
  }

  public broadcast(data: any, excludeId?: string): void {
    let msg: string;

    try {
      msg = JSON.stringify(data);
    } catch {
      return;
    }

    for (const [id, player] of this._players) {
      if (id === excludeId) {
        continue;
      }

      if (player.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      try {
        player.ws.send(msg);
      } catch {
        // On ignore ici, le ping/pong nettoiera les connexions mortes.
      }
    }
  }

  public broadcastToAdmins(data: any): void {
    this.broadcast(data);
  }

  // ──────────────────────────────────────────
  // BROADCAST SYNC ENTITIES
  // ──────────────────────────────────────────

  public syncEntities(): void {
    const dirty = this._entityManager.serializeDirty();

    if (!Array.isArray(dirty) || dirty.length === 0) {
      return;
    }

    this.broadcast({
      type: 'ENTITIES_BATCH',
      payload: {
        entities: dirty,
      },
      timestamp: Date.now(),
    });
  }

  public syncPlayers(): void {
    const state = this.getPlayersState();

    if (state.length === 0) {
      return;
    }

    this.broadcast({
      type: 'PLAYER_MOVE',
      payload: {
        players: state,
      },
      timestamp: Date.now(),
    });
  }

  // ──────────────────────────────────────────
  // UTILITAIRES
  // ──────────────────────────────────────────

  public getPlayersState(): Array<{
    id: string;
    name: string;
    color: string;
    position: Vec3;
    rotation: Vec3;
    velocity: Vec3;
    animation: string;
    health: number;
  }> {
    const state: Array<{
      id: string;
      name: string;
      color: string;
      position: Vec3;
      rotation: Vec3;
      velocity: Vec3;
      animation: string;
      health: number;
    }> = [];

    for (const [id, p] of this._players) {
      state.push({
        id,
        name: p.name,
        color: p.color,
        position: p.position,
        rotation: p.rotation,
        velocity: p.velocity,
        animation: p.animation,
        health: p.health,
      });
    }

    return state;
  }

  public getPlayer(id: string): ConnectedPlayer | undefined {
    return this._players.get(id);
  }

  public get playerCount(): number {
    return this._players.size;
  }

  public kickPlayer(playerId: string, reason = 'Kicked by admin'): void {
    const player = this._players.get(playerId);

    if (!player) {
      return;
    }

    this.send(player, {
      type: 'KICKED',
      payload: {
        reason,
      },
      timestamp: Date.now(),
    });

    try {
      player.ws.close(1000, reason);
    } catch {
      player.ws.terminate();
    }

    this._players.delete(playerId);

    this.broadcast({
      type: 'PLAYER_LEAVE',
      payload: {
        id: playerId,
      },
      timestamp: Date.now(),
    });
  }

  public close(): void {
    clearInterval(this._pingInterval);

    for (const [, player] of this._players) {
      try {
        player.ws.close();
      } catch {
        player.ws.terminate();
      }
    }

    this._players.clear();

    try {
      this._wss.close();
    } catch {
      // Rien à faire. Node adore parfois jeter des assiettes.
    }
  }

  // ──────────────────────────────────────────
  // PING / PONG
  // ──────────────────────────────────────────

  private _pingAll(): void {
    for (const [id, player] of this._players) {
      if (player.ws.readyState !== WebSocket.OPEN) {
        this._players.delete(id);
        continue;
      }

      if (!player.isAlive) {
        console.warn(`[WS] Player ${id} timeout, terminating socket`);

        try {
          player.ws.terminate();
        } catch {
          // ignore
        }

        this._players.delete(id);

        this.broadcast({
          type: 'PLAYER_LEAVE',
          payload: {
            id,
          },
          timestamp: Date.now(),
        });

        this._bus.emit('player:leave', id);

        continue;
      }

      player.isAlive = false;

      try {
        player.ws.ping();
      } catch {
        player.ws.terminate();
        this._players.delete(id);
      }
    }
  }

  private _rawToString(raw: RawData): string {
    try {
      if (typeof raw === 'string') {
        return raw;
      }

      if (Buffer.isBuffer(raw)) {
        return raw.toString('utf8');
      }

      if (Array.isArray(raw)) {
        return Buffer.concat(raw).toString('utf8');
      }

      if (raw instanceof ArrayBuffer) {
        return Buffer.from(raw).toString('utf8');
      }

      return Buffer.from(raw as Buffer).toString('utf8');
    } catch {
      return '';
    }
  }

  private _isVec3(value: any): value is Vec3 {
    return (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every(
        (n) => typeof n === 'number' && Number.isFinite(n)
      )
    );
  }
}
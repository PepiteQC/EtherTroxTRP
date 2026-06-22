// server/network/PacketHandler.ts

import type {
  Packet,
  PlayerMovePayload,
  ChatPayload,
  SpawnRequestPayload,
  ToolActionPayload,
} from '../../shared/types';

import { PLAYER } from '../../shared/constants';
import { sanitizeString, isValidPosition } from '../../shared/utils';
import { EventBus } from '../engine/EventBus';
import type { ConnectedPlayer } from './WebSocketGateway';

type Vec3 = [number, number, number];

interface AdminCapablePlayer extends ConnectedPlayer {
  isAdmin?: boolean;
}

export class PacketHandler {
  private readonly _bus: EventBus;

  private readonly _rateLimits: Map<string, Map<string, number[]>> = new Map();

  private readonly _RATE_LIMITS: Record<string, number> = {
    PLAYER_MOVE: 30,
    CHAT: 3,
    PLAYER_RENAME: 2,
    SPAWN_REQUEST: 2,
    TOOL_ACTION: 10,
    ADMIN_ACTION: 5,
  };

  private readonly _RATE_WINDOW_MS = 1000;

  constructor(bus: EventBus) {
    this._bus = bus;
    console.log('[PacketHandler] Initialisé');
  }

  public handle(
    playerId: string,
    packet: Packet,
    player: ConnectedPlayer
  ): void {
    if (!packet || typeof packet.type !== 'string') {
      return;
    }

    if (this._isRateLimited(playerId, packet.type)) {
      console.warn(`[PacketHandler] Rate limit: ${playerId} → ${packet.type}`);
      return;
    }

    switch (packet.type) {
      case 'PLAYER_MOVE':
        this._handleMove(playerId, packet.payload as PlayerMovePayload, player);
        break;

      case 'CHAT':
        this._handleChat(playerId, packet.payload as ChatPayload, player);
        break;

      case 'PLAYER_RENAME':
        this._handleRename(playerId, packet.payload as { name?: string }, player);
        break;

      case 'SPAWN_REQUEST':
        this._handleSpawn(playerId, packet.payload as SpawnRequestPayload, player);
        break;

      case 'TOOL_ACTION':
        this._handleToolAction(playerId, packet.payload as ToolActionPayload);
        break;

      case 'ADMIN_ACTION':
        this._handleAdminAction(playerId, packet.payload, player as AdminCapablePlayer);
        break;

      case 'PING':
        break;

      default:
        console.warn(`[PacketHandler] Type inconnu: ${packet.type}`);
        break;
    }
  }

  private _handleMove(
    playerId: string,
    payload: PlayerMovePayload,
    player: ConnectedPlayer
  ): void {
    if (!payload || !this._isVec3(payload.position)) {
      return;
    }

    const position = payload.position;
    const rotation = this._isVec3(payload.rotation) ? payload.rotation : player.rotation;
    const velocity = this._isVec3(payload.velocity) ? payload.velocity : [0, 0, 0] as Vec3;

    const [vx, vy, vz] = velocity;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    const isAdmin = Boolean((player as AdminCapablePlayer).isAdmin);
    const flySpeed = typeof PLAYER.FLY_SPEED === 'number' ? PLAYER.FLY_SPEED : 10;
    const maxSpeed = isAdmin ? 100 : flySpeed * 3;

    if (speed > maxSpeed) {
      console.warn(`[PacketHandler] Speed hack possible: ${playerId} → ${speed.toFixed(2)}`);
      return;
    }

    player.position = position;
    player.rotation = rotation;
    player.velocity = velocity;

    if (typeof payload.animation === 'string') {
      player.animation = sanitizeString(payload.animation, 30) || 'idle';
    }

    this._bus.emit('player:move', {
      playerId,
      position: player.position,
      rotation: player.rotation,
      velocity: player.velocity,
      animation: player.animation,
    });
  }

  private _handleChat(
    playerId: string,
    payload: ChatPayload,
    player: ConnectedPlayer
  ): void {
    if (!payload || typeof payload.text !== 'string') {
      return;
    }

    const maxLength =
      typeof PLAYER.CHAT_MAX_LENGTH === 'number'
        ? PLAYER.CHAT_MAX_LENGTH
        : 200;

    const text = sanitizeString(payload.text, maxLength);

    if (!text) {
      return;
    }

    const channel =
      typeof payload.channel === 'string'
        ? sanitizeString(payload.channel, 30) || 'global'
        : 'global';

    if (text.startsWith('/')) {
      this._bus.emit('player:command', {
        playerId,
        command: text,
        player,
      });
      return;
    }

    this._bus.emit('player:chat', {
      playerId,
      sender: player.name,
      text,
      channel,
    });
  }

  private _handleRename(
    playerId: string,
    payload: { name?: string },
    player: ConnectedPlayer
  ): void {
    if (!payload || typeof payload.name !== 'string') {
      return;
    }

    const maxLength =
      typeof PLAYER.NAME_MAX_LENGTH === 'number'
        ? PLAYER.NAME_MAX_LENGTH
        : 20;

    const name = sanitizeString(payload.name, maxLength);

    if (name.length < 2) {
      return;
    }

    player.name = name;

    this._bus.emit('player:rename', {
      playerId,
      name,
    });
  }

  private _handleSpawn(
    playerId: string,
    payload: SpawnRequestPayload,
    player: ConnectedPlayer
  ): void {
    if (!payload || typeof payload.modelId !== 'string') {
      return;
    }

    const modelId = sanitizeString(payload.modelId, 64);

    if (!/^[a-z0-9_-]+$/i.test(modelId)) {
      return;
    }

    const position =
      payload.position === 'player_look_at'
        ? player.position
        : this._isVec3(payload.position)
          ? payload.position
          : player.position;

    const rotation = this._isVec3(payload.rotation)
      ? payload.rotation
      : [0, 0, 0] as Vec3;

    this._bus.emit('entity:spawnRequest', {
      playerId,
      modelId,
      position,
      rotation,
    });
  }

  private _handleToolAction(
    playerId: string,
    payload: ToolActionPayload
  ): void {
    if (!payload || typeof payload.toolId !== 'string') {
      return;
    }

    const toolId = sanitizeString(payload.toolId, 64);

    if (!toolId) {
      return;
    }

    this._bus.emit('tool:action', {
      playerId,
      toolId,
      targetId:
        typeof payload.targetId === 'string'
          ? sanitizeString(payload.targetId, 64)
          : undefined,
      position: this._isVec3(payload.position) ? payload.position : undefined,
      params:
        payload.params && typeof payload.params === 'object'
          ? payload.params
          : {},
    });
  }

  private _handleAdminAction(
    playerId: string,
    payload: any,
    player: AdminCapablePlayer
  ): void {
    if (!player.isAdmin) {
      console.warn(`[PacketHandler] Admin action refusée: ${playerId}`);
      return;
    }

    if (!payload || typeof payload.action !== 'string') {
      return;
    }

    const action = sanitizeString(payload.action, 64);

    if (!action) {
      return;
    }

    this._bus.emit('admin:action', {
      playerId,
      action,
      params:
        payload.params && typeof payload.params === 'object'
          ? payload.params
          : {},
    });
  }

  private _isRateLimited(playerId: string, packetType: string): boolean {
    const limit = this._RATE_LIMITS[packetType];

    if (!limit) {
      return false;
    }

    let byPlayer = this._rateLimits.get(packetType);

    if (!byPlayer) {
      byPlayer = new Map();
      this._rateLimits.set(packetType, byPlayer);
    }

    const now = Date.now();
    const timestamps = byPlayer.get(playerId) ?? [];
    const recent = timestamps.filter(
      (timestamp) => now - timestamp < this._RATE_WINDOW_MS
    );

    recent.push(now);
    byPlayer.set(playerId, recent);

    return recent.length > limit;
  }

  private _isVec3(value: unknown): value is Vec3 {
    if (isValidPosition(value as any)) {
      return true;
    }

    return (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every((n) => typeof n === 'number' && Number.isFinite(n))
    );
  }

  public cleanupPlayer(playerId: string): void {
    for (const [, byPlayer] of this._rateLimits) {
      byPlayer.delete(playerId);
    }
  }

  public dispose(): void {
    this._rateLimits.clear();
  }
}
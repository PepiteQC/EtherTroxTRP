// server/bus/BusEvents.ts
// ============================================================
//  BUS EVENTS — Câblage des événements globaux du serveur
//  Connecte EventBus ↔ Gateway ↔ WorldState ↔ EntityManager
// ============================================================

import type { AppContext }    from '../types/context.js';
import type { CommandHandler } from '../commands/CommandHandler.js';
import { logger }             from '../lib/logger.js';

export function setupBusEvents(
  ctx:            AppContext,
  commandHandler: CommandHandler,
): void {
  const { bus, gateway, worldState, entityManager, brain, thirdEye } = ctx;

  // ── Joueur connecté ──────────────────────────────────────
  bus.on('player:connected', (data: any) => {
    logger.info(`[Bus] Joueur connecté: ${data.playerId}`);

    gateway.broadcast({
      type:      'PLAYER_JOINED',
      payload:   { playerId: data.playerId, playerCount: gateway.getPlayerCount() },
      timestamp: Date.now(),
    });

    brain?.recordEvent('player:connected', { playerId: data.playerId });
  });

  // ── Joueur déconnecté ────────────────────────────────────
  bus.on('player:disconnected', (data: any) => {
    logger.info(`[Bus] Joueur déconnecté: ${data.playerId}`);

    gateway.broadcast({
      type:      'PLAYER_LEFT',
      payload:   { playerId: data.playerId, playerCount: gateway.getPlayerCount() },
      timestamp: Date.now(),
    });

    entityManager.removeByOwner?.(data.playerId);
    brain?.recordEvent('player:disconnected', { playerId: data.playerId });
  });

  // ── Mouvement joueur ─────────────────────────────────────
  bus.on('player:move', (data: any) => {
    gateway.broadcast({
      type:      'PLAYER_MOVED',
      payload:   data,
      timestamp: Date.now(),
    });
  });

  // ── Commandes ────────────────────────────────────────────
  bus.on('command:execute', async (data: any) => {
    try {
      await commandHandler.handle(data);
    } catch (err: any) {
      logger.error(`[Bus] Erreur commande: ${err.message}`);
    }
  });

  // ── Monde : état ─────────────────────────────────────────
  bus.on('world:state:update', (data: any) => {
    gateway.broadcast({
      type:      'WORLD_STATE',
      payload:   { state: worldState.serializeExtended?.() ?? worldState.serialize() },
      timestamp: Date.now(),
    });
  });

  // ── Monde : météo ────────────────────────────────────────
  bus.on('world:weather:change', (data: any) => {
    gateway.broadcast({
      type:      'WORLD_WEATHER',
      payload:   data,
      timestamp: Date.now(),
    });
    logger.info(`[Bus] Météo changée: ${data.weather}`);
  });

  // ── Entité spawned ───────────────────────────────────────
  bus.on('entity:spawn', (data: any) => {
    gateway.broadcast({
      type:      'ENTITY_SPAWNED',
      payload:   data,
      timestamp: Date.now(),
    });
  });

  // ── Entité supprimée ─────────────────────────────────────
  bus.on('entity:remove', (data: any) => {
    gateway.broadcast({
      type:      'ENTITY_REMOVED',
      payload:   data,
      timestamp: Date.now(),
    });
  });

  // ── Agent résultat ───────────────────────────────────────
  bus.on('agent:result', (data: any) => {
    logger.info(`[Bus] Agent result: ${data.taskId} — success: ${data.result?.success}`);
    thirdEye?.recordAgentResult?.(data);
  });

  // ── Agent télémétrie ─────────────────────────────────────
  bus.on('agent:telemetry', (data: any) => {
    thirdEye?.recordTelemetry?.(data);
  });

  // ── Chat ─────────────────────────────────────────────────
  bus.on('chat:message', (data: any) => {
    gateway.broadcast({
      type:      'CHAT',
      payload:   data,
      timestamp: Date.now(),
    });
  });

  // ── Snapshot créé ────────────────────────────────────────
  bus.on('snapshot:created', (data: any) => {
    logger.info(`[Bus] Snapshot créé: ${data.id}`);
  });

  logger.info('[BusEvents] Tous les événements câblés');
}
// server/network/Authority.ts
import type { ConnectedPlayer } from './WebSocketGateway';

// ============================================================
//  AUTHORITY — Vérification des droits
// ============================================================

// Actions réservées aux admins
const ADMIN_ONLY_ACTIONS = new Set([
  'ADMIN_ACTION',
  'WORLD_RESET',
  'ENTITY_DESTROY',
]);

// Actions interdites à tous (serveur only)
const SERVER_ONLY_ACTIONS = new Set([
  'INIT',
  'PLAYER_JOIN',
  'PLAYER_LEAVE',
  'KICKED',
  'AUTO_SAVE',
]);

export class Authority {

  /**
   * Vérifie si un joueur peut effectuer une action
   */
  public canPerform(player: ConnectedPlayer, actionType: string): boolean {
    // Actions serveur → toujours refusées côté client
    if (SERVER_ONLY_ACTIONS.has(actionType)) return false;

    // Actions admin → réservées aux admins
    if (ADMIN_ONLY_ACTIONS.has(actionType) && !player.isAdmin) return false;

    return true;
  }

  /**
   * Vérifie si un joueur peut spawner une entité
   */
  public canSpawn(player: ConnectedPlayer, modelId: string): boolean {
    // Entités dangereuses → admin only
    const adminOnlyModels = ['nuke', 'admin_prop'];
    if (adminOnlyModels.includes(modelId) && !player.isAdmin) return false;
    return true;
  }

  /**
   * Vérifie si un joueur peut modifier une entité
   */
  public canModifyEntity(
    player:    ConnectedPlayer,
    ownerId?:  string
  ): boolean {
    if (player.isAdmin) return true;
    if (!ownerId)       return true;
    return player.id === ownerId;
  }
}
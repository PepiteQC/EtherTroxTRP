// server/engine/ChunkManager.ts
import { WORLD } from '../../shared/constants';
import type { EntityData } from '../../shared/types';

// ============================================================
//  TYPES
// ============================================================

export interface ChunkCoord {
  x: number;
  z: number;
}

export interface Chunk {
  coord:      ChunkCoord;
  entities:   Set<string>;
  isLoaded:   boolean;
  lastAccess: number;
}

type ChunkEvent =
  | 'chunk:loaded'
  | 'chunk:unloaded'
  | 'chunk:entity_added'
  | 'chunk:entity_removed';

// ============================================================
//  CHUNK MANAGER
// ============================================================

export class ChunkManager {

  private _chunks:      Map<string, Chunk> = new Map();
  private _entityChunk: Map<string, string> = new Map(); // entityId → chunkKey
  private _chunkSize:   number;
  private _listeners:   Map<string, Set<Function>> = new Map();

  constructor(chunkSize = WORLD.CHUNK_SIZE) {
    this._chunkSize = chunkSize;
    console.log(`[ChunkManager] Initialisé — Chunk size: ${chunkSize}`);
  }

  // ──────────────────────────────────────────
  //  COORDONNÉES
  // ──────────────────────────────────────────

  /**
   * Convertit position monde → coordonnée chunk
   */
  public worldToChunk(position: [number, number, number]): ChunkCoord {
    return {
      x: Math.floor(position[0] / this._chunkSize),
      z: Math.floor(position[2] / this._chunkSize),
    };
  }

  /**
   * Clé unique pour un chunk
   */
  public chunkKey(coord: ChunkCoord): string {
    return `${coord.x},${coord.z}`;
  }

  /**
   * Position monde du centre d'un chunk
   */
  public chunkCenter(coord: ChunkCoord): [number, number, number] {
    return [
      coord.x * this._chunkSize + this._chunkSize / 2,
      0,
      coord.z * this._chunkSize + this._chunkSize / 2,
    ];
  }

  /**
   * Limites d'un chunk en coordonnées monde
   */
  public chunkBounds(coord: ChunkCoord): {
    minX: number; maxX: number;
    minZ: number; maxZ: number;
  } {
    return {
      minX: coord.x * this._chunkSize,
      maxX: coord.x * this._chunkSize + this._chunkSize,
      minZ: coord.z * this._chunkSize,
      maxZ: coord.z * this._chunkSize + this._chunkSize,
    };
  }

  // ──────────────────────────────────────────
  //  GESTION CHUNKS
  // ──────────────────────────────────────────

  /**
   * Récupère ou crée un chunk
   */
  public getOrCreate(coord: ChunkCoord): Chunk {
    const key = this.chunkKey(coord);
    let chunk = this._chunks.get(key);

    if (!chunk) {
      chunk = {
        coord,
        entities:   new Set(),
        isLoaded:   true,
        lastAccess: Date.now(),
      };
      this._chunks.set(key, chunk);
      this._emit('chunk:loaded', chunk);
    }

    chunk.lastAccess = Date.now();
    return chunk;
  }

  /**
   * Récupère un chunk existant
   */
  public get(coord: ChunkCoord): Chunk | undefined {
    const key = this.chunkKey(coord);
    const chunk = this._chunks.get(key);
    if (chunk) chunk.lastAccess = Date.now();
    return chunk;
  }

  /**
   * Liste tous les chunks chargés
   */
  public getLoadedChunks(): Chunk[] {
    return Array.from(this._chunks.values()).filter(c => c.isLoaded);
  }

  /**
   * Nombre de chunks chargés
   */
  public get chunkCount(): number {
    return this._chunks.size;
  }

  // ──────────────────────────────────────────
  //  ENTITÉS ↔ CHUNKS
  // ──────────────────────────────────────────

  /**
   * Assigne une entité au chunk correspondant à sa position
   */
  public trackEntity(entityId: string, position: [number, number, number]): void {
    const coord = this.worldToChunk(position);
    const key   = this.chunkKey(coord);

    // Retirer de l'ancien chunk
    const oldKey = this._entityChunk.get(entityId);
    if (oldKey && oldKey !== key) {
      const oldChunk = this._chunks.get(oldKey);
      if (oldChunk) {
        oldChunk.entities.delete(entityId);
        this._emit('chunk:entity_removed', oldChunk, entityId);
      }
    }

    // Ajouter au nouveau chunk
    const chunk = this.getOrCreate(coord);
    chunk.entities.add(entityId);
    this._entityChunk.set(entityId, key);
    this._emit('chunk:entity_added', chunk, entityId);
  }

  /**
   * Retire une entité de son chunk
   */
  public untrackEntity(entityId: string): void {
    const key = this._entityChunk.get(entityId);
    if (!key) return;

    const chunk = this._chunks.get(key);
    if (chunk) {
      chunk.entities.delete(entityId);
      this._emit('chunk:entity_removed', chunk, entityId);
    }

    this._entityChunk.delete(entityId);
  }

  /**
   * Récupère toutes les entités dans un rayon de chunks autour d'un point
   */
  public getEntitiesInRadius(
    center:  [number, number, number],
    radiusChunks: number
  ): Set<string> {
    const centerCoord = this.worldToChunk(center);
    const result      = new Set<string>();

    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
        const coord: ChunkCoord = {
          x: centerCoord.x + dx,
          z: centerCoord.z + dz,
        };
        const chunk = this.get(coord);
        if (chunk) {
          chunk.entities.forEach(id => result.add(id));
        }
      }
    }

    return result;
  }

  /**
   * Récupère les chunks autour d'un joueur
   */
  public getChunksAround(
    center: [number, number, number],
    radiusChunks = 2
  ): Chunk[] {
    const centerCoord = this.worldToChunk(center);
    const chunks: Chunk[] = [];

    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
        const coord: ChunkCoord = {
          x: centerCoord.x + dx,
          z: centerCoord.z + dz,
        };
        chunks.push(this.getOrCreate(coord));
      }
    }

    return chunks;
  }

  // ──────────────────────────────────────────
  //  NETTOYAGE
  // ──────────────────────────────────────────

  /**
   * Décharge les chunks trop éloignés d'un joueur
   */
  public unloadDistantChunks(
    playerPositions: [number, number, number][],
    maxDistanceChunks = 4
  ): number {
    let unloaded = 0;
    const now    = Date.now();

    for (const [key, chunk] of this._chunks) {
      // Ne pas décharger s'il y a des entités
      if (chunk.entities.size > 0) continue;

      // Vérifier la distance à tous les joueurs
      let closestDist = Infinity;
      const center    = this.chunkCenter(chunk.coord);

      for (const pp of playerPositions) {
        const dx = (center[0] - pp[0]) / this._chunkSize;
        const dz = (center[2] - pp[2]) / this._chunkSize;
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d < closestDist) closestDist = d;
      }

      // Décharger si trop loin et pas accédé récemment
      if (closestDist > maxDistanceChunks && now - chunk.lastAccess > 30000) {
        chunk.isLoaded = false;
        this._chunks.delete(key);
        this._emit('chunk:unloaded', chunk);
        unloaded++;
      }
    }

    return unloaded;
  }

  /**
   * Vide tous les chunks
   */
  public clear(): void {
    this._chunks.clear();
    this._entityChunk.clear();
  }

  // ──────────────────────────────────────────
  //  EVENTS
  // ──────────────────────────────────────────

  public on(event: ChunkEvent, listener: Function): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  private _emit(event: string, ...args: any[]): void {
    this._listeners.get(event)?.forEach(fn => {
      try { fn(...args); } catch(e) {
        console.error(`[ChunkManager] Event error:`, e);
      }
    });
  }

  // ──────────────────────────────────────────
  //  DEBUG
  // ──────────────────────────────────────────

  public getStats() {
    let totalEntities = 0;
    for (const chunk of this._chunks.values()) {
      totalEntities += chunk.entities.size;
    }
    return {
      chunkCount:    this._chunks.size,
      totalEntities,
      trackedEntities: this._entityChunk.size,
      chunkSize:     this._chunkSize,
    };
  }
}
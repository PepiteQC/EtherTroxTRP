// server/engine/EntityManager.ts
import { BaseEntity } from '../entities/BaseEntity';
import { PhysicsProp } from '../entities/PhysicsProp';
import { PhysicsWorld } from './PhysicsWorld';
import type { EntityData, EntityType } from '../../shared/types';
import { vec3DistanceSq } from '../../shared/utils';

// ============================================================
//  TYPES
// ============================================================

export interface EntityQuery {
  type?:     EntityType;
  tags?:     string[];
  maxDist?:  number;
  center?:   [number, number, number];
  limit?:    number;
}

export interface EntityManagerStats {
  total:        number;
  byType:       Record<string, number>;
  dirtyCount:   number;
  physicsCount: number;
}

type ManagerEvent =
  | 'entity:added'
  | 'entity:removed'
  | 'entity:destroyed';

// ============================================================
//  ENTITY MANAGER
// ============================================================

export class EntityManager {

  // ──────────────────────────────────────────
  //  STOCKAGE
  // ──────────────────────────────────────────
  private _entities:   Map<string, BaseEntity>  = new Map();
  private _byType:     Map<string, Set<string>> = new Map();
  private _byTag:      Map<string, Set<string>> = new Map();
  private _byNetwork:  Map<number, string>      = new Map();

  // ──────────────────────────────────────────
  //  DÉPENDANCES
  // ──────────────────────────────────────────
  private _physics: PhysicsWorld;

  // ──────────────────────────────────────────
  //  EVENTS
  // ──────────────────────────────────────────
  private _listeners: Map<string, Set<Function>> = new Map();

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(physics: PhysicsWorld) {
    this._physics = physics;
    console.log('[EntityManager] Initialisé');
  }

  // ──────────────────────────────────────────
  //  AJOUT / SUPPRESSION
  // ──────────────────────────────────────────

  /**
   * Ajoute une entité au monde
   */
  public add(entity: BaseEntity): void {
    if (this._entities.has(entity.id)) {
      console.warn(`[EntityManager] Entité déjà existante: ${entity.id}`);
      return;
    }

    // Index principal
    this._entities.set(entity.id, entity);

    // Index par type
    if (!this._byType.has(entity.type)) {
      this._byType.set(entity.type, new Set());
    }
    this._byType.get(entity.type)!.add(entity.id);

    // Index par tags
    entity.getTags().forEach(tag => this._indexTag(entity.id, tag));

    // Index réseau
    this._byNetwork.set(entity.networkId, entity.id);

    // Si PhysicsProp → ajouter au monde physique
    if (entity instanceof PhysicsProp) {
      this._physics.addBody(entity.body, entity.id);
    }

    // Écouter les changements de tags
    entity.on('tagAdded',   (_: any, tag: string) => this._indexTag(entity.id, tag));
    entity.on('tagRemoved', (_: any, tag: string) => this._unindexTag(entity.id, tag));

    // Écouter la destruction
    entity.on('destroy', () => this._onEntityDestroyed(entity.id));

    this._emit('entity:added', entity);
    console.log(`[EntityManager] + ${entity.toString()}`);
  }

  /**
   * Retire et détruit une entité
   */
  public remove(entityId: string): boolean {
    const entity = this._entities.get(entityId);
    if (!entity) return false;

    this._removeFromIndexes(entity);

    // Retirer du monde physique
    if (entity instanceof PhysicsProp) {
      this._physics.removeBody(entity.body);
    }

    entity.destroy();
    this._emit('entity:removed', entityId);
    console.log(`[EntityManager] - Entity removed: ${entityId.slice(0, 8)}`);
    return true;
  }

  /**
   * Retire plusieurs entités
   */
  public removeMany(ids: string[]): void {
    ids.forEach(id => this.remove(id));
  }

  /**
   * Vide toutes les entités
   */
  public clear(): void {
    const ids = Array.from(this._entities.keys());
    ids.forEach(id => this.remove(id));
    console.log('[EntityManager] Toutes les entités supprimées');
  }

  // ──────────────────────────────────────────
  //  ACCÈS
  // ──────────────────────────────────────────

  /**
   * Récupère une entité par ID
   */
  public get(id: string): BaseEntity | undefined {
    return this._entities.get(id);
  }

  /**
   * Récupère une entité par NetworkID
   */
  public getByNetworkId(networkId: number): BaseEntity | undefined {
    const id = this._byNetwork.get(networkId);
    if (!id) return undefined;
    return this._entities.get(id);
  }

  /**
   * Récupère une entité typée
   */
  public getAs<T extends BaseEntity>(
    id: string,
    _constructor: new (...args: any[]) => T
  ): T | undefined {
    const entity = this._entities.get(id);
    if (entity instanceof _constructor) return entity as T;
    return undefined;
  }

  /**
   * Vérifie si une entité existe
   */
  public has(id: string): boolean {
    return this._entities.has(id);
  }

  /**
   * Retourne toutes les entités
   */
  public getAll(): BaseEntity[] {
    return Array.from(this._entities.values());
  }

  /**
   * Retourne toutes les entités d'un type
   */
  public getByType(type: EntityType): BaseEntity[] {
    const ids = this._byType.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this._entities.get(id))
      .filter(Boolean) as BaseEntity[];
  }

  /**
   * Retourne toutes les entités avec un tag
   */
  public getByTag(tag: string): BaseEntity[] {
    const ids = this._byTag.get(tag);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this._entities.get(id))
      .filter(Boolean) as BaseEntity[];
  }

  /**
   * Retourne le nombre d'entités
   */
  public get count(): number {
    return this._entities.size;
  }

  // ──────────────────────────────────────────
  //  QUERY AVANCÉE
  // ──────────────────────────────────────────

  /**
   * Requête filtrée sur les entités
   */
  public query(options: EntityQuery): BaseEntity[] {
    let results: BaseEntity[] = [];

    // Filtrer par type (utilise l'index)
    if (options.type) {
      results = this.getByType(options.type);
    } else {
      results = this.getAll();
    }

    // Filtrer par tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(e =>
        options.tags!.every(tag => e.hasTag(tag))
      );
    }

    // Filtrer par distance
    if (options.center && options.maxDist !== undefined) {
      const maxDistSq = options.maxDist * options.maxDist;
      results = results.filter(e =>
        vec3DistanceSq(e.position, options.center!) <= maxDistSq
      );
    }

    // Limiter les résultats
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Récupère les entités dans un rayon
   */
  public queryRadius(
    center: [number, number, number],
    radius: number,
    type?:  EntityType
  ): BaseEntity[] {
    return this.query({ center, maxDist: radius, type });
  }

  /**
   * Retourne l'entité la plus proche d'un point
   */
  public queryNearest(
    center: [number, number, number],
    type?:  EntityType,
    maxDist = Infinity
  ): BaseEntity | null {
    const candidates = type
      ? this.getByType(type)
      : this.getAll();

    let nearest:  BaseEntity | null = null;
    let nearestD: number            = maxDist * maxDist;

    for (const entity of candidates) {
      const d = vec3DistanceSq(entity.position, center);
      if (d < nearestD) {
        nearestD = d;
        nearest  = entity;
      }
    }

    return nearest;
  }

  // ──────────────────────────────────────────
  //  UPDATE (TICK)
  // ──────────────────────────────────────────

  /**
   * Met à jour toutes les entités — appelé à chaque tick serveur
   */
  public update(deltaTime: number): void {
    for (const entity of this._entities.values()) {
      if (!entity.isDestroyed) {
        try {
          entity.update(deltaTime);
        } catch (e) {
          console.error(`[EntityManager] Update error on ${entity.id}:`, e);
        }
      }
    }
  }

  // ──────────────────────────────────────────
  //  DIRTY ENTITIES (SYNC RÉSEAU)
  // ──────────────────────────────────────────

  /**
   * Retourne toutes les entités modifiées depuis le dernier tick réseau
   */
  public getDirtyEntities(): BaseEntity[] {
    const dirty: BaseEntity[] = [];
    for (const entity of this._entities.values()) {
      if (entity.isDirty && !entity.isDestroyed) {
        dirty.push(entity);
      }
    }
    return dirty;
  }

  /**
   * Marque toutes les entités comme synchronisées
   */
  public clearAllDirty(): void {
    for (const entity of this._entities.values()) {
      entity.clearDirty();
    }
  }

  /**
   * Sérialise toutes les entités pour sync réseau
   */
  public serializeAll(): EntityData[] {
    return Array.from(this._entities.values())
      .filter(e => !e.isDestroyed)
      .map(e => e.serialize());
  }

  /**
   * Sérialise uniquement les entités dirty
   */
  public serializeDirty(): EntityData[] {
    return this.getDirtyEntities().map(e => {
      const data = e.serialize();
      e.clearDirty();
      return data;
    });
  }

  // ──────────────────────────────────────────
  //  STATS
  // ──────────────────────────────────────────

  public getStats(): EntityManagerStats {
    const byType: Record<string, number> = {};
    let dirtyCount   = 0;
    let physicsCount = 0;

    for (const entity of this._entities.values()) {
      // Par type
      byType[entity.type] = (byType[entity.type] ?? 0) + 1;

      // Dirty
      if (entity.isDirty) dirtyCount++;

      // Physics
      if (entity instanceof PhysicsProp) physicsCount++;
    }

    return {
      total:        this._entities.size,
      byType,
      dirtyCount,
      physicsCount,
    };
  }

  // ──────────────────────────────────────────
  //  INDEX INTERNES
  // ──────────────────────────────────────────

  private _indexTag(entityId: string, tag: string): void {
    if (!this._byTag.has(tag)) {
      this._byTag.set(tag, new Set());
    }
    this._byTag.get(tag)!.add(entityId);
  }

  private _unindexTag(entityId: string, tag: string): void {
    this._byTag.get(tag)?.delete(entityId);
  }

  private _removeFromIndexes(entity: BaseEntity): void {
    this._entities.delete(entity.id);
    this._byType.get(entity.type)?.delete(entity.id);
    this._byNetwork.delete(entity.networkId);
    entity.getTags().forEach(tag => this._unindexTag(entity.id, tag));
  }

  private _onEntityDestroyed(entityId: string): void {
    const entity = this._entities.get(entityId);
    if (!entity) return;
    this._removeFromIndexes(entity);
    this._emit('entity:destroyed', entityId);
  }

  // ──────────────────────────────────────────
  //  EVENTS
  // ──────────────────────────────────────────

  public on(event: ManagerEvent, listener: Function): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  public off(event: ManagerEvent, listener: Function): void {
    this._listeners.get(event)?.delete(listener);
  }

  private _emit(event: string, ...args: any[]): void {
    this._listeners.get(event)?.forEach(fn => {
      try { fn(...args); } catch(e) {
        console.error(`[EntityManager] Event error (${event}):`, e);
      }
    });
  }
}
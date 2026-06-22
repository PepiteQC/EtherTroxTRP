// server/entities/BaseEntity.ts
import { v4 as uuidv4 } from 'uuid';
import type { EntityData, EntityType } from '../../shared/types';
import { uniqueId, vec3Clone, isValidPosition } from '../../shared/utils';

// ============================================================
//  EVENTS
// ============================================================

type EntityEventMap = {
  destroy:    (entity: BaseEntity) => void;
  dirty:      (entity: BaseEntity) => void;
  tagAdded:   (entity: BaseEntity, tag: string) => void;
  tagRemoved: (entity: BaseEntity, tag: string) => void;
};

type EntityEventKey = keyof EntityEventMap;

// ============================================================
//  BASE ENTITY
// ============================================================

export abstract class BaseEntity {

  // ──────────────────────────────────────────
  //  IDENTITÉ
  // ──────────────────────────────────────────
  public readonly id:        string;
  public readonly networkId: number;
  public readonly type:      EntityType;
  public readonly createdAt: number;

  // ──────────────────────────────────────────
  //  TRANSFORM
  // ──────────────────────────────────────────
  protected _position: [number, number, number];
  protected _rotation: [number, number, number];
  protected _scale:    [number, number, number];

  // ──────────────────────────────────────────
  //  ÉTAT
  // ──────────────────────────────────────────
  protected _isDestroyed: boolean = false;
  protected _isDirty:     boolean = true;
  protected _tags:        Set<string> = new Set();
  protected _properties:  Record<string, any> = {};

  // ──────────────────────────────────────────
  //  MODÈLE 3D
  // ──────────────────────────────────────────
  public readonly modelPath?: string;

  // ──────────────────────────────────────────
  //  EVENTS (mini EventEmitter interne)
  // ──────────────────────────────────────────
  private _listeners: Map<string, Set<Function>> = new Map();

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(
    type:       EntityType,
    data:       Partial<EntityData> = {},
    networkId?: number
  ) {
    this.id        = data.id ?? uuidv4();
    this.networkId = networkId ?? BaseEntity._generateNetworkId();
    this.type      = type;
    this.createdAt = Date.now();

    // Valider et assigner position
    this._position = isValidPosition(data.position)
      ? vec3Clone(data.position)
      : [0, 0, 0];

    this._rotation = isValidPosition(data.rotation)
      ? vec3Clone(data.rotation)
      : [0, 0, 0];

    this._scale = isValidPosition(data.scale)
      ? vec3Clone(data.scale)
      : [1, 1, 1];

    this.modelPath = data.modelPath;

    // Propriétés initiales
    if (data.properties) {
      this._properties = { ...data.properties };
    }

    // Tags initiaux
    if (data.tags) {
      data.tags.forEach(t => this._tags.add(t));
    }
  }

  // ──────────────────────────────────────────
  //  GETTERS / SETTERS
  // ──────────────────────────────────────────
  get position(): [number, number, number] { return this._position; }
  set position(pos: [number, number, number]) {
    if (!isValidPosition(pos)) return;
    this._position = vec3Clone(pos);
    this._markDirty();
  }

  get rotation(): [number, number, number] { return this._rotation; }
  set rotation(rot: [number, number, number]) {
    if (!isValidPosition(rot)) return;
    this._rotation = vec3Clone(rot);
    this._markDirty();
  }

  get scale(): [number, number, number] { return this._scale; }
  set scale(scl: [number, number, number]) {
    if (!isValidPosition(scl)) return;
    this._scale = vec3Clone(scl);
    this._markDirty();
  }

  get isDestroyed(): boolean { return this._isDestroyed; }
  get isDirty():     boolean { return this._isDirty; }

  // ──────────────────────────────────────────
  //  LIFECYCLE
  // ──────────────────────────────────────────

  /**
   * Update appelé à chaque tick serveur.
   * À surcharger dans les classes enfants.
   */
  public update(_deltaTime: number): void {}

  /**
   * Détruit l'entité et libère ses ressources.
   */
  public destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._onBeforeDestroy();
    this._emit('destroy', this);
    this._listeners.clear();
  }

  // ──────────────────────────────────────────
  //  SÉRIALISATION RÉSEAU
  // ──────────────────────────────────────────

  /**
   * Sérialise l'entité pour envoi réseau.
   */
  public serialize(): EntityData {
    return {
      id:         this.id,
      type:       this.type,
      modelPath:  this.modelPath,
      position:   [...this._position],
      rotation:   [...this._rotation],
      scale:      [...this._scale],
      properties: { ...this._properties },
      tags:       this.getTags(),
    };
  }

  /**
   * Met à jour l'entité depuis des données réseau.
   */
  public deserialize(data: Partial<EntityData>): void {
    if (isValidPosition(data.position)) this._position = vec3Clone(data.position);
    if (isValidPosition(data.rotation)) this._rotation = vec3Clone(data.rotation);
    if (isValidPosition(data.scale))    this._scale    = vec3Clone(data.scale);
    if (data.properties) this._properties = { ...data.properties };
    if (data.tags)       data.tags.forEach(t => this._tags.add(t));
    this._markDirty();
  }

  // ──────────────────────────────────────────
  //  DIRTY FLAG
  // ──────────────────────────────────────────

  public _markDirty(): void {
    this._isDirty = true;
    this._emit('dirty', this);
  }

  public clearDirty(): void {
    this._isDirty = false;
  }

  // ──────────────────────────────────────────
  //  TAGS
  // ──────────────────────────────────────────

  public addTag(tag: string): void {
    this._tags.add(tag);
    this._emit('tagAdded', this, tag);
  }

  public removeTag(tag: string): void {
    this._tags.delete(tag);
    this._emit('tagRemoved', this, tag);
  }

  public hasTag(tag: string): boolean {
    return this._tags.has(tag);
  }

  public getTags(): string[] {
    return Array.from(this._tags);
  }

  // ──────────────────────────────────────────
  //  PROPRIÉTÉS
  // ──────────────────────────────────────────

  public getProperty<T = any>(key: string): T | undefined {
    return this._properties[key] as T;
  }

  public setProperty(key: string, value: any): void {
    this._properties[key] = value;
    this._markDirty();
  }

  public getProperties(): Record<string, any> {
    return { ...this._properties };
  }

  // ──────────────────────────────────────────
  //  EVENTS
  // ──────────────────────────────────────────

  public on(event: string, listener: Function): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  public off(event: string, listener: Function): void {
    this._listeners.get(event)?.delete(listener);
  }

  protected _emit(event: string, ...args: any[]): void {
    this._listeners.get(event)?.forEach(fn => {
      try { fn(...args); } catch (e) {
        console.error(`[Entity:${this.id}] Event error (${event}):`, e);
      }
    });
  }

  // ──────────────────────────────────────────
  //  HOOK (à surcharger)
  // ──────────────────────────────────────────

  protected _onBeforeDestroy(): void {}

  // ──────────────────────────────────────────
  //  DEBUG
  // ──────────────────────────────────────────

  public toString(): string {
    return `[${this.type}:${this.id.slice(0, 8)}] pos=(${this._position.map(v => v.toFixed(2)).join(',')})`;
  }

  public toDebug(): object {
    return {
      id:        this.id,
      networkId: this.networkId,
      type:      this.type,
      position:  this._position,
      rotation:  this._rotation,
      scale:     this._scale,
      tags:      this.getTags(),
      isDirty:   this._isDirty,
      isDestroyed: this._isDestroyed,
      properties: this._properties,
    };
  }

  // ──────────────────────────────────────────
  //  STATIC
  // ──────────────────────────────────────────

  private static _networkIdCounter = 0;

  private static _generateNetworkId(): number {
    return ++BaseEntity._networkIdCounter;
  }

  public static resetNetworkIdCounter(): void {
    BaseEntity._networkIdCounter = 0;
  }
}
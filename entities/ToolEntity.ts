// server/entities/ToolEntity.ts
import { BaseEntity } from './BaseEntity';
import type { EntityData, ToolAction } from '../../shared/types';

// ============================================================
//  TOOL ENTITY
// ============================================================

export class ToolEntity extends BaseEntity {

  public readonly toolId:    string;
  public readonly toolName:  string;
  public readonly owner:     string; // playerId

  private _isActive:    boolean = false;
  private _targetId?:   string;
  private _cooldown:    number  = 0;
  private _cooldownMax: number  = 0.3;

  constructor(data: {
    toolId:   string;
    toolName: string;
    owner:    string;
    position?: [number, number, number];
  }) {
    super('tool', {
      position: data.position ?? [0, 0, 0],
      rotation: [0, 0, 0],
      scale:    [1, 1, 1],
    });

    this.toolId   = data.toolId;
    this.toolName = data.toolName;
    this.owner    = data.owner;

    this.addTag('tool');
    this.addTag(`tool:${data.toolId}`);
  }

  // ──────────────────────────────────────────
  //  UPDATE
  // ──────────────────────────────────────────

  public override update(dt: number): void {
    if (this._cooldown > 0) {
      this._cooldown -= dt;
    }
  }

  // ──────────────────────────────────────────
  //  ACTIONS
  // ──────────────────────────────────────────

  public primaryFire(targetId?: string, params?: Record<string, any>): void {
    if (this._cooldown > 0) return;
    this._cooldown = this._cooldownMax;

    this._targetId = targetId;
    this._emit('tool:primary', {
      toolId:   this.toolId,
      playerId: this.owner,
      targetId,
      position: [...this._position],
      params,
    } as ToolAction & { playerId: string; position: [number, number, number] });
  }

  public secondaryFire(targetId?: string, params?: Record<string, any>): void {
    if (this._cooldown > 0) return;
    this._cooldown = this._cooldownMax;

    this._emit('tool:secondary', {
      toolId:   this.toolId,
      playerId: this.owner,
      targetId,
      position: [...this._position],
      params,
    } as ToolAction & { playerId: string; position: [number, number, number] });
  }

  public reload(): void {
    this._emit('tool:reload', { toolId: this.toolId, playerId: this.owner });
  }

  // ──────────────────────────────────────────
  //  ACTIVATION
  // ──────────────────────────────────────────

  public activate(): void {
    this._isActive = true;
    this.addTag('active');
    this._markDirty();
  }

  public deactivate(): void {
    this._isActive = false;
    this.removeTag('active');
    this._targetId = undefined;
    this._markDirty();
  }

  // ──────────────────────────────────────────
  //  SÉRIALISATION
  // ──────────────────────────────────────────

  public serialize() {
    return {
      ...super.serialize(),
      toolId:    this.toolId,
      toolName:  this.toolName,
      owner:     this.owner,
      isActive:  this._isActive,
      targetId:  this._targetId,
    };
  }

  // ──────────────────────────────────────────
  //  GETTERS
  // ──────────────────────────────────────────

  get isActive(): boolean { return this._isActive; }
  get targetId(): string | undefined { return this._targetId; }
}
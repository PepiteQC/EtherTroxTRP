// server/entities/NpcEntity.ts
import { BaseEntity } from './BaseEntity';
import type { EntityData, NpcData } from '../../shared/types';
import { vec3Distance, vec3Normalize, vec3Sub, vec3Add, vec3Scale } from '../../shared/utils';
import type { Vec3 } from '../../shared/utils';

// ============================================================
//  TYPES
// ============================================================

export type NpcState = 'idle' | 'patrol' | 'follow' | 'attack' | 'flee' | 'talk' | 'dead';

export interface DialogueLine {
  speaker: string;
  text:    string;
  choices?: { text: string; nextId: string }[];
}

export interface DialogueTree {
  id:    string;
  lines: Record<string, DialogueLine>;
}

// ============================================================
//  NPC ENTITY
// ============================================================

export class NpcEntity extends BaseEntity {

  // ──────────────────────────────────────────
  //  CONFIG
  // ──────────────────────────────────────────
  public readonly displayName: string;
  public readonly faction?:    string;

  // ──────────────────────────────────────────
  //  ÉTAT
  // ──────────────────────────────────────────
  private _health:    number;
  private _maxHealth: number;
  private _state:     NpcState         = 'idle';
  private _walkSpeed: number           = 2;
  private _runSpeed:  number           = 5;
  private _detectionRange: number      = 15;
  private _attackRange:    number      = 3;
  private _attackDamage:   number      = 10;
  private _attackCooldown: number      = 0;

  // ──────────────────────────────────────────
  //  PATROL
  // ──────────────────────────────────────────
  private _patrolPoints:    Vec3[]     = [];
  private _currentPatrolIdx: number    = 0;
  private _patrolWaitTime:  number     = 0;

  // ──────────────────────────────────────────
  //  DIALOGUE
  // ──────────────────────────────────────────
  private _dialogueTree?:    DialogueTree;
  private _currentDialogue?: string;
  private _talkingTo?:       string;

  // ──────────────────────────────────────────
  //  CIBLE
  // ──────────────────────────────────────────
  private _targetId?:     string;
  private _targetPos?:    Vec3;
  private _homePosition:  Vec3;

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(data: Partial<NpcData> & { displayName: string }) {
    super('npc', data);
    this.displayName = data.displayName;
    this._health     = data.health    ?? 100;
    this._maxHealth  = data.maxHealth ?? 100;
    this.faction     = data.faction;

    this._homePosition = [...this._position];
    this.addTag('npc');
    this.addTag('interactable');
    if (this.faction) this.addTag(`faction:${this.faction}`);
  }

  // ──────────────────────────────────────────
  //  UPDATE
  // ──────────────────────────────────────────

  public override update(dt: number): void {
    if (this._isDestroyed) return;
    if (this._state === 'dead') return;

    switch (this._state) {
      case 'idle':    this._updateIdle(dt);    break;
      case 'patrol':  this._updatePatrol(dt);  break;
      case 'follow':  this._updateFollow(dt);  break;
      case 'attack':  this._updateAttack(dt);  break;
      case 'flee':    this._updateFlee(dt);    break;
      case 'talk':    break; // Pas de mouvement pendant dialogue
    }

    if (this._attackCooldown > 0) {
      this._attackCooldown -= dt;
    }
  }

  // ──────────────────────────────────────────
  //  COMPORTEMENTS
  // ──────────────────────────────────────────

  private _updateIdle(dt: number): void {
    // Ne rien faire, attendre un stimulus
  }

  private _updatePatrol(dt: number): void {
    if (this._patrolPoints.length === 0) return;

    if (this._patrolWaitTime > 0) {
      this._patrolWaitTime -= dt;
      return;
    }

    const target = this._patrolPoints[this._currentPatrolIdx];
    const dist   = vec3Distance(this._position, target);

    if (dist < 1.0) {
      // Point atteint → passer au suivant
      this._currentPatrolIdx = (this._currentPatrolIdx + 1) % this._patrolPoints.length;
      this._patrolWaitTime   = 1 + Math.random() * 3; // Attendre 1–4 sec
    } else {
      this._moveTowards(target, this._walkSpeed, dt);
    }
  }

  private _updateFollow(dt: number): void {
    if (!this._targetPos) return;
    const dist = vec3Distance(this._position, this._targetPos);
    if (dist > 3) {
      this._moveTowards(this._targetPos, this._runSpeed, dt);
    }
  }

  private _updateAttack(dt: number): void {
    if (!this._targetPos) {
      this._state = 'idle';
      return;
    }

    const dist = vec3Distance(this._position, this._targetPos);

    if (dist > this._detectionRange * 1.5) {
      // Cible trop loin → retour idle
      this._state   = 'idle';
      this._targetId = undefined;
      return;
    }

    if (dist > this._attackRange) {
      this._moveTowards(this._targetPos, this._runSpeed, dt);
    } else if (this._attackCooldown <= 0) {
      this._performAttack();
    }
  }

  private _updateFlee(dt: number): void {
    if (!this._targetPos) {
      this._state = 'idle';
      return;
    }

    // Courir dans la direction opposée
    const away = vec3Normalize(vec3Sub(this._position, this._targetPos));
    const flee = vec3Add(this._position, vec3Scale(away, 10));
    this._moveTowards(flee, this._runSpeed, dt);

    const dist = vec3Distance(this._position, this._targetPos);
    if (dist > this._detectionRange * 2) {
      this._state    = 'idle';
      this._targetId = undefined;
    }
  }

  // ──────────────────────────────────────────
  //  MOUVEMENT
  // ──────────────────────────────────────────

  private _moveTowards(target: Vec3, speed: number, dt: number): void {
    const dir = vec3Normalize(vec3Sub(target, this._position));
    const step = vec3Scale(dir, speed * dt);
    this._position = vec3Add(this._position, step) as Vec3;

    // Rotation vers la direction
    this._rotation[1] = Math.atan2(dir[0], dir[2]);
    this._markDirty();
  }

  // ──────────────────────────────────────────
  //  COMBAT
  // ──────────────────────────────────────────

  private _performAttack(): void {
    this._attackCooldown = 1.5;
    this._emit('npc:attack', {
      npcId:    this.id,
      targetId: this._targetId,
      damage:   this._attackDamage,
      position: [...this._position],
    });
  }

  public takeDamage(amount: number, attackerId?: string): void {
    if (this._state === 'dead') return;

    this._health -= amount;
    this._emit('npc:damage', { npcId: this.id, damage: amount, remaining: this._health });

    if (this._health <= 0) {
      this._die();
      return;
    }

    // Réaction : fuir ou attaquer
    if (attackerId && this.hasTag('aggressive')) {
      this._targetId = attackerId;
      this._state    = 'attack';
    } else if (this._health < this._maxHealth * 0.3) {
      this._state = 'flee';
    }
  }

  private _die(): void {
    this._health = 0;
    this._state  = 'dead';
    this.addTag('dead');
    this._emit('npc:death', { npcId: this.id, position: [...this._position] });
  }

  // ──────────────────────────────────────────
  //  DIALOGUE
  // ──────────────────────────────────────────

  public setDialogueTree(tree: DialogueTree): void {
    this._dialogueTree = tree;
  }

  public startDialogue(playerId: string): DialogueLine | null {
    if (!this._dialogueTree) return null;
    this._state      = 'talk';
    this._talkingTo  = playerId;
    this._currentDialogue = 'start';
    return this._dialogueTree.lines['start'] ?? null;
  }

  public advanceDialogue(choiceIndex?: number): DialogueLine | null {
    if (!this._dialogueTree || !this._currentDialogue) return null;

    const current = this._dialogueTree.lines[this._currentDialogue];
    if (!current) return this.endDialogue();

    if (current.choices && choiceIndex !== undefined && current.choices[choiceIndex]) {
      this._currentDialogue = current.choices[choiceIndex].nextId;
    } else {
      this._currentDialogue = undefined;
      return this.endDialogue();
    }

    const next = this._dialogueTree.lines[this._currentDialogue];
    return next ?? this.endDialogue();
  }

  public endDialogue(): null {
    this._state           = 'idle';
    this._talkingTo       = undefined;
    this._currentDialogue = undefined;
    this._emit('npc:dialogue_end', { npcId: this.id });
    return null;
  }

  // ──────────────────────────────────────────
  //  PATROL
  // ──────────────────────────────────────────

  public setPatrolPoints(points: Vec3[]): void {
    this._patrolPoints     = [...points];
    this._currentPatrolIdx = 0;
    if (points.length > 0) this._state = 'patrol';
  }

  public setState(state: NpcState): void {
    this._state = state;
  }

  // ──────────────────────────────────────────
  //  SÉRIALISATION
  // ──────────────────────────────────────────

  public serialize() {
    return {
      ...super.serialize(),
      displayName: this.displayName,
      health:      this._health,
      maxHealth:   this._maxHealth,
      state:       this._state,
      faction:     this.faction,
      talkingTo:   this._talkingTo,
    };
  }

  // ──────────────────────────────────────────
  //  GETTERS
  // ──────────────────────────────────────────

  get health():    number    { return this._health; }
  get maxHealth(): number    { return this._maxHealth; }
  get state():     NpcState  { return this._state; }
  get isAlive():   boolean   { return this._health > 0; }
}
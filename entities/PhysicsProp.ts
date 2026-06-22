// server/entities/PhysicsProp.ts
import * as CANNON from 'cannon-es';
import { BaseEntity } from './BaseEntity';
import type { EntityData, PhysicsConfig } from '../../shared/types';
import { vec3Clone, isValidPosition } from '../../shared/utils';

// ============================================================
//  INTERFACES
// ============================================================

export interface PropData extends Partial<EntityData> {
  physics: PhysicsConfig;
}

export interface CollideEvent {
  body:    CANNON.Body;
  contact: CANNON.ContactEquation;
}

// ============================================================
//  PHYSICS PROP
// ============================================================

export class PhysicsProp extends BaseEntity {

  // ──────────────────────────────────────────
  //  CORPS PHYSIQUE
  // ──────────────────────────────────────────
  public  body:          CANNON.Body;
  public  readonly config: PhysicsConfig;

  // ──────────────────────────────────────────
  //  ÉTAT PHYSIQUE
  // ──────────────────────────────────────────
  private _isFrozen:    boolean = false;
  private _isSleeping:  boolean = false;
  private _isHeld:      boolean = false;
  private _heldByPlayer?: string;

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(data: PropData, networkId?: number) {
    super('prop', data, networkId);
    this.config = { ...data.physics };

    // Créer le corps Cannon
    this.body = this._createBody();

    // Appliquer position initiale
    this.body.position.set(
      this._position[0],
      this._position[1],
      this._position[2]
    );

    // Appliquer rotation initiale (Euler → Quaternion)
    this.body.quaternion.setFromEuler(
      this._rotation[0],
      this._rotation[1],
      this._rotation[2]
    );

    // Tags par défaut
    this.addTag('physics');
    this.addTag('prop');
    if (this.config.isTrigger) this.addTag('trigger');
    if (this.config.mass === 0) this.addTag('static');
  }

  // ──────────────────────────────────────────
  //  CRÉATION CORPS CANNON
  // ──────────────────────────────────────────

  private _createBody(): CANNON.Body {
    const body = new CANNON.Body({
      mass:            this.config.mass,
      linearDamping:   this.config.linearDamping  ?? 0.1,
      angularDamping:  this.config.angularDamping ?? 0.1,
      allowSleep:      true,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit:  1.0,
    });

    // Ajouter la shape
    body.addShape(this._createShape());

    // Matériau physique
    body.material = new CANNON.Material({
      friction:    this.config.friction    ?? 0.5,
      restitution: this.config.restitution ?? 0.3,
    });

    // Trigger = pas de réponse de collision
    if (this.config.isTrigger) {
      body.collisionResponse = false;
    }

    // Écouter les collisions
    body.addEventListener('collide', (e: any) => this._onCollide(e));

    // Sleep / Wake events
    body.addEventListener('sleep', () => {
      this._isSleeping = true;
    });
    body.addEventListener('wakeup', () => {
      this._isSleeping = false;
      this._markDirty();
    });

    return body;
  }

  private _createShape(): CANNON.Shape {
    const [x, y, z] = this.config.dimensions;

    switch (this.config.shape) {
      case 'box':
        // x, y, z = halfExtents
        return new CANNON.Box(new CANNON.Vec3(
          Math.max(0.01, x),
          Math.max(0.01, y),
          Math.max(0.01, z)
        ));

      case 'sphere':
        // x = radius
        return new CANNON.Sphere(Math.max(0.01, x));

      case 'cylinder':
        // x = radius, y = height, segments = 12
        return new CANNON.Cylinder(
          Math.max(0.01, x),
          Math.max(0.01, x),
          Math.max(0.01, y),
          12
        );

      case 'trimesh':
        // Non supporté sans fichier de collision
        console.warn(`[PhysicsProp:${this.id}] Trimesh non supporté → fallback box`);
        return new CANNON.Box(new CANNON.Vec3(
          Math.max(0.01, x),
          Math.max(0.01, y),
          Math.max(0.01, z)
        ));

      default:
        return new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    }
  }

  // ──────────────────────────────────────────
  //  UPDATE (SYNC CANNON → ENTITY)
  // ──────────────────────────────────────────

  public override update(_deltaTime: number): void {
    if (this._isDestroyed) return;
    if (this._isSleeping)  return;
    if (this._isFrozen)    return;

    // Sync position
    const p = this.body.position;
    this._position[0] = p.x;
    this._position[1] = p.y;
    this._position[2] = p.z;

    // Sync rotation (Quaternion → Euler)
    const euler = new CANNON.Vec3();
    this.body.quaternion.toEuler(euler);
    this._rotation[0] = euler.x;
    this._rotation[1] = euler.y;
    this._rotation[2] = euler.z;

    // Marquer dirty si en mouvement
    const speed = this.body.velocity.length();
    if (speed > 0.01) {
      this._markDirty();
    }

    // Détecter si sorti du monde
    if (this._position[1] < -200) {
      this._onFallOutOfWorld();
    }
  }

  // ──────────────────────────────────────────
  //  CONTRÔLE PHYSIQUE
  // ──────────────────────────────────────────

  /**
   * Gèle / dégèle le prop
   */
  public freeze(frozen = true): void {
    this._isFrozen = frozen;

    if (frozen) {
      this.body.type = CANNON.Body.STATIC;
      this.body.velocity.setZero();
      this.body.angularVelocity.setZero();
      this.body.updateMassProperties();
    } else {
      this.body.type = CANNON.Body.DYNAMIC;
      this.body.updateMassProperties();
      this.body.wakeUp();
    }

    this._markDirty();
  }

  /**
   * Téléporte le prop
   */
  public teleport(position: [number, number, number]): void {
    if (!isValidPosition(position)) return;

    this.body.position.set(position[0], position[1], position[2]);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    this._position = vec3Clone(position);
    this.body.wakeUp();
    this._markDirty();
  }

  /**
   * Applique une impulsion
   */
  public applyImpulse(
    impulse:  [number, number, number],
    worldPoint?: [number, number, number]
  ): void {
    const imp = new CANNON.Vec3(impulse[0], impulse[1], impulse[2]);
    const pt  = worldPoint
      ? new CANNON.Vec3(worldPoint[0], worldPoint[1], worldPoint[2])
      : this.body.position;

    this.body.applyImpulse(imp, pt);
    this.body.wakeUp();
    this._markDirty();
  }

  /**
   * Applique une force continue
   */
  public applyForce(
    force:      [number, number, number],
    worldPoint?: [number, number, number]
  ): void {
    const f  = new CANNON.Vec3(force[0], force[1], force[2]);
    const pt = worldPoint
      ? new CANNON.Vec3(worldPoint[0], worldPoint[1], worldPoint[2])
      : this.body.position;

    this.body.applyForce(f, pt);
    this.body.wakeUp();
    this._markDirty();
  }

  /**
   * Définit la vélocité linéaire
   */
  public setVelocity(velocity: [number, number, number]): void {
    if (!isValidPosition(velocity)) return;
    this.body.velocity.set(velocity[0], velocity[1], velocity[2]);
    this.body.wakeUp();
    this._markDirty();
  }

  /**
   * Définit la vélocité angulaire
   */
  public setAngularVelocity(velocity: [number, number, number]): void {
    if (!isValidPosition(velocity)) return;
    this.body.angularVelocity.set(velocity[0], velocity[1], velocity[2]);
    this.body.wakeUp();
    this._markDirty();
  }

  /**
   * Ramasse le prop (Physics Gun)
   */
  public pickup(playerId: string): void {
    if (this._isHeld) return;
    this._isHeld       = true;
    this._heldByPlayer = playerId;
    this.body.type     = CANNON.Body.KINEMATIC;
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    this.addTag('held');
    this._markDirty();
  }

  /**
   * Lâche le prop
   */
  public drop(throwVelocity?: [number, number, number]): void {
    if (!this._isHeld) return;
    this._isHeld       = false;
    this._heldByPlayer = undefined;
    this.body.type     = CANNON.Body.DYNAMIC;
    this.body.updateMassProperties();

    if (throwVelocity && isValidPosition(throwVelocity)) {
      this.body.velocity.set(
        throwVelocity[0],
        throwVelocity[1],
        throwVelocity[2]
      );
    }

    this.body.wakeUp();
    this.removeTag('held');
    this._markDirty();
  }

  /**
   * Explose le prop (si tag 'explosive')
   */
  public explode(): void {
    if (!this.hasTag('explosive')) return;
    this._emit('explode', {
      position: [...this._position],
      radius:   this.getProperty<number>('explosionRadius') ?? 5,
      damage:   this.getProperty<number>('explosionDamage') ?? 100,
    });
    this.destroy();
  }

  // ──────────────────────────────────────────
  //  ÉVÉNEMENTS INTERNES
  // ──────────────────────────────────────────

  protected _onCollide(event: CollideEvent): void {
    const contact       = event.contact;
    const impactSpeed   = contact.getImpactVelocityAlongNormal();
    const absImpact     = Math.abs(impactSpeed);

    this._emit('collide', {
      otherId:     (event.body as any).__entityId,
      impactSpeed: absImpact,
    });

    // Auto-explosion si impact fort
    if (this.hasTag('explosive') && absImpact > 15) {
      this.explode();
    }

    // Son d'impact (émit pour le réseau)
    if (absImpact > 3) {
      this._emit('impact_sound', {
        position: [...this._position],
        speed:    absImpact,
      });
    }
  }

  protected _onFallOutOfWorld(): void {
    console.warn(`[PhysicsProp:${this.id}] Sorti du monde → respawn`);
    const spawnPos = this.getProperty<[number, number, number]>('spawnPosition')
      ?? [0, 5, 0];
    this.teleport(spawnPos);
  }

  // ──────────────────────────────────────────
  //  SÉRIALISATION
  // ──────────────────────────────────────────

  public override serialize(): EntityData & { physics: PhysicsConfig } {
    return {
      ...super.serialize(),
      physics: { ...this.config },
    };
  }

  // ──────────────────────────────────────────
  //  DESTRUCTION
  // ──────────────────────────────────────────

  protected override _onBeforeDestroy(): void {
    // Le corps sera retiré du monde par EntityManager
    this.body.removeAllShapes();
    this.body.removeEventListener('collide', this._onCollide);
  }

  // ──────────────────────────────────────────
  //  GETTERS
  // ──────────────────────────────────────────

  get isFrozen():    boolean          { return this._isFrozen; }
  get isSleeping():  boolean          { return this._isSleeping; }
  get isHeld():      boolean          { return this._isHeld; }
  get heldBy():      string|undefined { return this._heldByPlayer; }
  get mass():        number           { return this.config.mass; }
  get isPhysicsProp(): true           { return true; }

  get velocity(): [number, number, number] {
    return [
      this.body.velocity.x,
      this.body.velocity.y,
      this.body.velocity.z,
    ];
  }

  get speed(): number {
    return this.body.velocity.length();
  }
}
// server/entities/VehicleEntity.ts
import * as CANNON from 'cannon-es';
import { BaseEntity } from './BaseEntity';
import type { EntityData, VehicleData } from '../../shared/types';

// ============================================================
//  VEHICLE ENTITY
// ============================================================

export interface WheelConfig {
  position:    [number, number, number];
  radius:      number;
  isFront:     boolean;
}

export class VehicleEntity extends BaseEntity {

  // ──────────────────────────────────────────
  //  CONFIG
  // ──────────────────────────────────────────
  public readonly modelId:      string;
  public readonly maxSpeed:     number;
  public readonly engineForce:  number;
  public readonly seats:        number;

  // ──────────────────────────────────────────
  //  CORPS PHYSIQUE
  // ──────────────────────────────────────────
  public body: CANNON.Body;

  // ──────────────────────────────────────────
  //  ÉTAT CONDUITE
  // ──────────────────────────────────────────
  private _driver?:            string; // playerId
  private _passengers:         Map<number, string> = new Map(); // seat → playerId
  private _throttle:           number = 0;
  private _steering:           number = 0;
  private _brake:              number = 0;
  private _currentSpeed:       number = 0;
  private _isEngineOn:         boolean = false;
  private _health:             number = 100;
  private _fuel:               number = 100;
  private _fuelConsumption:    number = 0.01;

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(data: Partial<VehicleData> & { modelId: string }) {
    super('vehicle', data);
    this.modelId     = data.modelId;
    this.maxSpeed    = data.maxSpeed    ?? 200;
    this.engineForce = data.engineForce ?? 1500;
    this.seats       = data.seats       ?? 4;

    this.body = this._createBody();

    this.addTag('vehicle');
    this.addTag('driveable');
    this.setProperty('horn', false);
    this.setProperty('lights', false);
    this.setProperty('siren', false);
  }

  // ──────────────────────────────────────────
  //  CORPS PHYSIQUE
  // ──────────────────────────────────────────

  private _createBody(): CANNON.Body {
    const body = new CANNON.Body({
      mass:           800,
      linearDamping:  0.3,
      angularDamping: 0.5,
      allowSleep:     false,
    });

    // Chassis (caisse principale)
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.1, 0.4, 2.5));
    body.addShape(chassisShape, new CANNON.Vec3(0, 0.5, 0));

    // Cabine (partie haute)
    const cabinShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.35, 1.2));
    body.addShape(cabinShape, new CANNON.Vec3(0, 1.15, -0.5));

    body.position.set(
      this._position[0],
      this._position[1],
      this._position[2]
    );

    return body;
  }

  // ──────────────────────────────────────────
  //  UPDATE
  // ──────────────────────────────────────────

  public override update(dt: number): void {
    if (this._isDestroyed) return;

    // Sync position depuis Cannon
    const p = this.body.position;
    this._position[0] = p.x;
    this._position[1] = p.y;
    this._position[2] = p.z;

    const euler = new CANNON.Vec3();
    this.body.quaternion.toEuler(euler);
    this._rotation[0] = euler.x;
    this._rotation[1] = euler.y;
    this._rotation[2] = euler.z;

    this._currentSpeed = this.body.velocity.length();

    // Appliquer forces de conduite
    if (this._isEngineOn && this._driver) {
      this._applyDriving(dt);
    }

    // Consommation carburant
    if (this._isEngineOn && Math.abs(this._throttle) > 0.01) {
      this._fuel = Math.max(0, this._fuel - this._fuelConsumption * Math.abs(this._throttle) * dt);
      if (this._fuel <= 0) {
        this._isEngineOn = false;
      }
    }

    // Chute hors monde
    if (this._position[1] < -200) {
      this.teleport([0, 10, 0]);
    }

    this._markDirty();
  }

  private _applyDriving(dt: number): void {
    // Direction avant du véhicule
    const forward = new CANNON.Vec3(0, 0, -1);
    this.body.quaternion.vmult(forward, forward);

    // Accélération / freinage
    if (this._throttle !== 0) {
      const force = forward.scale(this._throttle * this.engineForce * dt);
      this.body.applyForce(force, this.body.position);
      this.body.wakeUp();
    }

    // Freinage
    if (this._brake > 0) {
      const vel     = this.body.velocity.clone();
      const brake   = vel.scale(-this._brake * 2 * dt);
      this.body.applyForce(brake, this.body.position);
    }

    // Direction (torque angulaire)
    if (this._steering !== 0 && this._currentSpeed > 0.5) {
      const steerForce = this._steering * 3 * dt;
      this.body.angularVelocity.y += steerForce;
    }

    // Limiter la vitesse
    if (this._currentSpeed > this.maxSpeed / 3.6) {
      const ratio = (this.maxSpeed / 3.6) / this._currentSpeed;
      this.body.velocity.scale(ratio, this.body.velocity);
    }
  }

  // ──────────────────────────────────────────
  //  CONTRÔLES
  // ──────────────────────────────────────────

  public setThrottle(value: number):  void { this._throttle = Math.max(-1, Math.min(1, value)); }
  public setSteering(value: number):  void { this._steering = Math.max(-1, Math.min(1, value)); }
  public setBrake(value: number):     void { this._brake    = Math.max(0,  Math.min(1, value)); }

  public startEngine(): void {
    if (this._fuel > 0) {
      this._isEngineOn = true;
      this._markDirty();
    }
  }

  public stopEngine(): void {
    this._isEngineOn = false;
    this._throttle   = 0;
    this._steering   = 0;
    this._brake      = 0;
    this._markDirty();
  }

  // ──────────────────────────────────────────
  //  PASSAGERS
  // ──────────────────────────────────────────

  public enterVehicle(playerId: string, seat = 0): boolean {
    if (seat === 0) {
      if (this._driver) return false;
      this._driver = playerId;
      this.startEngine();
      return true;
    }
    if (this._passengers.has(seat)) return false;
    if (seat >= this.seats) return false;
    this._passengers.set(seat, playerId);
    return true;
  }

  public exitVehicle(playerId: string): boolean {
    if (this._driver === playerId) {
      this._driver = undefined;
      this.stopEngine();
      return true;
    }
    for (const [seat, pid] of this._passengers) {
      if (pid === playerId) {
        this._passengers.delete(seat);
        return true;
      }
    }
    return false;
  }

  public getDriver(): string | undefined { return this._driver; }
  public getPassengers(): Map<number, string> { return new Map(this._passengers); }
  public isOccupied(): boolean { return !!this._driver; }

  // ──────────────────────────────────────────
  //  DÉGÂTS
  // ──────────────────────────────────────────

  public damage(amount: number): void {
    this._health = Math.max(0, this._health - amount);
    if (this._health <= 0) this._onDestroyed();
    this._markDirty();
  }

  public repair(amount: number): void {
    this._health = Math.min(100, this._health + amount);
    this._markDirty();
  }

  private _onDestroyed(): void {
    this.stopEngine();
    this._emit('vehicle:destroyed', {
      id:       this.id,
      position: [...this._position],
    });
    // Explosion après 2 secondes
    setTimeout(() => this._emit('explosion', { position: [...this._position], radius: 6 }), 2000);
  }

  public refuel(amount: number): void {
    this._fuel = Math.min(100, this._fuel + amount);
    this._markDirty();
  }

  // ──────────────────────────────────────────
  //  TÉLÉPORTATION
  // ──────────────────────────────────────────

  public teleport(position: [number, number, number]): void {
    this.body.position.set(position[0], position[1], position[2]);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    this._position = [...position];
    this.body.wakeUp();
    this._markDirty();
  }

  // ──────────────────────────────────────────
  //  SÉRIALISATION
  // ──────────────────────────────────────────

  public serialize() {
    return {
      ...super.serialize(),
      modelId:       this.modelId,
      maxSpeed:      this.maxSpeed,
      seats:         this.seats,
      health:        this._health,
      fuel:          this._fuel,
      speed:         this._currentSpeed,
      isEngineOn:    this._isEngineOn,
      driver:        this._driver,
      passengers:    Object.fromEntries(this._passengers),
      horn:          this.getProperty('horn'),
      lights:        this.getProperty('lights'),
      siren:         this.getProperty('siren'),
    };
  }

  // ──────────────────────────────────────────
  //  GETTERS
  // ──────────────────────────────────────────

  get health():   number  { return this._health; }
  get fuel():     number  { return this._fuel; }
  get speed():    number  { return this._currentSpeed; }
  get isEngineOn(): boolean { return this._isEngineOn; }
}
// server/engine/PhysicsWorld.ts
import * as CANNON from 'cannon-es';
import { PHYSICS, WORLD } from '../../shared/constants';

// ============================================================
//  TYPES
// ============================================================

export interface RaycastHit {
  body:     CANNON.Body;
  point:    [number, number, number];
  normal:   [number, number, number];
  distance: number;
}

export interface ContactPair {
  bodyA:       CANNON.Body;
  bodyB:       CANNON.Body;
  impactSpeed: number;
}

type PhysicsEventMap = {
  collision:  (pair: ContactPair) => void;
  postStep:   (dt: number)        => void;
};

// ============================================================
//  PHYSICS WORLD
// ============================================================

export class PhysicsWorld {

  // ──────────────────────────────────────────
  //  CANNON WORLD
  // ──────────────────────────────────────────
  private _world:      CANNON.World;
  private _running:    boolean = false;
  private _lastTime:   number  = 0;
  private _tickTimer?: ReturnType<typeof setInterval>;

  // ──────────────────────────────────────────
  //  MATÉRIAUX GLOBAUX
  // ──────────────────────────────────────────
  public readonly groundMaterial:  CANNON.Material;
  public readonly defaultMaterial: CANNON.Material;
  public readonly iceMaterial:     CANNON.Material;
  public readonly bounceMaterial:  CANNON.Material;

  // ──────────────────────────────────────────
  //  EVENTS
  // ──────────────────────────────────────────
  private _listeners: Map<string, Set<Function>> = new Map();

  // ──────────────────────────────────────────
  //  STATS
  // ──────────────────────────────────────────
  private _stats = {
    bodies:     0,
    contacts:   0,
    stepTimeMs: 0,
    totalSteps: 0,
  };

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(gravity = PHYSICS.GRAVITY) {
    this._world = new CANNON.World({
      gravity: new CANNON.Vec3(0, gravity, 0),
    });

    // Broadphase optimisé
    this._world.broadphase = new CANNON.SAPBroadphase(this._world);

    // Solver
    this._world.solver = new CANNON.GSSolver();
    (this._world.solver as CANNON.GSSolver).iterations = PHYSICS.SOLVER_ITERATIONS;

    // Sleep
    this._world.allowSleep      = true;

    // Matériaux globaux
    this.groundMaterial  = new CANNON.Material('ground');
    this.defaultMaterial = new CANNON.Material('default');
    this.iceMaterial     = new CANNON.Material('ice');
    this.bounceMaterial  = new CANNON.Material('bounce');

    this._setupContactMaterials();
    this._setupGround();
    this._setupCollisionEvents();

    console.log('[PhysicsWorld] Initialisé — Gravity:', gravity);
  }

  // ──────────────────────────────────────────
  //  SETUP
  // ──────────────────────────────────────────

  private _setupContactMaterials(): void {
    // Default ↔ Ground
    this._world.addContactMaterial(new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.groundMaterial,
      { friction: 0.4, restitution: 0.2 }
    ));

    // Default ↔ Default
    this._world.addContactMaterial(new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      { friction: 0.5, restitution: 0.3 }
    ));

    // Ice ↔ Default (très glissant)
    this._world.addContactMaterial(new CANNON.ContactMaterial(
      this.iceMaterial,
      this.defaultMaterial,
      { friction: 0.02, restitution: 0.1 }
    ));

    // Bounce ↔ Default (très rebondissant)
    this._world.addContactMaterial(new CANNON.ContactMaterial(
      this.bounceMaterial,
      this.defaultMaterial,
      { friction: 0.3, restitution: 0.9 }
    ));

    // Bounce ↔ Ground
    this._world.addContactMaterial(new CANNON.ContactMaterial(
      this.bounceMaterial,
      this.groundMaterial,
      { friction: 0.3, restitution: 0.95 }
    ));
  }

  private _setupGround(): void {
    // Plan infini comme sol
    const groundBody = new CANNON.Body({
      mass:     0,
      type:     CANNON.Body.STATIC,
      material: this.groundMaterial,
    });

    groundBody.addShape(new CANNON.Plane());

    // Orienter le plan horizontal (rotation -90° sur X)
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.set(0, -1, 0);

    // Tag pour identification
    (groundBody as any).__isGround = true;

    this._world.addBody(groundBody);
    console.log('[PhysicsWorld] Sol créé à Y=-1');
  }

  private _setupCollisionEvents(): void {
    this._world.addEventListener('beginContact', (event: any) => {
      const bodyA = event.bodyA as CANNON.Body;
      const bodyB = event.bodyB as CANNON.Body;

      // Calculer vitesse d'impact
      const relVel = new CANNON.Vec3();
      bodyA.velocity.vsub(bodyB.velocity, relVel);
      const impactSpeed = relVel.length();

      this._stats.contacts++;

      this._emit('collision', {
        bodyA,
        bodyB,
        impactSpeed,
      } as ContactPair);
    });
  }

  // ──────────────────────────────────────────
  //  STEP (TICK)
  // ──────────────────────────────────────────

  /**
   * Démarre la boucle physique automatique
   */
  public start(): void {
    if (this._running) return;
    this._running  = true;
    this._lastTime = Date.now();

    this._tickTimer = setInterval(() => {
      this._step();
    }, PHYSICS.FIXED_STEP * 1000);

    console.log('[PhysicsWorld] Boucle physique démarrée');
  }

  /**
   * Arrête la boucle physique
   */
  public stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = undefined;
    }
    console.log('[PhysicsWorld] Boucle physique arrêtée');
  }

  /**
   * Effectue un step manuel (utile pour tests)
   */
  public stepOnce(dt = PHYSICS.FIXED_STEP): void {
    this._doStep(dt);
  }

  private _step(): void {
    const now = Date.now();
    const dt  = Math.min((now - this._lastTime) / 1000, 0.1); // max 100ms
    this._lastTime = now;
    this._doStep(dt);
  }

  private _doStep(dt: number): void {
    const t0 = Date.now();

    this._world.step(
      PHYSICS.FIXED_STEP,
      dt,
      PHYSICS.MAX_SUBSTEPS
    );

    this._stats.stepTimeMs = Date.now() - t0;
    this._stats.bodies     = this._world.bodies.length;
    this._stats.totalSteps++;

    this._emit('postStep', dt);
  }

  // ──────────────────────────────────────────
  //  GESTION DES CORPS
  // ──────────────────────────────────────────

  /**
   * Ajoute un corps Cannon au monde
   */
  public addBody(body: CANNON.Body, entityId?: string): void {
    if (entityId) {
      (body as any).__entityId = entityId;
    }
    this._world.addBody(body);
  }

  /**
   * Retire un corps Cannon du monde
   */
  public removeBody(body: CANNON.Body): void {
    try {
      this._world.removeBody(body);
    } catch (e) {
      console.warn('[PhysicsWorld] removeBody error:', e);
    }
  }

  /**
   * Vérifie si un corps est dans le monde
   */
  public hasBody(body: CANNON.Body): boolean {
    return this._world.bodies.includes(body);
  }

  // ──────────────────────────────────────────
  //  RAYCAST
  // ──────────────────────────────────────────

  /**
   * Raycast simple — retourne le premier hit
   */
  public raycastFirst(
    from: [number, number, number],
    to:   [number, number, number]
  ): RaycastHit | null {
    const result = new CANNON.RaycastResult();

    const hit = this._world.raycastClosest(
      new CANNON.Vec3(from[0], from[1], from[2]),
      new CANNON.Vec3(to[0],   to[1],   to[2]),
      { skipBackfaces: true },
      result
    );

    if (!hit || !result.body) return null;

    return {
      body:     result.body,
      point:    [result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z],
      normal:   [result.hitNormalWorld.x, result.hitNormalWorld.y, result.hitNormalWorld.z],
      distance: result.distance,
    };
  }

  /**
   * Raycast — retourne tous les hits
   */
  public raycastAll(
    from: [number, number, number],
    to:   [number, number, number]
  ): RaycastHit[] {
    const results: CANNON.RaycastResult[] = [];

    this._world.raycastAll(
      new CANNON.Vec3(from[0], from[1], from[2]),
      new CANNON.Vec3(to[0],   to[1],   to[2]),
      { skipBackfaces: true },
      (result) => {
        if (result.body) {
          results.push({ ...result } as any);
        }
      }
    );

    return results.map(r => ({
      body:     (r as any).body,
      point:    [(r as any).hitPointWorld.x, (r as any).hitPointWorld.y, (r as any).hitPointWorld.z],
      normal:   [(r as any).hitNormalWorld.x, (r as any).hitNormalWorld.y, (r as any).hitNormalWorld.z],
      distance: (r as any).distance,
    }));
  }

  // ──────────────────────────────────────────
  //  GRAVITÉ
  // ──────────────────────────────────────────

  public setGravity(g: number): void {
    this._world.gravity.set(0, g, 0);
    console.log('[PhysicsWorld] Gravité changée:', g);
  }

  public getGravity(): number {
    return this._world.gravity.y;
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

  private _emit(event: string, ...args: any[]): void {
    this._listeners.get(event)?.forEach(fn => {
      try { fn(...args); } catch(e) {
        console.error(`[PhysicsWorld] Event error (${event}):`, e);
      }
    });
  }

  // ──────────────────────────────────────────
  //  STATS & DEBUG
  // ──────────────────────────────────────────

  public getStats() {
    return {
      ...this._stats,
      isRunning: this._running,
      gravity:   this._world.gravity.y,
    };
  }

  public getBodies(): CANNON.Body[] {
    return this._world.bodies;
  }

  public getBodyCount(): number {
    return this._world.bodies.length;
  }

  /**
   * Accès direct au monde Cannon (pour cas avancés)
   */
  public get raw(): CANNON.World {
    return this._world;
  }

  // ──────────────────────────────────────────
  //  CLEANUP
  // ──────────────────────────────────────────

  public dispose(): void {
    this.stop();
    // Retirer tous les corps
    while (this._world.bodies.length > 0) {
      this._world.removeBody(this._world.bodies[0]);
    }
    this._listeners.clear();
    console.log('[PhysicsWorld] Disposé');
  }
}
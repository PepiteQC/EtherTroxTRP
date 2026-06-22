// server/modules/TroxTMod/props/barrel-explosive.ts
import { PhysicsProp } from '../../../entities/PhysicsProp';
import type { PhysicsConfig } from '../../../../shared/types';

// ============================================================
//  BARREL EXPLOSIF
// ============================================================

export class BarrelExplosive extends PhysicsProp {

  constructor(position: [number, number, number]) {
    super({
      modelPath: '/assets/models/props/barrel_red.glb',
      position,
      rotation: [0, 0, 0],
      scale:    [1, 1, 1],
      physics: {
        mass:         80,
        friction:     0.5,
        restitution:  0.3,
        shape:        'cylinder',
        dimensions:   [0.4, 1.0, 0.4],
        linearDamping: 0.3,
      } as PhysicsConfig,
    });

    this.addTag('explosive');
    this.addTag('flammable');
    this.addTag('barrel');
    this.addTag('destructible');

    this.setProperty('explosionRadius', 5);
    this.setProperty('explosionDamage', 100);
    this.setProperty('health', 50);
  }

  protected override _onCollide(event: any): void {
    super._onCollide(event as any);

    // Si touché par un corps très rapide → exploser
    if (event.impactSpeed && event.impactSpeed > 20) {
      this.explode();
    }
  }

  public hit(amount: number): void {
    const hp = (this.getProperty<number>('health') ?? 50) - amount;
    this.setProperty('health', hp);
    if (hp <= 0) this.explode();
  }
}
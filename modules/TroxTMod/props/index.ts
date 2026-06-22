// server/modules/TroxTMod/props/index.ts
import { ModuleLoader } from '../../ModuleLoader';
import { PROP_IDS }     from '../../../../shared/constants';

export function registerProps(loader: ModuleLoader): void {

  // ── BARREL ──
  loader.registerEntity(PROP_IDS.BARREL, {
    type:      'prop',
    modelPath: '/assets/models/props/barrel.glb',
    physics: {
      mass: 60, friction: 0.5, restitution: 0.2,
      shape: 'cylinder', dimensions: [0.35, 0.85, 0.35],
    },
    tags: ['barrel', 'rollable'],
    properties: { spawnPosition: [0, 2, 0] },
  });

  // ── BARREL EXPLOSIVE ──
  loader.registerEntity(PROP_IDS.BARREL_EXPLOSIVE, {
    type:      'prop',
    modelPath: '/assets/models/props/barrel_red.glb',
    physics: {
      mass: 80, friction: 0.5, restitution: 0.3,
      shape: 'cylinder', dimensions: [0.35, 0.9, 0.35],
    },
    tags: ['barrel', 'explosive', 'flammable'],
    properties: {
      explosionRadius: 6,
      explosionDamage: 120,
      spawnPosition:   [0, 2, 0],
    },
  });

  // ── CRATE ──
  loader.registerEntity(PROP_IDS.CRATE, {
    type:      'prop',
    modelPath: '/assets/models/props/crate_wood.glb',
    physics: {
      mass: 50, friction: 0.6, restitution: 0.1,
      shape: 'box', dimensions: [0.5, 0.5, 0.5],
    },
    tags: ['crate', 'stackable'],
  });

  // ── CRATE METAL ──
  loader.registerEntity(PROP_IDS.CRATE_METAL, {
    type:      'prop',
    modelPath: '/assets/models/props/crate_metal.glb',
    physics: {
      mass: 120, friction: 0.4, restitution: 0.05,
      shape: 'box', dimensions: [0.55, 0.55, 0.55],
    },
    tags: ['crate', 'metal', 'stackable'],
  });

  // ── PALLET ──
  loader.registerEntity(PROP_IDS.PALLET, {
    type:      'prop',
    modelPath: '/assets/models/props/pallet.glb',
    physics: {
      mass: 20, friction: 0.7, restitution: 0.05,
      shape: 'box', dimensions: [0.6, 0.07, 0.6],
    },
    tags: ['pallet', 'stackable'],
  });

  // ── DUMPSTER ──
  loader.registerEntity(PROP_IDS.DUMPSTER, {
    type:      'prop',
    modelPath: '/assets/models/props/dumpster.glb',
    physics: {
      mass: 300, friction: 0.5, restitution: 0.1,
      shape: 'box', dimensions: [1.0, 0.75, 0.55],
    },
    tags: ['dumpster', 'heavy'],
  });

  // ── CHAIR ──
  loader.registerEntity(PROP_IDS.CHAIR, {
    type:      'prop',
    modelPath: '/assets/models/furniture/chair.glb',
    physics: {
      mass: 10, friction: 0.5, restitution: 0.1,
      shape: 'box', dimensions: [0.25, 0.45, 0.25],
    },
    tags: ['furniture', 'chair', 'sittable'],
  });

  // ── TABLE ──
  loader.registerEntity(PROP_IDS.TABLE, {
    type:      'prop',
    modelPath: '/assets/models/furniture/table.glb',
    physics: {
      mass: 30, friction: 0.6, restitution: 0.05,
      shape: 'box', dimensions: [0.75, 0.38, 0.4],
    },
    tags: ['furniture', 'table'],
  });

  // ── SOFA ──
  loader.registerEntity(PROP_IDS.SOFA, {
    type:      'prop',
    modelPath: '/assets/models/furniture/sofa.glb',
    physics: {
      mass: 60, friction: 0.7, restitution: 0.15,
      shape: 'box', dimensions: [1.0, 0.45, 0.45],
    },
    tags: ['furniture', 'sofa', 'sittable'],
  });

  // ── BED ──
  loader.registerEntity(PROP_IDS.BED, {
    type:      'prop',
    modelPath: '/assets/models/furniture/bed.glb',
    physics: {
      mass: 80, friction: 0.8, restitution: 0.05,
      shape: 'box', dimensions: [1.0, 0.3, 1.1],
    },
    tags: ['furniture', 'bed'],
  });

  // ── LAMP POST ──
  loader.registerEntity(PROP_IDS.LAMP_POST, {
    type:      'prop',
    modelPath: '/assets/models/street/lamp_post.glb',
    physics: {
      mass: 0, friction: 0.5, restitution: 0.1,
      shape: 'cylinder', dimensions: [0.08, 4.0, 0.08],
    },
    tags: ['lamp', 'static', 'light_source'],
    properties: { lightColor: '#ffe4a0', lightRange: 12 },
  });

  // ── TREE ──
  loader.registerEntity(PROP_IDS.TREE, {
    type:      'prop',
    modelPath: '/assets/models/nature/tree_oak.glb',
    physics: {
      mass: 0, friction: 0.5, restitution: 0.0,
      shape: 'cylinder', dimensions: [0.2, 3.0, 0.2],
    },
    tags: ['nature', 'tree', 'static'],
  });

  // ── BUSH ──
  loader.registerEntity(PROP_IDS.BUSH, {
    type:      'prop',
    modelPath: '/assets/models/nature/bush.glb',
    physics: {
      mass: 0, friction: 0.5, restitution: 0.0,
      shape: 'sphere', dimensions: [0.5, 0.5, 0.5],
      isTrigger: true,
    },
    tags: ['nature', 'bush', 'static', 'trigger'],
  });

  // ── ROCK ──
  loader.registerEntity(PROP_IDS.ROCK, {
    type:      'prop',
    modelPath: '/assets/models/nature/rock.glb',
    physics: {
      mass: 200, friction: 0.8, restitution: 0.1,
      shape: 'sphere', dimensions: [0.5, 0.5, 0.5],
    },
    tags: ['nature', 'rock', 'heavy'],
  });

  // ── WALL ──
  loader.registerEntity(PROP_IDS.WALL, {
    type:      'prop',
    modelPath: '/assets/models/structures/wall.glb',
    physics: {
      mass: 0, friction: 0.5, restitution: 0.0,
      shape: 'box', dimensions: [1.5, 1.5, 0.1],
    },
    tags: ['structure', 'wall', 'static'],
  });

  // ── PILLAR ──
  loader.registerEntity(PROP_IDS.PILLAR, {
    type:      'prop',
    modelPath: '/assets/models/structures/pillar.glb',
    physics: {
      mass: 0, friction: 0.5, restitution: 0.0,
      shape: 'cylinder', dimensions: [0.2, 2.0, 0.2],
    },
    tags: ['structure', 'pillar', 'static'],
  });

  // ── BENCH ──
  loader.registerEntity(PROP_IDS.BENCH, {
    type:      'prop',
    modelPath: '/assets/models/street/bench.glb',
    physics: {
      mass: 40, friction: 0.6, restitution: 0.05,
      shape: 'box', dimensions: [0.6, 0.2, 0.2],
    },
    tags: ['street', 'bench', 'sittable'],
  });

  // ── TRAFFIC CONE ──
  loader.registerEntity(PROP_IDS.CONE, {
    type:      'prop',
    modelPath: '/assets/models/street/cone.glb',
    physics: {
      mass: 3, friction: 0.5, restitution: 0.3,
      shape: 'cylinder', dimensions: [0.15, 0.4, 0.15],
    },
    tags: ['street', 'cone', 'light'],
  });

  // ── BARRIER ──
  loader.registerEntity(PROP_IDS.BARRIER, {
    type:      'prop',
    modelPath: '/assets/models/street/barrier.glb',
    physics: {
      mass: 80, friction: 0.6, restitution: 0.1,
      shape: 'box', dimensions: [1.0, 0.5, 0.2],
    },
    tags: ['street', 'barrier', 'heavy'],
  });

  // ── FIRE HYDRANT ──
  loader.registerEntity(PROP_IDS.FIRE_HYDRANT, {
    type:      'prop',
    modelPath: '/assets/models/street/hydrant.glb',
    physics: {
      mass: 50, friction: 0.7, restitution: 0.05,
      shape: 'cylinder', dimensions: [0.15, 0.4, 0.15],
    },
    tags: ['street', 'hydrant'],
  });

  console.log(`   📦 ${loader.getStats().entities} props enregistrés`);
}
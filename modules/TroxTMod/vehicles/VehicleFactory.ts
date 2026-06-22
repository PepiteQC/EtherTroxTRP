// server/modules/TroxTMod/vehicles/VehicleFactory.ts
// ============================================================
//  TROXT RP — Vehicle Generation System (VGS)
//  Génère des véhicules complets à partir de blueprints
//  modulaires. Une base = N véhicules uniques.
// ============================================================

import { EventBus } from '../../../engine/EventBus';

// ============================================================
//  TYPES — Blueprint System
// ============================================================

export type ChassisType =
  | 'suv_large'
  | 'suv_medium'
  | 'sedan_full'
  | 'sedan_compact'
  | 'coupe_sport'
  | 'pickup_full'
  | 'pickup_mid'
  | 'truck_semi'
  | 'truck_medium'
  | 'van_full'
  | 'van_transit'
  | 'bus_transit'
  | 'bus_school'
  | 'motorcycle_std'
  | 'motorcycle_sport'
  | 'boat_small'
  | 'boat_medium'
  | 'helicopter_medium'
  | 'airplane_small';

export type VehiclePackage =
  | 'police'
  | 'ems'
  | 'fire'
  | 'swat'
  | 'taxi'
  | 'transport'
  | 'civilian'
  | 'civilian_sport'
  | 'government'
  | 'race_track'
  | 'offroad'
  | 'logging'
  | 'agriculture'
  | 'construction'
  | 'coast_guard'
  | 'corrections';

export type BodyKitType =
  | 'stock'
  | 'sport'
  | 'widebody_gt'
  | 'race_full'
  | 'utility'
  | 'police_pkg'
  | 'ems_pkg'
  | 'fire_pkg';

export type WingType  = 'none' | 'lip_spoiler' | 'gt_carbon_small' | 'gt_carbon_large' | 'race_wing';
export type WheelType = 'stock' | 'alloy_17' | 'alloy_18' | 'race_18_black' | 'truck_20' | 'offroad_20';
export type TireType  = 'all_season' | 'summer' | 'winter' | 'all_terrain' | 'semi_slick' | 'offroad';
export type DriveType = 'FWD' | 'RWD' | 'AWD' | '4WD';
export type TransType = 'auto_8' | 'manual_6' | 'manual_6_sequential' | 'cvt' | 'auto_allison';
export type TireCompound = 'all_season' | 'summer' | 'winter' | 'semi_slick' | 'slick';

// ── Handling ──
export interface HandlingData {
  mass:          number;
  centerOfMass:  { x: number; y: number; z: number };
  engine: {
    maxTorqueNm:   number;
    maxRPM:        number;
    idleRPM:       number;
    turbocharged:  boolean;
    horsepower:    number;
  };
  brakes: {
    frontBias:    number;
    brakeForce:   number;
    handbrakeForce: number;
  };
  suspension: {
    stiffness:   number;
    damping:     number;
    rideHeight:  number;
  };
  tires: {
    compound:   TireCompound;
    grip:       number;
    wearRate:   number;
  };
  transmission: {
    type:     TransType;
    ratios:   number[];
    finalDrive: number;
  };
  driveTrain:   DriveType;
  topSpeedKmh:  number;
  zeroToHundred: number;
}

// ── Livery ──
export interface LiveryData {
  id:          string;
  name:        string;
  colors: {
    body:      string;
    accent1?:  string;
    accent2?:  string;
    roof?:     string;
    wheels?:   string;
    interior?: string;
  };
  decals?:     string[];
  number?:     string;
  sponsor?:    string[];
}

// ── Blueprint ──
export interface VehicleBlueprint {
  id:          string;
  name:        string;
  nameFr:      string;
  category:    string;
  subCategory: string;
  description: string;
  chassis:     ChassisType;
  package:     VehiclePackage;
  bodyKit?:    BodyKitType;
  wing?:       WingType;
  splitter?:   boolean;
  skirts?:     boolean;
  diffuser?:   boolean;
  vents?:      boolean;
  wheels?:     WheelType;
  tires?:      TireType;
  interior?:   string;
  livery:      LiveryData;
  handling:    HandlingData;
  features: {
    emergencyLights?:  boolean;
    siren?:            boolean;
    pushBar?:          boolean;
    spotlight?:        boolean;
    prisonerCage?:     boolean;
    dashcam?:          boolean;
    mdtComputer?:      boolean;
    roofrack?:         boolean;
    towHook?:          boolean;
    rollcage?:         boolean;
    harness?:          boolean;
    extinguisher?:     boolean;
    airhorn?:          boolean;
    bullbar?:          boolean;
  };
  effects:     string[];
  seats:       number;
  doors:       number;
  lod: {
    lod0: number;
    lod1: number;
    lod2: number;
    lod3: number;
  };
  sounds: {
    engine:    string;
    horn:      string;
    siren?:    string;
    exhaust?:  string;
  };
  tags:        string[];
}

// ── Vehicle Instance ──
export interface VehicleInstance {
  instanceId:  string;
  blueprintId: string;
  blueprint:   VehicleBlueprint;
  ownerId?:    string;
  plate?:      string;
  spawnedAt:   number;
  position:    [number, number, number];
  rotation:    [number, number, number];
  fuel:        number;
  health:      number;
  mileage:     number;
  locked:      boolean;
  engine:      boolean;
}

// ============================================================
//  CHASSIS DATABASE — Dimensions de base par type
// ============================================================

const CHASSIS_SPECS: Record<ChassisType, {
  dimensions:  [number, number, number];
  mass:        number;
  seats:       number;
  doors:       number;
  driveTrain:  DriveType;
  topSpeed:    number;
  zeroTo100:   number;
  hp:          number;
  description: string;
}> = {
  suv_large:        { dimensions: [5.2, 1.8, 2.1], mass: 2400, seats: 5, doors: 4, driveTrain: 'AWD', topSpeed: 190, zeroTo100: 7.5, hp: 400, description: 'Grand VUS type Explorer/Tahoe' },
  suv_medium:       { dimensions: [4.8, 1.7, 1.9], mass: 1900, seats: 5, doors: 4, driveTrain: 'AWD', topSpeed: 200, zeroTo100: 7.0, hp: 280, description: 'VUS compact type RAV4/CR-V' },
  sedan_full:       { dimensions: [5.0, 1.5, 1.9], mass: 1800, seats: 5, doors: 4, driveTrain: 'RWD', topSpeed: 220, zeroTo100: 6.0, hp: 350, description: 'Berline pleine grandeur type Charger' },
  sedan_compact:    { dimensions: [4.6, 1.4, 1.8], mass: 1400, seats: 5, doors: 4, driveTrain: 'FWD', topSpeed: 195, zeroTo100: 9.0, hp: 170, description: 'Compacte type Civic/Corolla' },
  coupe_sport:      { dimensions: [4.6, 1.4, 1.85], mass: 1350, seats: 2, doors: 2, driveTrain: 'RWD', topSpeed: 250, zeroTo100: 5.5, hp: 300, description: 'Coupé sport type 350Z/Mustang' },
  pickup_full:      { dimensions: [5.9, 1.8, 2.0], mass: 2200, seats: 5, doors: 4, driveTrain: 'AWD', topSpeed: 180, zeroTo100: 7.8, hp: 400, description: 'Pickup pleine grandeur type F-150/RAM' },
  pickup_mid:       { dimensions: [5.3, 1.7, 1.9], mass: 1900, seats: 5, doors: 4, driveTrain: 'AWD', topSpeed: 175, zeroTo100: 8.5, hp: 310, description: 'Pickup intermédiaire type Tacoma' },
  truck_semi:       { dimensions: [7.5, 3.8, 2.6], mass: 8000, seats: 2, doors: 2, driveTrain: '4WD', topSpeed: 120, zeroTo100: 25.0, hp: 500, description: 'Semi-remorque type Freightliner/Kenworth' },
  truck_medium:     { dimensions: [6.5, 3.2, 2.4], mass: 5000, seats: 3, doors: 2, driveTrain: '4WD', topSpeed: 130, zeroTo100: 18.0, hp: 350, description: 'Camion moyen type F-450/Ram 5500' },
  van_full:         { dimensions: [6.5, 2.7, 2.2], mass: 3500, seats: 3, doors: 3, driveTrain: 'RWD', topSpeed: 150, zeroTo100: 14.0, hp: 300, description: 'Fourgon type Transit/Sprinter/E-350' },
  van_transit:      { dimensions: [5.5, 2.4, 2.0], mass: 2200, seats: 3, doors: 3, driveTrain: 'FWD', topSpeed: 155, zeroTo100: 12.0, hp: 185, description: 'Fourgon compact type Transit Connect' },
  bus_transit:      { dimensions: [12.2, 3.0, 2.6], mass: 14000, seats: 40, doors: 3, driveTrain: 'RWD', topSpeed: 90, zeroTo100: 30.0, hp: 250, description: 'Autobus urbain type Nova LFS' },
  bus_school:       { dimensions: [10.7, 2.8, 2.4], mass: 10000, seats: 72, doors: 2, driveTrain: 'RWD', topSpeed: 90, zeroTo100: 28.0, hp: 250, description: 'Autobus scolaire type Blue Bird Vision' },
  motorcycle_std:   { dimensions: [2.1, 1.1, 0.9], mass: 220, seats: 2, doors: 0, driveTrain: 'RWD', topSpeed: 180, zeroTo100: 5.5, hp: 65, description: 'Moto standard type Honda CB500' },
  motorcycle_sport: { dimensions: [2.0, 1.1, 0.8], mass: 180, seats: 2, doors: 0, driveTrain: 'RWD', topSpeed: 285, zeroTo100: 3.2, hp: 200, description: 'Sportive type Ninja ZX-10R' },
  boat_small:       { dimensions: [5.0, 0.8, 1.8], mass: 500, seats: 4, doors: 0, driveTrain: 'RWD', topSpeed: 65, zeroTo100: 15.0, hp: 115, description: 'Chaloupe de pêche type Crestliner' },
  boat_medium:      { dimensions: [12.0, 2.5, 3.5], mass: 5000, seats: 6, doors: 0, driveTrain: 'RWD', topSpeed: 55, zeroTo100: 25.0, hp: 500, description: 'Vedette type patrouille' },
  helicopter_medium:{ dimensions: [10.0, 2.2, 3.2], mass: 2800, seats: 7, doors: 2, driveTrain: 'AWD', topSpeed: 280, zeroTo100: 20.0, hp: 800, description: 'Hélicoptère type Bell 429' },
  airplane_small:   { dimensions: [12.5, 2.0, 4.5], mass: 2700, seats: 9, doors: 2, driveTrain: 'AWD', topSpeed: 344, zeroTo100: 30.0, hp: 680, description: 'Avion type Cessna Caravan' },
};

// ============================================================
//  PACKAGE MODIFIERS — Modifications selon le package
// ============================================================

const PACKAGE_MODS: Record<VehiclePackage, {
  massAdd:     number;
  hpMod:       number;
  topSpeedMod: number;
  features:    Partial<VehicleBlueprint['features']>;
  liveryHint:  Partial<LiveryData['colors']>;
  soundEngine: string;
  effectsAdd:  string[];
  tagsAdd:     string[];
}> = {
  police: {
    massAdd: 250, hpMod: 1.15, topSpeedMod: 1.05,
    features: { emergencyLights: true, siren: true, pushBar: true, spotlight: true, prisonerCage: true, dashcam: true, mdtComputer: true },
    liveryHint: { body: '#111111', accent1: '#ffffff', accent2: '#1a44ff' },
    soundEngine: 'v8_police', effectsAdd: ['fx_police_lights', 'fx_siren_wail'],
    tagsAdd: ['police', 'emergency', 'law'],
  },
  ems: {
    massAdd: 400, hpMod: 1.0, topSpeedMod: 1.0,
    features: { emergencyLights: true, siren: true, roofrack: true },
    liveryHint: { body: '#ffffff', accent1: '#ff6600', accent2: '#ff0000' },
    soundEngine: 'v8_diesel', effectsAdd: ['fx_ambulance_lights', 'fx_siren_ems'],
    tagsAdd: ['ems', 'emergency', 'medical'],
  },
  fire: {
    massAdd: 500, hpMod: 1.0, topSpeedMod: 0.95,
    features: { emergencyLights: true, siren: true, airhorn: true, roofrack: true },
    liveryHint: { body: '#cc2200', accent1: '#ffffff', accent2: '#ffcc00' },
    soundEngine: 'v8_diesel_fire', effectsAdd: ['fx_firetruck_lights', 'fx_siren_fire'],
    tagsAdd: ['fire', 'emergency'],
  },
  swat: {
    massAdd: 600, hpMod: 1.0, topSpeedMod: 0.9,
    features: { emergencyLights: true, siren: true, bullbar: true, dashcam: true },
    liveryHint: { body: '#1a1a1a', accent1: '#333333', accent2: '#ffffff' },
    soundEngine: 'v8_diesel', effectsAdd: ['fx_police_lights'],
    tagsAdd: ['police', 'swat', 'emergency'],
  },
  taxi: {
    massAdd: 0, hpMod: 0.95, topSpeedMod: 0.95,
    features: {},
    liveryHint: { body: '#ffcc00', accent1: '#000000' },
    soundEngine: 'v6_taxi', effectsAdd: ['fx_exhaust'],
    tagsAdd: ['taxi', 'civilian'],
  },
  transport: {
    massAdd: 200, hpMod: 1.0, topSpeedMod: 0.9,
    features: { roofrack: true, towHook: true },
    liveryHint: { body: '#2a3a4a', accent1: '#ff8800' },
    soundEngine: 'v8_diesel', effectsAdd: ['fx_exhaust', 'fx_engine_smoke'],
    tagsAdd: ['transport', 'civilian'],
  },
  civilian: {
    massAdd: 0, hpMod: 1.0, topSpeedMod: 1.0,
    features: {},
    liveryHint: { body: '#3a3a3a', accent1: '#cccccc' },
    soundEngine: 'v6_civilian', effectsAdd: ['fx_exhaust'],
    tagsAdd: ['civilian'],
  },
  civilian_sport: {
    massAdd: -50, hpMod: 1.1, topSpeedMod: 1.05,
    features: {},
    liveryHint: { body: '#1a1a1a', accent1: '#ff2200' },
    soundEngine: 'v8_sport', effectsAdd: ['fx_exhaust', 'fx_tire_smoke'],
    tagsAdd: ['civilian', 'sport'],
  },
  government: {
    massAdd: 100, hpMod: 1.0, topSpeedMod: 0.95,
    features: { dashcam: true },
    liveryHint: { body: '#2a3a2a', accent1: '#ffffff', accent2: '#ffcc00' },
    soundEngine: 'v6_civilian', effectsAdd: ['fx_exhaust'],
    tagsAdd: ['government', 'civilian'],
  },
  race_track: {
    massAdd: -200, hpMod: 1.4, topSpeedMod: 1.25,
    features: { rollcage: true, harness: true, extinguisher: true },
    liveryHint: { body: '#888888', accent1: '#cc0000', accent2: '#111111' },
    soundEngine: 'v8_race', effectsAdd: ['fx_tire_smoke', 'fx_exhaust_flame', 'fx_brake_glow', 'fx_skid_marks'],
    tagsAdd: ['race', 'sport'],
  },
  offroad: {
    massAdd: 150, hpMod: 1.05, topSpeedMod: 0.85,
    features: { bullbar: true, roofrack: true, towHook: true },
    liveryHint: { body: '#3a2a1a', accent1: '#886644' },
    soundEngine: 'v8_diesel', effectsAdd: ['fx_exhaust', 'fx_dust_track'],
    tagsAdd: ['offroad', 'civilian'],
  },
  logging: {
    massAdd: 500, hpMod: 1.0, topSpeedMod: 0.75,
    features: { towHook: true },
    liveryHint: { body: '#445533', accent1: '#ffcc00' },
    soundEngine: 'v8_diesel', effectsAdd: ['fx_exhaust', 'fx_engine_smoke'],
    tagsAdd: ['forestry', 'civilian'],
  },
  agriculture: {
    massAdd: 300, hpMod: 1.0, topSpeedMod: 0.6,
    features: { towHook: true, roofrack: true },
    liveryHint: { body: '#1a5a1a', accent1: '#ffcc00' },
    soundEngine: 'v8_diesel', effectsAdd: ['fx_exhaust', 'fx_dust_track'],
    tagsAdd: ['agriculture', 'civilian'],
  },
  construction: {
    massAdd: 400, hpMod: 1.0, topSpeedMod: 0.7,
    features: { bullbar: true, roofrack: true, airhorn: true },
    liveryHint: { body: '#ffaa00', accent1: '#1a1a1a' },
    soundEngine: 'v8_diesel', effectsAdd: ['fx_exhaust', 'fx_dust_track'],
    tagsAdd: ['construction', 'civilian'],
  },
  coast_guard: {
    massAdd: 200, hpMod: 1.05, topSpeedMod: 1.0,
    features: { emergencyLights: true, siren: true, spotlight: true },
    liveryHint: { body: '#cc1111', accent1: '#ffffff', accent2: '#cc1111' },
    soundEngine: 'v8_marine', effectsAdd: ['fx_police_lights'],
    tagsAdd: ['maritime', 'emergency'],
  },
  corrections: {
    massAdd: 200, hpMod: 1.05, topSpeedMod: 1.0,
    features: { emergencyLights: true, prisonerCage: true, dashcam: true },
    liveryHint: { body: '#1a1a2a', accent1: '#ffcc00', accent2: '#ffffff' },
    soundEngine: 'v8_police', effectsAdd: ['fx_police_lights'],
    tagsAdd: ['corrections', 'emergency'],
  },
};

// ============================================================
//  VEHICLE FACTORY
// ============================================================

export class VehicleFactory {

  private static _registry = new Map<string, VehicleBlueprint>();
  private static _instances = new Map<string, VehicleInstance>();
  private static _bus = EventBus.getInstance();

  // ──────────────────────────────────────────
  //  CREATE FROM BLUEPRINT
  // ──────────────────────────────────────────

  /**
   * Crée et enregistre un blueprint de véhicule.
   * Utilise le chassis + package pour générer automatiquement
   * toutes les specs (masse, vitesse, HP, features, etc.)
   */
  static create(blueprint: VehicleBlueprint): VehicleBlueprint {
    const chassis  = CHASSIS_SPECS[blueprint.chassis];
    const pkg      = PACKAGE_MODS[blueprint.package];

    // Fusionner les features du package
    blueprint.features = {
      ...pkg.features,
      ...blueprint.features,
    };

    // Enrichir tags
    blueprint.tags = [
      ...new Set([
        ...blueprint.tags,
        ...pkg.tagsAdd,
        blueprint.chassis,
        blueprint.package,
      ]),
    ];

    // Sons par défaut
    blueprint.sounds = blueprint.sounds ?? {
      engine:  pkg.soundEngine,
      horn:    'horn_standard',
      siren:   blueprint.features.siren ? `siren_${blueprint.package}` : undefined,
      exhaust: 'exhaust_default',
    };

    // Effets par défaut
    blueprint.effects = [
      ...new Set([
        ...blueprint.effects,
        ...pkg.effectsAdd,
      ]),
    ];

    // LOD par défaut si non défini
    blueprint.lod = blueprint.lod ?? {
      lod0: Math.round(chassis.dimensions[0] * 8000),
      lod1: Math.round(chassis.dimensions[0] * 4000),
      lod2: Math.round(chassis.dimensions[0] * 1500),
      lod3: Math.round(chassis.dimensions[0] * 400),
    };

    this._registry.set(blueprint.id, blueprint);
    return blueprint;
  }

  // ──────────────────────────────────────────
  //  SPAWN — Instancier en jeu
  // ──────────────────────────────────────────

  static spawn(
    blueprintId: string,
    options: {
      position:  [number, number, number];
      rotation?: [number, number, number];
      plate?:    string;
      ownerId?:  string;
      fuel?:     number;
    }
  ): VehicleInstance | null {
    const blueprint = this._registry.get(blueprintId);
    if (!blueprint) {
      console.warn(`[VehicleFactory] Blueprint inconnu: ${blueprintId}`);
      return null;
    }

    const instanceId = `vi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const instance: VehicleInstance = {
      instanceId,
      blueprintId,
      blueprint,
      ownerId:   options.ownerId,
      plate:     options.plate ?? this._generatePlate(blueprint),
      spawnedAt: Date.now(),
      position:  options.position,
      rotation:  options.rotation ?? [0, 0, 0],
      fuel:      options.fuel ?? 100,
      health:    100,
      mileage:   0,
      locked:    true,
      engine:    false,
    };

    this._instances.set(instanceId, instance);
    this._bus.emit('vehicle:spawned', { instanceId, blueprintId, position: options.position });
    return instance;
  }

  // ──────────────────────────────────────────
  //  ACCÈS
  // ──────────────────────────────────────────

  static getBlueprint(id: string): VehicleBlueprint | undefined {
    return this._registry.get(id);
  }

  static getInstance(id: string): VehicleInstance | undefined {
    return this._instances.get(id);
  }

  static getAllBlueprints(): VehicleBlueprint[] {
    return Array.from(this._registry.values());
  }

  static getAllInstances(): VehicleInstance[] {
    return Array.from(this._instances.values());
  }

  static getByPackage(pkg: VehiclePackage): VehicleBlueprint[] {
    return this.getAllBlueprints().filter(b => b.package === pkg);
  }

  static getByChassis(chassis: ChassisType): VehicleBlueprint[] {
    return this.getAllBlueprints().filter(b => b.chassis === chassis);
  }

  static despawn(instanceId: string): boolean {
    const ok = this._instances.delete(instanceId);
    if (ok) this._bus.emit('vehicle:despawned', { instanceId });
    return ok;
  }

  static getStats() {
    const byPkg: Record<string, number> = {};
    this._registry.forEach(b => {
      byPkg[b.package] = (byPkg[b.package] ?? 0) + 1;
    });
    return {
      blueprints: this._registry.size,
      instances:  this._instances.size,
      byPackage:  byPkg,
    };
  }

  // ──────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────

  private static _generatePlate(blueprint: VehicleBlueprint): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits  = '0123456789';
    const L = () => letters[Math.floor(Math.random() * letters.length)];
    const D = () => digits[Math.floor(Math.random() * digits.length)];

    // Québec: 3 lettres + 3 chiffres
    if (blueprint.tags.includes('police'))      return `SQ-${D()}${D()}${D()}${D()}`;
    if (blueprint.tags.includes('ems'))         return `EMS-${D()}${D()}${D()}`;
    if (blueprint.tags.includes('fire'))        return `SIM-${D()}${D()}${D()}`;
    if (blueprint.tags.includes('government'))  return `QC-${D()}${D()}${D()}${D()}`;
    return `${L()}${L()}${L()}-${D()}${D()}${D()}`;
  }
}

// ============================================================
//  HANDLING PRESETS — Réutilisables entre blueprints
// ============================================================

export const HANDLING: Record<string, HandlingData> = {

  police_suv: {
    mass: 2650, centerOfMass: { x: 0, y: -0.3, z: 0.1 },
    engine: { maxTorqueNm: 580, maxRPM: 6200, idleRPM: 750, turbocharged: false, horsepower: 420 },
    brakes: { frontBias: 0.62, brakeForce: 1.2, handbrakeForce: 0.5 },
    suspension: { stiffness: 0.65, damping: 0.60, rideHeight: 0.22 },
    tires: { compound: 'all_season', grip: 0.95, wearRate: 0.008 },
    transmission: { type: 'auto_8', ratios: [4.71, 3.14, 2.11, 1.67, 1.28, 1.00, 0.84, 0.67], finalDrive: 3.55 },
    driveTrain: 'AWD', topSpeedKmh: 205, zeroToHundred: 7.2,
  },

  police_sedan: {
    mass: 2050, centerOfMass: { x: 0, y: -0.35, z: 0.08 },
    engine: { maxTorqueNm: 540, maxRPM: 6400, idleRPM: 700, turbocharged: false, horsepower: 370 },
    brakes: { frontBias: 0.65, brakeForce: 1.25, handbrakeForce: 0.45 },
    suspension: { stiffness: 0.70, damping: 0.65, rideHeight: 0.18 },
    tires: { compound: 'all_season', grip: 1.0, wearRate: 0.009 },
    transmission: { type: 'auto_8', ratios: [4.62, 3.06, 2.10, 1.66, 1.27, 1.00, 0.85, 0.65], finalDrive: 3.45 },
    driveTrain: 'RWD', topSpeedKmh: 250, zeroToHundred: 6.5,
  },

  ambulance: {
    mass: 4200, centerOfMass: { x: 0, y: -0.2, z: 0.2 },
    engine: { maxTorqueNm: 620, maxRPM: 4200, idleRPM: 650, turbocharged: true, horsepower: 290 },
    brakes: { frontBias: 0.60, brakeForce: 1.0, handbrakeForce: 0.3 },
    suspension: { stiffness: 0.55, damping: 0.65, rideHeight: 0.28 },
    tires: { compound: 'all_season', grip: 0.88, wearRate: 0.006 },
    transmission: { type: 'auto_allison', ratios: [3.51, 1.90, 1.44, 1.00, 0.74, 0.64], finalDrive: 4.10 },
    driveTrain: 'RWD', topSpeedKmh: 150, zeroToHundred: 14.0,
  },

  race_coupe: {
    mass: 1150, centerOfMass: { x: 0, y: -0.45, z: 0.05 },
    engine: { maxTorqueNm: 690, maxRPM: 8200, idleRPM: 950, turbocharged: true, horsepower: 620 },
    brakes: { frontBias: 0.68, brakeForce: 1.35, handbrakeForce: 0.85 },
    suspension: { stiffness: 0.82, damping: 0.74, rideHeight: 0.12 },
    tires: { compound: 'semi_slick', grip: 1.28, wearRate: 0.018 },
    transmission: { type: 'manual_6_sequential', ratios: [2.92, 2.10, 1.68, 1.35, 1.10, 0.92], finalDrive: 4.11 },
    driveTrain: 'RWD', topSpeedKmh: 295, zeroToHundred: 3.8,
  },

  civilian_pickup: {
    mass: 2300, centerOfMass: { x: 0, y: -0.28, z: 0.15 },
    engine: { maxTorqueNm: 680, maxRPM: 5600, idleRPM: 650, turbocharged: false, horsepower: 400 },
    brakes: { frontBias: 0.60, brakeForce: 1.05, handbrakeForce: 0.6 },
    suspension: { stiffness: 0.52, damping: 0.55, rideHeight: 0.25 },
    tires: { compound: 'all_season', grip: 0.90, wearRate: 0.007 },
    transmission: { type: 'auto_8', ratios: [4.70, 3.13, 2.10, 1.67, 1.28, 1.00, 0.85, 0.67], finalDrive: 3.73 },
    driveTrain: '4WD', topSpeedKmh: 175, zeroToHundred: 7.8,
  },

  logging_truck: {
    mass: 15500, centerOfMass: { x: 0, y: -0.15, z: 0.35 },
    engine: { maxTorqueNm: 2800, maxRPM: 2200, idleRPM: 600, turbocharged: true, horsepower: 500 },
    brakes: { frontBias: 0.55, brakeForce: 0.85, handbrakeForce: 0.2 },
    suspension: { stiffness: 0.80, damping: 0.85, rideHeight: 0.35 },
    tires: { compound: 'all_terrain', grip: 0.82, wearRate: 0.004 },
    transmission: { type: 'manual_6', ratios: [14.8, 11.2, 8.5, 6.3, 4.7, 3.5], finalDrive: 4.88 },
    driveTrain: '4WD', topSpeedKmh: 100, zeroToHundred: 35.0,
  },

  tractor: {
    mass: 6500, centerOfMass: { x: 0, y: -0.10, z: 0.2 },
    engine: { maxTorqueNm: 900, maxRPM: 2400, idleRPM: 650, turbocharged: true, horsepower: 155 },
    brakes: { frontBias: 0.50, brakeForce: 0.70, handbrakeForce: 0.4 },
    suspension: { stiffness: 0.45, damping: 0.50, rideHeight: 0.55 },
    tires: { compound: 'all_terrain', grip: 0.75, wearRate: 0.003 },
    transmission: { type: 'manual_6', ratios: [8.0, 6.0, 4.0, 2.5, 1.5, 1.0], finalDrive: 20.0 },
    driveTrain: '4WD', topSpeedKmh: 50, zeroToHundred: 60.0,
  },
};

// ============================================================
//  LIVERIES — Coloris prédéfinis
// ============================================================

export const LIVERIES: Record<string, LiveryData> = {
  sq_green_white: {
    id: 'sq_green_white', name: 'SQ — Vert/Blanc',
    colors: { body: '#2a4a2a', accent1: '#ffffff', accent2: '#ffcc00', wheels: '#2a2a2a' },
    decals: ['decal_sq_logo', 'decal_police_text'],
  },
  spvm_white_blue: {
    id: 'spvm_white_blue', name: 'SPVM — Blanc/Bleu',
    colors: { body: '#f5f5f5', accent1: '#1a2266', accent2: '#ff2200', wheels: '#2a2a2a' },
    decals: ['decal_spvm_logo', 'decal_police_text'],
  },
  ems_white_orange: {
    id: 'ems_white_orange', name: 'Urgences-Santé — Blanc/Orange',
    colors: { body: '#ffffff', accent1: '#ff6600', accent2: '#ff0000', wheels: '#cccccc' },
    decals: ['decal_ems_logo', 'decal_ambulance_text'],
  },
  sim_red_white: {
    id: 'sim_red_white', name: 'SIM — Rouge/Blanc',
    colors: { body: '#cc2200', accent1: '#ffffff', accent2: '#ffcc00', wheels: '#1a1a1a' },
    decals: ['decal_sim_logo', 'decal_incendie_text'],
  },
  taxi_yellow: {
    id: 'taxi_yellow', name: 'Taxi — Jaune',
    colors: { body: '#ffcc00', accent1: '#000000', accent2: '#333333', wheels: '#555555' },
    decals: ['decal_taxi_logo'],
  },
  race_silver_red: {
    id: 'race_silver_red', name: 'Race — Gris/Rouge',
    colors: { body: '#888888', accent1: '#cc0000', accent2: '#111111', wheels: '#111111', interior: '#1a1a1a' },
    decals: ['decal_race_stripes', 'decal_sponsor_fictif'],
    number: '23',
    sponsor: ['TroxT Racing', 'EtherWorld Motorsport'],
  },
  civilian_black: {
    id: 'civilian_black', name: 'Civil — Noir',
    colors: { body: '#111111', accent1: '#333333', wheels: '#333333' },
  },
  civilian_white: {
    id: 'civilian_white', name: 'Civil — Blanc',
    colors: { body: '#f0f0f0', accent1: '#cccccc', wheels: '#aaaaaa' },
  },
  government_green: {
    id: 'government_green', name: 'Gouvernement — Vert Forêt',
    colors: { body: '#2a3a22', accent1: '#ffcc00', accent2: '#ffffff', wheels: '#2a2a2a' },
    decals: ['decal_gouvernement_qc'],
  },
};

// ============================================================
//  VEHICLE CATALOG — Tous les blueprints TroxT RP
// ============================================================

export function registerAllVehicles(): void {

  console.log('[VehicleFactory] 🚗 Enregistrement des véhicules TroxT RP...');

  // ── Police ──────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_police_explorer', name: 'Police Explorer', nameFr: 'Ford Explorer Police',
    category: 'vehicle', subCategory: 'police',
    description: 'Ford Explorer Interceptor — SQ / Police Municipale',
    chassis: 'suv_large', package: 'police',
    bodyKit: 'police_pkg', wing: 'none',
    wheels: 'alloy_18', tires: 'all_season',
    interior: 'police_pkg',
    livery: LIVERIES.sq_green_white,
    handling: HANDLING.police_suv,
    features: { emergencyLights: true, siren: true, pushBar: true, spotlight: true, prisonerCage: true, dashcam: true, mdtComputer: true },
    effects: ['fx_police_lights', 'fx_exhaust'],
    seats: 4, doors: 4,
    lod: { lod0: 72000, lod1: 36000, lod2: 14000, lod3: 3500 },
    sounds: { engine: 'v8_police', horn: 'horn_police', siren: 'siren_police', exhaust: 'exhaust_v8' },
    tags: ['police', 'emergency', 'suv'],
  });

  VehicleFactory.create({
    id: 'vehicle_police_charger', name: 'Police Charger', nameFr: 'Dodge Charger Police',
    category: 'vehicle', subCategory: 'police',
    description: 'Dodge Charger Pursuit — SPVM',
    chassis: 'sedan_full', package: 'police',
    bodyKit: 'police_pkg', wing: 'none',
    wheels: 'alloy_18', tires: 'all_season',
    interior: 'police_pkg',
    livery: LIVERIES.spvm_white_blue,
    handling: HANDLING.police_sedan,
    features: { emergencyLights: true, siren: true, pushBar: true, dashcam: true, mdtComputer: true },
    effects: ['fx_police_lights', 'fx_exhaust', 'fx_tire_smoke'],
    seats: 4, doors: 4,
    lod: { lod0: 68000, lod1: 34000, lod2: 13000, lod3: 3200 },
    sounds: { engine: 'v8_police', horn: 'horn_police', siren: 'siren_police', exhaust: 'exhaust_v8_aggressive' },
    tags: ['police', 'emergency', 'sedan'],
  });

  VehicleFactory.create({
    id: 'vehicle_police_tahoe', name: 'Police Tahoe', nameFr: 'Chevrolet Tahoe Police',
    category: 'vehicle', subCategory: 'police',
    description: 'Chevrolet Tahoe PPQ — SQ',
    chassis: 'suv_large', package: 'police',
    bodyKit: 'police_pkg', wing: 'none',
    wheels: 'truck_20', tires: 'all_season',
    interior: 'police_pkg',
    livery: LIVERIES.sq_green_white,
    handling: { ...HANDLING.police_suv, mass: 2650, engine: { ...HANDLING.police_suv.engine, horsepower: 355 } },
    features: { emergencyLights: true, siren: true, pushBar: true, spotlight: true, prisonerCage: true, dashcam: true, mdtComputer: true },
    effects: ['fx_police_lights', 'fx_exhaust'],
    seats: 4, doors: 4,
    lod: { lod0: 74000, lod1: 37000, lod2: 15000, lod3: 3800 },
    sounds: { engine: 'v8_police', horn: 'horn_police', siren: 'siren_police', exhaust: 'exhaust_v8' },
    tags: ['police', 'emergency', 'suv'],
  });

  VehicleFactory.create({
    id: 'vehicle_police_unmarked', name: 'Unmarked Police', nameFr: 'Police Banalisée',
    category: 'vehicle', subCategory: 'police',
    description: 'Sedan banalisée — SQ Enquêtes',
    chassis: 'sedan_full', package: 'police',
    bodyKit: 'stock', wing: 'none',
    wheels: 'alloy_18', tires: 'all_season',
    interior: 'police_pkg',
    livery: LIVERIES.civilian_black,
    handling: HANDLING.police_sedan,
    features: { emergencyLights: true, siren: true, dashcam: true, mdtComputer: true },
    effects: ['fx_police_lights', 'fx_exhaust'],
    seats: 4, doors: 4,
    lod: { lod0: 60000, lod1: 30000, lod2: 12000, lod3: 3000 },
    sounds: { engine: 'v8_police', horn: 'horn_standard', siren: 'siren_police_low', exhaust: 'exhaust_v8' },
    tags: ['police', 'emergency', 'undercover', 'sedan'],
  });

  VehicleFactory.create({
    id: 'vehicle_swat_van', name: 'SWAT Van', nameFr: 'Fourgon Tactique GTI',
    category: 'vehicle', subCategory: 'police',
    description: 'Fourgon blindé GTI — Intervention Tactique',
    chassis: 'van_full', package: 'swat',
    bodyKit: 'utility', wing: 'none',
    wheels: 'truck_20', tires: 'all_terrain',
    interior: 'tactical',
    livery: { id: 'swat_black', name: 'GTI Noir', colors: { body: '#1a1a1a', accent1: '#333333', accent2: '#ffffff', wheels: '#222222' }, decals: ['decal_police_text', 'decal_gti'] },
    handling: {
      mass: 5200, centerOfMass: { x: 0, y: -0.15, z: 0.25 },
      engine: { maxTorqueNm: 720, maxRPM: 3800, idleRPM: 650, turbocharged: true, horsepower: 310 },
      brakes: { frontBias: 0.58, brakeForce: 0.95, handbrakeForce: 0.25 },
      suspension: { stiffness: 0.72, damping: 0.70, rideHeight: 0.30 },
      tires: { compound: 'all_terrain', grip: 0.88, wearRate: 0.005 },
      transmission: { type: 'auto_allison', ratios: [3.51, 1.90, 1.44, 1.00, 0.74, 0.64], finalDrive: 4.10 },
      driveTrain: 'AWD', topSpeedKmh: 145, zeroToHundred: 14.5,
    },
    features: { emergencyLights: true, siren: true, bullbar: true, dashcam: true },
    effects: ['fx_police_lights', 'fx_exhaust'],
    seats: 8, doors: 3,
    lod: { lod0: 80000, lod1: 40000, lod2: 16000, lod3: 4000 },
    sounds: { engine: 'v8_diesel', horn: 'horn_truck', siren: 'siren_police', exhaust: 'exhaust_diesel' },
    tags: ['police', 'swat', 'emergency', 'van'],
  });

  // ── EMS ─────────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_ambulance_type3', name: 'Ambulance Type III', nameFr: 'Ambulance Type III',
    category: 'vehicle', subCategory: 'ems',
    description: 'Ford E-450 Ambulance — Urgences-Santé QC',
    chassis: 'van_full', package: 'ems',
    bodyKit: 'ems_pkg', wing: 'none',
    wheels: 'alloy_17', tires: 'all_season',
    interior: 'ems_medical',
    livery: LIVERIES.ems_white_orange,
    handling: HANDLING.ambulance,
    features: { emergencyLights: true, siren: true, roofrack: true },
    effects: ['fx_ambulance_lights', 'fx_exhaust'],
    seats: 4, doors: 3,
    lod: { lod0: 78000, lod1: 39000, lod2: 16000, lod3: 4000 },
    sounds: { engine: 'v8_diesel', horn: 'horn_truck', siren: 'siren_ems', exhaust: 'exhaust_diesel' },
    tags: ['ems', 'emergency', 'van', 'medical'],
  });

  VehicleFactory.create({
    id: 'vehicle_ems_suv', name: 'EMS SUV', nameFr: 'VUS Paramédic',
    category: 'vehicle', subCategory: 'ems',
    description: 'Chevrolet Tahoe Paramédic — Urgences-Santé',
    chassis: 'suv_large', package: 'ems',
    bodyKit: 'ems_pkg', wing: 'none',
    wheels: 'alloy_18', tires: 'all_season',
    interior: 'ems_light',
    livery: { ...LIVERIES.ems_white_orange, id: 'ems_suv', name: 'EMS SUV' },
    handling: { ...HANDLING.police_suv, mass: 2600, engine: { ...HANDLING.police_suv.engine, horsepower: 355, maxTorqueNm: 520 } },
    features: { emergencyLights: true, siren: true },
    effects: ['fx_ambulance_lights', 'fx_exhaust'],
    seats: 4, doors: 4,
    lod: { lod0: 72000, lod1: 36000, lod2: 14000, lod3: 3500 },
    sounds: { engine: 'v8_police', horn: 'horn_standard', siren: 'siren_ems', exhaust: 'exhaust_v8' },
    tags: ['ems', 'emergency', 'suv', 'medical'],
  });

  // ── Fire ────────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_fire_engine', name: 'Fire Engine', nameFr: 'Autopompe',
    category: 'vehicle', subCategory: 'fire',
    description: 'Autopompe Pierce — Service Incendie Montréal',
    chassis: 'truck_medium', package: 'fire',
    bodyKit: 'fire_pkg', wing: 'none',
    wheels: 'truck_20', tires: 'all_terrain',
    interior: 'fire_crew',
    livery: LIVERIES.sim_red_white,
    handling: {
      mass: 12500, centerOfMass: { x: 0, y: -0.12, z: 0.3 },
      engine: { maxTorqueNm: 1800, maxRPM: 2400, idleRPM: 600, turbocharged: true, horsepower: 450 },
      brakes: { frontBias: 0.58, brakeForce: 0.90, handbrakeForce: 0.15 },
      suspension: { stiffness: 0.88, damping: 0.80, rideHeight: 0.38 },
      tires: { compound: 'all_terrain', grip: 0.85, wearRate: 0.004 },
      transmission: { type: 'auto_allison', ratios: [3.51, 1.90, 1.44, 1.00, 0.74, 0.64], finalDrive: 5.29 },
      driveTrain: '4WD', topSpeedKmh: 120, zeroToHundred: 22.0,
    },
    features: { emergencyLights: true, siren: true, airhorn: true, roofrack: true },
    effects: ['fx_firetruck_lights', 'fx_exhaust', 'fx_engine_smoke'],
    seats: 6, doors: 4,
    lod: { lod0: 90000, lod1: 45000, lod2: 18000, lod3: 4500 },
    sounds: { engine: 'v8_diesel_fire', horn: 'horn_truck', siren: 'siren_fire', exhaust: 'exhaust_diesel_heavy' },
    tags: ['fire', 'emergency', 'truck'],
  });

  VehicleFactory.create({
    id: 'vehicle_ladder_truck', name: 'Ladder Truck', nameFr: 'Échelle Aérienne',
    category: 'vehicle', subCategory: 'fire',
    description: 'Camion grande échelle 100 pieds — SIM',
    chassis: 'truck_medium', package: 'fire',
    bodyKit: 'fire_pkg', wing: 'none',
    wheels: 'truck_20', tires: 'all_terrain',
    interior: 'fire_crew',
    livery: LIVERIES.sim_red_white,
    handling: {
      mass: 18000, centerOfMass: { x: 0, y: -0.10, z: 0.4 },
      engine: { maxTorqueNm: 2200, maxRPM: 2200, idleRPM: 600, turbocharged: true, horsepower: 500 },
      brakes: { frontBias: 0.55, brakeForce: 0.85, handbrakeForce: 0.10 },
      suspension: { stiffness: 0.90, damping: 0.85, rideHeight: 0.42 },
      tires: { compound: 'all_terrain', grip: 0.82, wearRate: 0.003 },
      transmission: { type: 'auto_allison', ratios: [3.51, 1.90, 1.44, 1.00, 0.74, 0.64], finalDrive: 5.88 },
      driveTrain: '4WD', topSpeedKmh: 105, zeroToHundred: 28.0,
    },
    features: { emergencyLights: true, siren: true, airhorn: true, roofrack: true },
    effects: ['fx_firetruck_lights', 'fx_exhaust'],
    seats: 6, doors: 4,
    lod: { lod0: 95000, lod1: 48000, lod2: 19000, lod3: 5000 },
    sounds: { engine: 'v8_diesel_fire', horn: 'horn_truck', siren: 'siren_fire', exhaust: 'exhaust_diesel_heavy' },
    tags: ['fire', 'emergency', 'truck'],
  });

  // ── Civil ────────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_f150', name: 'F-150', nameFr: 'Ford F-150 XLT',
    category: 'vehicle', subCategory: 'civil',
    description: 'Ford F-150 XLT 2024 — Pleine grandeur',
    chassis: 'pickup_full', package: 'civilian',
    bodyKit: 'stock', wing: 'none',
    wheels: 'truck_20', tires: 'all_season',
    interior: 'civilian_standard',
    livery: LIVERIES.civilian_white,
    handling: HANDLING.civilian_pickup,
    features: { towHook: true },
    effects: ['fx_exhaust'],
    seats: 5, doors: 4,
    lod: { lod0: 65000, lod1: 32000, lod2: 13000, lod3: 3200 },
    sounds: { engine: 'v8_pickup', horn: 'horn_truck', exhaust: 'exhaust_v8' },
    tags: ['civilian', 'pickup'],
  });

  VehicleFactory.create({
    id: 'vehicle_ram2500', name: 'Ram 2500', nameFr: 'Ram 2500 Big Horn Diesel',
    category: 'vehicle', subCategory: 'civil',
    description: 'Ram 2500 Big Horn Diesel 6.7L Cummins',
    chassis: 'pickup_full', package: 'civilian',
    bodyKit: 'stock', wing: 'none',
    wheels: 'truck_20', tires: 'all_terrain',
    interior: 'civilian_standard',
    livery: LIVERIES.civilian_black,
    handling: {
      ...HANDLING.civilian_pickup,
      mass: 3050,
      engine: { maxTorqueNm: 1150, maxRPM: 3200, idleRPM: 650, turbocharged: true, horsepower: 370 },
      driveTrain: '4WD', topSpeedKmh: 170, zeroToHundred: 9.2,
    },
    features: { towHook: true },
    effects: ['fx_exhaust', 'fx_engine_smoke'],
    seats: 5, doors: 4,
    lod: { lod0: 66000, lod1: 33000, lod2: 13000, lod3: 3300 },
    sounds: { engine: 'v6_diesel_cummins', horn: 'horn_truck', exhaust: 'exhaust_diesel' },
    tags: ['civilian', 'pickup', 'diesel'],
  });

  VehicleFactory.create({
    id: 'vehicle_civic', name: 'Civic', nameFr: 'Honda Civic Sedan 2024',
    category: 'vehicle', subCategory: 'civil',
    description: 'Honda Civic LX 2024 — Compacte populaire QC',
    chassis: 'sedan_compact', package: 'civilian',
    bodyKit: 'stock', wing: 'none',
    wheels: 'alloy_17', tires: 'all_season',
    interior: 'civilian_standard',
    livery: LIVERIES.civilian_white,
    handling: {
      mass: 1400, centerOfMass: { x: 0, y: -0.38, z: 0.05 },
      engine: { maxTorqueNm: 220, maxRPM: 6000, idleRPM: 700, turbocharged: true, horsepower: 158 },
      brakes: { frontBias: 0.68, brakeForce: 1.0, handbrakeForce: 0.45 },
      suspension: { stiffness: 0.58, damping: 0.55, rideHeight: 0.18 },
      tires: { compound: 'all_season', grip: 0.90, wearRate: 0.008 },
      transmission: { type: 'manual_6', ratios: [3.46, 2.23, 1.52, 1.15, 0.92, 0.74], finalDrive: 4.19 },
      driveTrain: 'FWD', topSpeedKmh: 197, zeroToHundred: 9.0,
    },
    features: {},
    effects: ['fx_exhaust'],
    seats: 5, doors: 4,
    lod: { lod0: 55000, lod1: 28000, lod2: 11000, lod3: 2800 },
    sounds: { engine: 'i4_civic', horn: 'horn_standard', exhaust: 'exhaust_i4' },
    tags: ['civilian', 'sedan', 'compact'],
  });

  VehicleFactory.create({
    id: 'vehicle_taxi', name: 'Taxi', nameFr: 'Taxi Diamond Montréal',
    category: 'vehicle', subCategory: 'civil',
    description: 'Toyota Camry Hybrid — Taxi Diamond',
    chassis: 'sedan_full', package: 'taxi',
    bodyKit: 'stock', wing: 'none',
    wheels: 'alloy_17', tires: 'all_season',
    interior: 'taxi_standard',
    livery: LIVERIES.taxi_yellow,
    handling: {
      mass: 1650, centerOfMass: { x: 0, y: -0.36, z: 0.06 },
      engine: { maxTorqueNm: 270, maxRPM: 5800, idleRPM: 650, turbocharged: false, horsepower: 208 },
      brakes: { frontBias: 0.65, brakeForce: 1.05, handbrakeForce: 0.4 },
      suspension: { stiffness: 0.55, damping: 0.52, rideHeight: 0.19 },
      tires: { compound: 'all_season', grip: 0.88, wearRate: 0.007 },
      transmission: { type: 'auto_8', ratios: [4.0, 2.72, 1.86, 1.41, 1.10, 0.87, 0.73, 0.61], finalDrive: 3.82 },
      driveTrain: 'FWD', topSpeedKmh: 180, zeroToHundred: 8.5,
    },
    features: {},
    effects: ['fx_exhaust'],
    seats: 4, doors: 4,
    lod: { lod0: 58000, lod1: 29000, lod2: 12000, lod3: 3000 },
    sounds: { engine: 'v4_hybrid', horn: 'horn_standard', exhaust: 'exhaust_i4_hybrid' },
    tags: ['civilian', 'taxi', 'sedan'],
  });

  VehicleFactory.create({
    id: 'vehicle_cascadia', name: 'Freightliner Cascadia', nameFr: 'Freightliner Cascadia',
    category: 'vehicle', subCategory: 'civil',
    description: 'Freightliner Cascadia — Semi longue distance',
    chassis: 'truck_semi', package: 'transport',
    bodyKit: 'utility', wing: 'none',
    wheels: 'truck_20', tires: 'all_season',
    interior: 'truck_standard',
    livery: { id: 'cascadia_white', name: 'Blanc Transport', colors: { body: '#f5f5f5', accent1: '#1a1a1a', accent2: '#cccccc', wheels: '#888888' } },
    handling: HANDLING.logging_truck,
    features: { towHook: true },
    effects: ['fx_exhaust', 'fx_engine_smoke'],
    seats: 2, doors: 2,
    lod: { lod0: 85000, lod1: 43000, lod2: 17000, lod3: 4300 },
    sounds: { engine: 'v8_diesel_heavy', horn: 'horn_truck', exhaust: 'exhaust_diesel_heavy' },
    tags: ['civilian', 'truck', 'transport', 'diesel'],
  });

  VehicleFactory.create({
    id: 'vehicle_city_bus', name: 'City Bus', nameFr: 'Autobus Urbain Nova LFS',
    category: 'vehicle', subCategory: 'civil',
    description: 'Nova Bus LFS — Réseau STL / STM',
    chassis: 'bus_transit', package: 'civilian',
    bodyKit: 'utility', wing: 'none',
    wheels: 'truck_20', tires: 'all_season',
    interior: 'bus_transit',
    livery: { id: 'stl_blue', name: 'STL Bleu', colors: { body: '#1a3a6a', accent1: '#ffffff', accent2: '#ffcc00', wheels: '#333333' } },
    handling: {
      mass: 14500, centerOfMass: { x: 0, y: -0.08, z: 0.5 },
      engine: { maxTorqueNm: 2000, maxRPM: 2000, idleRPM: 600, turbocharged: true, horsepower: 280 },
      brakes: { frontBias: 0.52, brakeForce: 0.82, handbrakeForce: 0.10 },
      suspension: { stiffness: 0.85, damping: 0.80, rideHeight: 0.40 },
      tires: { compound: 'all_season', grip: 0.80, wearRate: 0.003 },
      transmission: { type: 'auto_allison', ratios: [3.51, 1.90, 1.44, 1.00, 0.74, 0.64], finalDrive: 5.13 },
      driveTrain: 'RWD', topSpeedKmh: 90, zeroToHundred: 35.0,
    },
    features: {},
    effects: ['fx_exhaust'],
    seats: 40, doors: 3,
    lod: { lod0: 88000, lod1: 44000, lod2: 17500, lod3: 4400 },
    sounds: { engine: 'v8_diesel_heavy', horn: 'horn_bus', exhaust: 'exhaust_diesel_heavy' },
    tags: ['civilian', 'bus', 'transit'],
  });

  VehicleFactory.create({
    id: 'vehicle_tow_truck', name: 'Tow Truck', nameFr: 'Dépanneuse F-550',
    category: 'vehicle', subCategory: 'civil',
    description: 'Ford F-550 Dépanneuse — Service routier',
    chassis: 'truck_medium', package: 'civilian',
    bodyKit: 'utility', wing: 'none',
    wheels: 'truck_20', tires: 'all_terrain',
    interior: 'civilian_standard',
    livery: { id: 'tow_yellow', name: 'Dépanneuse Jaune', colors: { body: '#ffaa00', accent1: '#1a1a1a', accent2: '#ff4400', wheels: '#333333' } },
    handling: {
      mass: 4600, centerOfMass: { x: 0, y: -0.18, z: 0.22 },
      engine: { maxTorqueNm: 950, maxRPM: 3600, idleRPM: 650, turbocharged: true, horsepower: 440 },
      brakes: { frontBias: 0.60, brakeForce: 0.95, handbrakeForce: 0.35 },
      suspension: { stiffness: 0.70, damping: 0.68, rideHeight: 0.32 },
      tires: { compound: 'all_terrain', grip: 0.88, wearRate: 0.005 },
      transmission: { type: 'auto_8', ratios: [4.70, 3.13, 2.10, 1.67, 1.28, 1.00, 0.85, 0.67], finalDrive: 4.30 },
      driveTrain: '4WD', topSpeedKmh: 125, zeroToHundred: 14.0,
    },
    features: { emergencyLights: true, towHook: true },
    effects: ['fx_exhaust', 'fx_engine_smoke'],
    seats: 3, doors: 2,
    lod: { lod0: 70000, lod1: 35000, lod2: 14000, lod3: 3500 },
    sounds: { engine: 'v8_diesel', horn: 'horn_truck', exhaust: 'exhaust_diesel' },
    tags: ['civilian', 'truck', 'tow'],
  });

  // ── Race ─────────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_troxt_z350_race', name: 'TroxT Z350 Race', nameFr: 'TroxT Z350 Course',
    category: 'vehicle', subCategory: 'race',
    description: 'Coupé de piste — Kit widebody GT, arceau, slicks',
    chassis: 'coupe_sport', package: 'race_track',
    bodyKit: 'widebody_gt',
    wing: 'gt_carbon_large',
    splitter: true, skirts: true, diffuser: true, vents: true,
    wheels: 'race_18_black', tires: 'semi_slick',
    interior: 'race_rollcage',
    livery: { ...LIVERIES.race_silver_red, number: '23' },
    handling: HANDLING.race_coupe,
    features: { rollcage: true, harness: true, extinguisher: true },
    effects: [
      'fx_tire_smoke', 'fx_exhaust_flame', 'fx_brake_glow',
      'fx_skid_marks', 'fx_dust_track', 'fx_collision_sparks',
    ],
    seats: 2, doors: 2,
    lod: { lod0: 80000, lod1: 40000, lod2: 15000, lod3: 4000 },
    sounds: { engine: 'v6_turbo_race', horn: 'horn_track', exhaust: 'exhaust_race_pop' },
    tags: ['race', 'sport', 'coupe', 'track'],
  });

  // ── Forestry ─────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_logging_truck', name: 'Logging Truck', nameFr: 'Fardier Forestier',
    category: 'vehicle', subCategory: 'forestry',
    description: 'Western Star 4900 — Transport billes de bois',
    chassis: 'truck_semi', package: 'logging',
    bodyKit: 'utility', wing: 'none',
    wheels: 'truck_20', tires: 'all_terrain',
    interior: 'truck_standard',
    livery: { id: 'logging_yellow', name: 'Forestier Jaune', colors: { body: '#445533', accent1: '#ffcc00', wheels: '#333333' } },
    handling: HANDLING.logging_truck,
    features: { towHook: true, roofrack: true },
    effects: ['fx_exhaust', 'fx_dust_track', 'fx_engine_smoke'],
    seats: 2, doors: 2,
    lod: { lod0: 90000, lod1: 45000, lod2: 18000, lod3: 4500 },
    sounds: { engine: 'v8_diesel_heavy', horn: 'horn_truck', exhaust: 'exhaust_diesel_heavy' },
    tags: ['forestry', 'truck', 'transport'],
  });

  VehicleFactory.create({
    id: 'vehicle_tractor', name: 'Farm Tractor', nameFr: 'Tracteur John Deere 6155R',
    category: 'vehicle', subCategory: 'agriculture',
    description: 'John Deere 6155R — Tracteur polyvalent',
    chassis: 'pickup_mid', package: 'agriculture',
    bodyKit: 'utility', wing: 'none',
    wheels: 'offroad_20', tires: 'all_terrain',
    interior: 'tractor_cab',
    livery: { id: 'jd_green', name: 'John Deere Vert', colors: { body: '#1a5a1a', accent1: '#ffcc00', wheels: '#ffcc00' } },
    handling: HANDLING.tractor,
    features: { towHook: true, roofrack: true },
    effects: ['fx_exhaust', 'fx_dust_track'],
    seats: 1, doors: 1,
    lod: { lod0: 70000, lod1: 35000, lod2: 14000, lod3: 3500 },
    sounds: { engine: 'v4_diesel_tractor', horn: 'horn_standard', exhaust: 'exhaust_diesel' },
    tags: ['agriculture', 'farming'],
  });

  // ── Aviation ─────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_bell_429', name: 'Bell 429', nameFr: 'Hélicoptère Bell 429',
    category: 'vehicle', subCategory: 'aviation',
    description: 'Bell 429 — Hélicoptère SQ / SIM',
    chassis: 'helicopter_medium', package: 'police',
    bodyKit: 'stock', wing: 'none',
    wheels: 'stock', tires: 'all_season',
    interior: 'helicopter_crew',
    livery: { ...LIVERIES.sq_green_white, id: 'bell_sq', name: 'Bell 429 SQ' },
    handling: {
      mass: 2800, centerOfMass: { x: 0, y: -0.05, z: 0.0 },
      engine: { maxTorqueNm: 800, maxRPM: 6000, idleRPM: 2000, turbocharged: false, horsepower: 800 },
      brakes: { frontBias: 0.5, brakeForce: 0.3, handbrakeForce: 0.1 },
      suspension: { stiffness: 0.3, damping: 0.3, rideHeight: 0.5 },
      tires: { compound: 'all_season', grip: 0.5, wearRate: 0.001 },
      transmission: { type: 'auto_8', ratios: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], finalDrive: 1.0 },
      driveTrain: 'AWD', topSpeedKmh: 280, zeroToHundred: 20.0,
    },
    features: { emergencyLights: true, siren: true, spotlight: true },
    effects: ['fx_police_lights', 'fx_rotor_wash'],
    seats: 7, doors: 2,
    lod: { lod0: 85000, lod1: 43000, lod2: 17000, lod3: 4300 },
    sounds: { engine: 'turbine_helicopter', horn: 'horn_standard', siren: 'siren_police', exhaust: 'exhaust_turbine' },
    tags: ['aviation', 'helicopter', 'police', 'emergency'],
  });

  // ── Maritime ─────────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_fishing_boat', name: 'Fishing Boat', nameFr: 'Chaloupe de Pêche',
    category: 'vehicle', subCategory: 'maritime',
    description: 'Crestliner 1650 — Chaloupe aluminium',
    chassis: 'boat_small', package: 'civilian',
    bodyKit: 'stock', wing: 'none',
    wheels: 'stock', tires: 'all_season',
    interior: 'boat_open',
    livery: { id: 'boat_silver', name: 'Aluminium', colors: { body: '#aaaaaa', accent1: '#1a1a1a', accent2: '#ffffff' } },
    handling: {
      mass: 520, centerOfMass: { x: 0, y: 0.1, z: 0.05 },
      engine: { maxTorqueNm: 200, maxRPM: 5500, idleRPM: 700, turbocharged: false, horsepower: 115 },
      brakes: { frontBias: 0.5, brakeForce: 0.3, handbrakeForce: 0.1 },
      suspension: { stiffness: 0.2, damping: 0.4, rideHeight: 0.0 },
      tires: { compound: 'all_season', grip: 0.7, wearRate: 0.001 },
      transmission: { type: 'auto_8', ratios: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], finalDrive: 1.0 },
      driveTrain: 'RWD', topSpeedKmh: 65, zeroToHundred: 15.0,
    },
    features: {},
    effects: ['fx_water_splash'],
    seats: 4, doors: 0,
    lod: { lod0: 45000, lod1: 22000, lod2: 9000, lod3: 2200 },
    sounds: { engine: 'v4_outboard', horn: 'horn_boat', exhaust: 'exhaust_outboard' },
    tags: ['maritime', 'boat', 'civilian'],
  });

  // ── ATV / Hiver ──────────────────────────────────────────

  VehicleFactory.create({
    id: 'vehicle_atv', name: 'ATV', nameFr: 'Can-Am Outlander 650',
    category: 'vehicle', subCategory: 'civil',
    description: 'Can-Am Outlander 650 — Quad 4 roues',
    chassis: 'motorcycle_std', package: 'offroad',
    bodyKit: 'stock', wing: 'none',
    wheels: 'offroad_20', tires: 'all_terrain',
    interior: 'atv_open',
    livery: { id: 'canam_red', name: 'Can-Am Rouge', colors: { body: '#cc2200', accent1: '#1a1a1a', wheels: '#333333' } },
    handling: {
      mass: 310, centerOfMass: { x: 0, y: -0.25, z: 0.05 },
      engine: { maxTorqueNm: 65, maxRPM: 7500, idleRPM: 1000, turbocharged: false, horsepower: 62 },
      brakes: { frontBias: 0.58, brakeForce: 0.85, handbrakeForce: 0.6 },
      suspension: { stiffness: 0.45, damping: 0.48, rideHeight: 0.30 },
      tires: { compound: 'all_terrain', grip: 0.82, wearRate: 0.012 },
      transmission: { type: 'auto_8', ratios: [4.0, 2.5, 1.7, 1.2, 0.9, 0.72, 0.60, 0.50], finalDrive: 3.88 },
      driveTrain: '4WD', topSpeedKmh: 100, zeroToHundred: 7.5,
    },
    features: { roofrack: false },
    effects: ['fx_exhaust', 'fx_dust_track'],
    seats: 2, doors: 0,
    lod: { lod0: 40000, lod1: 20000, lod2: 8000, lod3: 2000 },
    sounds: { engine: 'v2_atv', horn: 'horn_standard', exhaust: 'exhaust_v2' },
    tags: ['civilian', 'offroad', 'atv'],
  });

  VehicleFactory.create({
    id: 'vehicle_snowmobile', name: 'Snowmobile', nameFr: 'Ski-Doo Renegade X 900',
    category: 'vehicle', subCategory: 'civil',
    description: 'Ski-Doo Renegade X 900 ACE — Motoneige',
    chassis: 'motorcycle_sport', package: 'civilian',
    bodyKit: 'stock', wing: 'none',
    wheels: 'stock', tires: 'winter',
    interior: 'sled_open',
    livery: { id: 'skidoo_yellow', name: 'Ski-Doo Jaune/Noir', colors: { body: '#ffcc00', accent1: '#1a1a1a', accent2: '#cc2200' } },
    handling: {
      mass: 240, centerOfMass: { x: 0, y: -0.15, z: 0.05 },
      engine: { maxTorqueNm: 95, maxRPM: 8800, idleRPM: 1200, turbocharged: false, horsepower: 120 },
      brakes: { frontBias: 0.7, brakeForce: 0.8, handbrakeForce: 0.7 },
      suspension: { stiffness: 0.50, damping: 0.55, rideHeight: 0.15 },
      tires: { compound: 'winter', grip: 0.75, wearRate: 0.010 },
      transmission: { type: 'cvt', ratios: [3.5, 2.5, 1.8, 1.3, 1.0, 0.82, 0.68, 0.55], finalDrive: 2.44 },
      driveTrain: 'RWD', topSpeedKmh: 160, zeroToHundred: 5.5,
    },
    features: {},
    effects: ['fx_exhaust', 'fx_snow'],
    seats: 2, doors: 0,
    lod: { lod0: 38000, lod1: 19000, lod2: 7500, lod3: 1900 },
    sounds: { engine: 'v2_snowmobile', horn: 'horn_standard', exhaust: 'exhaust_2stroke' },
    tags: ['civilian', 'winter', 'snowmobile'],
  });

  // Résumé
  const stats = VehicleFactory.getStats();
  console.log(`[VehicleFactory] ✅ ${stats.blueprints} véhicules enregistrés`);
  Object.entries(stats.byPackage).forEach(([pkg, count]) => {
    console.log(`  ${pkg.padEnd(18)}: ${count} véhicules`);
  });
  console.log('');
}
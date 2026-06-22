// server/agents/forge-factory/ForgeFactory.ts
// ============================================================
//  FORGE-FACTORY — Agent de production massive
//  Génère des assets en série à partir de modèles validés
// ============================================================

import { BaseAgent, type AgentTaskPacket } from '../BaseAgent';

export class ForgeFactory extends BaseAgent {

  constructor() {
    super('forge-factory');

    this.intellectus.contracts.register('factory:output', {
      name:        'ForgeFactory Output',
      description: 'Résultat de production Forge-Factory',
      rules: [
        { field: 'task',     type: 'string', required: true },
        { field: 'produced', type: 'object', required: true },
        { field: 'status',   type: 'string', required: true },
        { field: 'validated',type: 'boolean',required: true },
      ],
    });
  }

  protected async _process(packet: AgentTaskPacket): Promise<any> {
    const mission = packet.mission.toLowerCase();

    // SÉCURITÉ : Forge-Factory doit être validé par TroxT Brain
    if (!packet.input?.validated) {
      // Attente signalée via Third Eye
      this._emitTelemetry(packet.taskId, 'waiting', 40, 'high');

      this.intellectus.memory.set(`factory:blocked:${packet.taskId}`, {
        reason:    'Validation Brain requise',
        blockedAt: Date.now(),
        mission:   packet.mission,
      }, {
        source: 'forge-factory',
        tags:   ['blocked', 'waiting_validation'],
        ttl:    120000,
      });

      return {
        agent:     'forge-factory',
        task:      packet.mission,
        status:    'waiting_validation',
        validated: false,
        produced:  {},
        warning:   '⚠️ Production bloquée — Validation Brain + ThirdEye requise avant génération massive',
        message:   'Third Eye recommande: Attendre NamingRules validé + modules core initialisés',
        actions: [
          'Attendre validation TroxT Brain',
          'Vérifier que NamingRules sont confirmés',
          'Vérifier que modules core sont initialisés',
          'Relancer avec input.validated = true',
        ],
      };
    }

    let output: any;

    if (mission.includes('maison') || mission.includes('house') || mission.includes('property')) {
      output = this._produceHousePack();
    } else if (mission.includes('vehicle') || mission.includes('véhicule')) {
      output = this._produceVehiclePack();
    } else if (mission.includes('npc') || mission.includes('personnage')) {
      output = this._produceNPCPack();
    } else if (mission.includes('prop') || mission.includes('asset')) {
      output = this._produceAssetPack();
    } else if (mission.includes('furniture') || mission.includes('meuble')) {
      output = this._produceFurniturePack();
    } else {
      output = this._produceGeneric(packet.mission);
    }

    // Valider contrat
    this.intellectus.contracts.validate('factory:output', output);

    // Enregistrer production en mémoire
    this.intellectus.memory.set(`factory:production:${Date.now()}`, {
      task:       output.task,
      totalCount: Object.values(output.produced).reduce((a: any, b: any) => a + (typeof b === 'number' ? b : 0), 0),
      producedAt: Date.now(),
    }, {
      source: 'forge-factory',
      tags:   ['production', 'completed'],
      ttl:    3600000, // 1h
    });

    return output;
  }

  private _produceHousePack(): any {
    return {
      agent:     'forge-factory',
      task:      'House Pack Alpha + Beta',
      validated: true,
      produced: {
        properties:       25,
        categories:        8,
        keyTemplates:     25,
        furnitureSets:     8,
        forSaleSigns:     25,
        interiorConfigs:  15,
        dbSeedEntries:    25,
      },
      namingConvention: 'house_{category}_{style}_{number:02d}',
      ids: [
        'house_poor_01', 'house_poor_02',
        'house_modest_01', 'house_modest_02',
        'house_townhouse_01', 'house_townhouse_02', 'house_townhouse_03',
        'house_family_01', 'house_family_02',
        'house_country_01', 'house_country_02',
        'house_upper_01', 'house_upper_02',
        'house_luxury_01', 'house_luxury_02',
        'house_mansion_01',
        '+ 9 autres',
      ],
      priceRange: { min: '$55,000', max: '$8,500,000' },
      files: [
        'shared/property-catalog.ts',
        'server/persistence/world-seed.ts',
      ],
      intellectusUsed: [
        'memory.set(factory:production:houses)',
        'contracts.validate(factory:output)',
      ],
      status: 'completed',
    };
  }

  private _produceVehiclePack(): any {
    return {
      agent:     'forge-factory',
      task:      'Vehicle Pack Alpha',
      validated: true,
      produced: {
        vehicles:   23,
        blueprints: 23,
        liveries:   15,
        handlingPresets: 7,
        classes: { police: 5, ems: 2, fire: 3, civil: 9, aviation: 2, maritime: 1, agriculture: 1 },
      },
      namingConvention: 'vehicle_{package}_{chassis}',
      topIds: [
        'vehicle_police_explorer', 'vehicle_police_charger', 'vehicle_police_tahoe',
        'vehicle_ambulance_type3', 'vehicle_fire_engine', 'vehicle_ladder_truck',
        'vehicle_f150', 'vehicle_ram2500', 'vehicle_cascadia', 'vehicle_taxi',
        'vehicle_troxt_z350_race', 'vehicle_bell_429', 'vehicle_tractor',
        '+ 10 autres',
      ],
      files: ['server/modules/TroxTMod/vehicles/VehicleFactory.ts'],
      status: 'completed',
    };
  }

  private _produceNPCPack(): any {
    return {
      agent:     'forge-factory',
      task:      'NPC Pack Alpha',
      validated: true,
      produced: {
        npcs:       40,
        police:      6,
        ems:         3,
        fire:        2,
        corrections: 1,
        civilians:  18,
        criminals:   6,
        government:  4,
      },
      namingConvention: 'npc_{category}_{role}',
      files: ['shared/world-catalog.ts'],
      status: 'completed',
    };
  }

  private _produceAssetPack(): any {
    return {
      agent:     'forge-factory',
      task:      'Asset Pack Alpha (Props + Effects + Tools)',
      validated: true,
      produced: {
        props:     85,
        effects:   35,
        tools:     28,
        entities:  45,
        buildings: 30,
        sectors:    9,
        totalAssets: 232,
      },
      categories: {
        urban: 15, road: 12, industrial: 18,
        agriculture: 8, nature: 9, police: 5,
        interior: 12, forestry: 6,
      },
      files: ['shared/world-catalog.ts', 'server/modules/TroxTMod/world-registry.ts'],
      status: 'completed',
    };
  }

  private _produceFurniturePack(): any {
    return {
      agent:     'forge-factory',
      task:      'Furniture Pack',
      validated: true,
      produced: {
        furniture: 60,
        categories: { living_room: 10, kitchen: 7, bedroom: 7, bathroom: 4, office: 3, outdoor: 5, lighting: 4, luxury: 6, other: 14 },
      },
      namingConvention: 'furniture_{category}_{name}_{number:02d}',
      files: ['shared/property-catalog.ts'],
      status: 'completed',
    };
  }

  private _produceGeneric(mission: string): any {
    return {
      agent:     'forge-factory',
      task:      mission.slice(0, 80),
      validated: true,
      produced:  { items: 0 },
      status:    'needs_specification',
      warning:   'Spécifier: houses/vehicles/npcs/assets/furniture',
    };
  }
}
// server/modules/TroxTMod/index.ts
import { ModuleLoader }    from '../ModuleLoader';
import { registerProps }   from './props/index';
import { registerTools }   from './tools/physgun';
import { registerEffects } from './effects/index';
import { registerAllVehicles, VehicleFactory } from './vehicles/VehicleFactory';
import { EventBus } from '../../engine/EventBus';

export class TroxTMod {
  static init(loader: ModuleLoader): void {
    const bus = EventBus.getInstance();

    console.log('');
    console.log('🔧 ══════════════════════════════════════');
    console.log('   Initialisation de TroxTMod V5...');
    console.log('   Québec moderne 2025 — TroxT City RP');
    console.log('═══════════════════════════════════════');

    loader.registerModule({
      id:          'troxtmod',
      name:        'TroxTMod',
      version:     '1.0.0',
      description: 'Module principal — Props, Véhicules, Outils, Effets',
      author:      'TroxT',
      entities:    [],
      tools:       [],
    });

    // Props
    registerProps(loader);

    // Tools
    registerTools(loader);

    // Effects
    registerEffects(loader);

    // Vehicles (VGS)
    registerAllVehicles();

    // Exposer les blueprints dans le loader
    VehicleFactory.getAllBlueprints().forEach(blueprint => {
      loader.registerEntity(blueprint.id, {
        type:      'vehicle',
        modelPath: `/assets/models/vehicles/${blueprint.id}/lod0.glb`,
        tags:      blueprint.tags,
        properties: {
          handling:   blueprint.handling,
          seats:      blueprint.seats,
          doors:      blueprint.doors,
          package:    blueprint.package,
          chassis:    blueprint.chassis,
        },
      });
    });

    // Écouter les spawns
    bus.on('vehicle:spawned', (data: any) => {
      console.log(`[TroxTMod] 🚗 Vehicle spawned: ${data.blueprintId} at [${data.position?.join(', ')}]`);
    });

    const stats = loader.getStats();
    console.log('');
    console.log('✅ TroxTMod prêt:');
    console.log(`   📦 ${stats.entities} entités (dont ${VehicleFactory.getStats().blueprints} véhicules)`);
    console.log(`   🔧 ${stats.tools} outils`);
    console.log(`   ⚡ ${stats.effects} effets`);
    console.log('');
  }
}
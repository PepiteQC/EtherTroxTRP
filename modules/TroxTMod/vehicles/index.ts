// server/modules/TroxTMod/vehicles/index.ts
import { ModuleLoader } from '../../ModuleLoader';
import { VEHICLE_IDS } from '../../../../shared/constants';

export function registerVehicles(loader: ModuleLoader): void {
  loader.registerEntity(VEHICLE_IDS.JEEP, {
    type: 'vehicle',
    modelPath: '/assets/models/vehicles/jeep.glb',
    tags: ['vehicle', 'offroad'],
    properties: { maxSpeed: 120, engineForce: 800, seats: 4 },
  });

  loader.registerEntity(VEHICLE_IDS.SEDAN, {
    type: 'vehicle',
    modelPath: '/assets/models/vehicles/sedan.glb',
    tags: ['vehicle', 'civilian'],
    properties: { maxSpeed: 150, engineForce: 600, seats: 4 },
  });

  loader.registerEntity(VEHICLE_IDS.TRUCK, {
    type: 'vehicle',
    modelPath: '/assets/models/vehicles/truck.glb',
    tags: ['vehicle', 'industrial'],
    properties: { maxSpeed: 90, engineForce: 1500, seats: 2, cargo: true },
  });

  loader.registerEntity(VEHICLE_IDS.MOTORCYCLE, {
    type: 'vehicle',
    modelPath: '/assets/models/vehicles/motorcycle.glb',
    tags: ['vehicle', 'bike'],
    properties: { maxSpeed: 200, engineForce: 400, seats: 1 },
  });

  console.log('[TroxTMod] Véhicules enregistrés: 4');
}
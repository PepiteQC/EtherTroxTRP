// server/modules/TroxTMod/tools/index.ts
import { ModuleLoader } from '../../ModuleLoader';
import { TOOL_IDS } from '../../../../shared/constants';
import { PhysicsProp } from '../../../entities/PhysicsProp';
import { v4 as uuidv4 } from 'uuid';

export function registerTools(loader: ModuleLoader): void {

  // Physics Gun
  loader.registerTool(TOOL_IDS.PHYSICS_GUN, {
    name: 'Physics Gun',
    icon: '🔫',
    primaryFire: (playerId, targetId) => {
      if (!targetId) return;
      const entity = loader.entityManager.get(targetId);
      if (entity instanceof PhysicsProp) {
        entity.pickup(playerId);
      }
    },
    secondaryFire: (playerId, targetId) => {
      if (!targetId) return;
      const entity = loader.entityManager.get(targetId);
      if (entity instanceof PhysicsProp) {
        entity.freeze(!entity.isFrozen);
      }
    },
  });

  // Welder
  loader.registerTool(TOOL_IDS.WELD, {
    name: 'Welder',
    icon: '🔧',
    primaryFire: (playerId, targetId) => {
      if (!targetId) return;
      const entity = loader.entityManager.get(targetId);
      if (entity instanceof PhysicsProp) {
        entity.freeze(true);
        entity.setProperty('welded', true);
        entity.addTag('welded');
      }
    },
  });

  // Remover
  loader.registerTool(TOOL_IDS.REMOVER, {
    name: 'Remover',
    icon: '🗑️',
    primaryFire: (playerId, targetId) => {
      if (!targetId) return;
      loader.entityManager.remove(targetId);
    },
  });

  // Duplicator
  loader.registerTool(TOOL_IDS.DUPLICATOR, {
    name: 'Duplicator',
    icon: '📋',
    primaryFire: (playerId, targetId) => {
      if (!targetId) return;
      const entity = loader.entityManager.get(targetId);
      if (!entity) return;

      // Copier à +2 unités sur X
      const pos: [number, number, number] = [
        entity.position[0] + 2,
        entity.position[1],
        entity.position[2],
      ];

      // Créer le duplicata via le module loader
      // (simplifié ici car nécessite Factory pattern complet)
      console.log(`[Duplicator] Copie de ${targetId} à ${pos.join(',')}`);
    },
  });

  console.log('[TroxTMod] Outils enregistrés: 4');
}
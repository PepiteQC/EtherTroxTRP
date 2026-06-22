// server/modules/TroxTMod/tools/physgun.ts
import { ModuleLoader } from '../../ModuleLoader';
import { TOOL_IDS }     from '../../../../shared/constants';

export function registerTools(loader: ModuleLoader): void {

  // ── PHYSICS GUN ──
  loader.registerTool(TOOL_IDS.PHYSICS_GUN, {
    name: 'Physics Gun',
    icon: '🔫',
    primaryFire: (playerId, targetId, params) => {
      // Logique déléguée au serveur via EventBus
      // EntityManager.pickup(targetId, playerId)
      console.log(`[PhysGun] ${playerId} grab ${targetId}`);
    },
    secondaryFire: (playerId, targetId, params) => {
      // Toggle freeze
      console.log(`[PhysGun] ${playerId} freeze ${targetId}`);
    },
  });

  // ── WELD ──
  loader.registerTool(TOOL_IDS.WELD, {
    name: 'Weld Tool',
    icon: '🔩',
    primaryFire: (playerId, targetId, params) => {
      console.log(`[Weld] ${playerId} weld ${targetId}`);
    },
  });

  // ── ROPE ──
  loader.registerTool(TOOL_IDS.ROPE, {
    name: 'Rope Tool',
    icon: '🪢',
    primaryFire: (playerId, targetId, params) => {
      console.log(`[Rope] ${playerId} rope ${targetId}`);
    },
  });

  // ── REMOVER ──
  loader.registerTool(TOOL_IDS.REMOVER, {
    name: 'Remover',
    icon: '🗑️',
    primaryFire: (playerId, targetId, params) => {
      console.log(`[Remover] ${playerId} remove ${targetId}`);
    },
  });

  // ── COLOR ──
  loader.registerTool(TOOL_IDS.COLOR, {
    name: 'Color Tool',
    icon: '🎨',
    primaryFire: (playerId, targetId, params) => {
      console.log(`[Color] ${playerId} color ${targetId} → ${params?.color}`);
    },
  });

  // ── DUPLICATOR ──
  loader.registerTool(TOOL_IDS.DUPLICATOR, {
    name: 'Duplicator',
    icon: '📋',
    primaryFire: (playerId, targetId, params) => {
      console.log(`[Duplicator] ${playerId} copy ${targetId}`);
    },
    secondaryFire: (playerId, targetId, params) => {
      console.log(`[Duplicator] ${playerId} paste`);
    },
  });

  console.log(`   🔧 ${loader.getStats().tools} outils enregistrés`);
}
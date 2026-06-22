// server/modules/TroxTMod/npcs/index.ts
import { ModuleLoader } from '../../ModuleLoader';

export function registerNpcs(loader: ModuleLoader): void {
  loader.registerEntity('guard', {
    type: 'npc',
    modelPath: '/assets/models/npcs/guard.glb',
    tags: ['npc', 'friendly', 'guard'],
    properties: { displayName: 'Security Guard', health: 100, faction: 'security' },
  });

  loader.registerEntity('merchant', {
    type: 'npc',
    modelPath: '/assets/models/npcs/merchant.glb',
    tags: ['npc', 'friendly', 'merchant'],
    properties: { displayName: 'Shopkeeper', health: 50, faction: 'neutral' },
  });

  loader.registerEntity('civilian', {
    type: 'npc',
    modelPath: '/assets/models/npcs/civilian.glb',
    tags: ['npc', 'neutral'],
    properties: { displayName: 'Civilian', health: 30, faction: 'citizen' },
  });

  console.log('[TroxTMod] NPCs enregistrés: 3');
}
// server/modules/TroxTMod/world-registry.ts
// ============================================================
//  TROXT RP — World Registry
//  Charge le catalogue complet (~1100 assets) dans TroxTMod
//  et expose les routes API pour le frontend
// ============================================================

import express from 'express';
import {
  ENTITIES, PROPS, VEHICLES, NPCS, EFFECTS, TOOLS,
  BUILDINGS, SECTORS, WORLD_STATS,
  type AssetDef, type VehicleDef, type NpcDef,
  type BuildingDef, type EffectDef, type WorldSector,
} from '../../../shared/world-catalog';
import { EventBus } from '../../engine/EventBus';

// ============================================================
//  INDEX — Accès rapide par ID
// ============================================================

const entityIndex:   Map<string, AssetDef>    = new Map(ENTITIES.map(e => [e.id, e]));
const propIndex:     Map<string, AssetDef>    = new Map(PROPS.map(p => [p.id, p]));
const vehicleIndex:  Map<string, VehicleDef>  = new Map(VEHICLES.map(v => [v.id, v]));
const npcIndex:      Map<string, NpcDef>      = new Map(NPCS.map(n => [n.id, n]));
const effectIndex:   Map<string, EffectDef>   = new Map(EFFECTS.map(e => [e.id, e]));
const toolIndex:     Map<string, AssetDef>    = new Map(TOOLS.map(t => [t.id, t]));
const buildingIndex: Map<string, BuildingDef> = new Map(BUILDINGS.map(b => [b.id, b]));
const sectorIndex:   Map<string, WorldSector> = new Map(SECTORS.map(s => [s.id, s]));

// Catalogue unifié pour recherche globale
const ALL_ASSETS: Map<string, AssetDef | VehicleDef | NpcDef | BuildingDef | EffectDef> = new Map();
ENTITIES.forEach(a => ALL_ASSETS.set(a.id, a));
PROPS.forEach(a => ALL_ASSETS.set(a.id, a));
VEHICLES.forEach(a => ALL_ASSETS.set(a.id, a));
NPCS.forEach(a => ALL_ASSETS.set(a.id, a));
EFFECTS.forEach(a => ALL_ASSETS.set(a.id, a));
TOOLS.forEach(a => ALL_ASSETS.set(a.id, a));
BUILDINGS.forEach(a => ALL_ASSETS.set(a.id, a));

// ============================================================
//  SEARCH — Recherche full-text dans le catalogue
// ============================================================

function searchCatalog(
  query: string,
  options: {
    category?: string;
    subCategory?: string;
    tags?: string[];
    limit?: number;
  } = {}
): (AssetDef | VehicleDef | NpcDef | BuildingDef | EffectDef)[] {
  const q = query.toLowerCase().trim();
  const limit = options.limit ?? 50;

  let results = Array.from(ALL_ASSETS.values());

  // Filtre catégorie
  if (options.category) {
    results = results.filter(a => a.category === options.category);
  }

  // Filtre sous-catégorie
  if (options.subCategory) {
    results = results.filter(a => a.subCategory === options.subCategory);
  }

  // Filtre tags
  if (options.tags && options.tags.length > 0) {
    results = results.filter(a =>
      options.tags!.every(tag => a.tags.includes(tag))
    );
  }

  // Recherche texte
  if (q) {
    results = results.filter(a =>
      a.id.includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.nameFr.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some(t => t.includes(q))
    );
  }

  // Score de pertinence
  if (q) {
    results.sort((a, b) => {
      const scoreA = getRelevanceScore(a, q);
      const scoreB = getRelevanceScore(b, q);
      return scoreB - scoreA;
    });
  }

  return results.slice(0, limit);
}

function getRelevanceScore(
  asset: AssetDef | VehicleDef | NpcDef | BuildingDef | EffectDef,
  query: string
): number {
  let score = 0;
  if (asset.id === query)                             score += 100;
  if (asset.id.startsWith(query))                     score += 50;
  if (asset.name.toLowerCase() === query)             score += 80;
  if (asset.name.toLowerCase().startsWith(query))     score += 40;
  if (asset.nameFr.toLowerCase().includes(query))     score += 30;
  if (asset.description.toLowerCase().includes(query)) score += 10;
  asset.tags.forEach(t => { if (t.includes(query)) score += 20; });
  return score;
}

// ============================================================
//  SUBCATEGORIES — Lister les sous-catégories d'une catégorie
// ============================================================

function getSubCategories(category: string): string[] {
  const subs = new Set<string>();

  const collections: Record<string, readonly any[]> = {
    entity:   ENTITIES,
    prop:     PROPS,
    vehicle:  VEHICLES,
    npc:      NPCS,
    effect:   EFFECTS,
    tool:     TOOLS,
    building: BUILDINGS,
  };

  const collection = collections[category];
  if (collection) {
    collection.forEach((a: any) => {
      if (a.subCategory) subs.add(a.subCategory);
    });
  }

  return Array.from(subs).sort();
}

// ============================================================
//  TAGS — Tous les tags utilisés
// ============================================================

function getAllTags(): { tag: string; count: number }[] {
  const tagMap = new Map<string, number>();

  ALL_ASSETS.forEach(a => {
    a.tags.forEach(t => {
      tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    });
  });

  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================
//  ROUTER EXPRESS
// ============================================================

export const worldRegistryRouter = express.Router();

// ── Stats globales ──
worldRegistryRouter.get('/stats', (_req, res) => {
  res.json({
    success: true,
    stats: {
      ...WORLD_STATS,
      total:       WORLD_STATS.total,
      allAssets:   ALL_ASSETS.size,
      lastUpdated: new Date().toISOString(),
    },
  });
});

// ── Recherche globale ──
worldRegistryRouter.get('/search', (req, res) => {
  const query       = (req.query.q        as string) ?? '';
  const category    = (req.query.category  as string) ?? undefined;
  const subCategory = (req.query.sub       as string) ?? undefined;
  const tagsRaw     = (req.query.tags      as string) ?? '';
  const limit       = parseInt(req.query.limit as string) || 50;

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : undefined;

  const results = searchCatalog(query, { category, subCategory, tags, limit });

  res.json({
    success: true,
    query,
    count:   results.length,
    results,
  });
});

// ── Tags ──
worldRegistryRouter.get('/tags', (_req, res) => {
  res.json({ success: true, tags: getAllTags() });
});

// ── Entities ──
worldRegistryRouter.get('/entities', (req, res) => {
  const sub = req.query.sub as string;
  let data = ENTITIES;
  if (sub) data = data.filter(e => e.subCategory === sub);
  res.json({ success: true, count: data.length, entities: data, subCategories: getSubCategories('entity') });
});

worldRegistryRouter.get('/entities/:id', (req, res) => {
  const entity = entityIndex.get(req.params.id);
  if (!entity) return res.status(404).json({ success: false, error: 'Entity not found' });
  res.json({ success: true, entity });
});

// ── Props ──
worldRegistryRouter.get('/props', (req, res) => {
  const sub = req.query.sub as string;
  let data = PROPS;
  if (sub) data = data.filter(p => p.subCategory === sub);
  res.json({ success: true, count: data.length, props: data, subCategories: getSubCategories('prop') });
});

worldRegistryRouter.get('/props/:id', (req, res) => {
  const prop = propIndex.get(req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Prop not found' });
  res.json({ success: true, prop });
});

// ── Vehicles ──
worldRegistryRouter.get('/vehicles', (req, res) => {
  const sub = req.query.sub as string;
  let data = VEHICLES;
  if (sub) data = data.filter(v => v.subCategory === sub);
  res.json({ success: true, count: data.length, vehicles: data, subCategories: getSubCategories('vehicle') });
});

worldRegistryRouter.get('/vehicles/:id', (req, res) => {
  const vehicle = vehicleIndex.get(req.params.id);
  if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
  res.json({ success: true, vehicle });
});

// ── NPCs ──
worldRegistryRouter.get('/npcs', (req, res) => {
  const sub = req.query.sub as string;
  let data = NPCS;
  if (sub) data = data.filter(n => n.subCategory === sub);
  res.json({ success: true, count: data.length, npcs: data, subCategories: getSubCategories('npc') });
});

worldRegistryRouter.get('/npcs/:id', (req, res) => {
  const npc = npcIndex.get(req.params.id);
  if (!npc) return res.status(404).json({ success: false, error: 'NPC not found' });
  res.json({ success: true, npc });
});

// ── Effects ──
worldRegistryRouter.get('/effects', (req, res) => {
  const sub = req.query.sub as string;
  let data = EFFECTS;
  if (sub) data = data.filter(e => e.subCategory === sub);
  res.json({ success: true, count: data.length, effects: data, subCategories: getSubCategories('effect') });
});

worldRegistryRouter.get('/effects/:id', (req, res) => {
  const effect = effectIndex.get(req.params.id);
  if (!effect) return res.status(404).json({ success: false, error: 'Effect not found' });
  res.json({ success: true, effect });
});

// ── Tools ──
worldRegistryRouter.get('/tools', (req, res) => {
  const sub = req.query.sub as string;
  let data = TOOLS;
  if (sub) data = data.filter(t => t.subCategory === sub);
  res.json({ success: true, count: data.length, tools: data, subCategories: getSubCategories('tool') });
});

worldRegistryRouter.get('/tools/:id', (req, res) => {
  const tool = toolIndex.get(req.params.id);
  if (!tool) return res.status(404).json({ success: false, error: 'Tool not found' });
  res.json({ success: true, tool });
});

// ── Buildings ──
worldRegistryRouter.get('/buildings', (req, res) => {
  const sub    = req.query.sub    as string;
  const sector = req.query.sector as string;
  let data = BUILDINGS;
  if (sub)    data = data.filter(b => b.subCategory === sub);
  if (sector) data = data.filter(b => b.sector === sector);
  res.json({ success: true, count: data.length, buildings: data, subCategories: getSubCategories('building') });
});

worldRegistryRouter.get('/buildings/:id', (req, res) => {
  const building = buildingIndex.get(req.params.id);
  if (!building) return res.status(404).json({ success: false, error: 'Building not found' });
  res.json({ success: true, building });
});

// ── Sectors (Map zones) ──
worldRegistryRouter.get('/sectors', (_req, res) => {
  res.json({ success: true, count: SECTORS.length, sectors: SECTORS });
});

worldRegistryRouter.get('/sectors/:id', (req, res) => {
  const sector = sectorIndex.get(req.params.id);
  if (!sector) return res.status(404).json({ success: false, error: 'Sector not found' });

  // Enrichir avec les buildings complets
  const buildings = sector.buildings
    .map(id => buildingIndex.get(id))
    .filter(Boolean);

  res.json({
    success: true,
    sector: {
      ...sector,
      buildingDetails: buildings,
    },
  });
});

// ── Catalogue complet (pour le Spawn Menu frontend) ──
worldRegistryRouter.get('/catalog', (_req, res) => {
  res.json({
    success: true,
    catalog: {
      entities:  ENTITIES,
      props:     PROPS,
      vehicles:  VEHICLES,
      npcs:      NPCS,
      effects:   EFFECTS,
      tools:     TOOLS,
      buildings: BUILDINGS,
      sectors:   SECTORS,
    },
    stats: WORLD_STATS,
  });
});

// ── Catalogue par catégorie (léger, pour menus) ──
worldRegistryRouter.get('/catalog/menu', (_req, res) => {
  const toMenuItem = (a: AssetDef) => ({
    id:          a.id,
    name:        a.name,
    nameFr:      a.nameFr,
    category:    a.category,
    subCategory: a.subCategory,
    tags:        a.tags,
  });

  res.json({
    success: true,
    menu: {
      entities:  ENTITIES.map(toMenuItem),
      props:     PROPS.map(toMenuItem),
      vehicles:  VEHICLES.map(v => ({
        ...toMenuItem(v),
        vehicleClass: v.vehicleClass,
        maxSpeed:     v.maxSpeed,
        seats:        v.seats,
      })),
      npcs:      NPCS.map(n => ({
        ...toMenuItem(n),
        npcClass: n.npcClass,
        health:   n.health,
        job:      n.job,
        faction:  n.faction,
      })),
      effects:   EFFECTS.map(e => ({
        ...toMenuItem(e),
        duration: e.duration,
      })),
      tools:     TOOLS.map(toMenuItem),
      buildings: BUILDINGS.map(b => ({
        ...toMenuItem(b),
        sector:    b.sector,
        floors:    b.dimensions.floors,
        interiors: b.interiors.length,
      })),
    },
  });
});

// ── Catégories disponibles ──
worldRegistryRouter.get('/categories', (_req, res) => {
  const categories = [
    {
      id: 'entity', label: 'Entités', labelFr: 'Entités',
      icon: '⚡', count: ENTITIES.length,
      subCategories: getSubCategories('entity'),
    },
    {
      id: 'prop', label: 'Props', labelFr: 'Accessoires',
      icon: '📦', count: PROPS.length,
      subCategories: getSubCategories('prop'),
    },
    {
      id: 'vehicle', label: 'Vehicles', labelFr: 'Véhicules',
      icon: '🚗', count: VEHICLES.length,
      subCategories: getSubCategories('vehicle'),
    },
    {
      id: 'npc', label: 'NPCs', labelFr: 'Personnages',
      icon: '👤', count: NPCS.length,
      subCategories: getSubCategories('npc'),
    },
    {
      id: 'effect', label: 'Effects', labelFr: 'Effets',
      icon: '✨', count: EFFECTS.length,
      subCategories: getSubCategories('effect'),
    },
    {
      id: 'tool', label: 'Tools', labelFr: 'Outils',
      icon: '🔧', count: TOOLS.length,
      subCategories: getSubCategories('tool'),
    },
    {
      id: 'building', label: 'Buildings', labelFr: 'Bâtiments',
      icon: '🏢', count: BUILDINGS.length,
      subCategories: getSubCategories('building'),
    },
  ];

  res.json({ success: true, categories });
});

// ============================================================
//  INIT FUNCTION — Appelée au démarrage du serveur
// ============================================================

export function initWorldRegistry(): void {
  const bus = EventBus.getInstance();

  console.log('');
  console.log('🌍 ════════════════════════════════════════');
  console.log('   TROXT RP — World Registry Loaded');
  console.log('   ────────────────────────────────────────');
  console.log(`   ⚡ Entities:  ${ENTITIES.length}`);
  console.log(`   📦 Props:     ${PROPS.length}`);
  console.log(`   🚗 Vehicles:  ${VEHICLES.length}`);
  console.log(`   👤 NPCs:      ${NPCS.length}`);
  console.log(`   ✨ Effects:   ${EFFECTS.length}`);
  console.log(`   🔧 Tools:     ${TOOLS.length}`);
  console.log(`   🏢 Buildings: ${BUILDINGS.length}`);
  console.log(`   🗺️  Sectors:   ${SECTORS.length}`);
  console.log(`   ────────────────────────────────────────`);
  console.log(`   📊 TOTAL:     ${WORLD_STATS.total} assets`);
  console.log('🌍 ════════════════════════════════════════');
  console.log('');

  bus.emit('world:registry:loaded', {
    stats:   WORLD_STATS,
    sectors: SECTORS.length,
  });
}
// server/agents/ether-prism/EtherPrism.ts
// ============================================================
//  ETHER-PRISM — Agent transformateur et créateur de variantes
//  Transforme idées → catégories, variantes, styles
// ============================================================

import { BaseAgent, type AgentTaskPacket } from '../BaseAgent';

export class EtherPrism extends BaseAgent {

  constructor() {
    super('ether-prism');

    this.intellectus.contracts.register('prism:output', {
      name:        'EtherPrism Output',
      description: 'Résultat de transformation Ether-Prism',
      rules: [
        { field: 'task',       type: 'string', required: true },
        { field: 'categories', type: 'object', required: true },
        { field: 'total',      type: 'number', required: true, min: 1 },
        { field: 'naming',     type: 'string', required: true },
        { field: 'status',     type: 'string', required: true },
      ],
    });
  }

  protected async _process(packet: AgentTaskPacket): Promise<any> {
    const mission = packet.mission.toLowerCase();

    // Récupérer variantes précédentes depuis mémoire
    const cached = this.intellectus.memory.get<any>(`prism:${mission.slice(0, 40)}`);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    let output: any;

    if (mission.includes('maison') || mission.includes('house') || mission.includes('property')) {
      output = this._transformHouses();
    } else if (mission.includes('vehicle') || mission.includes('véhicule')) {
      output = this._transformVehicles();
    } else if (mission.includes('npc') || mission.includes('personnage')) {
      output = this._transformNPCs();
    } else if (mission.includes('prop') || mission.includes('objet')) {
      output = this._transformProps();
    } else if (mission.includes('job') || mission.includes('emploi')) {
      output = this._transformJobs();
    } else {
      output = this._transformGeneric(packet.mission);
    }

    // Valider contrat
    this.intellectus.contracts.validate('prism:output', output);

    // Mettre en cache dans Intellectus Memory
    this.intellectus.memory.set(`prism:${mission.slice(0, 40)}`, output, {
      source: 'ether-prism',
      tags:   ['prism', 'categories', output.task],
      ttl:    1800000, // 30 min
    });

    return output;
  }

  private _transformHouses(): any {
    return {
      agent: 'ether-prism',
      task:  'House Categories',
      categories: {
        poor:      { priceMin: 55000,   priceMax: 110000,   rooms: '2-3', garage: false, pool: false, maxFurniture: 40,  examples: ['Bungalow délabré', 'Petit logement'] },
        modest:    { priceMin: 140000,  priceMax: 260000,   rooms: '3-5', garage: false, pool: false, maxFurniture: 75,  examples: ['Maison de ville modeste', 'Bungalow propre'] },
        townhouse: { priceMin: 250000,  priceMax: 420000,   rooms: '5-7', garage: true,  pool: false, maxFurniture: 130, examples: ['Maison moderne', 'Maison patrimoniale'] },
        family:    { priceMin: 380000,  priceMax: 650000,   rooms: '7-9', garage: true,  pool: true,  maxFurniture: 200, examples: ['Maison familiale banlieue', 'Moderne avec piscine'] },
        country:   { priceMin: 300000,  priceMax: 800000,   rooms: '6-9', garage: true,  pool: true,  maxFurniture: 180, examples: ['Ferme québécoise', 'Chalet-villa lacustre'] },
        upper:     { priceMin: 750000,  priceMax: 1400000,  rooms: '9-12',garage: true,  pool: true,  maxFurniture: 350, examples: ['Villa prestige', 'Penthouse centre-ville'] },
        luxury:    { priceMin: 1500000, priceMax: 4500000,  rooms: '12+', garage: true,  pool: true,  maxFurniture: 500, examples: ['Domaine luxueux', 'Villa lacustre'] },
        mansion:   { priceMin: 5000000, priceMax: 20000000, rooms: '20+', garage: true,  pool: true,  maxFurniture: 700, examples: ['Manoir TroxT — 22 pièces, hélipad'] },
      },
      total: 8,
      naming: 'house_{category}_{style}_{number:02d}',
      features: {
        customizable: 'Toutes catégories',
        garage:       'Modest et plus',
        pool:         'Family et plus',
        balcony:      'Townhouse et plus',
        fireplace:    'Modest et plus',
      },
      progression: [
        '$55k → Poor → Bungalow délabré',
        '$175k → Modest → Maison de ville',
        '$295k → Townhouse → Maison moderne',
        '$425k → Family → Grande maison',
        '$380k → Country → Ferme/chalet',
        '$980k → Upper → Villa prestige',
        '$2.2M → Luxury → Domaine privé',
        '$8.5M → Mansion → Manoir complet',
      ],
      status: 'completed',
    };
  }

  private _transformVehicles(): any {
    return {
      agent: 'ether-prism',
      task:  'Vehicle Packages',
      categories: {
        police:      { features: ['gyrophare','sirène','push_bar','dashcam','mdt'], livery: 'sq_markings',     maxSpeed: 250 },
        ems:         { features: ['gyrophare','sirène','baie_medicale'],            livery: 'white_orange',   maxSpeed: 180 },
        fire:        { features: ['gyrophare','sirène','klaxon_air'],               livery: 'red_white',      maxSpeed: 130 },
        swat:        { features: ['gyrophare','sirène','blindage'],                 livery: 'black_tactical', maxSpeed: 145 },
        civilian:    { features: [],                                                 livery: 'custom',         maxSpeed: 200 },
        race:        { features: ['arceau','harnais','extincteur'],                 livery: 'racing',         maxSpeed: 295 },
        government:  { features: ['dashcam'],                                       livery: 'gov_markings',   maxSpeed: 180 },
        taxi:        { features: ['compteur'],                                       livery: 'yellow',         maxSpeed: 180 },
        transport:   { features: ['crochet_remorque','galerie'],                    livery: 'orange_warning', maxSpeed: 130 },
        agriculture: { features: ['crochet_remorque','galerie_toit'],               livery: 'green_farm',     maxSpeed: 60  },
        forestry:    { features: ['crochet_remorque','galerie_bois'],               livery: 'yellow_forest',  maxSpeed: 100 },
      },
      chassis: {
        suv_large:      { seats: 5, doors: 4, weight: 2400, category: 'SUV grand format' },
        sedan_full:     { seats: 5, doors: 4, weight: 1800, category: 'Berline pleine grandeur' },
        coupe_sport:    { seats: 2, doors: 2, weight: 1350, category: 'Coupé sport' },
        pickup_full:    { seats: 5, doors: 4, weight: 2200, category: 'Pickup pleine grandeur' },
        van_full:       { seats: 3, doors: 3, weight: 3500, category: 'Fourgon complet' },
        truck_semi:     { seats: 2, doors: 2, weight: 8000, category: 'Semi-remorque' },
        bus_transit:    { seats: 40,doors: 3, weight: 14000,category: 'Autobus urbain' },
        motorcycle_std: { seats: 2, doors: 0, weight: 220,  category: 'Moto standard' },
        boat_small:     { seats: 4, doors: 0, weight: 500,  category: 'Chaloupe' },
        helicopter:     { seats: 7, doors: 2, weight: 2800, category: 'Hélicoptère' },
      },
      formula: 'vehicle_{package}_{chassis}  → 110 combinaisons possibles',
      total: 11,
      naming: 'vehicle_{package}_{chassis}',
      status: 'completed',
    };
  }

  private _transformNPCs(): any {
    return {
      agent: 'ether-prism',
      task:  'NPC Categories',
      categories: {
        law:        { health: '200-400', hostile: false, patrol: true,  examples: ['Policier SQ', 'Agent GTI', 'Dispatcher'] },
        emergency:  { health: '150-300', hostile: false, patrol: true,  examples: ['Paramédic', 'Médecin', 'Pompier'] },
        corrections:{ health: '250',     hostile: false, patrol: true,  examples: ['Agent correctionnel'] },
        civilian:   { health: '80-120',  hostile: false, patrol: true,  examples: ['Citoyen', 'Passant', 'Joggeur'] },
        worker:     { health: '120-180', hostile: false, patrol: false, examples: ['Mécanicien', 'Camionneur', 'Agriculteur'] },
        criminal:   { health: '120-300', hostile: true,  patrol: false, examples: ['Revendeur', 'Gang', 'Contrebandier'] },
        government: { health: '80-100',  hostile: false, patrol: false, examples: ['Maire', 'Juge', 'Commis SAAQ'] },
      },
      total: 7,
      naming: 'npc_{category}_{role}',
      totalNPCs: 40,
      status: 'completed',
    };
  }

  private _transformProps(): any {
    return {
      agent: 'ether-prism',
      task:  'Prop Categories',
      categories: {
        urban:          { count: 15, examples: ['Banc', 'Poubelle', 'Réverbère', 'Arrêt d\'autobus'] },
        road:           { count: 12, examples: ['Feu de circulation', 'Panneau stop', 'Cône orange'] },
        industrial:     { count: 18, examples: ['Conteneur', 'Palette', 'Baril', 'Génératrice'] },
        agriculture:    { count: 8,  examples: ['Balle de foin', 'Abreuvoir', 'Clôture', 'Silo'] },
        nature:         { count: 9,  examples: ['Épinette', 'Érable', 'Roche', 'Arbre tombé'] },
        police:         { count: 5,  examples: ['Barricade', 'Radar', 'Herse', 'Ruban'] },
        interior:       { count: 12, examples: ['Bureau', 'Chaise', 'Classeur', 'Tableau blanc'] },
      },
      total: 7,
      naming: 'prop_{category}_{name}_{number:02d}',
      totalProps: 85,
      status: 'completed',
    };
  }

  private _transformJobs(): any {
    return {
      agent: 'ether-prism',
      task:  'Job Categories',
      categories: {
        emergency:   { salary: '3500-4000', uniform: true,  vehicle: true,  examples: ['Police', 'Ambulance', 'Pompier', 'Corrections'] },
        civil:       { salary: '1800-3200', uniform: false, vehicle: false, examples: ['Taxi', 'Camionneur', 'Agriculteur', 'Mécanicien'] },
        government:  { salary: '2800-3500', uniform: false, vehicle: false, examples: ['Fonctionnaire', 'SAAQ', 'Tribunal'] },
        resource:    { salary: '2800-3400', uniform: true,  vehicle: true,  examples: ['Bûcheron', 'Mineur', 'Construction'] },
        commerce:    { salary: '1800-2500', uniform: true,  vehicle: false, examples: ['Commis', 'Restauration', 'Pharmacie'] },
        unemployed:  { salary: '500',       uniform: false, vehicle: false, examples: ['Sans emploi'] },
      },
      total: 6,
      naming: 'job_{name}',
      grades: 'cadet → officer → corporal → sergeant → lieutenant → captain → chief',
      totalJobs: 16,
      status: 'completed',
    };
  }

  private _transformGeneric(mission: string): any {
    return {
      agent:  'ether-prism',
      task:   mission.slice(0, 80),
      categories: {
        standard: { description: 'Variante standard' },
        premium:  { description: 'Variante premium' },
        basic:    { description: 'Variante basique' },
      },
      total: 3,
      naming: '{type}_{variant}_{number:02d}',
      status: 'completed',
    };
  }
}
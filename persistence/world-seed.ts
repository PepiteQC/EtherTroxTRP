// server/persistence/world-seed.ts
// ============================================================
//  TROXT RP — World Seed pour EtherPrism DB
//  Données réalistes Québec 2025 pour toutes les tables RP
//  Synchronisé avec shared/world-catalog.ts
// ============================================================

import { DatabaseAdapter } from './DatabaseAdapter';

// ============================================================
//  SEED COMPLET — Appeler avec db.seedWorld()
// ============================================================

export function seedWorldData(db: DatabaseAdapter): {
  tables:    string[];
  totalRows: number;
} {
  const now    = new Date().toISOString();
  const tables: string[] = [];
  let totalRows = 0;

  const seed = (table: string, rows: any[]) => {
    if (!db.hasTable(table)) db.createTable(table);
    // Vider avant seed
    const existing = db.findAll(table);
    if (existing.data && existing.data.length > 0) return; // Ne pas re-seeder

    rows.forEach(row => db.insert(table, { ...row, created_at: now, updated_at: now }));
    tables.push(table);
    totalRows += rows.length;
  };

  // ============================================================
  //  PLAYERS — Joueurs RP
  // ============================================================

  seed('players', [
    { id: 1,  name: 'Jean-Philippe Tremblay', steam_id: 'steam:110000101', job: 'police',       rank: 'sergeant',    money_cash: 5200,   money_bank: 48000,   phone: '418-555-0101', status: 'online',  health: 200, armor: 50,  license_car: true,  license_gun: true,  license_pilot: false },
    { id: 2,  name: 'Marie-Ève Lavoie',       steam_id: 'steam:110000102', job: 'ambulance',     rank: 'paramedic',   money_cash: 3400,   money_bank: 62000,   phone: '418-555-0102', status: 'online',  health: 100, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 3,  name: 'Marco Bélanger',          steam_id: 'steam:110000103', job: 'mechanic',      rank: 'boss',        money_cash: 12000,  money_bank: 145000,  phone: '418-555-0103', status: 'online',  health: 100, armor: 0,   license_car: true,  license_gun: true,  license_pilot: false },
    { id: 4,  name: 'Alexandre Gagnon',        steam_id: 'steam:110000104', job: 'taxi',          rank: 'driver',      money_cash: 1800,   money_bank: 22000,   phone: '418-555-0104', status: 'offline', health: 100, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 5,  name: 'Tony "Snake" Moretti',    steam_id: 'steam:110000105', job: 'unemployed',    rank: 'none',        money_cash: 85000,  money_bank: 1200000, phone: '438-555-0105', status: 'online',  health: 100, armor: 100, license_car: true,  license_gun: true,  license_pilot: true },
    { id: 6,  name: 'Sarah-Jade Bouchard',     steam_id: 'steam:110000106', job: 'police',        rank: 'detective',   money_cash: 4500,   money_bank: 78000,   phone: '418-555-0106', status: 'online',  health: 200, armor: 50,  license_car: true,  license_gun: true,  license_pilot: false },
    { id: 7,  name: 'Maxime Côté',             steam_id: 'steam:110000107', job: 'fire',          rank: 'captain',     money_cash: 3800,   money_bank: 95000,   phone: '418-555-0107', status: 'online',  health: 300, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 8,  name: 'Chloé Dubois',            steam_id: 'steam:110000108', job: 'journalist',    rank: 'reporter',    money_cash: 2200,   money_bank: 35000,   phone: '438-555-0108', status: 'online',  health: 100, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 9,  name: 'Patrick "Patch" Leclerc', steam_id: 'steam:110000109', job: 'logger',        rank: 'foreman',     money_cash: 6500,   money_bank: 55000,   phone: '819-555-0109', status: 'offline', health: 150, armor: 0,   license_car: true,  license_gun: true,  license_pilot: false },
    { id: 10, name: 'Isabelle Fortin',         steam_id: 'steam:110000110', job: 'farmer',        rank: 'owner',       money_cash: 8000,   money_bank: 180000,  phone: '819-555-0110', status: 'offline', health: 100, armor: 0,   license_car: true,  license_gun: true,  license_pilot: false },
    { id: 11, name: 'Kevin "KG" Gauthier',     steam_id: 'steam:110000111', job: 'unemployed',    rank: 'none',        money_cash: 42000,  money_bank: 15000,   phone: '514-555-0111', status: 'online',  health: 100, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 12, name: 'Valérie Roy',             steam_id: 'steam:110000112', job: 'ambulance',     rank: 'doctor',      money_cash: 5000,   money_bank: 120000,  phone: '418-555-0112', status: 'online',  health: 100, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 13, name: 'David Pelletier',         steam_id: 'steam:110000113', job: 'construction',  rank: 'worker',      money_cash: 3200,   money_bank: 28000,   phone: '418-555-0113', status: 'offline', health: 160, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 14, name: 'Jasmine Nguyen',          steam_id: 'steam:110000114', job: 'store',         rank: 'manager',     money_cash: 4100,   money_bank: 42000,   phone: '438-555-0114', status: 'online',  health: 100, armor: 0,   license_car: true,  license_gun: false, license_pilot: false },
    { id: 15, name: 'Steve "Ghost" Martineau', steam_id: 'steam:110000115', job: 'unemployed',    rank: 'none',        money_cash: 120000, money_bank: 5000,    phone: '514-555-0115', status: 'online',  health: 100, armor: 50,  license_car: true,  license_gun: true,  license_pilot: true },
  ]);

  // ============================================================
  //  VEHICLES — Véhicules enregistrés
  // ============================================================

  seed('vehicles', [
    { id: 1,  owner_id: 1,  model: 'vehicle_police_explorer',  plate: 'SQ-2401',   garage: 'police_station',  fuel: 82,  status: 'out',      color: 'noir/blanc',     mileage: 45200,  condition: 92,  insurance: true,  impounded: false },
    { id: 2,  owner_id: 1,  model: 'vehicle_police_charger',   plate: 'SQ-2402',   garage: 'police_station',  fuel: 65,  status: 'parked',   color: 'noir/blanc',     mileage: 38000,  condition: 88,  insurance: true,  impounded: false },
    { id: 3,  owner_id: 2,  model: 'vehicle_ambulance_type3',  plate: 'EMS-301',   garage: 'hospital',        fuel: 58,  status: 'out',      color: 'blanc/orange',   mileage: 62000,  condition: 85,  insurance: true,  impounded: false },
    { id: 4,  owner_id: 3,  model: 'vehicle_f150',             plate: 'K42-RMC',   garage: 'mechanic_garage', fuel: 74,  status: 'parked',   color: 'rouge',          mileage: 85000,  condition: 78,  insurance: true,  impounded: false },
    { id: 5,  owner_id: 3,  model: 'vehicle_tow_truck',        plate: 'DEP-501',   garage: 'mechanic_garage', fuel: 90,  status: 'out',      color: 'jaune',          mileage: 120000, condition: 72,  insurance: true,  impounded: false },
    { id: 6,  owner_id: 5,  model: 'vehicle_civic',            plate: 'SNK-666',   garage: 'luxury_garage',   fuel: 100, status: 'parked',   color: 'noir mat',       mileage: 12000,  condition: 98,  insurance: true,  impounded: false },
    { id: 7,  owner_id: 5,  model: 'vehicle_ram2500',          plate: 'MTR-999',   garage: 'luxury_garage',   fuel: 45,  status: 'impound',  color: 'noir',           mileage: 35000,  condition: 90,  insurance: true,  impounded: true },
    { id: 8,  owner_id: 4,  model: 'vehicle_corolla',          plate: 'TAX-801',   garage: 'taxi_depot',      fuel: 55,  status: 'out',      color: 'blanc/jaune',    mileage: 195000, condition: 65,  insurance: true,  impounded: false },
    { id: 9,  owner_id: 7,  model: 'vehicle_fire_engine',      plate: 'SIM-101',   garage: 'fire_station',    fuel: 92,  status: 'parked',   color: 'rouge',          mileage: 28000,  condition: 95,  insurance: true,  impounded: false },
    { id: 10, owner_id: 6,  model: 'vehicle_police_tahoe',     plate: 'SQ-2410',   garage: 'police_station',  fuel: 70,  status: 'out',      color: 'vert/blanc',     mileage: 52000,  condition: 86,  insurance: true,  impounded: false },
    { id: 11, owner_id: 9,  model: 'vehicle_logging_truck',    plate: 'LOG-201',   garage: 'logging_camp',    fuel: 80,  status: 'parked',   color: 'jaune',          mileage: 250000, condition: 60,  insurance: true,  impounded: false },
    { id: 12, owner_id: 10, model: 'vehicle_tractor',          plate: 'FRM-401',   garage: 'barn',            fuel: 65,  status: 'parked',   color: 'vert JD',        mileage: 3200,   condition: 92,  insurance: true,  impounded: false },
    { id: 13, owner_id: 10, model: 'vehicle_silverado',        plate: 'FRM-402',   garage: 'farmhouse',       fuel: 88,  status: 'out',      color: 'blanc',          mileage: 78000,  condition: 80,  insurance: true,  impounded: false },
    { id: 14, owner_id: 11, model: 'vehicle_civic',            plate: 'KG-1337',   garage: null,              fuel: 30,  status: 'impound',  color: 'gris foncé',     mileage: 150000, condition: 55,  insurance: false, impounded: true },
    { id: 15, owner_id: 15, model: 'vehicle_atv',              plate: 'OFF-001',   garage: 'hidden_bunker',   fuel: 100, status: 'parked',   color: 'camo',           mileage: 8000,   condition: 95,  insurance: false, impounded: false },
  ]);

  // ============================================================
  //  HOUSES / PROPERTIES — Propriétés immobilières
  // ============================================================

  seed('properties', [
    { id: 1,  owner_id: 5,  address: '2044 Boul. Laurier',           type: 'condo',     price: 450000,  rent_monthly: 2200, tier: 'luxury',  locked: true,  garage_slots: 2, interior: 'modern_loft',   sector: 'downtown',  sqft: 1800 },
    { id: 2,  owner_id: 1,  address: '112 Rue des Érables',          type: 'house',     price: 285000,  rent_monthly: 1500, tier: 'medium',  locked: true,  garage_slots: 1, interior: 'suburban_home',  sector: 'suburban',  sqft: 1200 },
    { id: 3,  owner_id: null, address: '1337 Rue Grove',             type: 'apartment', price: 0,       rent_monthly: 850,  tier: 'low',     locked: false, garage_slots: 0, interior: 'basic_apt',     sector: 'downtown',  sqft: 600 },
    { id: 4,  owner_id: 3,  address: '432 Boul. Industriel',         type: 'commercial',price: 380000,  rent_monthly: 2800, tier: 'medium',  locked: true,  garage_slots: 3, interior: 'garage_shop',   sector: 'industrial',sqft: 2500 },
    { id: 5,  owner_id: 10, address: 'Rang Saint-Joseph, Lot 142',   type: 'farm',      price: 650000,  rent_monthly: 0,    tier: 'high',    locked: true,  garage_slots: 4, interior: 'farmhouse',     sector: 'rural',     sqft: 3500 },
    { id: 6,  owner_id: null, address: '88 Rue du Port',             type: 'warehouse', price: 0,       rent_monthly: 3500, tier: 'industrial', locked: false, garage_slots: 2, interior: 'warehouse',  sector: 'port',      sqft: 5000 },
    { id: 7,  owner_id: 15, address: 'Chemin Forestier km 42',       type: 'cabin',     price: 125000,  rent_monthly: 0,    tier: 'low',     locked: true,  garage_slots: 1, interior: 'cabin',         sector: 'forest',    sqft: 800 },
    { id: 8,  owner_id: 5,  address: '1 Penthouse Ave, Tour TroxT',  type: 'penthouse', price: 1200000, rent_monthly: 5000, tier: 'luxury',  locked: true,  garage_slots: 3, interior: 'penthouse',     sector: 'downtown',  sqft: 4000 },
  ]);

  // ============================================================
  //  JOBS — Emplois disponibles
  // ============================================================

  seed('jobs', [
    { id: 1,  name: 'police',       label: 'Service de Police TroxT',        grades: 'cadet,officer,corporal,sergeant,detective,lieutenant,captain,chief', salary_base: 3800, on_duty: 3, max_slots: 20, department: 'emergency', uniform: true,  vehicle_access: true },
    { id: 2,  name: 'ambulance',     label: 'Urgences-Santé TroxT',          grades: 'trainee,paramedic,senior_paramedic,doctor,chief_medical',            salary_base: 3500, on_duty: 2, max_slots: 15, department: 'emergency', uniform: true,  vehicle_access: true },
    { id: 3,  name: 'fire',          label: 'Service Incendie TroxT (SIM)',  grades: 'recruit,firefighter,driver,lieutenant,captain,chief',                salary_base: 3600, on_duty: 2, max_slots: 12, department: 'emergency', uniform: true,  vehicle_access: true },
    { id: 4,  name: 'mechanic',      label: 'Garage TroxT Mécanique',        grades: 'apprentice,mechanic,senior_mechanic,boss',                          salary_base: 2800, on_duty: 1, max_slots: 8,  department: 'civil',     uniform: true,  vehicle_access: true },
    { id: 5,  name: 'taxi',          label: 'Taxi Diamond TroxT',            grades: 'driver,senior_driver,dispatcher,manager',                            salary_base: 2200, on_duty: 1, max_slots: 10, department: 'civil',     uniform: false, vehicle_access: true },
    { id: 6,  name: 'trucker',       label: 'Transport Routier TroxT',       grades: 'driver,senior_driver,foreman',                                       salary_base: 2600, on_duty: 0, max_slots: 10, department: 'civil',     uniform: false, vehicle_access: true },
    { id: 7,  name: 'farmer',        label: 'Agriculture TroxT',             grades: 'worker,senior_worker,foreman,owner',                                 salary_base: 2400, on_duty: 0, max_slots: 8,  department: 'civil',     uniform: false, vehicle_access: true },
    { id: 8,  name: 'logger',        label: 'Industrie Forestière TroxT',    grades: 'laborer,operator,foreman,manager',                                   salary_base: 3000, on_duty: 0, max_slots: 8,  department: 'civil',     uniform: true,  vehicle_access: true },
    { id: 9,  name: 'miner',         label: 'Mines TroxT (Abitibi)',         grades: 'laborer,operator,blaster,foreman',                                   salary_base: 3200, on_duty: 0, max_slots: 6,  department: 'civil',     uniform: true,  vehicle_access: true },
    { id: 10, name: 'construction',  label: 'Construction FTQ',              grades: 'laborer,carpenter,electrician,foreman,superintendent',                salary_base: 2800, on_duty: 0, max_slots: 10, department: 'civil',     uniform: true,  vehicle_access: true },
    { id: 11, name: 'store',         label: 'Commerce de Détail',            grades: 'clerk,cashier,manager',                                              salary_base: 1800, on_duty: 0, max_slots: 15, department: 'civil',     uniform: true,  vehicle_access: false },
    { id: 12, name: 'journalist',    label: 'Média TroxT (TVA/RC)',          grades: 'intern,reporter,anchor,editor',                                      salary_base: 2500, on_duty: 0, max_slots: 5,  department: 'civil',     uniform: false, vehicle_access: true },
    { id: 13, name: 'corrections',   label: 'Services Correctionnels',       grades: 'guard,senior_guard,sergeant,warden',                                 salary_base: 3400, on_duty: 1, max_slots: 10, department: 'emergency', uniform: true,  vehicle_access: true },
    { id: 14, name: 'government',    label: 'Fonction Publique QC',          grades: 'clerk,officer,director,minister',                                    salary_base: 3000, on_duty: 0, max_slots: 8,  department: 'government',uniform: false, vehicle_access: false },
    { id: 15, name: 'electric',      label: 'Hydro-Québec',                  grades: 'apprentice,technician,senior_tech,supervisor',                       salary_base: 3400, on_duty: 0, max_slots: 6,  department: 'civil',     uniform: true,  vehicle_access: true },
    { id: 16, name: 'unemployed',    label: 'Sans Emploi',                   grades: 'none',                                                               salary_base: 500,  on_duty: 0, max_slots: 999,department: 'none',      uniform: false, vehicle_access: false },
  ]);

  // ============================================================
  //  FACTIONS — Organisations criminelles
  // ============================================================

  seed('factions', [
    { id: 1, name: 'Les Serpents',         type: 'gang',   leader_id: 5,    territory: 'Zone Industrielle / Port',     members: 15, bank: 350000,  color: '#2d6a4f', reputation: 75,  wanted_level: 3, active: true },
    { id: 2, name: 'Cartel du Nord',       type: 'cartel', leader_id: null,  territory: 'Secteur Forestier',           members: 8,  bank: 580000,  color: '#cc3333', reputation: 85,  wanted_level: 5, active: true },
    { id: 3, name: 'Fantômes de TroxT',   type: 'gang',   leader_id: 15,   territory: 'Centre-ville Est',            members: 12, bank: 220000,  color: '#6b7280', reputation: 60,  wanted_level: 2, active: true },
    { id: 4, name: 'Motards du Québec',    type: 'mc',     leader_id: null,  territory: 'Route 138 / Banlieue Sud',   members: 20, bank: 750000,  color: '#1f2937', reputation: 90,  wanted_level: 4, active: true },
    { id: 5, name: 'Syndicat Portuaire',   type: 'mafia',  leader_id: null,  territory: 'Port Industriel',            members: 6,  bank: 1200000, color: '#1e3a5f', reputation: 95,  wanted_level: 5, active: true },
  ]);

  // ============================================================
  //  BANK ACCOUNTS — Comptes bancaires
  // ============================================================

  seed('bank_accounts', [
    { id: 1,  owner_id: 1,  type: 'personal', balance: 48000,   iban: 'DJ-00001', institution: 'Desjardins', interest_rate: 0.5 },
    { id: 2,  owner_id: 2,  type: 'personal', balance: 62000,   iban: 'DJ-00002', institution: 'Desjardins', interest_rate: 0.5 },
    { id: 3,  owner_id: 3,  type: 'personal', balance: 145000,  iban: 'DJ-00003', institution: 'Desjardins', interest_rate: 0.5 },
    { id: 4,  owner_id: 3,  type: 'business', balance: 280000,  iban: 'BZ-00001', institution: 'Desjardins', interest_rate: 0.3 },
    { id: 5,  owner_id: 5,  type: 'personal', balance: 1200000, iban: 'DJ-00005', institution: 'Desjardins', interest_rate: 0.5 },
    { id: 6,  owner_id: 5,  type: 'offshore', balance: 5000000, iban: 'CY-99001', institution: 'Swiss Bank',  interest_rate: 1.2 },
    { id: 7,  owner_id: 10, type: 'personal', balance: 180000,  iban: 'DJ-00010', institution: 'Desjardins', interest_rate: 0.5 },
    { id: 8,  owner_id: 10, type: 'business', balance: 420000,  iban: 'BZ-00002', institution: 'Nationale',  interest_rate: 0.4 },
    { id: 9,  owner_id: 15, type: 'personal', balance: 5000,    iban: 'DJ-00015', institution: 'Desjardins', interest_rate: 0.5 },
  ]);

  // ============================================================
  //  INVENTORY — Inventaire des joueurs
  // ============================================================

  seed('inventory', [
    // Police — JP Tremblay
    { id: 1,  owner_id: 1,  item: 'tool_radio_police',     quantity: 1, slot: 1,  weight: 0.5, metadata: '{"freq":"SPVM-1"}' },
    { id: 2,  owner_id: 1,  item: 'tool_bodycam',          quantity: 1, slot: 2,  weight: 0.1, metadata: '{"recording":true}' },
    { id: 3,  owner_id: 1,  item: 'tool_handcuffs',        quantity: 2, slot: 3,  weight: 0.6, metadata: '{}' },
    { id: 4,  owner_id: 1,  item: 'tool_flashlight_police',quantity: 1, slot: 4,  weight: 0.4, metadata: '{}' },
    { id: 5,  owner_id: 1,  item: 'tool_taser',            quantity: 1, slot: 5,  weight: 0.4, metadata: '{"charges":2}' },
    { id: 6,  owner_id: 1,  item: 'tool_pepper_spray',     quantity: 1, slot: 6,  weight: 0.2, metadata: '{}' },

    // EMS — Marie-Ève
    { id: 7,  owner_id: 2,  item: 'tool_medical_kit',      quantity: 1, slot: 1,  weight: 3.0, metadata: '{"supplies":85}' },
    { id: 8,  owner_id: 2,  item: 'tool_defibrillator',    quantity: 1, slot: 2,  weight: 2.0, metadata: '{"battery":100}' },
    { id: 9,  owner_id: 2,  item: 'tool_stethoscope',      quantity: 1, slot: 3,  weight: 0.2, metadata: '{}' },
    { id: 10, owner_id: 2,  item: 'tool_radio_police',     quantity: 1, slot: 4,  weight: 0.5, metadata: '{"freq":"EMS-1"}' },

    // Mechanic — Marco
    { id: 11, owner_id: 3,  item: 'tool_repair_kit',       quantity: 1, slot: 1,  weight: 8.0, metadata: '{"uses":5}' },
    { id: 12, owner_id: 3,  item: 'tool_wrench',           quantity: 1, slot: 2,  weight: 3.0, metadata: '{}' },
    { id: 13, owner_id: 3,  item: 'tool_smartphone',       quantity: 1, slot: 3,  weight: 0.2, metadata: '{}' },

    // Criminal — Tony Snake
    { id: 14, owner_id: 5,  item: 'tool_lockpick',         quantity: 3, slot: 1,  weight: 0.3, metadata: '{}' },
    { id: 15, owner_id: 5,  item: 'tool_smartphone',       quantity: 2, slot: 2,  weight: 0.4, metadata: '{"encrypted":true}' },
    { id: 16, owner_id: 5,  item: 'tool_crowbar',          quantity: 1, slot: 3,  weight: 3.0, metadata: '{}' },

    // Farmer — Isabelle
    { id: 17, owner_id: 10, item: 'tool_smartphone',       quantity: 1, slot: 1,  weight: 0.2, metadata: '{}' },
    { id: 18, owner_id: 10, item: 'tool_shovel',           quantity: 1, slot: 2,  weight: 2.0, metadata: '{}' },

    // Logger — Patch
    { id: 19, owner_id: 9,  item: 'tool_chainsaw',         quantity: 1, slot: 1,  weight: 7.0, metadata: '{"fuel":80}' },
    { id: 20, owner_id: 9,  item: 'tool_radio_police',     quantity: 1, slot: 2,  weight: 0.5, metadata: '{"freq":"LOG-1"}' },

    // Criminal — Ghost
    { id: 21, owner_id: 15, item: 'tool_lockpick',         quantity: 5, slot: 1,  weight: 0.5, metadata: '{"quality":"pro"}' },
    { id: 22, owner_id: 15, item: 'tool_crowbar',          quantity: 1, slot: 2,  weight: 3.0, metadata: '{}' },
    { id: 23, owner_id: 15, item: 'tool_smartphone',       quantity: 1, slot: 3,  weight: 0.2, metadata: '{"encrypted":true,"burner":true}' },
  ]);

  // ============================================================
  //  SHOPS — Commerces du monde
  // ============================================================

  seed('shops', [
    { id: 1,  name: 'Couche-Tard Centre-Ville',  owner_id: null,  type: 'convenience', money_register: 15000,  status: 'open',   location: 'downtown',   robbery_cooldown: 0 },
    { id: 2,  name: 'Shell Station TroxT',        owner_id: null,  type: 'gas_station', money_register: 25000,  status: 'open',   location: 'highway',    robbery_cooldown: 0 },
    { id: 3,  name: 'Garage TroxT Mécanique',     owner_id: 3,     type: 'garage',      money_register: 8000,   status: 'open',   location: 'industrial', robbery_cooldown: 0 },
    { id: 4,  name: 'Jean Coutu TroxT',           owner_id: null,  type: 'pharmacy',    money_register: 12000,  status: 'open',   location: 'downtown',   robbery_cooldown: 0 },
    { id: 5,  name: 'IGA TroxT',                  owner_id: null,  type: 'grocery',     money_register: 20000,  status: 'open',   location: 'downtown',   robbery_cooldown: 0 },
    { id: 6,  name: 'La Belle Province TroxT',    owner_id: null,  type: 'restaurant',  money_register: 5000,   status: 'open',   location: 'downtown',   robbery_cooldown: 0 },
    { id: 7,  name: 'Arme & Détente (légal)',     owner_id: null,  type: 'weapon_shop', money_register: 35000,  status: 'open',   location: 'industrial', robbery_cooldown: 0 },
    { id: 8,  name: 'Casino TroxT',               owner_id: null,  type: 'casino',      money_register: 500000, status: 'open',   location: 'downtown',   robbery_cooldown: 0 },
    { id: 9,  name: 'Motel Route 138',             owner_id: null,  type: 'motel',       money_register: 3000,   status: 'open',   location: 'highway',    robbery_cooldown: 0 },
    { id: 10, name: 'Binerie du Port',             owner_id: null,  type: 'restaurant',  money_register: 4000,   status: 'open',   location: 'port',       robbery_cooldown: 0 },
  ]);

  // ============================================================
  //  WARRANTS — Mandats de justice
  // ============================================================

  seed('warrants', [
    { id: 1, target_id: 5,  type: 'arrest',  issued_by: 6,  reason: 'Trafic de stupéfiants (art. 5 LRCDAS)',        status: 'active',   priority: 'high',    expires_at: null },
    { id: 2, target_id: 11, type: 'search',  issued_by: 1,  reason: 'Recel de biens volés (art. 354 C.cr.)',        status: 'active',   priority: 'medium',  expires_at: null },
    { id: 3, target_id: 15, type: 'arrest',  issued_by: 6,  reason: 'Introduction par effraction (art. 348 C.cr.)', status: 'active',   priority: 'high',    expires_at: null },
    { id: 4, target_id: 15, type: 'search',  issued_by: 1,  reason: 'Possession arme prohibée (art. 92 C.cr.)',     status: 'active',   priority: 'urgent',  expires_at: null },
  ]);

  // ============================================================
  //  INCIDENTS — Rapports d'incidents
  // ============================================================

  seed('incidents', [
    { id: 1,  type: 'traffic_stop',    officer_id: 1,  suspect_id: 11,   location: 'Boul. Laurier / Rue des Pins',  description: 'Excès de vitesse 120 dans zone 50',    status: 'closed',  fine: 850,   points: 4, date: '2025-06-15T14:30:00' },
    { id: 2,  type: 'robbery',         officer_id: 6,  suspect_id: 5,    location: 'Couche-Tard Centre-Ville',      description: 'Vol qualifié à main armée',             status: 'open',    fine: 0,     points: 0, date: '2025-06-18T22:15:00' },
    { id: 3,  type: 'drug_bust',       officer_id: 6,  suspect_id: null, location: 'Entrepôt Abandonné, Industriel',description: 'Saisie 5kg cannabis illicite',           status: 'investigating', fine: 0, points: 0, date: '2025-06-19T03:45:00' },
    { id: 4,  type: 'structure_fire',  officer_id: 7,  suspect_id: null, location: 'Rang Saint-Joseph, Grange #2',  description: 'Incendie grange 2ème alarme',           status: 'closed',  fine: 0,     points: 0, date: '2025-06-17T18:00:00' },
    { id: 5,  type: 'medical',         officer_id: 2,  suspect_id: null, location: 'Parc Municipal TroxT',          description: 'ACR homme 55 ans joggeur',              status: 'closed',  fine: 0,     points: 0, date: '2025-06-20T08:12:00' },
    { id: 6,  type: 'car_theft',       officer_id: 1,  suspect_id: 15,   location: 'Stationnement IGA',             description: 'Vol Civic gris — suspect filmé',        status: 'open',    fine: 0,     points: 0, date: '2025-06-20T11:30:00' },
  ]);

  // ============================================================
  //  LICENSES — Permis et licences
  // ============================================================

  seed('licenses', [
    { id: 1,  owner_id: 1,  type: 'driver_class5',  status: 'valid',    issued_date: '2020-03-15', expiry_date: '2028-03-15', points: 0,  suspensions: 0 },
    { id: 2,  owner_id: 1,  type: 'firearm',         status: 'valid',    issued_date: '2022-01-10', expiry_date: '2027-01-10', points: 0,  suspensions: 0 },
    { id: 3,  owner_id: 2,  type: 'driver_class5',  status: 'valid',    issued_date: '2019-06-20', expiry_date: '2027-06-20', points: 0,  suspensions: 0 },
    { id: 4,  owner_id: 3,  type: 'driver_class5',  status: 'valid',    issued_date: '2015-09-01', expiry_date: '2027-09-01', points: 2,  suspensions: 0 },
    { id: 5,  owner_id: 5,  type: 'driver_class5',  status: 'valid',    issued_date: '2018-11-20', expiry_date: '2026-11-20', points: 6,  suspensions: 1 },
    { id: 6,  owner_id: 5,  type: 'firearm',         status: 'revoked',  issued_date: '2020-05-15', expiry_date: '2025-05-15', points: 0,  suspensions: 2 },
    { id: 7,  owner_id: 5,  type: 'pilot',           status: 'valid',    issued_date: '2023-02-01', expiry_date: '2028-02-01', points: 0,  suspensions: 0 },
    { id: 8,  owner_id: 9,  type: 'driver_class3',  status: 'valid',    issued_date: '2016-04-10', expiry_date: '2028-04-10', points: 0,  suspensions: 0 },
    { id: 9,  owner_id: 10, type: 'driver_class5',  status: 'valid',    issued_date: '2010-08-15', expiry_date: '2026-08-15', points: 0,  suspensions: 0 },
    { id: 10, owner_id: 11, type: 'driver_class5',  status: 'suspended',issued_date: '2019-12-01', expiry_date: '2027-12-01', points: 12, suspensions: 2 },
    { id: 11, owner_id: 15, type: 'driver_class5',  status: 'valid',    issued_date: '2017-07-22', expiry_date: '2027-07-22', points: 4,  suspensions: 1 },
    { id: 12, owner_id: 15, type: 'firearm',         status: 'valid',    issued_date: '2023-09-01', expiry_date: '2028-09-01', points: 0,  suspensions: 0 },
  ]);

  // ============================================================
  //  PHONE CONTACTS — Répertoire téléphonique
  // ============================================================

  seed('phone_contacts', [
    // Jean-Philippe contacts
    { id: 1,  owner_id: 1, contact_id: 6,  name: 'Sarah-Jade (Partenaire)',  favorite: true },
    { id: 2,  owner_id: 1, contact_id: 2,  name: 'Marie-Ève EMS',           favorite: false },
    { id: 3,  owner_id: 1, contact_id: 7,  name: 'Maxime Pompier',          favorite: false },

    // Tony contacts
    { id: 4,  owner_id: 5, contact_id: 15, name: 'Ghost',                   favorite: true },
    { id: 5,  owner_id: 5, contact_id: 11, name: 'KG (Runner)',             favorite: false },

    // Ghost contacts
    { id: 6,  owner_id: 15, contact_id: 5,  name: 'Snake (Boss)',           favorite: true },
    { id: 7,  owner_id: 15, contact_id: 11, name: 'KG',                    favorite: false },
  ]);

  // ============================================================
  //  PHONE MESSAGES — SMS
  // ============================================================

  seed('phone_messages', [
    { id: 1, sender_id: 5,  receiver_id: 15, text: 'Livraison ce soir au port. Container bleu #7.',   read: true,  date: '2025-06-19T20:15:00' },
    { id: 2, sender_id: 15, receiver_id: 5,  text: 'Reçu. Je prends le quad par la forêt.',           read: true,  date: '2025-06-19T20:18:00' },
    { id: 3, sender_id: 5,  receiver_id: 11, text: 'Va faire le tour du dépanneur. Check les caméras.',read: true, date: '2025-06-20T09:00:00' },
    { id: 4, sender_id: 1,  receiver_id: 6,  text: 'Briefing 14h. On a un mandat pour Moretti.',      read: true,  date: '2025-06-20T10:30:00' },
    { id: 5, sender_id: 6,  receiver_id: 1,  text: 'Parfait. J\'ai le dossier prêt.',                 read: true,  date: '2025-06-20T10:32:00' },
  ]);

  // ============================================================
  //  VEHICLES IMPOUND — Fourrière
  // ============================================================

  seed('impound', [
    { id: 1, vehicle_id: 7,  reason: 'Saisie lors perquisition — preuve',     impound_date: '2025-06-15T16:00:00', release_date: null,  fee: 500,  officer_id: 1,  status: 'held' },
    { id: 2, vehicle_id: 14, reason: 'Abandon + plaque expirée',              impound_date: '2025-06-18T09:00:00', release_date: null,  fee: 250,  officer_id: 1,  status: 'pending_release' },
  ]);

  // ============================================================
  //  BILLING / INVOICES — Factures
  // ============================================================

  seed('invoices', [
    { id: 1, from_id: 3,    to_id: 4,    type: 'mechanic',    amount: 350,   description: 'Changement huile + freins',         status: 'paid',    date: '2025-06-14T11:00:00' },
    { id: 2, from_id: null,  to_id: 11,   type: 'fine',        amount: 850,   description: 'Excès de vitesse 120/50',           status: 'unpaid',  date: '2025-06-15T14:35:00' },
    { id: 3, from_id: null,  to_id: 5,    type: 'fine',        amount: 1500,  description: 'Conduite dangereuse art. 249 C.cr.',status: 'unpaid',  date: '2025-06-10T22:00:00' },
    { id: 4, from_id: 2,    to_id: 13,   type: 'medical',     amount: 0,     description: 'Transport ambulancier RAMQ',        status: 'paid',    date: '2025-06-12T08:15:00' },
    { id: 5, from_id: null,  to_id: 5,    type: 'property_tax',amount: 4500,  description: 'Taxes foncières 2025 — Penthouse',  status: 'unpaid',  date: '2025-01-01T00:00:00' },
  ]);

  console.log(`🌱 World seed terminé: ${tables.length} tables, ${totalRows} lignes`);

  return { tables, totalRows };
}
// server/agents/ether-weave/EtherWeave.ts
// ============================================================
//  ETHER-WEAVE — Agent connecteur de modules
//  Relie les systèmes ensemble, définit les flux de données
// ============================================================

import { BaseAgent, type AgentTaskPacket } from '../BaseAgent';

export interface Connection {
  from:   string;
  to:     string;
  event:  string;
  status: 'connected' | 'missing' | 'partial';
  note?:  string;
}

export interface DataFlow {
  name:  string;
  steps: string[];
}

export interface WeaveReport {
  agent:       'ether-weave';
  task:        string;
  connections: Connection[];
  dataFlows:   DataFlow[];
  missing:     string[];
  status:      'completed' | 'partial' | 'failed';
  warnings:    string[];
  priority:    string[];
}

export class EtherWeave extends BaseAgent {

  constructor() {
    super('ether-weave');

    this.intellectus.contracts.register('weave:output', {
      name:        'EtherWeave Output',
      description: 'Rapport de connexion Ether-Weave',
      rules: [
        { field: 'task',        type: 'string', required: true },
        { field: 'connections', type: 'array',  required: true },
        { field: 'dataFlows',   type: 'array',  required: true },
        { field: 'status',      type: 'string', required: true },
      ],
    });
  }

  protected async _process(packet: AgentTaskPacket): Promise<WeaveReport> {
    const mission = packet.mission.toLowerCase();

    let report: WeaveReport;

    if (mission.includes('property') || mission.includes('immobilier')) {
      report = this._connectPropertySystem();
    } else if (mission.includes('inventory') || mission.includes('inventaire')) {
      report = this._connectInventorySystem();
    } else if (mission.includes('intellectus')) {
      report = this._connectIntellectus();
    } else if (mission.includes('brain') || mission.includes('agent')) {
      report = this._connectBrainAgents();
    } else {
      report = this._connectGeneric(packet.mission);
    }

    // Valider contrat
    this.intellectus.contracts.validate('weave:output', report);

    // Stocker en mémoire
    this.intellectus.memory.set(`weave:${report.task.replace(/\s/g, '_')}`, report, {
      source: 'ether-weave',
      tags:   ['weave', 'connections', report.status],
      ttl:    600000,
    });

    return report;
  }

  private _connectPropertySystem(): WeaveReport {
    return {
      agent: 'ether-weave',
      task:  'Property System Connections',
      connections: [
        { from: 'PurchaseSystem',   to: 'InventorySystem',  event: 'property:buy → inventory:addKey + inventory:addDeed',     status: 'connected' },
        { from: 'PurchaseSystem',   to: 'KeySystem',        event: 'property:buy → key:create',                              status: 'connected' },
        { from: 'KeySystem',        to: 'DoorAccessSystem', event: 'key:check → door:open',                                  status: 'connected' },
        { from: 'FurnitureSave',    to: 'DatabaseAdapter',  event: 'furniture:save → db:upsert',                             status: 'missing',  note: 'À implémenter' },
        { from: 'PropertyRouter',   to: 'EventBus',         event: 'Tous les events property:*',                             status: 'connected' },
        { from: 'HouseWheel',       to: 'PropertyAPI',      event: 'ui:buy → POST /api/property/:id/buy',                    status: 'connected' },
        { from: 'ForSaleSign',      to: 'HouseWheel',       event: 'sign:click → wheel:open',                                status: 'connected' },
        { from: 'PropertySystem',   to: 'Intellectus Memory',event: 'property:buy → memory.set(property:cache)',             status: 'missing',  note: 'À brancher' },
        { from: 'PurchaseSystem',   to: 'EconomySystem',    event: 'property:buy → economy:debit',                          status: 'missing',  note: 'EconomySystem à créer' },
        { from: 'AccessSystem',     to: 'DatabaseAdapter',  event: 'access:grant → db:persistAccess',                       status: 'missing',  note: 'À implémenter' },
      ],
      dataFlows: [
        {
          name: 'Achat propriété complet',
          steps: [
            'Player → ForSaleSign.click()',
            'ForSaleSign → HouseWheel.open()',
            'HouseWheel → POST /api/property/:id/buy',
            'Server → PurchaseSystem.buyProperty()',
            'PurchaseSystem → EconomySystem.debit(price)',
            'PurchaseSystem → PropertyRegistry.setOwner(playerId)',
            'PurchaseSystem → KeySystem.createKeyring(playerId, doors)',
            'KeySystem → InventorySystem.addKeyring(playerId, keyring)',
            'PurchaseSystem → InventorySystem.addDeed(playerId, deed)',
            'PurchaseSystem → AccessSystem.grant(propertyId, playerId, owner)',
            'Server → EventBus.emit(property:buy, data)',
            'Response → keyring + deed + message',
          ],
        },
        {
          name: 'Aménagement intérieur',
          steps: [
            'Player → DecorationMode.open()',
            'Player → FurnitureCatalog.select(itemId)',
            'Player → FurniturePlacement.place(position)',
            'Client → POST /api/property/:id/furniture',
            'Server → AccessSystem.canEdit(playerId, propertyId)',
            'Server → FurnitureSaveSystem.save(placements)',
            'FurnitureSaveSystem → DatabaseAdapter.upsert(placements)',
            'EventBus.emit(furniture:saved)',
          ],
        },
      ],
      missing: [
        'EconomySystem.debit() — À créer',
        'AccessSystem persistance DB — À implémenter',
        'FurnitureSave → DB connexion — À implémenter',
        'Intellectus Memory cache propriétés — À brancher',
      ],
      status:   'partial',
      warnings: [
        'FurnitureSaveSystem ne persiste pas en DB',
        'AccessSystem ne persiste pas les accès',
        'EconomySystem non implémenté',
      ],
      priority: [
        '1. Connecter FurnitureSave → DatabaseAdapter',
        '2. Implémenter EconomySystem.debit()',
        '3. Persister AccessSystem en DB',
        '4. Brancher Intellectus Memory pour cache',
      ],
    };
  }

  private _connectInventorySystem(): WeaveReport {
    return {
      agent: 'ether-weave',
      task:  'Inventory System Connections',
      connections: [
        { from: 'InventoryManager', to: 'DatabaseAdapter', event: 'inventory:add → db:insert(inventory)',     status: 'connected' },
        { from: 'InventoryManager', to: 'EventBus',        event: 'inventory:add/remove → broadcast',        status: 'connected' },
        { from: 'KeySystem',        to: 'InventoryManager',event: 'property:buy → inventory:addKeyring',     status: 'connected' },
        { from: 'PropertySystem',   to: 'InventoryManager',event: 'property:buy → inventory:addDeed',        status: 'connected' },
        { from: 'InventoryManager', to: 'Intellectus',     event: 'inventory:use → memory.set(item:used)',   status: 'missing',  note: 'À brancher' },
        { from: 'WebSocket',        to: 'InventoryManager',event: 'client:inventory:use → server:validate',  status: 'missing',  note: 'WS handler à créer' },
      ],
      dataFlows: [
        {
          name: 'Ajout item inventaire',
          steps: [
            'Source (KeySystem/PropertySystem/Server)',
            'POST /api/inventory/:playerId/add',
            'InventoryManager.addItem(playerId, item)',
            'DatabaseAdapter.insert(inventory, item)',
            'EventBus.emit(inventory:add, { playerId, item })',
            'WebSocket → INVENTORY_UPDATE packet → Client',
          ],
        },
        {
          name: 'Utilisation item',
          steps: [
            'Player → Client.useItem(itemId)',
            'WebSocket → INVENTORY_USE packet → Server',
            'POST /api/inventory/:playerId/use',
            'InventoryManager.useItem(itemId)',
            'Apply effect (heal / open door / spawn vehicle)',
            'EventBus.emit(inventory:use, result)',
          ],
        },
      ],
      missing: [
        'WebSocket handler INVENTORY_USE',
        'Intellectus Memory pour cache inventaires',
        'Sync inventaire côté client (Zustand)',
      ],
      status:   'partial',
      warnings: ['WebSocket inventory handler manquant'],
      priority: [
        '1. Ajouter WS handler pour INVENTORY_USE',
        '2. Brancher Intellectus Memory cache',
        '3. Sync state Zustand côté client',
      ],
    };
  }

  private _connectIntellectus(): WeaveReport {
    return {
      agent: 'ether-weave',
      task:  'Intellectus Connections',
      connections: [
        { from: 'TroxTBrain',         to: 'ServerIntellectus', event: 'decision → memory.set(brain:decision)',        status: 'connected' },
        { from: 'ThirdEye',           to: 'ServerIntellectus', event: 'alert → memory.set(thirdeye:alert)',           status: 'connected' },
        { from: 'EtherForge',         to: 'ServerIntellectus', event: 'result → memory.set(forge:result)',            status: 'connected' },
        { from: 'EtherLens',          to: 'ServerIntellectus', event: 'report → memory.set(lens:report)',             status: 'connected' },
        { from: 'EtherPrism',         to: 'ServerIntellectus', event: 'categories → memory.set(prism:categories)',   status: 'connected' },
        { from: 'EtherWeave',         to: 'ServerIntellectus', event: 'connections → memory.set(weave:connections)', status: 'connected' },
        { from: 'ForgeFactory',       to: 'ServerIntellectus', event: 'status → telemetry + memory',                  status: 'connected' },
        { from: 'ServerIntellectus',  to: 'DatabaseAdapter',   event: 'shutdown → memory.snapshot() → db.save()',    status: 'missing',  note: 'À implémenter' },
        { from: 'PropertySystem',     to: 'ServerIntellectus', event: 'property:buy → memory.set(property:cache)',   status: 'missing',  note: 'À brancher' },
        { from: 'ServerIntellectus',  to: 'EventBus',          event: 'intellectus:alert → bus.emit()',               status: 'connected' },
      ],
      dataFlows: [
        {
          name: 'Flux cognitif Brain → Memory → ThirdEye',
          steps: [
            'User request → TroxTBrain.process()',
            'Brain → Intellectus.memory.set(request:context)',
            'Brain → AgentBus.dispatch(task)',
            'Agent → execute() → result',
            'Brain → Intellectus.memory.set(decision:result)',
            'ThirdEye → memory.query(recent:decisions)',
            'ThirdEye → score + alert → memory.set(alert)',
            'EventBus.emit(thirdeye:alert)',
          ],
        },
      ],
      missing: [
        'Persistence mémoire Intellectus au shutdown',
        'Cache PropertySystem → Intellectus',
        'Cache InventorySystem → Intellectus',
        'Dashboard UI pour visualiser les connexions',
      ],
      status:   'partial',
      warnings: ['Mémoire Intellectus non persistée au restart'],
      priority: [
        '1. Persister Intellectus Memory au shutdown (db.save)',
        '2. Brancher PropertySystem → Memory cache',
        '3. Brancher InventorySystem → Memory cache',
        '4. Ajouter dashboard /etherprism onglet Intellectus',
      ],
    };
  }

  private _connectBrainAgents(): WeaveReport {
    return {
      agent: 'ether-weave',
      task:  'Brain-Agents Connections',
      connections: [
        { from: 'TroxTBrain',  to: 'AgentBus',     event: 'plan:step → bus.dispatch(taskPacket)',         status: 'connected' },
        { from: 'AgentBus',    to: 'EtherForge',   event: 'task:ether-forge → forge.execute()',           status: 'connected' },
        { from: 'AgentBus',    to: 'EtherLens',    event: 'task:ether-lens → lens.execute()',             status: 'connected' },
        { from: 'AgentBus',    to: 'EtherPrism',   event: 'task:ether-prism → prism.execute()',          status: 'connected' },
        { from: 'AgentBus',    to: 'EtherWeave',   event: 'task:ether-weave → weave.execute()',          status: 'connected' },
        { from: 'AgentBus',    to: 'ForgeFactory', event: 'task:forge-factory → factory.execute()',      status: 'connected' },
        { from: 'EtherForge',  to: 'ThirdEye',     event: 'result → thirdeye.scoreResult()',             status: 'connected' },
        { from: 'EtherLens',   to: 'ThirdEye',     event: 'audit → thirdeye.validatePlan()',             status: 'connected' },
        { from: 'ThirdEye',    to: 'TroxTBrain',   event: 'alert:RED/BLACK → brain.blockStep()',         status: 'connected' },
        { from: 'TroxTBrain',  to: 'EventBus',     event: 'decision:complete → bus.emit(brain:decision)',status: 'connected' },
      ],
      dataFlows: [
        {
          name: 'Orchestration Brain complète',
          steps: [
            '1. Request → TroxTBrain.process()',
            '2. Brain → classify(type) + createPlan(steps)',
            '3. ThirdEye.assessRequest() → GREEN/YELLOW/ORANGE/RED',
            '4. Brain → AgentBus.dispatch(step[0])',
            '5. Agent → execute() → TaskResult',
            '6. ThirdEye.scoreResult() → 0-100',
            '7. Brain → next step ou correction',
            '8. Brain → BrainDecision finale',
            '9. EventBus.emit(brain:decision)',
          ],
        },
      ],
      missing: [],
      status:   'completed',
      warnings: [],
      priority: ['Architecture Brain-Agents opérationnelle'],
    };
  }

  private _connectGeneric(mission: string): WeaveReport {
    return {
      agent: 'ether-weave',
      task:  mission.slice(0, 80),
      connections: [
        { from: 'ModuleA', to: 'ModuleB', event: 'event:generic', status: 'missing', note: 'Spécifier les modules à connecter' },
      ],
      dataFlows: [],
      missing:   ['Modules à connecter non spécifiés'],
      status:    'partial',
      warnings:  ['Utiliser une cible précise: property/inventory/intellectus/brain'],
      priority:  ['Préciser les systèmes à connecter'],
    };
  }
}
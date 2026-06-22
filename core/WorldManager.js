export class WorldManager {
  constructor() {
    this.props    = new Map();
    this.vehicles = new Map();
    this.zones    = new Map();
    this.npcs     = new Map();

    this._initZones();
    console.log("\x1b[34m[WorldManager] Monde sandbox initialise\x1b[0m");
  }

  // ── Props (style GMod toolgun) ──────────────────────────────────────────────
  spawnProp(type, position, owner = "world") {
    const id = crypto.randomUUID();
    const prop = {
      id, type, owner,
      position: position || { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      frozen:   false,
      spawnedAt: Date.now()
    };
    this.props.set(id, prop);
    console.log(`\x1b[34m[World] Prop spawne: ${type} par ${owner} en (${prop.position.x},${prop.position.y},${prop.position.z})\x1b[0m`);
    return prop;
  }

  deleteProp(id) {
    const existed = this.props.has(id);
    this.props.delete(id);
    return existed;
  }

  clearProps(owner = null) {
    if (!owner) { this.props.clear(); return; }
    for (const [id, p] of this.props) {
      if (p.owner === owner) this.props.delete(id);
    }
  }

  getProps() { return Array.from(this.props.values()); }

  // ── Vehicules spawnés ───────────────────────────────────────────────────────
  spawnVehicle(model, position, owner = "world") {
    const id = crypto.randomUUID();
    const veh = {
      id, model, owner,
      position:  position || { x: 0, y: 0, z: 0 },
      health:    1000,
      fuel:      100,
      locked:    false,
      driver:    null,
      spawnedAt: Date.now()
    };
    this.vehicles.set(id, veh);
    console.log(`\x1b[34m[World] Vehicule spawne: ${model} par ${owner}\x1b[0m`);
    return veh;
  }

  deleteVehicle(id) {
    const existed = this.vehicles.has(id);
    this.vehicles.delete(id);
    return existed;
  }

  getVehicles() { return Array.from(this.vehicles.values()); }

  // ── Zones (style GTA blips) ─────────────────────────────────────────────────
  addZone(name, center, radius, type = "info") {
    const zone = { name, center, radius, type, createdAt: Date.now() };
    this.zones.set(name, zone);
    console.log(`\x1b[34m[World] Zone ajoutee: ${name} (r=${radius})\x1b[0m`);
    return zone;
  }

  getZoneAt(position) {
    for (const zone of this.zones.values()) {
      const dx = position.x - zone.center.x;
      const dz = position.z - zone.center.z;
      if (Math.sqrt(dx*dx + dz*dz) <= zone.radius) return zone;
    }
    return null;
  }

  getZones() { return Array.from(this.zones.values()); }

  // ── NPCs ────────────────────────────────────────────────────────────────────
  spawnNPC(name, position, role = "civilian") {
    const id = crypto.randomUUID();
    const npc = {
      id, name, role,
      position: position || { x: 0, y: 0, z: 0 },
      health:   100,
      dialogue: [],
      spawnedAt: Date.now()
    };
    this.npcs.set(id, npc);
    console.log(`\x1b[34m[World] NPC spawne: ${name} (${role})\x1b[0m`);
    return npc;
  }

  getNPCs() { return Array.from(this.npcs.values()); }

  // ── Etat complet du monde ───────────────────────────────────────────────────
  getState() {
    return {
      props:    this.getProps(),
      vehicles: this.getVehicles(),
      zones:    this.getZones(),
      npcs:     this.getNPCs(),
      counts: {
        props:    this.props.size,
        vehicles: this.vehicles.size,
        zones:    this.zones.size,
        npcs:     this.npcs.size
      }
    };
  }

  // ── Serialisation pour persistance ─────────────────────────────────────────
  serialize() {
    return {
      props:    this.getProps(),
      vehicles: this.getVehicles(),
      zones:    this.getZones(),
      npcs:     this.getNPCs()
    };
  }

  hydrate(data) {
    if (!data) return;
    if (data.props)    data.props.forEach(p    => this.props.set(p.id, p));
    if (data.vehicles) data.vehicles.forEach(v => this.vehicles.set(v.id, v));
    if (data.zones)    data.zones.forEach(z    => this.zones.set(z.name, z));
    if (data.npcs)     data.npcs.forEach(n     => this.npcs.set(n.id, n));
    console.log(`\x1b[34m[World] Monde restaure: ${this.props.size} props, ${this.vehicles.size} vehicules, ${this.zones.size} zones\x1b[0m`);
  }

  // ── Zones par defaut ────────────────────────────────────────────────────────
  _initZones() {
    this.addZone("spawn",    { x: 0,   y: 0, z: 0   }, 5,  "safe");
    this.addZone("hospital", { x: 20,  y: 0, z: 10  }, 8,  "ems");
    this.addZone("police",   { x: -20, y: 0, z: 10  }, 8,  "police");
    this.addZone("garage",   { x: 15,  y: 0, z: -15 }, 7,  "garage");
    this.addZone("bank",     { x: -10, y: 0, z: -20 }, 6,  "robbery");
    this.addZone("market",   { x: 25,  y: 0, z: -5  }, 5,  "shop");
    this.addZone("darkzone", { x: -30, y: 0, z: -30 }, 10, "danger");
  }
}

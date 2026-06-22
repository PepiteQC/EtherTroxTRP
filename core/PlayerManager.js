export class PlayerManager {
  constructor() {
    this.players = new Map();
    console.log("\x1b[32m[PlayerManager] Systeme joueurs initialise\x1b[0m");
  }

  ensurePlayer(id) {
    if (!this.players.has(id)) {
      this.players.set(id, {
        id, name:id, connected:false,
        job:"Civilian", money:500, wanted:0,
        health:100, armor:0, inventory:[],
        vehicle:null, position:{x:0,y:0,z:0},
        createdAt:Date.now(), updatedAt:Date.now()
      });
    }
    return this.players.get(id);
  }

  connect(id, name=null) {
    const p = this.ensurePlayer(id);
    p.connected = true;
    if (name) p.name = name;
    p.updatedAt = Date.now();
    return p;
  }

  disconnect(id) {
    const p = this.ensurePlayer(id);
    p.connected  = false;
    p.updatedAt  = Date.now();
    return p;
  }

  updatePosition(id, pos) {
    const p = this.ensurePlayer(id);
    p.position  = { x:Number(pos?.x||0), y:Number(pos?.y||0), z:Number(pos?.z||0) };
    p.updatedAt = Date.now();
    return p;
  }

  setJob(id, job)       { const p=this.ensurePlayer(id); p.job=job||"Civilian"; p.updatedAt=Date.now(); return p; }
  addMoney(id, n)       { const p=this.ensurePlayer(id); p.money+=Number(n||0); p.updatedAt=Date.now(); return p; }
  setMoney(id, n)       { const p=this.ensurePlayer(id); p.money=Number(n||0);  p.updatedAt=Date.now(); return p; }
  setWanted(id, n)      { const p=this.ensurePlayer(id); p.wanted=Math.max(0,Math.min(5,Number(n||0))); p.updatedAt=Date.now(); return p; }
  setHealth(id, n)      { const p=this.ensurePlayer(id); p.health=Math.max(0,Math.min(100,Number(n||100))); p.updatedAt=Date.now(); return p; }
  setVehicle(id, v)     { const p=this.ensurePlayer(id); p.vehicle=v||null; p.updatedAt=Date.now(); return p; }
  addItem(id, item)     { const p=this.ensurePlayer(id); if(item) p.inventory.push(item); p.updatedAt=Date.now(); return p; }
  removeItem(id, item)  { const p=this.ensurePlayer(id); const i=p.inventory.indexOf(item); if(i!==-1) p.inventory.splice(i,1); p.updatedAt=Date.now(); return p; }
  getPlayer(id)         { return this.players.get(id)||null; }
  getAllPlayers()        { return Array.from(this.players.values()); }
  getConnectedPlayers() { return this.getAllPlayers().filter(p=>p.connected); }

  getState() {
    const all = this.getAllPlayers();
    return { totalPlayers:all.length, connectedPlayers:all.filter(p=>p.connected).length, players:all };
  }
}

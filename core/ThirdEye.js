export class ThirdEye {
  constructor() {
    this.isActive     = true;
    this.observations = new Map();
    this.events       = [];
    console.log("\x1b[36m[ThirdEye] Systeme observation actif\x1b[0m");
  }

  scan(target) {
    const obs = {
      id:          crypto.randomUUID(),
      target,
      timestamp:   Date.now(),
      position:    { x: 0, y: 0, z: 0 },
      threatLevel: Math.random() > 0.7 ? "HIGH" : "LOW",
      tags:        ["entity","scanned"]
    };
    this.observations.set(target, obs);
    this.events.push({ type:"SCAN", obs });
    console.log(`\x1b[36m[ThirdEye] Scan -> ${target} | Threat: ${obs.threatLevel}\x1b[0m`);
    return obs;
  }

  watchPlayer(playerId, data) {
    const w = {
      playerId,
      position:  data.position || { x:0,y:0,z:0 },
      health:    data.health   || 100,
      job:       data.job      || "Civilian",
      wanted:    data.wanted   || 0,
      timestamp: Date.now()
    };
    this.observations.set(`player:${playerId}`, w);
    return w;
  }

  getAll()  { return Array.from(this.observations.values()); }

  report() {
    return {
      active:            this.isActive,
      totalObservations: this.observations.size,
      totalEvents:       this.events.length,
      observations:      this.getAll()
    };
  }
}

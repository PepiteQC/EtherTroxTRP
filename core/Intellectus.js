export class Intellectus {
  constructor() {
    this.memory = [];
    this.rules  = new Map();
    this.sandboxState = {
      mode:        "sandbox",
      playerCount: 0,
      worldEvents: [],
      weather:     "sunny",
      hour:        12
    };
    this.rules.set("spawn",   (c) => `Spawn autorise pour ${c.player}`);
    this.rules.set("ban",     (c) => `Joueur ${c.player} banni : ${c.reason}`);
    this.rules.set("give",    (c) => `Objet "${c.item}" donne a ${c.player}`);
    this.rules.set("tp",      (c) => `Teleportation de ${c.player} vers ${c.dest}`);
    this.rules.set("noclip",  (c) => `Noclip ${c.enabled?"active":"desactive"} pour ${c.player}`);
    console.log("\x1b[35m[Intellectus] Moteur IA sandbox initialise\x1b[0m");
  }

  think(prompt, context = {}) {
    const t = {
      id:         crypto.randomUUID(),
      prompt,
      context,
      response:   this._process(prompt, context),
      confidence: Math.random() * 0.4 + 0.6,
      timestamp:  Date.now()
    };
    this.memory.push(t);
    console.log(`\x1b[35m[Intellectus] Pensee: "${prompt}"\x1b[0m`);
    return t;
  }

  applyRule(name, context) {
    const rule = this.rules.get(name);
    if (!rule) return { success:false, message:`Regle inconnue: ${name}` };
    const result = rule(context);
    this.sandboxState.worldEvents.push({ rule:name, context, result, timestamp:Date.now() });
    console.log(`\x1b[35m[Intellectus] Regle "${name}" appliquee\x1b[0m`);
    return { success:true, result };
  }

  addRule(name, handler) { this.rules.set(name, handler); }
  getRecentMemory(n=5)   { return this.memory.slice(-n); }

  getWorldState() {
    return { ...this.sandboxState, memorySize: this.memory.length, rulesCount: this.rules.size };
  }

  _process(prompt, ctx) {
    const l = prompt.toLowerCase();
    if (l.includes("spawn"))   return `Spawner: ${ctx.item||"objet inconnu"}`;
    if (l.includes("ban"))     return `Moderation: ${ctx.player||"inconnu"}`;
    if (l.includes("weather")) return "Modification meteo sandbox";
    if (l.includes("time"))    return "Modification heure du monde";
    if (l.includes("reset"))   return "Reset complet du sandbox";
    return `Action traitee: "${prompt}"`;
  }
}

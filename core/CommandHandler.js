export class CommandHandler {
  constructor(thirdEye, intellectus, playerManager, worldManager) {
    this.thirdEye      = thirdEye;
    this.intellectus   = intellectus;
    this.playerManager = playerManager;
    this.worldManager  = worldManager;
    this.commands      = new Map();
    this.history       = [];
    this._reg();
    console.log("\x1b[33m[CommandHandler] Systeme de commandes pret\x1b[0m");
  }

  register(name, desc, fn) {
    this.commands.set(name, { name, description:desc, handler:fn });
    console.log(`\x1b[33m[CMD] Commande enregistree: /${name}\x1b[0m`);
  }

  execute(raw, player = "console") {
    const [name, ...args] = raw.trim().replace(/^\//, "").split(" ");
    const cmd   = this.commands.get(name);
    const entry = { raw, player, timestamp:Date.now(), success:false, result:null };

    if (!cmd) {
      entry.result = `Commande inconnue: /${name}`;
      this.history.push(entry);
      return entry;
    }

    try {
      entry.result  = cmd.handler({ args, player, raw });
      entry.success = true;
      console.log(`\x1b[33m[CMD] ${player} -> /${name} ${args.join(" ")}\x1b[0m`);
    } catch(e) {
      entry.result = `Erreur: ${e.message}`;
    }

    this.history.push(entry);
    return entry;
  }

  getCommands() {
    return Array.from(this.commands.values())
      .map(c => ({ name:c.name, description:c.description }));
  }

  _reg() {
    const I = this.intellectus;
    const T = this.thirdEye;
    const P = this.playerManager;
    const W = this.worldManager;

    // ── Aide ──────────────────────────────────────────────────────────────────
    this.register("help", "Liste des commandes", () =>
      Array.from(this.commands.values())
        .map(c => `/${c.name} - ${c.description}`)
        .join("\n")
    );

    // ── Joueurs ───────────────────────────────────────────────────────────────
    this.register("players", "Lister les joueurs", () => {
      const all = P.getAllPlayers();
      if (!all.length) return "Aucun joueur";
      return all.map(p =>
        `${p.connected?"[ON]":"[OFF]"} ${p.name} | ${p.job} | $${p.money} | W:${p.wanted} | ${p.vehicle||"a pied"} | ${p.health}HP`
      ).join("\n");
    });

    this.register("player", "Voir un joueur", ({ args }) => {
      const t = args[0]; if (!t) return "Usage: /player <id>";
      const p = P.ensurePlayer(t);
      return [
        `Joueur: ${p.name}`,
        `Job: ${p.job} | Argent: $${p.money}`,
        `Sante: ${p.health}HP | Armure: ${p.armor}`,
        `Wanted: ${p.wanted} | Vehicule: ${p.vehicle||"aucun"}`,
        `Position: (${p.position.x}, ${p.position.y}, ${p.position.z})`,
        `Inventaire: ${p.inventory.length ? p.inventory.join(", ") : "vide"}`
      ].join("\n");
    });

    this.register("setjob", "Definir un job", ({ args }) => {
      const [t, ...j] = args;
      if (!t || !j.length) return "Usage: /setjob <joueur> <job>";
      const p = P.setJob(t, j.join(" "));
      return `${p.name} est maintenant ${p.job}`;
    });

    this.register("money", "Ajouter argent", ({ args }) => {
      const [t, n] = args;
      if (!t || !n) return "Usage: /money <joueur> <montant>";
      const p = P.addMoney(t, Number(n));
      return `${p.name} a $${p.money} (+${n})`;
    });

    this.register("setmoney", "Definir argent exact", ({ args }) => {
      const [t, n] = args;
      if (!t || !n) return "Usage: /setmoney <joueur> <montant>";
      const p = P.setMoney(t, Number(n));
      return `${p.name} a maintenant $${p.money}`;
    });

    this.register("wanted", "Definir wanted level", ({ args }) => {
      const [t, n] = args;
      if (!t || n === undefined) return "Usage: /wanted <joueur> <0-5>";
      const p = P.setWanted(t, Number(n));
      return `Wanted de ${p.name}: ${"★".repeat(p.wanted)||"0"}`;
    });

    this.register("vehicle", "Assigner vehicule", ({ args }) => {
      const [t, v] = args;
      if (!t || !v) return "Usage: /vehicle <joueur> <vehicule>";
      const p = P.setVehicle(t, v);
      return `${p.name} conduit: ${p.vehicle}`;
    });

    this.register("heal", "Soigner un joueur", ({ args, player }) => {
      const t = args[0] || player;
      const p = P.setHealth(t, 100);
      return `${p.name} soigne (100 HP)`;
    });

    this.register("kill", "Tuer un joueur", ({ args, player }) => {
      const t = args[0] || player;
      const p = P.setHealth(t, 0);
      return `${p.name} est mort (0 HP)`;
    });

    this.register("give", "Donner un item", ({ args }) => {
      const [t, item] = args;
      if (!t || !item) return "Usage: /give <joueur> <item>";
      P.addItem(t, item);
      return `OK: ${I.applyRule("give", { player:t, item }).result}`;
    });

    this.register("take", "Retirer un item", ({ args }) => {
      const [t, item] = args;
      if (!t || !item) return "Usage: /take <joueur> <item>";
      P.removeItem(t, item);
      return `Item "${item}" retire de ${t}`;
    });

    this.register("inventory", "Voir inventaire", ({ args, player }) => {
      const t = args[0] || player;
      const p = P.ensurePlayer(t);
      return `Inventaire ${p.name}: ${p.inventory.length ? p.inventory.join(", ") : "vide"}`;
    });

    this.register("tp", "Teleporter un joueur", ({ args }) => {
      const [t, x, y, z] = args;
      if (!t) return "Usage: /tp <joueur> <x> <y> <z>";
      P.updatePosition(t, { x:Number(x||0), y:Number(y||0), z:Number(z||0) });
      return `OK: ${I.applyRule("tp", { player:t, dest:`${x||0},${y||0},${z||0}` }).result}`;
    });

    this.register("ban", "Bannir un joueur", ({ args }) => {
      const [t, ...r] = args;
      if (!t) return "Usage: /ban <joueur> [raison]";
      return `OK: ${I.applyRule("ban", { player:t, reason:r.join(" ")||"Aucune raison" }).result}`;
    });

    this.register("noclip", "Toggle noclip", ({ args, player }) => {
      const t = args[0] || player;
      return `OK: ${I.applyRule("noclip", { player:t, enabled:true }).result}`;
    });

    // ── ThirdEye ──────────────────────────────────────────────────────────────
    this.register("scan", "Scanner une entite", ({ args, player }) => {
      const t   = args[0] || player;
      const obs = T.scan(t);
      return `Scan "${t}" | Threat:${obs.threatLevel} | ID:${obs.id}`;
    });

    this.register("eye", "Rapport ThirdEye", () => {
      const r = T.report();
      return `ThirdEye | Obs:${r.totalObservations} | Events:${r.totalEvents}`;
    });

    // ── Monde ─────────────────────────────────────────────────────────────────
    this.register("world", "Etat du monde", () => {
      const s = I.getWorldState();
      const w = W.getState();
      return [
        `Monde | Mode:${s.mode} | Meteo:${s.weather} | Heure:${s.hour}h`,
        `Joueurs:${s.playerCount} | Props:${w.counts.props} | Vehicules:${w.counts.vehicles}`,
        `Zones:${w.counts.zones} | NPCs:${w.counts.npcs} | Events:${s.worldEvents.length}`
      ].join("\n");
    });

    this.register("weather", "Changer la meteo", ({ args }) => {
      const types = ["sunny","rain","storm","fog","snow","chaos"];
      const w = args[0] || "sunny";
      if (!types.includes(w)) return `Meteos: ${types.join(", ")}`;
      I.sandboxState.weather = w;
      return `Meteo: ${w}`;
    });

    this.register("time", "Changer heure", ({ args }) => {
      const h = parseInt(args[0]);
      if (isNaN(h) || h < 0 || h > 23) return "Usage: /time <0-23>";
      I.sandboxState.hour = h;
      return `Heure: ${h}h00`;
    });

    // ── Props (GMod) ──────────────────────────────────────────────────────────
    this.register("spawn", "Spawner un prop", ({ args, player }) => {
      const type = args[0] || "cube";
      const x    = Number(args[1] || 0);
      const z    = Number(args[2] || 0);
      const prop = W.spawnProp(type, { x, y:0, z }, player);
      I.applyRule("spawn", { player, item:type });
      return `Prop "${type}" spawne | ID:${prop.id.slice(0,8)}`;
    });

    this.register("props", "Lister les props", () => {
      const all = W.getProps();
      if (!all.length) return "Aucun prop";
      return all.map(p => `${p.type} | owner:${p.owner} | (${p.position.x},${p.position.z})`).join("\n");
    });

    this.register("delprop", "Supprimer un prop", ({ args }) => {
      const id = args[0]; if (!id) return "Usage: /delprop <id>";
      const match = W.getProps().find(p => p.id.startsWith(id));
      if (!match) return `Prop introuvable: ${id}`;
      W.deleteProp(match.id);
      return `Prop ${id} supprime`;
    });

    this.register("clearprops", "Supprimer tous les props", ({ player }) => {
      const owner = player === "console" ? null : player;
      W.clearProps(owner);
      return `Props supprimes${owner ? ` de ${owner}` : " (tous)"}`;
    });

    // ── Vehicules monde ───────────────────────────────────────────────────────
    this.register("spawncar", "Spawner un vehicule monde", ({ args, player }) => {
      const model = args[0] || "sultan";
      const x     = Number(args[1] || 0);
      const z     = Number(args[2] || 0);
      const veh   = W.spawnVehicle(model, { x, y:0, z }, player);
      return `Vehicule "${model}" spawne | ID:${veh.id.slice(0,8)}`;
    });

    this.register("cars", "Lister les vehicules monde", () => {
      const all = W.getVehicles();
      if (!all.length) return "Aucun vehicule";
      return all.map(v => `${v.model} | owner:${v.owner} | ${v.health}HP | fuel:${v.fuel}%`).join("\n");
    });

    this.register("delcar", "Supprimer un vehicule monde", ({ args }) => {
      const id = args[0]; if (!id) return "Usage: /delcar <id>";
      const match = W.getVehicles().find(v => v.id.startsWith(id));
      if (!match) return `Vehicule introuvable: ${id}`;
      W.deleteVehicle(match.id);
      return `Vehicule ${id} supprime`;
    });

    // ── Zones ─────────────────────────────────────────────────────────────────
    this.register("zones", "Lister les zones", () => {
      const all = W.getZones();
      if (!all.length) return "Aucune zone";
      return all.map(z => `[${z.type.toUpperCase()}] ${z.name} | r:${z.radius} | (${z.center.x},${z.center.z})`).join("\n");
    });

    this.register("zone", "Ajouter une zone", ({ args }) => {
      const [name, x, z, radius, type] = args;
      if (!name) return "Usage: /zone <nom> <x> <z> <rayon> [type]";
      const zone = W.addZone(name, { x:Number(x||0), y:0, z:Number(z||0) }, Number(radius||5), type||"info");
      return `Zone "${zone.name}" ajoutee (r=${zone.radius})`;
    });

    this.register("whereis", "Zone du joueur", ({ args, player }) => {
      const t = args[0] || player;
      const p = P.ensurePlayer(t);
      const z = W.getZoneAt(p.position);
      return z
        ? `${t} est dans la zone "${z.name}" [${z.type}]`
        : `${t} n est dans aucune zone`;
    });

    // ── NPCs ──────────────────────────────────────────────────────────────────
    this.register("spawnnpc", "Spawner un NPC", ({ args }) => {
      const [name, x, z, role] = args;
      if (!name) return "Usage: /spawnnpc <nom> <x> <z> [role]";
      const npc = W.spawnNPC(name, { x:Number(x||0), y:0, z:Number(z||0) }, role||"civilian");
      return `NPC "${npc.name}" (${npc.role}) spawne`;
    });

    this.register("npcs", "Lister les NPCs", () => {
      const all = W.getNPCs();
      if (!all.length) return "Aucun NPC";
      return all.map(n => `${n.name} | ${n.role} | ${n.health}HP`).join("\n");
    });

    // ── Utilitaires ───────────────────────────────────────────────────────────
    this.register("reset", "Reset complet sandbox", ({ player }) => {
      T.observations.clear();
      T.events = [];
      I.sandboxState.worldEvents = [];
      I.memory = [];
      W.props.clear();
      W.vehicles.clear();
      W.npcs.clear();
      return `Sandbox reset par ${player}`;
    });

    this.register("history", "Historique commandes", () =>
      this.history.slice(-8)
        .map(h => `[${h.success?"OK":"ERR"}] ${h.player}: ${h.raw}`)
        .join("\n")
    );

    this.register("stats", "Statistiques globales", () => {
      const w = W.getState();
      const s = I.getWorldState();
      const e = T.report();
      return [
        `=== Stats TroxT Sandbox ===`,
        `Joueurs: ${P.getAllPlayers().length} total | ${P.getConnectedPlayers().length} connectes`,
        `Props: ${w.counts.props} | Vehicules monde: ${w.counts.vehicles}`,
        `Zones: ${w.counts.zones} | NPCs: ${w.counts.npcs}`,
        `ThirdEye: ${e.totalObservations} obs | ${e.totalEvents} events`,
        `Intellectus: ${s.memorySize} memories | ${s.rulesCount} regles`,
        `Meteo: ${s.weather} | Heure: ${s.hour}h`,
        `Events monde: ${s.worldEvents.length}`
      ].join("\n");
    });
  }
}

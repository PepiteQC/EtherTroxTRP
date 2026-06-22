import express             from "express";
import { WebSocketServer } from "ws";
import chalk               from "chalk";
import path                from "path";
import { fileURLToPath }   from "url";

import { ThirdEye }              from "./core/ThirdEye.js";
import { Intellectus }           from "./core/Intellectus.js";
import { CommandHandler }        from "./core/CommandHandler.js";
import { PlayerManager }         from "./core/PlayerManager.js";
import { WorldManager }          from "./core/WorldManager.js";
import { AutoSave, saveJSON, loadJSON } from "./core/PersistenceManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Systemes core ─────────────────────────────────────────────────────────────
const thirdEye = new ThirdEye();
const intel    = new Intellectus();
const players  = new PlayerManager();
const world    = new WorldManager();
const commands = new CommandHandler(thirdEye, intel, players, world);
const clients  = new Set();

// ── Chargement des sauvegardes ────────────────────────────────────────────────
const savedPlayers = loadJSON("players", {});
const savedWorld   = loadJSON("world",   null);
const savedState   = loadJSON("state",   null);

for (const [id, data] of Object.entries(savedPlayers)) {
  const p = players.ensurePlayer(id);
  Object.assign(p, data);
}

if (savedWorld)  world.hydrate(savedWorld);

if (savedState) {
  if (savedState.weather) intel.sandboxState.weather = savedState.weather;
  if (savedState.hour    !== undefined) intel.sandboxState.hour = savedState.hour;
}

console.log(chalk.blue("[TroxT] Donnees restaurees depuis data/"));

// ── AutoSave toutes les 15s ───────────────────────────────────────────────────
const autoSave = new AutoSave(15000);

autoSave.register("players", () => {
  const obj = {};
  for (const p of players.getAllPlayers()) obj[p.id] = p;
  return obj;
});

autoSave.register("world", () => world.serialize());

autoSave.register("state", () => ({
  weather:    intel.sandboxState.weather,
  hour:       intel.sandboxState.hour,
  savedAt:    Date.now()
}));

autoSave.start();

// ── Snapshot ──────────────────────────────────────────────────────────────────
function snapshot() {
  intel.sandboxState.playerCount = players.getConnectedPlayers().length;
  return {
    serverTime: Date.now(),
    worldState: intel.getWorldState(),
    players:    players.getState(),
    eye:        thirdEye.report(),
    world:      world.getState()
  };
}

function broadcast(type, payload = {}) {
  const msg = JSON.stringify({ type, ...payload });
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}

// ── Routes REST ───────────────────────────────────────────────────────────────
app.get("/",              (_,res) => res.redirect("/viewer.html"));
app.get("/api/health",    (_,res) => res.json({ status:"ok", sandbox:"TroxT RP", thirdEyeActive:thirdEye.isActive, commandsCount:commands.getCommands().length }));
app.get("/api/snapshot",  (_,res) => res.json(snapshot()));
app.get("/api/commands",  (_,res) => res.json(commands.getCommands()));
app.get("/api/world",     (_,res) => res.json(world.getState()));
app.get("/api/eye",       (_,res) => res.json(thirdEye.report()));
app.get("/api/players",   (_,res) => res.json(players.getState()));
app.get("/api/player/:id",(req,res) => {
  const p = players.getPlayer(req.params.id);
  p ? res.json(p) : res.status(404).json({ error:"introuvable" });
});

app.post("/api/command", (req, res) => {
  const { cmd, player } = req.body;
  if (!cmd) return res.status(400).json({ error:"cmd requis" });
  players.connect(player || "api");
  const result = commands.execute(cmd, player || "api");
  broadcast("command_event", { result });
  broadcast("snapshot",      { snapshot: snapshot() });
  res.json(result);
});

app.post("/api/save", (_,res) => {
  autoSave.saveNow();
  res.json({ ok:true, savedAt: Date.now() });
});

// ── HTTP + WS ─────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(chalk.green(`\n[TroxT] Server -> http://localhost:${PORT}`));
  console.log(chalk.cyan(`[TroxT] ${commands.getCommands().length} commandes`));
  console.log(chalk.magenta("[TroxT] Sandbox GMod+GTA pret\n"));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(chalk.yellow("[WS] Client connecte"));

  ws.send(JSON.stringify({
    type:     "welcome",
    message:  "TroxT Sandbox",
    commands: commands.getCommands(),
    snapshot: snapshot()
  }));

  ws.on("message", (raw) => {
    try {
      const d = JSON.parse(raw);

      if (d.type === "ping") {
        ws.send(JSON.stringify({ type:"pong", time:Date.now() }));
        return;
      }

      if (d.type === "command") {
        players.connect(d.player || "player");
        ws.playerId = d.player || "player";
        const result = commands.execute(d.cmd, d.player || "player");
        ws.send(JSON.stringify({ type:"command_result", result }));
        broadcast("command_event", { result });
        broadcast("snapshot",      { snapshot: snapshot() });
        return;
      }

      if (d.type === "observe") {
        const result = thirdEye.scan(d.target || "unknown");
        ws.send(JSON.stringify({ type:"observation", result }));
        broadcast("snapshot", { snapshot: snapshot() });
        return;
      }

      if (d.type === "think") {
        const thought = intel.think(d.prompt || "...", d.context || {});
        ws.send(JSON.stringify({ type:"thought", thought }));
        return;
      }

      if (d.type === "player_update") {
        const id = d.playerId || "Unknown";
        ws.playerId = id;
        players.connect(id, id);
        players.updatePosition(id, d.position || { x:0,y:0,z:0 });
        if (d.job)              players.setJob(id, d.job);
        if (d.vehicle)          players.setVehicle(id, d.vehicle);
        if (d.wanted !== undefined) players.setWanted(id, d.wanted);
        if (d.health !== undefined) players.setHealth(id, d.health);
        const watch = thirdEye.watchPlayer(id, d);
        ws.send(JSON.stringify({ type:"player_ack", watch, player:players.getPlayer(id) }));
        broadcast("snapshot", { snapshot: snapshot() });
        return;
      }

      if (d.type === "spawn_prop") {
        const prop = world.spawnProp(d.propType || "cube", d.position, d.player || "player");
        ws.send(JSON.stringify({ type:"prop_spawned", prop }));
        broadcast("snapshot", { snapshot: snapshot() });
        return;
      }

      if (d.type === "spawn_vehicle") {
        const veh = world.spawnVehicle(d.model || "sultan", d.position, d.player || "player");
        ws.send(JSON.stringify({ type:"vehicle_spawned", vehicle:veh }));
        broadcast("snapshot", { snapshot: snapshot() });
        return;
      }

    } catch {
      ws.send(JSON.stringify({ type:"error", message:"Message invalide" }));
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (ws.playerId) {
      players.disconnect(ws.playerId);
      broadcast("snapshot", { snapshot: snapshot() });
    }
    console.log(chalk.gray("[WS] Client deconnecte"));
  });
});

// ── Sauvegarde propre a l arret ───────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n[TroxT] Arret - sauvegarde finale..."));
  autoSave.saveNow();
  autoSave.stop();
  process.exit(0);
});

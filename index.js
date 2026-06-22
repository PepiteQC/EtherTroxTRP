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
app.use(express.static(path.join(__dirname, "..", "client", "public")));

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

// ── Helpers EtherWorld ────────────────────────────────────────────────────────
function getPlayersArray() {
  const state = players.getState();
  const list = Array.isArray(state) ? state : Object.values(state || {});
  return list.map((p) => {
    const pos = p?.position || { x: 0, y: 0, z: 0 };
    return {
      id: p?.id || "unknown",
      name: p?.name || p?.username || p?.displayName || p?.id || "Joueur",
      position: Array.isArray(pos) ? pos : [pos.x || 0, pos.y || 0, pos.z || 0],
      health: p?.health ?? 100,
      job: p?.job ?? null,
      vehicle: p?.vehicle ?? null,
      wanted: p?.wanted ?? 0,
    };
  });
}

function getBuildObjects() {
  const state = world.getState?.() || {};
  const props = Array.isArray(state.props) ? state.props : [];
  const vehicles = Array.isArray(state.vehicles) ? state.vehicles : [];

  const mappedProps = props.map((p) => ({
    id: p.id,
    type: p.propType || p.type || "cube",
    position: Array.isArray(p.position)
      ? p.position
      : [p.position?.x || 0, p.position?.y || 0, p.position?.z || 0],
    scale: Array.isArray(p.scale) ? p.scale : [2, 0.5, 2],
    color: p.color || "#4a5568",
  }));

  const mappedVehicles = vehicles.map((v) => ({
    id: v.id,
    type: v.model || v.type || "vehicle",
    position: Array.isArray(v.position)
      ? v.position
      : [v.position?.x || 0, v.position?.y || 0, v.position?.z || 0],
    scale: Array.isArray(v.scale) ? v.scale : [3, 1.2, 5],
    color: v.color || "#888888",
  }));

  return [...mappedProps, ...mappedVehicles];
}

function sendInit(ws, playerId, playerName) {
  const current = players.getPlayer(playerId);
  const pos = current?.position || { x: 0, y: 5, z: 2 };

  ws.send(JSON.stringify({
    type: "INIT",
    data: {
      player: {
        id: playerId,
        name: playerName,
        position: [pos.x || 0, pos.y || 5, pos.z || 2],
      },
      players: getPlayersArray(),
      buildObjects: getBuildObjects(),
    }
  }));
}

function broadcastWorldState() {
  broadcast("WORLD_STATE", {
    data: {
      players: getPlayersArray()
    }
  });
}

// ── Routes REST ───────────────────────────────────────────────────────────────
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
    type: "CONNECTED",
    data: { ok: true, message: "TroxT Sandbox connecté" }
  }));

  ws.on("message", (raw) => {
    try {
      const d = JSON.parse(raw);

      if (d.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
        return;
      }

      // ── EtherWorld : handshake ────────────────────────────────
      if (d.type === "HELLO") {
        const playerName = d?.data?.name || "Joueur";
        const playerId = `player_${Date.now().toString(36)}`;

        ws.playerId = playerId;
        players.connect(playerId, playerName);
        players.updatePosition(playerId, { x: 0, y: 5, z: 2 });

        sendInit(ws, playerId, playerName);
        broadcastWorldState();
        return;
      }

      // ── EtherWorld : chat ─────────────────────────────────────
      if (d.type === "CHAT") {
        const text = d?.data?.text || "";
        const senderId = ws.playerId || "player";
        const senderPlayer = players.getPlayer(senderId);
        const senderName = senderPlayer?.name || senderId;

        if (text.trim()) {
          broadcast("CHAT", {
            data: {
              sender: senderName,
              text
            }
          });
        }
        return;
      }

      // ── EtherWorld : mouvement ────────────────────────────────
      if (d.type === "PLAYER_MOVE") {
        const senderId = ws.playerId || "player";
        const posArr = d?.data?.position || [0, 0, 0];
        const rotArr = d?.data?.rotation || [0, 0, 0];

        const position = {
          x: Number(posArr[0]) || 0,
          y: Number(posArr[1]) || 0,
          z: Number(posArr[2]) || 0,
        };

        players.connect(senderId, senderId);
        players.updatePosition(senderId, position);

        broadcast("PLAYER_MOVE", {
          data: {
            id: senderId,
            position: [position.x, position.y, position.z],
            rotation: rotArr
          }
        });

        broadcastWorldState();
        return;
      }

      // ── Ancien protocole (viewer/admin) ───────────────────────
      if (d.type === "command") {
        players.connect(d.player || "player");
        ws.playerId = d.player || "player";
        const result = commands.execute(d.cmd, d.player || "player");
        ws.send(JSON.stringify({ type: "command_result", result }));
        broadcast("command_event", { result });
        broadcast("snapshot", { snapshot: snapshot() });
        broadcastWorldState();
        return;
      }

      if (d.type === "observe") {
        const result = thirdEye.scan(d.target || "unknown");
        ws.send(JSON.stringify({ type: "observation", result }));
        broadcast("snapshot", { snapshot: snapshot() });
        return;
      }

      if (d.type === "think") {
        const thought = intel.think(d.prompt || "...", d.context || {});
        ws.send(JSON.stringify({ type: "thought", thought }));
        return;
      }

      if (d.type === "player_update") {
        const id = d.playerId || "Unknown";
        ws.playerId = id;
        players.connect(id, id);
        players.updatePosition(id, d.position || { x: 0, y: 0, z: 0 });
        if (d.job)              players.setJob(id, d.job);
        if (d.vehicle)          players.setVehicle(id, d.vehicle);
        if (d.wanted !== undefined) players.setWanted(id, d.wanted);
        if (d.health !== undefined) players.setHealth(id, d.health);
        const watch = thirdEye.watchPlayer(id, d);
        ws.send(JSON.stringify({ type: "player_ack", watch, player: players.getPlayer(id) }));
        broadcast("snapshot", { snapshot: snapshot() });
        broadcastWorldState();
        return;
      }

      if (d.type === "spawn_prop") {
        const prop = world.spawnProp(d.propType || "cube", d.position, d.player || "player");
        ws.send(JSON.stringify({ type: "prop_spawned", prop }));
        broadcast("BUILD_OBJECT_PLACED", { data: prop });
        broadcast("snapshot", { snapshot: snapshot() });
        return;
      }

      if (d.type === "spawn_vehicle") {
        const veh = world.spawnVehicle(d.model || "sultan", d.position, d.player || "player");
        ws.send(JSON.stringify({ type: "vehicle_spawned", vehicle: veh }));
        broadcast("BUILD_OBJECT_PLACED", { data: veh });
        broadcast("snapshot", { snapshot: snapshot() });
        return;
      }

    } catch (err) {
      console.error("[WS] Message invalide:", err);
      ws.send(JSON.stringify({ type: "error", message: "Message invalide" }));
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (ws.playerId) {
      players.disconnect(ws.playerId);
      broadcastWorldState();
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
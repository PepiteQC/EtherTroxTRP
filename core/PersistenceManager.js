import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "..", "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function saveJSON(name, data) {
  ensureDir();
  try {
    fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error(`[Persistence] Erreur save ${name}: ${e.message}`);
  }
}

export function loadJSON(name, fallback = {}) {
  ensureDir();
  try {
    if (fs.existsSync(filePath(name))) {
      return JSON.parse(fs.readFileSync(filePath(name), "utf8"));
    }
  } catch (e) {
    console.error(`[Persistence] Erreur load ${name}: ${e.message}`);
  }
  return fallback;
}

export class AutoSave {
  constructor(intervalMs = 15000) {
    this.tasks       = new Map();
    this.intervalMs  = intervalMs;
    this.timer       = null;
  }

  register(name, getFn) {
    this.tasks.set(name, getFn);
    console.log(`\x1b[90m[Persistence] AutoSave enregistre: ${name}\x1b[0m`);
  }

  start() {
    this.timer = setInterval(() => this._saveAll(), this.intervalMs);
    console.log(`\x1b[90m[Persistence] AutoSave toutes les ${this.intervalMs/1000}s\x1b[0m`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  saveNow() {
    this._saveAll();
  }

  _saveAll() {
    for (const [name, getFn] of this.tasks) {
      try { saveJSON(name, getFn()); } catch {}
    }
    console.log(`\x1b[90m[Persistence] Sauvegarde OK (${new Date().toLocaleTimeString()})\x1b[0m`);
  }
}

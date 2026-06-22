// server/persistence/Snapshotter.ts
import fs   from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { WorldState, EntityData } from '../../shared/types';
import { WORLD } from '../../shared/constants';

// ============================================================
//  TYPES
// ============================================================

export interface Snapshot {
  id:           string;
  type:         'auto' | 'manual' | 'backup';
  description:  string;
  createdAt:    string;
  playerCount:  number;
  entityCount:  number;
  worldState:   WorldState;
  entities:     EntityData[];
}

export interface SnapshotMeta {
  id:          string;
  type:        Snapshot['type'];
  description: string;
  createdAt:   string;
  playerCount: number;
  entityCount: number;
}

// ============================================================
//  SNAPSHOTTER
// ============================================================

export class Snapshotter {

  private _dir:       string;
  private _snapshots: Snapshot[]                    = [];
  private _autoTimer?: ReturnType<typeof setInterval>;
  private _maxSnaps:  number;

  // Callbacks
  private _onSave?: () => { worldState: WorldState; entities: EntityData[]; playerCount: number };
  private _onRestore?: (snapshot: Snapshot) => void;

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(dir: string, maxSnapshots = WORLD.MAX_SNAPSHOTS) {
    this._dir      = dir;
    this._maxSnaps = maxSnapshots;

    // Créer dossier si inexistant
    if (!fs.existsSync(this._dir)) {
      fs.mkdirSync(this._dir, { recursive: true });
    }

    // Charger snapshots existants
    this._loadExisting();
    console.log(`[Snapshotter] Initialisé — ${this._snapshots.length} snapshots existants`);
  }

  // ──────────────────────────────────────────
  //  CONFIGURATION
  // ──────────────────────────────────────────

  public onSave(
    cb: () => { worldState: WorldState; entities: EntityData[]; playerCount: number }
  ): void {
    this._onSave = cb;
  }

  public onRestore(cb: (snapshot: Snapshot) => void): void {
    this._onRestore = cb;
  }

  // ──────────────────────────────────────────
  //  AUTO-SAVE
  // ──────────────────────────────────────────

  public startAutoSave(intervalMs = WORLD.AUTO_SAVE_MS): void {
    this.stopAutoSave();
    this._autoTimer = setInterval(() => {
      this.create('auto', 'Auto-save');
    }, intervalMs);
    console.log(`[Snapshotter] Auto-save démarré (${intervalMs / 1000}s)`);
  }

  public stopAutoSave(): void {
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = undefined;
    }
  }

  // ──────────────────────────────────────────
  //  CRÉATION
  // ──────────────────────────────────────────

  public create(
    type:        Snapshot['type'] = 'manual',
    description = '',
    playerCount  = 0
  ): Snapshot | null {
    if (!this._onSave) {
      console.warn('[Snapshotter] Aucun callback onSave défini');
      return null;
    }

    let saveData: { worldState: WorldState; entities: EntityData[]; playerCount: number };
    try {
      saveData = this._onSave();
    } catch (e) {
      console.error('[Snapshotter] Erreur lors de la sauvegarde:', e);
      return null;
    }

    const snap: Snapshot = {
      id:          uuidv4(),
      type,
      description: description || `${type} snapshot`,
      createdAt:   new Date().toISOString(),
      playerCount: saveData.playerCount,
      entityCount: saveData.entities.length,
      worldState:  saveData.worldState,
      entities:    saveData.entities,
    };

    // Ajouter en tête
    this._snapshots.unshift(snap);

    // Respecter la limite
    while (this._snapshots.length > this._maxSnaps) {
      const removed = this._snapshots.pop();
      if (removed) this._deleteFile(removed.id);
    }

    // Écrire sur disque
    this._writeFile(snap);

    console.log(
      `[Snapshotter] 💾 Snapshot créé: ${snap.id.slice(0, 8)}`,
      `(${snap.entityCount} entités, type: ${type})`
    );

    return snap;
  }

  // ──────────────────────────────────────────
  //  RESTAURATION
  // ──────────────────────────────────────────

  public restore(id: string): boolean {
    const snap = this._snapshots.find(s => s.id === id);
    if (!snap) {
      console.warn(`[Snapshotter] Snapshot introuvable: ${id}`);
      return false;
    }

    if (this._onRestore) {
      try {
        this._onRestore(snap);
        console.log(`[Snapshotter] ♻️ Snapshot restauré: ${id.slice(0, 8)}`);
        return true;
      } catch (e) {
        console.error('[Snapshotter] Erreur lors de la restauration:', e);
        return false;
      }
    }

    return false;
  }

  // ──────────────────────────────────────────
  //  SUPPRESSION
  // ──────────────────────────────────────────

  public delete(id: string): boolean {
    const idx = this._snapshots.findIndex(s => s.id === id);
    if (idx === -1) return false;

    this._snapshots.splice(idx, 1);
    this._deleteFile(id);
    return true;
  }

  // ──────────────────────────────────────────
  //  ACCÈS
  // ──────────────────────────────────────────

  public getAll(): Snapshot[] {
    return [...this._snapshots];
  }

  public getMeta(): SnapshotMeta[] {
    return this._snapshots.map(s => ({
      id:          s.id,
      type:        s.type,
      description: s.description,
      createdAt:   s.createdAt,
      playerCount: s.playerCount,
      entityCount: s.entityCount,
    }));
  }

  public get(id: string): Snapshot | undefined {
    return this._snapshots.find(s => s.id === id);
  }

  public getLatest(): Snapshot | undefined {
    return this._snapshots[0];
  }

  public count(): number {
    return this._snapshots.length;
  }

  // ──────────────────────────────────────────
  //  FICHIERS
  // ──────────────────────────────────────────

  private _writeFile(snap: Snapshot): void {
    try {
      const fp = path.join(this._dir, `${snap.id}.json`);
      fs.writeFileSync(fp, JSON.stringify(snap, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Snapshotter] Erreur écriture fichier:', e);
    }
  }

  private _deleteFile(id: string): void {
    try {
      const fp = path.join(this._dir, `${id}.json`);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      console.error('[Snapshotter] Erreur suppression fichier:', e);
    }
  }

  private _loadExisting(): void {
    try {
      const files = fs.readdirSync(this._dir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse(); // Plus récent en premier

      for (const file of files) {
        try {
          const fp   = path.join(this._dir, file);
          const data = JSON.parse(fs.readFileSync(fp, 'utf-8')) as Snapshot;
          this._snapshots.push(data);
        } catch (e) {
          console.warn(`[Snapshotter] Fichier corrompu ignoré: ${file}`);
        }
      }

      // Respecter la limite
      while (this._snapshots.length > this._maxSnaps) {
        this._snapshots.pop();
      }
    } catch (e) {
      console.error('[Snapshotter] Erreur chargement:', e);
    }
  }

  // ──────────────────────────────────────────
  //  CLEANUP
  // ──────────────────────────────────────────

  public dispose(): void {
    this.stopAutoSave();
    console.log('[Snapshotter] Disposé');
  }
}
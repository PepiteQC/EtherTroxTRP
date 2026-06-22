// server/persistence/DatabaseAdapter.ts
import fs   from 'fs';
import path from 'path';

// ============================================================
//  TYPES
// ============================================================

export type TableRow = Record<string, any> & { id: number | string };

export interface DBMeta {
  createdAt:    string;
  updatedAt:    string;
  version:      string;
  totalQueries: number;
}

export interface Database {
  _meta:         DBMeta;
  players:       TableRow[];
  vehicles:      TableRow[];
  houses:        TableRow[];
  shops:         TableRow[];
  jobs:          TableRow[];
  inventory:     TableRow[];
  factions:      TableRow[];
  bank_accounts: TableRow[];
  [table: string]: any;
}

export interface QueryResult<T = TableRow> {
  success: boolean;
  data?:   T;
  error?:  string;
  count?:  number;
}

// ============================================================
//  DATABASE ADAPTER (JSON File)
// ============================================================

export class DatabaseAdapter {

  private _db:   Database;
  private _file: string;
  private _dirty = false;
  private _flushTimer?: ReturnType<typeof setInterval>;

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(filePath: string) {
    this._file = filePath;
    this._db   = this._load();

    // Flush automatique toutes les 5 secondes si dirty
    this._flushTimer = setInterval(() => {
      if (this._dirty) this._flush();
    }, 5000);

    console.log(
      `[DatabaseAdapter] Initialisé — ${Object.keys(this._db).filter(k => k !== '_meta').length} tables`
    );
  }

  // ──────────────────────────────────────────
  //  LOAD / SAVE
  // ──────────────────────────────────────────

  private _load(): Database {
    if (fs.existsSync(this._file)) {
      try {
        return JSON.parse(fs.readFileSync(this._file, 'utf-8')) as Database;
      } catch (e) {
        console.error('[DatabaseAdapter] Fichier DB corrompu — reset:', e);
      }
    }
    return this._createEmptyDB();
  }

  private _createEmptyDB(): Database {
    return {
      _meta: {
        createdAt:    new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
        version:      '2.0',
        totalQueries: 0,
      },
      players:       [],
      vehicles:      [],
      houses:        [],
      shops:         [],
      jobs:          [],
      inventory:     [],
      factions:      [],
      bank_accounts: [],
    };
  }

  private _flush(): void {
    try {
      this._db._meta.updatedAt    = new Date().toISOString();
      this._db._meta.totalQueries++;
      fs.writeFileSync(this._file, JSON.stringify(this._db, null, 2), 'utf-8');
      this._dirty = false;
    } catch (e) {
      console.error('[DatabaseAdapter] Erreur flush:', e);
    }
  }

  private _markDirty(): void {
    this._dirty = true;
  }

  // ──────────────────────────────────────────
  //  TABLE MANAGEMENT
  // ──────────────────────────────────────────

  public hasTable(name: string): boolean {
    return name in this._db && name !== '_meta';
  }

  public createTable(name: string): QueryResult {
    if (name === '_meta' || name.startsWith('_')) {
      return { success: false, error: 'Nom de table réservé' };
    }
    if (this.hasTable(name)) {
      return { success: false, error: 'Table déjà existante' };
    }
    this._db[name] = [];
    this._markDirty();
    return { success: true };
  }

  public dropTable(name: string): QueryResult {
    if (!this.hasTable(name)) {
      return { success: false, error: 'Table introuvable' };
    }
    delete this._db[name];
    this._markDirty();
    return { success: true };
  }

  public truncateTable(name: string): QueryResult {
    if (!this.hasTable(name)) {
      return { success: false, error: 'Table introuvable' };
    }
    this._db[name] = [];
    this._markDirty();
    return { success: true };
  }

  public listTables(): string[] {
    return Object.keys(this._db).filter(k => k !== '_meta');
  }

  public getTableInfo(name: string): QueryResult<{ name: string; count: number; columns: string[] }> {
    if (!this.hasTable(name)) {
      return { success: false, error: 'Table introuvable' };
    }
    const rows = this._db[name] as TableRow[];
    return {
      success: true,
      data: {
        name,
        count:   rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      },
    };
  }

  // ──────────────────────────────────────────
  //  CRUD
  // ──────────────────────────────────────────

  public findAll(table: string): QueryResult<TableRow[]> {
    if (!this.hasTable(table)) return { success: false, error: 'Table introuvable' };
    return { success: true, data: [...this._db[table]], count: this._db[table].length };
  }

  public findById(table: string, id: number | string): QueryResult<TableRow> {
    if (!this.hasTable(table)) return { success: false, error: 'Table introuvable' };

    const row = (this._db[table] as TableRow[]).find(
      r => r.id === id || r.id === Number(id)
    );

    if (!row) return { success: false, error: 'Ligne introuvable' };
    return { success: true, data: { ...row } };
  }

  public findWhere(
    table:  string,
    filter: Partial<TableRow>
  ): QueryResult<TableRow[]> {
    if (!this.hasTable(table)) return { success: false, error: 'Table introuvable' };

    const rows = (this._db[table] as TableRow[]).filter(row =>
      Object.entries(filter).every(([k, v]) => row[k] === v)
    );

    return { success: true, data: rows, count: rows.length };
  }

  public insert(table: string, data: Omit<TableRow, 'id'> & { id?: any }): QueryResult<TableRow> {
    if (!this.hasTable(table)) {
      this._db[table] = [];
    }

    const rows  = this._db[table] as TableRow[];
    const maxId = rows.reduce(
      (mx, r) => Math.max(mx, typeof r.id === 'number' ? r.id : 0),
      0
    );

    const now = new Date().toISOString();
    const row: TableRow = {
      id:         data.id ?? maxId + 1,
      ...data,
      created_at: now,
      updated_at: now,
    };

    rows.push(row);
    this._markDirty();
    return { success: true, data: { ...row } };
  }

  public update(
    table:  string,
    id:     number | string,
    data:   Partial<TableRow>
  ): QueryResult<TableRow> {
    if (!this.hasTable(table)) return { success: false, error: 'Table introuvable' };

    const rows = this._db[table] as TableRow[];
    const idx  = rows.findIndex(r => r.id === id || r.id === Number(id));

    if (idx === -1) return { success: false, error: 'Ligne introuvable' };

    rows[idx] = {
      ...rows[idx],
      ...data,
      id:         rows[idx].id, // Conserver l'ID
      updated_at: new Date().toISOString(),
    };

    this._markDirty();
    return { success: true, data: { ...rows[idx] } };
  }

  public delete(table: string, id: number | string): QueryResult {
    if (!this.hasTable(table)) return { success: false, error: 'Table introuvable' };

    const rows   = this._db[table] as TableRow[];
    const before = rows.length;
    this._db[table] = rows.filter(r => r.id !== id && r.id !== Number(id));

    if (this._db[table].length === before) {
      return { success: false, error: 'Ligne introuvable' };
    }

    this._markDirty();
    return { success: true };
  }

  // ──────────────────────────────────────────
  //  STATS
  // ──────────────────────────────────────────

  public getStats(): {
    tableCount: number;
    totalRows:  number;
    tables:     { name: string; rows: number }[];
    meta:       DBMeta;
  } {
    const tables = this.listTables();
    return {
      tableCount: tables.length,
      totalRows:  tables.reduce((s, t) => s + (this._db[t]?.length ?? 0), 0),
      tables:     tables.map(t => ({ name: t, rows: this._db[t]?.length ?? 0 })),
      meta:       { ...this._db._meta },
    };
  }

  // ──────────────────────────────────────────
  //  SEED
  // ──────────────────────────────────────────

  public seed(): void {
    const now = new Date().toISOString();

    if (!this._db.players?.length) {
      this._db.players = [
        { id:1, name:'John Smith',    steam_id:'steam:1100001', job:'police',    rank:'sergeant', money_cash:5000,   money_bank:45000,   phone:'555-0101', status:'online',  created_at:now, updated_at:now },
        { id:2, name:'Marie Dupont',  steam_id:'steam:1100002', job:'ambulance', rank:'doctor',   money_cash:3200,   money_bank:67000,   phone:'555-0102', status:'online',  created_at:now, updated_at:now },
        { id:3, name:'Tony Montana',  steam_id:'steam:1100003', job:'unemployed',rank:'none',     money_cash:150000, money_bank:2000000, phone:'555-0103', status:'offline', created_at:now, updated_at:now },
        { id:4, name:'Sarah Connor',  steam_id:'steam:1100004', job:'mechanic',  rank:'boss',     money_cash:8900,   money_bank:120000,  phone:'555-0104', status:'online',  created_at:now, updated_at:now },
        { id:5, name:'James Wilson',  steam_id:'steam:1100005', job:'taxi',      rank:'employee', money_cash:1200,   money_bank:15000,   phone:'555-0105', status:'offline', created_at:now, updated_at:now },
      ];
    }

    if (!this._db.vehicles?.length) {
      this._db.vehicles = [
        { id:1, owner_id:1, model:'police3',   plate:'LSPD-001', garage:'mrpd',     fuel:85,  status:'parked',  color:'black/white', created_at:now, updated_at:now },
        { id:2, owner_id:2, model:'ambulance', plate:'EMS-042',  garage:'hospital', fuel:60,  status:'out',     color:'white/red',   created_at:now, updated_at:now },
        { id:3, owner_id:3, model:'infernus',  plate:'TONY-01',  garage:'luxury',   fuel:100, status:'parked',  color:'red',         created_at:now, updated_at:now },
        { id:4, owner_id:3, model:'adder',     plate:'TONY-02',  garage:'luxury',   fuel:45,  status:'impound', color:'gold',        created_at:now, updated_at:now },
        { id:5, owner_id:4, model:'flatbed',   plate:'MECH-01',  garage:'mechanic', fuel:70,  status:'out',     color:'yellow',      created_at:now, updated_at:now },
      ];
    }

    if (!this._db.jobs?.length) {
      this._db.jobs = [
        { id:1, name:'police',     label:'Los Santos Police',  grades:'cadet,officer,sergeant,lieutenant,chief', salary_base:3500, on_duty:1, max_slots:15,  created_at:now, updated_at:now },
        { id:2, name:'ambulance',  label:'Emergency Medical',  grades:'trainee,paramedic,doctor,chief',          salary_base:3200, on_duty:1, max_slots:10,  created_at:now, updated_at:now },
        { id:3, name:'mechanic',   label:'Los Santos Customs', grades:'apprentice,mechanic,boss',                salary_base:2800, on_duty:1, max_slots:8,   created_at:now, updated_at:now },
        { id:4, name:'taxi',       label:'Downtown Cab Co.',   grades:'employee,manager',                        salary_base:2000, on_duty:0, max_slots:10,  created_at:now, updated_at:now },
        { id:5, name:'unemployed', label:'Unemployed',         grades:'none',                                    salary_base:500,  on_duty:0, max_slots:999, created_at:now, updated_at:now },
      ];
    }

    this._markDirty();
    this._flush();
    console.log('[DatabaseAdapter] 🌱 Seed appliqué');
  }

  // ──────────────────────────────────────────
  //  CLEANUP
  // ──────────────────────────────────────────

  public dispose(): void {
    if (this._flushTimer) clearInterval(this._flushTimer);
    if (this._dirty) this._flush();
    console.log('[DatabaseAdapter] Disposé');
  }
}
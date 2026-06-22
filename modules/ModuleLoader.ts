// server/modules/ModuleLoader.ts
import type { EntityDefinition, ToolDefinition, ModuleDefinition } from '../../shared/types';

// ============================================================
//  MODULE LOADER — Registre de tous les contenus
// ============================================================

export class ModuleLoader {

  private _entities:  Map<string, EntityDefinition>  = new Map();
  private _tools:     Map<string, ToolDefinition>    = new Map();
  private _modules:   Map<string, ModuleDefinition>  = new Map();
  private _effects:   Map<string, any>               = new Map();
  private _vehicles:  Map<string, any>               = new Map();
  private _npcs:      Map<string, any>               = new Map();

  // ──────────────────────────────────────────
  //  REGISTRATION
  // ──────────────────────────────────────────

  public registerModule(def: ModuleDefinition): void {
    this._modules.set(def.id, def);
    console.log(`[ModuleLoader] 📦 Module: ${def.name} v${def.version}`);
  }

  public registerEntity(id: string, def: EntityDefinition): void {
    this._entities.set(id, def);
  }

  public registerTool(id: string, def: ToolDefinition): void {
    this._tools.set(id, def);
  }

  public registerEffect(id: string, def: any): void {
    this._effects.set(id, def);
  }

  public registerVehicle(id: string, def: any): void {
    this._vehicles.set(id, def);
  }

  public registerNpc(id: string, def: any): void {
    this._npcs.set(id, def);
  }

  // ──────────────────────────────────────────
  //  ACCÈS
  // ──────────────────────────────────────────

  public getEntity(id: string): EntityDefinition | undefined {
    return this._entities.get(id);
  }

  public getTool(id: string): ToolDefinition | undefined {
    return this._tools.get(id);
  }

  public getEffect(id: string): any {
    return this._effects.get(id);
  }

  public getVehicle(id: string): any {
    return this._vehicles.get(id);
  }

  public getNpc(id: string): any {
    return this._npcs.get(id);
  }

  public hasEntity(id: string): boolean {
    return this._entities.has(id);
  }

  public listEntities(): string[] {
    return Array.from(this._entities.keys());
  }

  public listTools(): string[] {
    return Array.from(this._tools.keys());
  }

  public listModules(): ModuleDefinition[] {
    return Array.from(this._modules.values());
  }

  public getStats(): {
    modules:  number;
    entities: number;
    tools:    number;
    effects:  number;
    vehicles: number;
    npcs:     number;
  } {
    return {
      modules:  this._modules.size,
      entities: this._entities.size,
      tools:    this._tools.size,
      effects:  this._effects.size,
      vehicles: this._vehicles.size,
      npcs:     this._npcs.size,
    };
  }
}
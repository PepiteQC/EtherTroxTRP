// server/agents/ether-forge/forge.types.ts
// ============================================================
//  ETHER-FORGE — Types et Interfaces
// ============================================================

export type FileStatus = 'generated' | 'updated' | 'existing' | 'failed';

export interface ForgeGeneratedFile {
  path: string;
  status: FileStatus;
  lines: number;
}

export interface ForgeContractDef {
  files: string[];
  modules: string[];
  events: string[];
  routes: string[];
}

export interface ForgeOutput {
  agent: 'ether-forge';
  task: string;
  files: ForgeGeneratedFile[];
  modules: string[];
  events?: string[];
  routes?: string[];
  dependencies?: string[];
  integration?: string[];
  intellectusHooks?: string[];
  status: 'completed' | 'in_progress' | 'failed';
  warnings: string[];
  contractIssues?: any[];
  
  // Champs spécifiques aux sous-systèmes
  blueprints?: number;
  packages?: string[];
  chassis?: string[];
  slots?: number;
  itemTypes?: string[];
  tickRate?: number;
  features?: string[];
  hooks?: string[];
}
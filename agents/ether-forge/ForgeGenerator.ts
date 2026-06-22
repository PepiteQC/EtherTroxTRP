// server/agents/ether-forge/ForgeGenerator.ts
// ============================================================
//  ETHER-FORGE — Générateur de Fichiers
//  Gère la création physique des structures TypeScript
// ============================================================

import fs from 'fs';
import path from 'path';
import type { ForgeGeneratedFile, FileStatus } from './forge.types';

export class ForgeGenerator {
  private static readonly ROOT_DIR = path.resolve(__dirname, '../../../../');

  /**
   * Simule ou exécute la création d'un fichier basé sur les directives de la Forge
   */
  public static async processFileOperation(filePath: string, contentTemplate: string = ''): Promise<ForgeGeneratedFile> {
    const fullPath = path.join(this.ROOT_DIR, filePath);
    const dirName = path.dirname(fullPath);
    let status: FileStatus = 'generated';
    let lines = 0;

    try {
      // S'assurer que le dossier parent existe
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }

      if (fs.existsSync(fullPath)) {
        status = 'existing';
        // Logique optionnelle pour 'updated' si on injecte du code
      } else {
        // En production, contentTemplate serait généré par l'LLM de l'agent
        const defaultContent = contentTemplate || `// Généré par Ether-Forge\n// Path: ${filePath}\n\nexport {};\n`;
        fs.writeFileSync(fullPath, defaultContent, 'utf-8');
      }

      // Calculer le nombre de lignes
      const content = fs.readFileSync(fullPath, 'utf-8');
      lines = content.split('\n').length;

    } catch (error) {
      console.error(`[Ether-Forge] Erreur lors de la génération de ${filePath}:`, error);
      status = 'failed';
    }

    return {
      path: filePath,
      status,
      lines
    };
  }

  /**
   * Utilité pour générer un template de base pour un contrôleur/module
   */
  public static createModuleTemplate(moduleName: string): string {
    return `// ============================================================
//  MODULE: ${moduleName}
//  Généré automatiquement par Ether-Forge
// ============================================================

export class ${moduleName} {
  constructor() {
    console.log('[${moduleName}] Initialisé');
  }

  public init(): void {
    // Logique d'initialisation
  }
}
`;
  }
}
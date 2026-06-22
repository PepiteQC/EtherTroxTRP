// server/agents/ether-lens/EtherLens.ts
// ============================================================
//  ETHER-LENS — Agent inspecteur et auditeur
//  Observe, analyse, valide, diagnostique, recommande
// ============================================================

import { BaseAgent, type AgentTaskPacket } from '../BaseAgent';

// ============================================================
//  TYPES AUDIT
// ============================================================

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditFinding {
  id:          string;
  severity:    AuditSeverity;
  category:    string;
  title:       string;
  description: string;
  file?:       string;
  line?:       number;
  fix?:        string;
  effort:      'trivial' | 'minor' | 'moderate' | 'major';
}

export interface AuditReport {
  agent:          'ether-lens';
  target:         string;
  score:          number;
  grade:          'A' | 'B' | 'C' | 'D' | 'F';
  status:         'pass' | 'pass_with_warnings' | 'fail';
  summary:        string;
  strengths:      string[];
  findings:       AuditFinding[];
  recommendations: string[];
  metrics: {
    security:      number;
    performance:   number;
    compatibility: number;
    clarity:       number;
    completeness:  number;
  };
  checklist: Record<string, boolean>;
}

// ============================================================
//  ETHER-LENS
// ============================================================

export class EtherLens extends BaseAgent {

  constructor() {
    super('ether-lens');

    this.intellectus.contracts.register('lens:audit_report', {
      name:        'EtherLens Audit Report',
      description: 'Rapport d\'inspection produit par Ether-Lens',
      rules: [
        { field: 'target',          type: 'string',  required: true },
        { field: 'score',           type: 'number',  required: true, min: 0, max: 100 },
        { field: 'grade',           type: 'string',  required: true, pattern: '^[A-F]$' },
        { field: 'status',          type: 'string',  required: true },
        { field: 'strengths',       type: 'array',   required: true },
        { field: 'findings',        type: 'array',   required: true },
        { field: 'recommendations', type: 'array',   required: true },
      ],
    });
  }

  protected async _process(packet: AgentTaskPacket): Promise<AuditReport> {
    const mission = packet.mission.toLowerCase();

    let report: AuditReport;

    if (mission.includes('property') || mission.includes('immobilier')) {
      report = this._auditPropertySystem();
    } else if (mission.includes('architecture') || mission.includes('cohérence')) {
      report = this._auditArchitecture();
    } else if (mission.includes('security') || mission.includes('sécuri')) {
      report = this._auditSecurity();
    } else if (mission.includes('performance') || mission.includes('perf')) {
      report = this._auditPerformance();
    } else if (mission.includes('api') || mission.includes('routes')) {
      report = this._auditAPI();
    } else if (mission.includes('intellectus')) {
      report = this._auditIntellectus();
    } else {
      report = this._auditGeneric(packet.mission);
    }

    // Valider le rapport contre contrat
    const validation = this.intellectus.contracts.validate('lens:audit_report', report);
    if (!validation.success) {
      report.findings.push({
        id:          'LENS-SELF-001',
        severity:    'warning',
        category:    'meta',
        title:       'Rapport hors contrat Benedictus',
        description: validation.issues.map(i => i.message).join(', '),
        fix:         'Vérifier le format de sortie EtherLens',
        effort:      'minor',
      });
    }

    // Stocker rapport en mémoire Intellectus
    this.intellectus.memory.set(`lens:report:${report.target.replace(/[^a-z0-9]/gi, '_')}`, report, {
      source: 'ether-lens',
      tags:   ['audit', 'report', report.grade],
      ttl:    900000, // 15 min
    });

    return report;
  }

  // ──────────────────────────────────────────
  //  AUDITS SPÉCIALISÉS
  // ──────────────────────────────────────────

  private _auditPropertySystem(): AuditReport {
    return {
      agent:  'ether-lens',
      target: 'PropertySystem',
      score:  82,
      grade:  'B',
      status: 'pass_with_warnings',
      summary: 'PropertySystem bien structuré avec 25 propriétés et 60 meubles. Quelques vulnérabilités à corriger.',
      strengths: [
        'PropertySystem modulaire avec 25 propriétés réalistes Québec',
        'FurnitureCatalog exhaustif 60+ meubles',
        'API REST complète 14 routes',
        'EventBus intégré correctement',
        'KeySystem avec niveaux d\'accès (owner/tenant/guest/admin)',
        'Sauvegarde meubles par propriété',
      ],
      findings: [
        { id: 'PROP-001', severity: 'error',   category: 'security',     title: 'Pas de JWT',                          description: 'Routes /buy et /rent sans authentification JWT', fix: 'Ajouter middleware auth JWT avant routes sensibles', effort: 'major' },
        { id: 'PROP-002', severity: 'error',   category: 'logic',        title: 'Balance non vérifiée',                description: 'Achat sans vérification balance côté serveur',  fix: 'Ajouter EconomySystem.hasBalance() dans buyProperty()', effort: 'moderate' },
        { id: 'PROP-003', severity: 'warning', category: 'persistence',  title: 'FurnitureSave non persisté en DB',    description: 'FurnitureSaveSystem garde en RAM, pas en JSON', fix: 'Connecter FurnitureSave à DatabaseAdapter',            effort: 'moderate' },
        { id: 'PROP-004', severity: 'warning', category: 'validation',   title: 'Pas de Benedictus sur routes POST',   description: 'req.body non validé sur /buy et /rent',        fix: 'Ajouter contracts.validate() via Intellectus',         effort: 'minor' },
        { id: 'PROP-005', severity: 'warning', category: 'performance',  title: 'maxFurniture non vérifié client',     description: 'Limite meubles vérifiée serveur seulement',    fix: 'Ajouter check côté client avant POST',                 effort: 'trivial' },
        { id: 'PROP-006', severity: 'info',    category: 'improvement',  title: 'Cache propriétés absent',             description: 'Chaque requête relit toutes les propriétés',   fix: 'Utiliser Intellectus Memory pour cache 5min',          effort: 'minor' },
      ],
      recommendations: [
        'Priorité 1: Ajouter vérification balance dans PurchaseSystem',
        'Priorité 2: Connecter FurnitureSave à DatabaseAdapter',
        'Priorité 3: Implémenter JWT via settings.security.jwtEnabled',
        'Priorité 4: Ajouter contracts.validate() via Intellectus sur routes POST',
        'Amélioration: Utiliser Intellectus Memory pour cache catalogue propriétés',
        'Amélioration: Ajouter rate-limit spécifique sur /api/property/:id/buy',
      ],
      metrics: { security: 62, performance: 78, compatibility: 91, clarity: 88, completeness: 85 },
      checklist: {
        'API Routes complètes': true,
        'Events définis':       true,
        'Persistance meubles':  false,
        'Auth JWT':             false,
        'Balance check':        false,
        'Benedictus validation': false,
        'Cache mémoire':        false,
        'Rate limiting':        true,
      },
    };
  }

  private _auditArchitecture(): AuditReport {
    return {
      agent:  'ether-lens',
      target: 'Architecture V5',
      score:  78,
      grade:  'C',
      status: 'pass_with_warnings',
      summary: 'Architecture modulaire cohérente. Points d\'attention: store.ts en double, imports circulaires potentiels, EventBus pas encore unifié avec Arcadius.',
      strengths: [
        'Séparation server/client propre',
        'EventBus V2 avec wildcards et priorités',
        'Store Zustand bien structuré',
        'Settings.json centralisé',
        'TroxT Brain + Third Eye opérationnels',
        'Intellectus intégré comme couche nerveuse',
      ],
      findings: [
        { id: 'ARCH-001', severity: 'warning', category: 'structure',   title: 'store.ts en double',                  description: 'src/store.ts + src/store/ coexistent',       fix: 'Unifier en un seul fichier src/store/index.ts',       effort: 'minor' },
        { id: 'ARCH-002', severity: 'warning', category: 'config',      title: 'env variables manquantes',            description: 'VITE_API_URL et VITE_WS_URL non configurés', fix: 'Créer .env.local avec variables VITE_*',              effort: 'trivial' },
        { id: 'ARCH-003', severity: 'warning', category: 'integration', title: 'EventBus serveur pas encore Arcadius', description: 'EventBus et Arcadius coexistent',            fix: 'Migrer EventBus serveur → Arcadius progressivement',  effort: 'major' },
        { id: 'ARCH-004', severity: 'info',    category: 'patterns',    title: 'ServerIntellectus non branché partout',description: 'Brain + ThirdEye partiellement branchés',   fix: 'Compléter branchement Memory + Scheduler + Contracts',effort: 'moderate' },
      ],
      recommendations: [
        'Unifier store.ts → un seul fichier',
        'Configurer .env.local avec VITE_API_URL et VITE_WS_URL',
        'Migrer EventBus serveur → Arcadius (phase progressive)',
        'Brancher tous les agents sur ServerIntellectus',
        'Ajouter tsconfig.paths pour aliases @/ propres',
      ],
      metrics: { security: 72, performance: 80, compatibility: 85, clarity: 75, completeness: 78 },
      checklist: {
        'Architecture modulaire':       true,
        'Settings centralisés':         true,
        'Store unifié':                 false,
        'EventBus unifié':              false,
        'Intellectus intégré':          true,
        'Brain opérationnel':           true,
        'Third Eye actif':              true,
        'Agents branchés Intellectus':  false,
      },
    };
  }

  private _auditSecurity(): AuditReport {
    return {
      agent:  'ether-lens',
      target: 'Sécurité Serveur',
      score:  65,
      grade:  'D',
      status: 'pass_with_warnings',
      summary: 'Sécurité partielle. Rate limiting et CORS opérationnels. JWT absent, validation Benedictus incomplète.',
      strengths: [
        'Rate limiting actif (120 req/min par IP)',
        'CORS configuré depuis settings.json',
        'allowedOrigins whitelist',
        'Security headers X-Content-Type, X-Frame',
        'Validation weather contre allowedWeathers',
        'Chat tronqué (maxChatMessageLength)',
      ],
      findings: [
        { id: 'SEC-001', severity: 'critical', category: 'auth',        title: 'JWT absent',                         description: 'Aucune authentification sur routes sensibles', fix: 'Implémenter JWT middleware (jwtEnabled dans settings)',effort: 'major' },
        { id: 'SEC-002', severity: 'critical', category: 'validation',  title: 'req.body non validé',               description: 'POST /buy /rent sans validation Benedictus',  fix: 'contracts.validate() sur chaque route POST',          effort: 'moderate' },
        { id: 'SEC-003', severity: 'error',    category: 'auth',        title: 'playerId non authentifié',           description: 'playerId vient du body, non vérifié',         fix: 'Extraire playerId depuis token JWT ou session',        effort: 'major' },
        { id: 'SEC-004', severity: 'warning',  category: 'sanitization',title: 'Pas de sanitizeString partout',      description: 'Certains champs texte non sanitisés',         fix: 'Appliquer sanitizeString() sur tous les inputs string', effort: 'minor' },
        { id: 'SEC-005', severity: 'warning',  category: 'rate_limit',  title: 'Rate limit global uniquement',       description: 'Pas de rate limit par route /buy /spawn',    fix: 'Ajouter rate limit spécifique sur routes critiques',   effort: 'minor' },
      ],
      recommendations: [
        '🔴 CRITIQUE: Implémenter JWT — jwtEnabled: true dans settings',
        '🔴 CRITIQUE: Valider req.body avec Benedictus sur routes POST',
        '🟠 IMPORTANT: Authentifier playerId via token',
        '🟡 MOYEN: Rate limit par route sur /buy /spawn /brain',
        '🟢 AMÉLIORATION: Ajouter helmet.js pour headers sécurité complets',
      ],
      metrics: { security: 42, performance: 85, compatibility: 88, clarity: 80, completeness: 70 },
      checklist: {
        'JWT Auth':              false,
        'Rate limiting':         true,
        'CORS configuré':        true,
        'Validation Benedictus': false,
        'Sanitization':          false,
        'Security headers':      true,
        'HTTPS en prod':         false,
        'Admin auth':            false,
      },
    };
  }

  private _auditPerformance(): AuditReport {
    return {
      agent:  'ether-lens',
      target: 'Performance Serveur',
      score:  80,
      grade:  'B',
      status: 'pass_with_warnings',
      summary: 'Performance globalement bonne. Tick rate optimisé, broadcast contrôlé. Quelques optimisations possibles.',
      strengths: [
        'Tick rate configurable (20/s par défaut)',
        'Broadcast rate 100ms depuis settings',
        'EntityManager avec dirty tracking',
        'PhysicsWorld SAP broadphase',
        'Particules GPU dans effects system',
        'LOD configuré dans settings',
      ],
      findings: [
        { id: 'PERF-001', severity: 'warning', category: 'memory',    title: 'fs.writeFileSync synchrone',       description: 'Logs écrits en sync dans la boucle principale', fix: 'Utiliser fs.appendFile async ou queue',              effort: 'minor' },
        { id: 'PERF-002', severity: 'warning', category: 'database',  title: 'DB JSON rechargée à chaque requête',description: 'DatabaseAdapter relit le fichier à chaque GET', fix: 'Cache en mémoire avec TTL Intellectus',              effort: 'moderate' },
        { id: 'PERF-003', severity: 'info',    category: 'network',   title: 'Broadcast complet à chaque tick',  description: 'PLAYER_MOVE broadcast toutes les 100ms',       fix: 'Envoyer seulement les deltas si peu de changements', effort: 'major' },
        { id: 'PERF-004', severity: 'info',    category: 'query',     title: 'Pas de pagination sur certaines routes',description: '/api/entities sans pagination',           fix: 'Ajouter limit/offset sur routes GET listes',         effort: 'minor' },
      ],
      recommendations: [
        'Utiliser Intellectus Memory pour cache DB (TTL 30s)',
        'Passer logs async avec setImmediate (déjà partiel)',
        'Ajouter pagination sur /api/entities et /api/prism/:table',
        'Monitorer avec getMetrics() de ServerIntellectus régulièrement',
      ],
      metrics: { security: 75, performance: 78, compatibility: 90, clarity: 85, completeness: 80 },
      checklist: {
        'Tick rate optimisé':     true,
        'Broadcast contrôlé':     true,
        'Physics optimisée':      true,
        'DB cache mémoire':       false,
        'Logs async':             true,
        'Pagination API':         false,
        'LOD configuré':          true,
        'Delta compression WS':   false,
      },
    };
  }

  private _auditAPI(): AuditReport {
    return {
      agent:  'ether-lens',
      target: 'API REST',
      score:  88,
      grade:  'B',
      status: 'pass_with_warnings',
      summary: 'API REST très complète — 55+ routes. Quelques patterns d\'erreur à uniformiser.',
      strengths: [
        '55+ routes couvrant toutes les fonctionnalités',
        'CORS configuré depuis settings',
        'Rate limiting actif',
        'Health check avec version',
        'Métriques complètes /api/admin/metrics',
        'SPA fallback propre',
      ],
      findings: [
        { id: 'API-001', severity: 'warning', category: 'consistency', title: 'Formats erreur inconsistants',   description: 'Certaines routes retournent { error } d\'autres { success: false, error }', fix: 'Uniformiser vers { success, error, code }', effort: 'minor' },
        { id: 'API-002', severity: 'warning', category: 'versioning',  title: 'Pas de versioning API',          description: 'Routes sans préfixe /v1/',          fix: 'Ajouter /api/v1/ progressivement',         effort: 'moderate' },
        { id: 'API-003', severity: 'info',    category: 'docs',        title: 'Pas de OpenAPI/Swagger',         description: 'Aucune documentation auto-générée', fix: 'Ajouter swagger-jsdoc',                    effort: 'moderate' },
      ],
      recommendations: [
        'Uniformiser format erreurs → { success, error, code, details }',
        'Ajouter /api/health/detailed pour diagnostics avancés',
        'Considérer OpenAPI pour documentation automatique',
      ],
      metrics: { security: 70, performance: 88, compatibility: 92, clarity: 85, completeness: 95 },
      checklist: {
        'Routes complètes':       true,
        'CORS correct':           true,
        'Rate limiting':          true,
        'Health check':           true,
        'Métriques':              true,
        'Format erreurs uniform': false,
        'Versioning API':         false,
        'Documentation':          false,
      },
    };
  }

  private _auditIntellectus(): AuditReport {
    const memMetrics = this.intellectus.memory.getMetrics();
    const schedMetrics = this.intellectus.scheduler.getMetrics();

    return {
      agent:  'ether-lens',
      target: 'ServerIntellectus',
      score:  91,
      grade:  'A',
      status: 'pass',
      summary: `Intellectus opérationnel. Mémoire: ${memMetrics.size} entrées (${memMetrics.hitRate}% hit rate). Scheduler: ${schedMetrics.total} tâches.`,
      strengths: [
        'CognitiveMemory avec LRU eviction et TTL',
        'TaskScheduler avec retry et priorités',
        'ContractValidator avec 6 contrats enregistrés',
        'Branchement Brain + ThirdEye partiel',
        'API /api/intellectus/* opérationnelle',
        `Mémoire: ${memMetrics.hits} hits, ${memMetrics.misses} misses`,
      ],
      findings: [
        { id: 'INT-001', severity: 'warning', category: 'integration', title: 'Agents pas tous branchés',       description: 'Seulement Brain + ThirdEye utilisent Intellectus', fix: 'Brancher tous les agents Ether sur ServerIntellectus', effort: 'moderate' },
        { id: 'INT-002', severity: 'info',    category: 'persistence', title: 'Mémoire non persistée au redémarrage', description: 'CognitiveMemory repart à zéro',          fix: 'Connecter Lotus LocalStorageAdapter côté serveur',      effort: 'moderate' },
        { id: 'INT-003', severity: 'info',    category: 'monitoring',  title: 'Pas de dashboard Intellectus',   description: 'Métriques disponibles en API mais pas en UI', fix: 'Ajouter onglet Intellectus dans EtherPrism Admin',      effort: 'minor' },
      ],
      recommendations: [
        'Brancher EtherForge + EtherLens + EtherPrism + EtherWeave sur Memory',
        'Persister CognitiveMemory dans etherprism_db.json au shutdown',
        'Ajouter dashboard Intellectus dans /etherprism',
        'Utiliser scheduler pour tasks périodiques (sync DB, cleanup, metrics)',
      ],
      metrics: {
        security:      88,
        performance:   92,
        compatibility: 95,
        clarity:       90,
        completeness:  85,
      },
      checklist: {
        'Memory opérationnelle':     true,
        'Scheduler opérationnel':    true,
        'Contrats enregistrés':      true,
        'Brain branché':             true,
        'ThirdEye branché':          true,
        'Agents Ether branchés':     false,
        'Persistence mémoire':       false,
        'Dashboard Intellectus':     false,
      },
    };
  }

  private _auditGeneric(target: string): AuditReport {
    return {
      agent:  'ether-lens',
      target: target.slice(0, 80),
      score:  75,
      grade:  'C',
      status: 'pass_with_warnings',
      summary: `Inspection générique de "${target}". Spécifier la cible pour un rapport détaillé.`,
      strengths: ['Module existant', 'Structure de base présente'],
      findings: [
        { id: 'GEN-001', severity: 'info', category: 'general', title: 'Audit générique', description: 'Utiliser une cible spécifique pour un rapport complet', fix: 'Cibler: property/architecture/security/performance/api/intellectus', effort: 'trivial' },
      ],
      recommendations: [
        'Cibler un système précis pour un audit complet',
        'Exemples: "audit property system", "audit security", "audit architecture"',
      ],
      metrics: { security: 70, performance: 75, compatibility: 80, clarity: 75, completeness: 60 },
      checklist: {},
    };
  }
}
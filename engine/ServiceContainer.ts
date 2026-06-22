// ══════════════════════════════════════════════════════════════════════════════
// Service Container — IoC Robuste à Cycle de Vie Strict & Anti-Dépendance Circulaire
// Standard EtherWorld RP · NexusCore v3
// ══════════════════════════════════════════════════════════════════════════════

// 1. Registre Central des Services (Garantit le typage fort de .get() et des helpers)
export interface IServiceRegistry {
  database: any;       // Remplace 'any' par tes vraies interfaces/classes (ex: PrismaClient)
  entityManager: any;  // ex: EntityManager
  physicsWorld: any;   // ex: CannonPhysicsWorld
  worldState: any;     // ex: WorldState
  gateway: any;        // ex: WebSocketGateway
  snapshotter: any;    // ex: Snapshotter
  moduleLoader: any;   // ex: ModuleLoader
  brain: any;          // ex: TroxtBrain
}

type ServiceKey = keyof IServiceRegistry;
type ServiceFactory<T> = (container: ServiceContainer) => T;

// Interfaces de Cycle de Vie optionnelles pour tes services
export interface IInitializable { initialize(): Promise<void> | void; }
export interface IStartable     { start(): Promise<void> | void; }
export interface IDisposable    { dispose(): Promise<void> | void; }

class ServiceContainer {
  private readonly _services = new Map<ServiceKey, any>();
  private readonly _factories = new Map<ServiceKey, ServiceFactory<any>>();
  private readonly _instantiating = new Set<ServiceKey>(); // Guard anti-boucle circulaire
  private _isInitialized = false;
  private _isStarted = false;

  /**
   * Enregistre une factory (lazy loading par défaut).
   */
  register<K extends ServiceKey>(name: K, factory: ServiceFactory<IServiceRegistry[K]>): this {
    if (this._services.has(name)) {
      throw new Error(`[Container] Impossible d'enregistrer la factory: L'instance '${name}' existe déjà.`);
    }
    this._factories.set(name, factory);
    return this;
  }

  /**
   * Enregistre directement une instance déjà créée.
   */
  registerInstance<K extends ServiceKey>(name: K, instance: IServiceRegistry[K]): this {
    this._services.set(name, instance);
    this._factories.delete(name);
    return this;
  }

  /**
   * Récupère un service de manière synchrone avec vérification circulaire.
   */
  get<K extends ServiceKey>(name: K): IServiceRegistry[K] {
    // 1. Retour immédiat si déjà instancié
    if (this._services.has(name)) {
      return this._services.get(name);
    }

    // 2. Détection de boucle circulaire
    if (this._instantiating.has(name)) {
      const chain = [...this._instantiating, name].join(' -> ');
      throw new Error(`[Container] Dépendance circulaire critique détectée : ${chain}`);
    }

    const factory = this._factories.get(name);
    if (!factory) {
      throw new Error(`[Container] Service inconnu ou non enregistré : '${name}'`);
    }

    // 3. Instanciation sécurisée
    this._instantiating.add(name);
    try {
      const instance = factory(this);
      this._services.set(name, instance);
      return instance;
    } finally {
      this._instantiating.delete(name); // Nettoyage du guard
    }
  }

  /**
   * Force l'instanciation immédiate de toutes les factories enregistrées.
   * Crucial pour éviter le lag au premier appel in-game.
   */
  preloadAll(): void {
    for (const key of this._factories.keys()) {
      this.get(key);
    }
  }

  /**
   * Phase 1 : Initialisation asynchrone ordonnée de tous les services éligibles.
   */
  async initializeAll(): Promise<void> {
    if (this._isInitialized) return;
    this.preloadAll(); // On s'assure que tout est instancié

    for (const [name, service] of this._services.entries()) {
      if (service && typeof (service as IInitializable).initialize === 'function') {
        try {
          await (service as IInitializable).initialize();
        } catch (error) {
          throw new Error(`[Container] Échec de l'initialisation du service '${name}': ${(error as Error).message}`);
        }
      }
    }
    this._isInitialized = true;
  }

  /**
   * Phase 2 : Démarrage asynchrone (activation des écoutes réseaux, ticks, etc.)
   */
  async startAll(): Promise<void> {
    if (!this._isInitialized) await this.initializeAll();
    if (this._isStarted) return;

    for (const [name, service] of this._services.entries()) {
      if (service && typeof (service as IStartable).start === 'function') {
        try {
          await (service as IStartable).start();
        } catch (error) {
          throw new Error(`[Container] Échec du démarrage du service '${name}': ${(error as Error).message}`);
        }
      }
    }
    this._isStarted = true;
  }

  /**
   * Vérifie la présence d'un service ou d'une factory.
   */
  has(name: ServiceKey): boolean {
    return this._services.has(name) || this._factories.has(name);
  }

  /**
   * Extinction propre et asynchrone du conteneur et déconnexion des services.
   */
  async dispose(): Promise<void> {
    // Parcourt à l'envers pour couper les services récents en premier
    const instances = Array.from(this._services.entries()).reverse();

    for (const [name, service] of instances) {
      if (service && typeof (service as IDisposable).dispose === 'function') {
        try {
          await (service as IDisposable).dispose();
        } catch (error) {
          console.error(`[Container] Erreur lors du dispose du service '${name}':`, error);
        }
      }
    }

    this._services.clear();
    this._factories.clear();
    this._instantiating.clear();
    this._isInitialized = false;
    this._isStarted = false;
  }
}

// Export de l'instance unique (Singleton)
export const container = new ServiceContainer();

// ── Helpers de Convenance Fortement Typés ────────────────────────────────────
export const getDatabase       = () => container.get('database');
export const getEntityManager  = () => container.get('entityManager');
export const getPhysicsWorld   = () => container.get('physicsWorld');
export const getWorldState     = () => container.get('worldState');
export const getGateway        = () => container.get('gateway');
export const getSnapshotter    = () => container.get('snapshotter');
export const getModuleLoader   = () => container.get('moduleLoader');
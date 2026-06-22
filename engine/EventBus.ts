// server/engine/EventBus.ts
// ============================================================
//  EVENT BUS V2 — Pub/Sub global boosté
//  Features: Wildcards namespacés, Priorités, Middleware,
//  pause/resume, Stats perf, replay(), emitAsync(), waitFor()
// ============================================================

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

const PRIORITY_VALUE: Record<EventPriority, number> = {
  critical: 3,
  high:     2,
  normal:   1,
  low:      0,
};

// ============================================================
//  TYPES
// ============================================================

export interface EventRecord {
  type:      string;
  data:      any;
  timestamp: number;
  source?:   string;
}

export interface EventStats {
  count:         number;
  totalMs:       number;
  avgMs:         number;
  lastError:     string | null;
  lastEmittedAt: number | null;
}

type MiddlewareFn = (event: EventRecord) => EventRecord | null | false;

interface ListenerEntry {
  handler:  Function;
  priority: number;
  once:     boolean;
}

// ============================================================
//  EVENT BUS V2
// ============================================================

export class EventBus {

  // ──────────────────────────────────────────
  //  STOCKAGE
  // ──────────────────────────────────────────
  private _listeners:   Map<string, Set<ListenerEntry>> = new Map();
  private _history:     EventRecord[]                   = [];
  private _middlewares: MiddlewareFn[]                  = [];
  private _stats:       Map<string, EventStats>         = new Map();

  // ──────────────────────────────────────────
  //  CONFIG
  // ──────────────────────────────────────────
  private readonly _maxHistory: number;
  private _debug:   boolean = false;

  // ──────────────────────────────────────────
  //  PAUSE / QUEUE
  // ──────────────────────────────────────────
  private _paused:      boolean       = false;
  private _pausedQueue: EventRecord[] = [];

  // ──────────────────────────────────────────
  //  SINGLETON
  // ──────────────────────────────────────────
  private static _instance: EventBus | null = null;

  public static getInstance(): EventBus {
    if (!EventBus._instance) {
      EventBus._instance = new EventBus();
    }
    return EventBus._instance;
  }

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(options: { maxHistory?: number; debug?: boolean } = {}) {
    this._maxHistory = options.maxHistory ?? 200;
    this._debug      = options.debug      ?? false;
    console.log('[EventBus V2] Initialisé');
  }

  // ============================================================
  //  SUBSCRIBE
  // ============================================================

  /**
   * S'abonne à un événement.
   * Supporte wildcards : '*' (tous) et 'namespace:*' (namespace entier)
   * @returns unsubscribe function
   */
  public on(
    eventType: string,
    handler:   Function,
    options:   { priority?: EventPriority; priorityValue?: number } = {}
  ): () => void {
    if (typeof handler !== 'function') {
      throw new TypeError(`[EventBus] on("${eventType}") attend une fonction.`);
    }

    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, new Set());
    }

    const entry: ListenerEntry = {
      handler,
      priority: options.priorityValue
        ?? PRIORITY_VALUE[options.priority ?? 'normal'],
      once: false,
    };

    this._listeners.get(eventType)!.add(entry);

    if (this._debug) {
      console.debug(`[EventBus] +on "${eventType}" (priority=${entry.priority})`);
    }

    return () => this._removeEntry(eventType, entry);
  }

  /**
   * S'abonne une seule fois.
   * @returns unsubscribe function
   */
  public once(
    eventType: string,
    handler:   Function,
    options:   { priority?: EventPriority } = {}
  ): () => void {
    const wrapper: Function = (data: any) => {
      this._removeByHandler(eventType, wrapper);
      handler(data);
    };

    return this.on(eventType, wrapper, options);
  }

  /**
   * S'abonne à plusieurs événements à la fois.
   */
  public onMany(
    events:  string[],
    handler: Function,
    options: { priority?: EventPriority } = {}
  ): () => void {
    const unsubs = events.map(e => this.on(e, handler, options));
    return () => unsubs.forEach(u => u());
  }

  /**
   * Retire tous les handlers d'un type d'événement.
   */
  public offAll(eventType: string): void {
    this._listeners.delete(eventType);
  }

  /**
   * Retire un handler spécifique.
   */
  public off(eventType: string, handler: Function): void {
    this._removeByHandler(eventType, handler);
  }

  // ============================================================
  //  MIDDLEWARE
  // ============================================================

  /**
   * Ajoute un middleware exécuté avant chaque emit().
   * Retourner null/false pour bloquer l'émission.
   * @returns fonction pour retirer le middleware
   */
  public use(fn: MiddlewareFn): () => void {
    this._middlewares.push(fn);
    return () => {
      const idx = this._middlewares.indexOf(fn);
      if (idx >= 0) this._middlewares.splice(idx, 1);
    };
  }

  private _runMiddlewares(event: EventRecord): EventRecord | null {
    let current: EventRecord | null = event;

    for (const mw of this._middlewares) {
      try {
        const result = mw(current!);
        if (result === null || result === false) return null;
        if (result && typeof result === 'object') current = result;
      } catch (e) {
        console.error('[EventBus] Middleware error:', e);
      }
    }

    return current;
  }

  // ============================================================
  //  EMIT
  // ============================================================

  /**
   * Émet un événement de façon synchrone.
   * @returns nombre de handlers exécutés
   */
  public emit(
    eventType: string,
    data?:     any,
    source?:   string
  ): number {
    let event: EventRecord = {
      type:      eventType,
      data:      data ?? {},
      timestamp: Date.now(),
      source,
    };

    // Middleware pipeline
    const processed = this._runMiddlewares(event);
    if (!processed) {
      if (this._debug) {
        console.debug(`[EventBus] emit("${eventType}") bloqué par middleware`);
      }
      return 0;
    }
    event = processed;

    // Si pausé → queue
    if (this._paused) {
      this._pausedQueue.push(event);
      return 0;
    }

    return this._dispatch(event);
  }

  /**
   * Émet et attend la résolution de tous les handlers async.
   * @returns Promise<nombre de handlers>
   */
  public async emitAsync(
    eventType: string,
    data?:     any,
    source?:   string
  ): Promise<number> {
    let event: EventRecord = {
      type:      eventType,
      data:      data ?? {},
      timestamp: Date.now(),
      source,
    };

    const processed = this._runMiddlewares(event);
    if (!processed) return 0;
    event = processed;

    if (this._paused) {
      this._pausedQueue.push(event);
      return 0;
    }

    return this._dispatch(event, true);
  }

  /**
   * Émet après un délai.
   */
  public emitDelayed(
    eventType: string,
    data:      any,
    delayMs:   number,
    source?:   string
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => this.emit(eventType, data, source), delayMs);
  }

  /**
   * Émet sur tout un namespace (ex: 'entity' → tous les 'entity:*')
   */
  public emitNamespace(namespace: string, data?: any): void {
    const prefix = namespace.endsWith(':') ? namespace : `${namespace}:`;
    for (const type of this._listeners.keys()) {
      if (type.startsWith(prefix)) {
        this.emit(type, data);
      }
    }
  }

  // ──────────────────────────────────────────
  //  DISPATCH INTERNE
  // ──────────────────────────────────────────

  private _dispatch(event: EventRecord, awaitHandlers = false): any {
    // Historique
    this._history.push(event);
    if (this._history.length > this._maxHistory) this._history.shift();

    const matched = this._collectMatchingHandlers(event.type);

    if (matched.length === 0) {
      if (this._debug) {
        console.debug(`[EventBus] emit("${event.type}") — aucun listener`);
      }
      return awaitHandlers ? Promise.resolve(0) : 0;
    }

    const start    = Date.now();
    const pending: Promise<any>[] = [];

    for (const { registeredType, entry } of matched) {
      // Wildcards reçoivent l'event complet, sinon juste data
      const payload = (registeredType === '*' || registeredType.endsWith(':*'))
        ? event
        : event.data;

      try {
        const result = entry.handler(payload);
        if (awaitHandlers && result instanceof Promise) {
          pending.push(
            result.catch(e => {
              console.error(`[EventBus] async handler error for "${event.type}":`, e);
              this._recordError(event.type, e);
            })
          );
        }
      } catch (e) {
        console.error(`[EventBus] handler error for "${event.type}":`, e);
        this._recordError(event.type, e);
      }
    }

    this._recordStats(event.type, start);

    if (awaitHandlers) {
      return Promise.allSettled(pending).then(() => matched.length);
    }

    return matched.length;
  }

  // ──────────────────────────────────────────
  //  MATCHING (wildcard namespacé)
  // ──────────────────────────────────────────

  private _matches(registeredType: string, emittedType: string): boolean {
    if (registeredType === emittedType) return true;
    if (registeredType === '*') return true;

    // Wildcard namespacé : 'entity:*' match 'entity:spawn', 'entity:remove', etc.
    if (registeredType.endsWith(':*')) {
      const prefix = registeredType.slice(0, -1); // garde le ':'
      return emittedType.startsWith(prefix);
    }

    return false;
  }

  private _collectMatchingHandlers(
    eventType: string
  ): { registeredType: string; entry: ListenerEntry }[] {
    const results: { registeredType: string; entry: ListenerEntry }[] = [];

    for (const [registeredType, set] of this._listeners) {
      if (this._matches(registeredType, eventType)) {
        for (const entry of set) {
          results.push({ registeredType, entry });
        }
      }
    }

    // Tri par priorité décroissante
    results.sort((a, b) => b.entry.priority - a.entry.priority);

    return results;
  }

  // ============================================================
  //  ATTENTE
  // ============================================================

  /**
   * Attend un événement avec timeout et AbortSignal optionnel.
   */
  public waitFor(
    eventType: string,
    timeoutMs  = 5000,
    signal?:   AbortSignal
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsub();
        cleanup();
        reject(new Error(`[EventBus] Timeout waiting for "${eventType}" (${timeoutMs}ms)`));
      }, timeoutMs);

      const onAbort = () => {
        if (settled) return;
        settled = true;
        unsub();
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };

      const unsub = this.once(eventType, (data: any) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(data);
      });

      if (signal) {
        if (signal.aborted) { onAbort(); return; }
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  // ============================================================
  //  PAUSE / RESUME
  // ============================================================

  /**
   * Suspend la diffusion — les emit() suivants sont mis en file.
   */
  public pause(): void {
    this._paused = true;
    if (this._debug) console.debug('[EventBus] ⏸ Pausé');
  }

  /**
   * Reprend la diffusion et vide la file dans l'ordre d'arrivée.
   */
  public resume(): void {
    this._paused = false;
    const queue  = this._pausedQueue;
    this._pausedQueue = [];

    if (this._debug) {
      console.debug(`[EventBus] ▶ Repris — ${queue.length} events en file`);
    }

    for (const event of queue) {
      this._dispatch(event);
    }
  }

  // ============================================================
  //  REPLAY
  // ============================================================

  /**
   * Rejoue l'historique sur un handler (sans re-déclencher les autres listeners).
   * Utile pour un listener qui s'abonne tardivement.
   * @returns nombre d'events rejoués
   */
  public replay(
    handler: Function,
    filter?: string
  ): number {
    const events = filter
      ? this._history.filter(e => e.type === filter)
      : [...this._history];

    for (const event of events) {
      try {
        handler(event.data, event);
      } catch (e) {
        console.error('[EventBus] replay handler error:', e);
      }
    }

    return events.length;
  }

  // ============================================================
  //  STATS & PERF
  // ============================================================

  private _recordStats(eventType: string, startMs: number): void {
    const elapsed = Date.now() - startMs;
    const prev    = this._stats.get(eventType) ?? {
      count: 0, totalMs: 0, avgMs: 0,
      lastError: null, lastEmittedAt: null,
    };

    const count   = prev.count + 1;
    const totalMs = prev.totalMs + elapsed;

    this._stats.set(eventType, {
      count,
      totalMs,
      avgMs:         totalMs / count,
      lastError:     prev.lastError,
      lastEmittedAt: Date.now(),
    });
  }

  private _recordError(eventType: string, error: any): void {
    const prev = this._stats.get(eventType) ?? {
      count: 0, totalMs: 0, avgMs: 0,
      lastError: null, lastEmittedAt: null,
    };
    this._stats.set(eventType, {
      ...prev,
      lastError: error?.message ?? String(error),
    });
  }

  public getStats(eventType?: string): EventStats | Record<string, EventStats> | null {
    if (eventType) return this._stats.get(eventType) ?? null;
    return Object.fromEntries(this._stats);
  }

  public resetStats(): void {
    this._stats.clear();
  }

  // ============================================================
  //  HISTORIQUE
  // ============================================================

  public getHistory(filter?: string): EventRecord[] {
    if (!filter) return [...this._history];
    return this._history.filter(e => e.type === filter);
  }

  public clearHistory(): void {
    this._history = [];
  }

  // ============================================================
  //  INTROSPECTION
  // ============================================================

  public getEventTypes(): string[] {
    return Array.from(this._listeners.keys());
  }

  public hasListeners(eventType: string): boolean {
    return (this._listeners.get(eventType)?.size ?? 0) > 0;
  }

  public listenerCount(eventType: string): number {
    return this._listeners.get(eventType)?.size ?? 0;
  }

  public setDebug(enabled: boolean): void {
    this._debug = enabled;
  }

  // ============================================================
  //  CLEANUP
  // ============================================================

  public dispose(): void {
    this._listeners.clear();
    this._middlewares = [];
    this._history     = [];
    this._pausedQueue = [];
    this._stats.clear();
    console.log('[EventBus] Disposé');
  }

  // ============================================================
  //  HELPERS PRIVÉS
  // ============================================================

  private _removeEntry(eventType: string, entry: ListenerEntry): void {
    const set = this._listeners.get(eventType);
    if (!set) return;
    set.delete(entry);
    if (set.size === 0) this._listeners.delete(eventType);
  }

  private _removeByHandler(eventType: string, handler: Function): void {
    const set = this._listeners.get(eventType);
    if (!set) return;
    for (const entry of set) {
      if (entry.handler === handler) {
        set.delete(entry);
        break;
      }
    }
    if (set.size === 0) this._listeners.delete(eventType);
  }
}

// ============================================================
//  SINGLETON GLOBAL
// ============================================================
export const globalBus = EventBus.getInstance();
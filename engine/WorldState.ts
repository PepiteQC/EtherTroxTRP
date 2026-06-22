// server/engine/WorldState.ts
import type { WorldState as IWorldState, WeatherType } from '../../shared/types';
import { WORLD } from '../../shared/constants';
import { clamp, formatTimeOfDay } from '../../shared/utils';

// ============================================================
//  TYPES
// ============================================================

export interface WorldStateSnapshot {
  id:          string;
  createdAt:   string;
  type:        'auto' | 'manual' | 'backup';
  description: string;
  state:       IWorldState;
}

type WorldStateEvent =
  | 'weather:change'
  | 'time:change'
  | 'status:change'
  | 'state:update';

// ============================================================
//  WORLD STATE MANAGER
// ============================================================

export class WorldStateManager {

  // ──────────────────────────────────────────
  //  ÉTAT
  // ──────────────────────────────────────────
  private _state: IWorldState;

  // ──────────────────────────────────────────
  //  CYCLE JOUR/NUIT
  // ──────────────────────────────────────────
  private _timeRunning:    boolean = true;
  private _timeSpeed:      number  = 1.0;  // 1 = temps réel, 60 = 1min = 1h jeu
  private _dayDurationMs:  number  = 24 * 60 * 1000; // 24min réelles = 24h jeu

  // ──────────────────────────────────────────
  //  MÉTÉO
  // ──────────────────────────────────────────
  private _weatherDuration:   number  = 0;
  private _weatherTimer:      number  = 0;
  private _weatherTransition: boolean = false;

  // ──────────────────────────────────────────
  //  EVENTS
  // ──────────────────────────────────────────
  private _listeners: Map<string, Set<Function>> = new Map();

  // ──────────────────────────────────────────
  //  CONSTRUCTEUR
  // ──────────────────────────────────────────
  constructor(initial?: Partial<IWorldState>) {
    this._state = {
      worldName:    initial?.worldName    ?? WORLD.NAME,
      timeOfDay:    initial?.timeOfDay    ?? WORLD.DEFAULT_TIME,
      weather:      initial?.weather      ?? (WORLD.DEFAULT_WEATHER as WeatherType),
      gravity:      initial?.gravity      ?? Math.abs(WORLD.GRAVITY),
      maxPlayers:   initial?.maxPlayers   ?? WORLD.MAX_PLAYERS,
      serverStatus: initial?.serverStatus ?? 'running',
      statistics: {
        totalJoins: initial?.statistics?.totalJoins ?? 0,
        totalSaves: initial?.statistics?.totalSaves ?? 0,
        uptime:     initial?.statistics?.uptime     ?? 0,
      },
    };

    // Durée météo aléatoire initiale (5–15 min)
    this._resetWeatherTimer();

    console.log(
      `[WorldState] Initialisé — ${this._state.worldName}`,
      `| Time: ${formatTimeOfDay(this._state.timeOfDay)}`,
      `| Weather: ${this._state.weather}`
    );
  }

  // ──────────────────────────────────────────
  //  UPDATE (appelé à chaque tick serveur)
  // ──────────────────────────────────────────

  public update(deltaTime: number): void {
    this._updateTime(deltaTime);
    this._updateWeather(deltaTime);
    this._state.statistics.uptime += deltaTime;
  }

  // ──────────────────────────────────────────
  //  CYCLE JOUR / NUIT
  // ──────────────────────────────────────────

  private _updateTime(dt: number): void {
    if (!this._timeRunning) return;
    if (this._state.serverStatus !== 'running') return;

    // Avancer le temps (24h / dayDurationMs)
    const hoursPerSecond = (24 / (this._dayDurationMs / 1000)) * this._timeSpeed;
    this._state.timeOfDay = (this._state.timeOfDay + hoursPerSecond * dt) % 24;

    // Émettre changement toutes les heures de jeu
    const hour = Math.floor(this._state.timeOfDay);
    if (this._lastHour !== hour) {
      this._lastHour = hour;
      this._emit('time:change', this._state.timeOfDay);
    }
  }

  private _lastHour: number = -1;

  // ──────────────────────────────────────────
  //  MÉTÉO
  // ──────────────────────────────────────────

  private _updateWeather(dt: number): void {
    this._weatherTimer += dt;

    if (this._weatherTimer >= this._weatherDuration) {
      this._autoChangeWeather();
    }
  }

  private _autoChangeWeather(): void {
    const weathers: WeatherType[] = ['clear', 'clear', 'clear', 'rain', 'fog', 'snow'];
    const weights                  = [0.4, 0.2, 0.1, 0.15, 0.1, 0.05];

    // Choix pondéré (favorise le beau temps)
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let next: WeatherType = 'clear';
    for (let i = 0; i < weathers.length; i++) {
      r -= weights[i];
      if (r <= 0) { next = weathers[i]; break; }
    }

    if (next !== this._state.weather) {
      this.setWeather(next);
    }

    this._resetWeatherTimer();
  }

  private _resetWeatherTimer(): void {
    this._weatherTimer    = 0;
    // Durée aléatoire entre 5 et 20 minutes
    this._weatherDuration = (5 + Math.random() * 15) * 60;
  }

  // ──────────────────────────────────────────
  //  SETTERS PUBLICS
  // ──────────────────────────────────────────

  public setWeather(weather: WeatherType): void {
    const prev = this._state.weather;
    this._state.weather = weather;
    this._weatherTransition = true;

    setTimeout(() => {
      this._weatherTransition = false;
    }, 3000);

    this._emit('weather:change', { from: prev, to: weather });
    this._emit('state:update', this.serialize());
    console.log(`[WorldState] Météo: ${prev} → ${weather}`);
  }

  public setTimeOfDay(hour: number): void {
    this._state.timeOfDay = clamp(hour, 0, 23.99);
    this._lastHour        = Math.floor(this._state.timeOfDay);
    this._emit('time:change', this._state.timeOfDay);
    this._emit('state:update', this.serialize());
  }

  public setTimeSpeed(speed: number): void {
    this._timeSpeed = clamp(speed, 0, 100);
    console.log(`[WorldState] Vitesse temps: x${this._timeSpeed}`);
  }

  public pauseTime(): void {
    this._timeRunning = false;
    console.log('[WorldState] Temps pausé');
  }

  public resumeTime(): void {
    this._timeRunning = true;
    console.log('[WorldState] Temps repris');
  }

  public setServerStatus(status: IWorldState['serverStatus']): void {
    const prev = this._state.serverStatus;
    this._state.serverStatus = status;
    this._emit('status:change', { from: prev, to: status });
    this._emit('state:update', this.serialize());
    console.log(`[WorldState] Status: ${prev} → ${status}`);
  }

  public setGravity(g: number): void {
    this._state.gravity = clamp(Math.abs(g), 0, 50);
    this._emit('state:update', this.serialize());
  }

  public incrementJoins(): void {
    this._state.statistics.totalJoins++;
  }

  public incrementSaves(): void {
    this._state.statistics.totalSaves++;
  }

  // ──────────────────────────────────────────
  //  GETTERS
  // ──────────────────────────────────────────

  get timeOfDay():    number                    { return this._state.timeOfDay; }
  get weather():      WeatherType               { return this._state.weather; }
  get serverStatus(): IWorldState['serverStatus']{ return this._state.serverStatus; }
  get isRunning():    boolean                   { return this._state.serverStatus === 'running'; }
  get isPaused():     boolean                   { return this._state.serverStatus === 'paused'; }
  get statistics():   IWorldState['statistics'] { return this._state.statistics; }
  get gravity():      number                    { return this._state.gravity; }
  get worldName():    string                    { return this._state.worldName; }

  /**
   * Est-ce la nuit ? (20h → 6h)
   */
  get isNight(): boolean {
    return this._state.timeOfDay >= 20 || this._state.timeOfDay < 6;
  }

  /**
   * Intensité soleil (0 = nuit, 1 = midi)
   */
  get sunIntensity(): number {
    const t = this._state.timeOfDay;
    if (t < 6 || t > 20)  return 0;
    if (t >= 11 && t <= 14) return 1;
    if (t < 11) return (t - 6)  / 5;
    return (20 - t) / 6;
  }

  /**
   * Couleur du ciel selon l'heure
   */
  get skyColor(): string {
    const t = this._state.timeOfDay;
    if (t < 5  || t > 22) return '#02020a'; // Nuit profonde
    if (t < 6  || t > 21) return '#1a0a2e'; // Nuit
    if (t < 7  || t > 20) return '#ff6b35'; // Aube / Crépuscule
    if (t < 8  || t > 19) return '#ff9f43'; // Lever / Coucher
    if (t < 10 || t > 17) return '#74b9ff'; // Matin / Soir
    return '#0a84ff'; // Journée
  }

  /**
   * Est en transition météo
   */
  get isWeatherTransitioning(): boolean {
    return this._weatherTransition;
  }

  // ──────────────────────────────────────────
  //  SÉRIALISATION
  // ──────────────────────────────────────────

  public serialize(): IWorldState {
    return {
      ...this._state,
      statistics: { ...this._state.statistics },
    };
  }

  public serializeExtended(): IWorldState & {
    isNight:           boolean;
    sunIntensity:      number;
    skyColor:          string;
    timeFormatted:     string;
    weatherTransition: boolean;
    timeSpeed:         number;
  } {
    return {
      ...this.serialize(),
      isNight:           this.isNight,
      sunIntensity:      this.sunIntensity,
      skyColor:          this.skyColor,
      timeFormatted:     formatTimeOfDay(this._state.timeOfDay),
      weatherTransition: this._weatherTransition,
      timeSpeed:         this._timeSpeed,
    };
  }

  /**
   * Restore depuis un snapshot
   */
  public restore(state: IWorldState): void {
    this._state = {
      ...state,
      statistics: { ...state.statistics },
    };
    this._lastHour = Math.floor(this._state.timeOfDay);
    this._emit('state:update', this.serialize());
    console.log('[WorldState] État restauré depuis snapshot');
  }

  // ──────────────────────────────────────────
  //  EVENTS
  // ──────────────────────────────────────────

  public on(event: WorldStateEvent, listener: Function): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  public off(event: WorldStateEvent, listener: Function): void {
    this._listeners.get(event)?.delete(listener);
  }

  private _emit(event: string, ...args: any[]): void {
    this._listeners.get(event)?.forEach(fn => {
      try { fn(...args); } catch(e) {
        console.error(`[WorldState] Event error (${event}):`, e);
      }
    });
  }
}
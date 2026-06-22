// server/modules/TroxTMod/effects/index.ts
import { ModuleLoader } from '../../ModuleLoader';
import { EFFECT_IDS }   from '../../../../shared/constants';

export function registerEffects(loader: ModuleLoader): void {

  loader.registerEffect(EFFECT_IDS.EXPLOSION, {
    name:         'Explosion',
    particleCount: 200,
    duration:     1.5,
    radius:       5,
    colors:       ['#ff4400', '#ff8800', '#ffcc00', '#888888'],
    sound:        '/assets/sounds/explosion.mp3',
    lightColor:   '#ff6600',
    lightRadius:  15,
    lightDuration: 0.3,
  });

  loader.registerEffect(EFFECT_IDS.FIRE, {
    name:         'Fire',
    particleCount: 80,
    duration:     -1, // Infini
    colors:       ['#ff2200', '#ff6600', '#ffaa00'],
    sound:        '/assets/sounds/fire_loop.mp3',
    loop:         true,
  });

  loader.registerEffect(EFFECT_IDS.SMOKE, {
    name:         'Smoke',
    particleCount: 40,
    duration:     3.0,
    colors:       ['#444444', '#666666', '#888888'],
    opacity:      0.6,
  });

  loader.registerEffect(EFFECT_IDS.SPARKS, {
    name:         'Sparks',
    particleCount: 30,
    duration:     0.8,
    colors:       ['#ffff00', '#ffcc00', '#ffffff'],
    sound:        '/assets/sounds/sparks.mp3',
  });

  loader.registerEffect(EFFECT_IDS.WATER_SPLASH, {
    name:         'Water Splash',
    particleCount: 60,
    duration:     1.0,
    colors:       ['#4488ff', '#6699ff', '#aaccff'],
    sound:        '/assets/sounds/splash.mp3',
  });

  loader.registerEffect(EFFECT_IDS.BEAM_BLUE, {
    name:    'Blue Beam',
    type:    'beam',
    color:   '#0088ff',
    width:   0.05,
    glowIntensity: 0.8,
  });

  loader.registerEffect(EFFECT_IDS.BEAM_RED, {
    name:    'Red Beam',
    type:    'beam',
    color:   '#ff2200',
    width:   0.05,
    glowIntensity: 0.8,
  });

  console.log(`   ⚡ ${loader.getStats().effects} effets enregistrés`);
}
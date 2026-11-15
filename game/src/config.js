// AURORA WAKE — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Beat the wave-10 boss to win; after the win the game rolls on in endless mode. */
export const WIN_WAVE = 10;
/** A boss guards every fifth wave. */
export const BOSS_EVERY = 5;

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 340,
  drag: 0.86,
  hull: 100,
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletDamage: 12,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerable: 1.2,
  magnetRadius: 90,
  pickupRadius: 26,
};

export const BULLET = { radius: 5, life: 0.9 };
export const ENEMY_BULLET = { radius: 7, speed: 240, life: 5 };

/** Enemy kinds: how they move, how tough they are, what they pay. */
export const ENEMIES = {
  drifter: { radius: 16, hp: 20, speed: 95, score: 50, shards: 2, colour: '#f472b6', turn: 3.2 },
  weaver: { radius: 14, hp: 14, speed: 170, score: 80, shards: 3, colour: '#fb923c', turn: 5.0 },
  spitter: { radius: 18, hp: 30, speed: 70, score: 100, shards: 4, colour: '#a78bfa', turn: 2.2 },
  brute: { radius: 30, hp: 140, speed: 52, score: 200, shards: 8, colour: '#f87171', turn: 1.6 },
};

export const BOSS = {
  name: 'THE MAW',
  radius: 64,
  hp: 900,
  speed: 46,
  score: 5000,
  shards: 60,
  colour: '#e879f9',
};

/** Kills chained inside this window raise the combo multiplier, up to COMBO_MAX. */
export const COMBO = { window: 3.0, max: 8 };

/** What a wave is made of: counts grow with the wave number. */
export function waveComposition(wave) {
  const n = wave;
  return {
    drifter: 4 + n * 2,
    weaver: n >= 2 ? 1 + n : 0,
    spitter: n >= 3 ? 1 + Math.floor(n * 0.8) : 0,
    brute: n >= 4 ? Math.floor((n - 2) / 2) : 0,
    boss: n % BOSS_EVERY === 0,
  };
}

/** The between-wave shop: spend shards on lasting upgrades. */
export const UPGRADES = [
  { id: 'damage', name: 'STARLANCE', desc: '+35% bullet damage', cost: 30, apply: (p) => { p.damageMul *= 1.35; } },
  { id: 'rapid', name: 'SWIFT TRIGGER', desc: '+25% fire rate', cost: 25, apply: (p) => { p.fireMul *= 1.25; } },
  { id: 'hull', name: 'AEGIS PLATING', desc: '+40 max hull, repair 40', cost: 25, apply: (p) => { p.maxHull += 40; p.hull = Math.min(p.maxHull, p.hull + 40); } },
  { id: 'dash', name: 'SLIPSTREAM', desc: 'Dash recharges 40% faster', cost: 20, apply: (p) => { p.dashMul *= 1.4; } },
  { id: 'magnet', name: 'TIDE MAGNET', desc: 'Shards fly to you from 2x as far', cost: 15, apply: (p) => { p.magnetMul *= 2; } },
  { id: 'spread', name: 'TWIN CANNONS', desc: '+1 bullet per shot', cost: 60, apply: (p) => { p.bullets += 1; } },
];

export const PALETTE = {
  space: '#070b1d',
  spaceDeep: '#04060f',
  auroraTeal: '#2de2c5',
  auroraViolet: '#8b5cf6',
  auroraPink: '#f472b6',
  gold: '#fbbf24',
  player: '#67e8f9',
  playerCore: '#ecfeff',
  bullet: '#a5f3fc',
  text: '#eef2ff',
  muted: '#94a3b8',
  panel: 'rgba(10, 16, 38, 0.82)',
  panelEdge: '#2de2c5',
  danger: '#fb7185',
  heal: '#4ade80',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'aurora-wake.best';

/** How many of anything can exist at once; pools are allocated once, at boot. */
export const POOL = { bullets: 256, enemyBullets: 256, enemies: 96, particles: 700, pickups: 128, texts: 48 };

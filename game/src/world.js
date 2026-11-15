// AURORA WAKE's simulation: one fixed-step world. The player drifts a neon ship
// through waves of star-beasts, fires at the mouse, dashes through danger, and
// spends the shards they drop in a shop between waves. A boss guards every fifth
// wave; beating the wave-10 boss wins, and the game rolls on endlessly after that.
//
// The world never reads the wall clock or the DOM: given a seed it plays the same
// way every time, which is what makes the screenshot scenes deterministic.

import {
  BOSS, BOSS_EVERY, BULLET, COMBO, ENEMIES, ENEMY_BULLET, FIELD, PLAYER, POOL, STEP,
  UPGRADES, WIN_WAVE, waveComposition,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_VICTORY = 8;
export const EVENT_BOSS = 16;

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_SHOP = 'shop';
export const PHASE_OVER = 'over';
export const PHASE_WIN = 'win';

function makePlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    maxHull: PLAYER.hull,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    invuln: 0,
    damageMul: 1,
    fireMul: 1,
    dashMul: 1,
    magnetMul: 1,
    bullets: 1,
    alive: true,
    thrust: 0,
  };
}

export function createWorld(random) {
  const world = {
    random,
    phase: PHASE_TITLE,
    time: 0,
    score: 0,
    shards: 0,
    combo: 1,
    comboTimer: 0,
    bestCombo: 1,
    wave: 0,
    kills: 0,
    shotsFired: 0,
    player: makePlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    pickups: [],
    texts: [],
    stars: [],
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    bossWarn: 0,
    shake: 0,
    flash: 0,
    banner: '',
    bannerTimer: 0,
    shop: [],
    victory: false,
    endless: false,
    muted: false,
  };
  buildStars(world);
  return world;
}

function buildStars(world) {
  world.stars = [];
  for (let i = 0; i < 150; i += 1) {
    world.stars.push({
      x: world.random.range(0, FIELD.width),
      y: world.random.range(0, FIELD.height),
      depth: world.random.range(0.2, 1),
      size: world.random.range(0.6, 2.2),
      twinkle: world.random.range(0, Math.PI * 2),
    });
  }
}

export function resetWorld(world) {
  const random = world.random;
  const fresh = createWorld(random);
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
  world.phase = PHASE_PLAY;
  startWave(world, 1);
}

function edgeSpawn(world, margin = 40) {
  const side = world.random.int(0, 3);
  if (side === 0) return { x: world.random.range(0, FIELD.width), y: -margin };
  if (side === 1) return { x: world.random.range(0, FIELD.width), y: FIELD.height + margin };
  if (side === 2) return { x: -margin, y: world.random.range(0, FIELD.height) };
  return { x: FIELD.width + margin, y: world.random.range(0, FIELD.height) };
}

function spawnEnemy(world, kind) {
  const def = ENEMIES[kind];
  const pos = edgeSpawn(world, 50);
  const waveScale = 1 + (world.wave - 1) * 0.06;
  world.enemies.push({
    kind,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: def.radius,
    hp: def.hp * waveScale,
    maxHp: def.hp * waveScale,
    speed: def.speed * world.random.range(0.9, 1.15),
    score: def.score,
    shards: def.shards,
    colour: def.colour,
    turn: def.turn,
    fireTimer: world.random.range(1, 2.5),
    weavePhase: world.random.angle(),
    hitFlash: 0,
    active: true,
  });
}

function spawnBoss(world) {
  const pos = { x: FIELD.width / 2, y: -90 };
  const scale = 1 + (world.wave / BOSS_EVERY - 1) * 0.5;
  world.boss = {
    kind: 'boss',
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2,
    radius: BOSS.radius,
    hp: BOSS.hp * scale,
    maxHp: BOSS.hp * scale,
    speed: BOSS.speed,
    score: BOSS.score,
    shards: BOSS.shards,
    colour: BOSS.colour,
    turn: 1.2,
    fireTimer: 2,
    burstTimer: 5,
    spawnTimer: 6,
    hitFlash: 0,
    active: true,
  };
  world.enemies.push(world.boss);
}

export function startWave(world, wave) {
  world.wave = wave;
  world.spawnQueue = [];
  const comp = waveComposition(wave);
  const kinds = [];
  for (let i = 0; i < comp.drifter; i += 1) kinds.push('drifter');
  for (let i = 0; i < comp.weaver; i += 1) kinds.push('weaver');
  for (let i = 0; i < comp.spitter; i += 1) kinds.push('spitter');
  for (let i = 0; i < comp.brute; i += 1) kinds.push('brute');
  // Shuffle the queue so the wave arrives mixed.
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(world.random.next() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  world.spawnQueue = kinds;
  world.spawnTimer = 0.6;
  world.boss = null;
  world.bossWarn = comp.boss ? 2.5 : 0;
  world.banner = comp.boss ? `WAVE ${wave} — ${BOSS.name} APPROACHES` : `WAVE ${wave}`;
  world.bannerTimer = 2.5;
  world.phase = PHASE_PLAY;
}

export function openShop(world) {
  // Three upgrades drawn from the six, priced in shards.
  const pool = [...UPGRADES];
  world.shop = [];
  for (let i = 0; i < 3 && pool.length > 0; i += 1) {
    const idx = Math.floor(world.random.next() * pool.length);
    world.shop.push(pool.splice(idx, 1)[0]);
  }
  world.phase = PHASE_SHOP;
}

export function buyUpgrade(world, index) {
  const up = world.shop[index];
  if (!up) return false;
  if (world.shards < up.cost) return false;
  world.shards -= up.cost;
  up.apply(world.player);
  world.shop.splice(index, 1);
  return true;
}

function addParticles(world, x, y, colour, count, speed, life = 0.6, size = 3) {
  for (let i = 0; i < count; i += 1) {
    if (world.particles.length >= POOL.particles) return;
    const a = world.random.angle();
    const v = world.random.range(speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: world.random.range(life * 0.5, life),
      maxLife: life,
      size: world.random.range(size * 0.5, size * 1.4),
      colour,
    });
  }
}

function addText(world, x, y, text, colour) {
  if (world.texts.length >= POOL.texts) world.texts.shift();
  world.texts.push({ x, y, text, colour, life: 0.9 });
}

function dropPickup(world, x, y, kind, value) {
  if (world.pickups.length >= POOL.pickups) return;
  world.pickups.push({
    kind, value,
    x, y,
    vx: world.random.range(-40, 40),
    vy: world.random.range(-40, 40),
    life: 12,
    bob: world.random.angle(),
  });
}

function killEnemy(world, enemy, awardScore) {
  enemy.active = false;
  world.kills += 1;
  const big = enemy.kind === 'brute' || enemy.kind === 'boss';
  addParticles(world, enemy.x, enemy.y, enemy.colour, big ? 46 : 22, big ? 340 : 240, 0.8, big ? 5 : 3.5);
  addParticles(world, enemy.x, enemy.y, '#ffffff', 8, 160, 0.4, 2);
  world.shake = Math.min(14, world.shake + (big ? 10 : 4));
  world.flash = Math.max(world.flash, big ? 0.25 : 0.08);
  if (awardScore) {
    const gained = enemy.score * world.combo;
    world.score += gained;
    addText(world, enemy.x, enemy.y - 10, `+${gained}`, '#fbbf24');
    world.comboTimer = COMBO.window;
    if (world.combo < COMBO.max) {
      world.combo += 1;
      world.bestCombo = Math.max(world.bestCombo, world.combo);
    }
  }
  const shards = enemy.shards + (enemy.kind === 'boss' ? world.wave : 0);
  for (let i = 0; i < shards; i += 1) {
    dropPickup(world, enemy.x + world.random.range(-14, 14), enemy.y + world.random.range(-14, 14), 'shard', 1);
  }
  if (world.random.next() < (enemy.kind === 'brute' ? 0.5 : 0.06)) {
    dropPickup(world, enemy.x, enemy.y, 'heart', 25);
  }
  if (enemy.kind === 'boss') {
    world.boss = null;
    addParticles(world, enemy.x, enemy.y, '#f0abfc', 90, 420, 1.2, 6);
    world.shake = 18;
    if (world.wave >= WIN_WAVE && !world.endless) {
      world.victory = true;
      world.phase = PHASE_WIN;
      return EVENT_VICTORY;
    }
  }
  return EVENT_NONE;
}

function hurtPlayer(world, damage) {
  const p = world.player;
  if (!p.alive || p.invuln > 0 || p.dashTimer > 0) return EVENT_NONE;
  p.hull -= damage;
  p.invuln = PLAYER.invulnerable;
  world.shake = Math.min(16, world.shake + 7);
  world.flash = 0.3;
  addParticles(world, p.x, p.y, '#fb7185', 18, 260, 0.5, 3);
  if (world.combo > 1) {
    world.combo = 1;
    world.comboTimer = 0;
  }
  if (p.hull <= 0) {
    p.hull = 0;
    p.alive = false;
    addParticles(world, p.x, p.y, '#67e8f9', 70, 380, 1.1, 5);
    addParticles(world, p.x, p.y, '#f472b6', 40, 300, 0.9, 4);
    world.shake = 20;
    world.phase = PHASE_OVER;
    return EVENT_OVER;
  }
  return EVENT_HIT;
}

function firePlayerBullet(world, angle, offset) {
  const p = world.player;
  const spread = (offset - (p.bullets - 1) / 2) * 0.09;
  const a = angle + spread;
  if (world.bullets.length >= POOL.bullets) return;
  world.bullets.push({
    x: p.x + Math.cos(a) * (p.radius + 8),
    y: p.y + Math.sin(a) * (p.radius + 8),
    vx: Math.cos(a) * PLAYER.bulletSpeed + p.vx * 0.4,
    vy: Math.sin(a) * PLAYER.bulletSpeed + p.vy * 0.4,
    damage: PLAYER.bulletDamage * p.damageMul,
    life: BULLET.life,
    radius: BULLET.radius,
  });
  world.shotsFired += 1;
}

function fireEnemyBullet(world, x, y, angle, speed = ENEMY_BULLET.speed) {
  if (world.enemyBullets.length >= POOL.enemyBullets) return;
  world.enemyBullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: ENEMY_BULLET.life,
    radius: ENEMY_BULLET.radius,
  });
}

function stepPlayer(world, input, dt) {
  const p = world.player;
  if (!p.alive) return;
  const dir = input.direction();
  p.thrust = Math.hypot(dir.x, dir.y) > 0 ? 1 : 0;
  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
  } else {
    p.vx += dir.x * PLAYER.accel * dt;
    p.vy += dir.y * PLAYER.accel * dt;
    const speed = Math.hypot(p.vx, p.vy);
    const max = PLAYER.maxSpeed;
    if (speed > max) {
      p.vx = (p.vx / speed) * max;
      p.vy = (p.vy / speed) * max;
    }
    p.vx *= Math.pow(PLAYER.drag, dt * 60);
    p.vy *= Math.pow(PLAYER.drag, dt * 60);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x));
  p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y));
  p.angle = input.aimAngle(p.x, p.y);
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.dashCooldown > 0) p.dashCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (input.dashHeld() && p.dashCooldown <= 0 && p.dashTimer <= 0 && (dir.x !== 0 || dir.y !== 0)) {
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = PLAYER.dashCooldown / p.dashMul;
    const d = Math.hypot(dir.x, dir.y) || 1;
    p.vx = (dir.x / d) * PLAYER.dashSpeed;
    p.vy = (dir.y / d) * PLAYER.dashSpeed;
    p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.08);
    addParticles(world, p.x, p.y, '#67e8f9', 14, 180, 0.4, 3);
  }
  if (input.firing() && p.fireTimer <= 0) {
    for (let i = 0; i < p.bullets; i += 1) firePlayerBullet(world, p.angle, i);
    p.fireTimer = PLAYER.fireInterval / p.fireMul;
  }
  if (p.thrust > 0) {
    const back = p.angle + Math.PI;
    addParticles(world, p.x + Math.cos(back) * 14, p.y + Math.sin(back) * 14, '#2de2c5', 1, 60, 0.3, 2.5);
  }
}

function stepEnemy(world, e, dt) {
  const p = world.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let turn = want - e.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  e.angle += Math.max(-e.turn * dt, Math.min(e.turn * dt, turn));
  if (e.hitFlash > 0) e.hitFlash -= dt;

  if (e.kind === 'drifter') {
    e.vx += Math.cos(e.angle) * e.speed * 2.4 * dt;
    e.vy += Math.sin(e.angle) * e.speed * 2.4 * dt;
  } else if (e.kind === 'weaver') {
    e.weavePhase += dt * 4;
    const perp = e.angle + Math.PI / 2;
    e.vx += (Math.cos(e.angle) * e.speed * 2.2 + Math.cos(perp) * Math.sin(e.weavePhase) * 160) * dt;
    e.vy += (Math.sin(e.angle) * e.speed * 2.2 + Math.sin(perp) * Math.sin(e.weavePhase) * 160) * dt;
  } else if (e.kind === 'spitter') {
    const ideal = 260;
    const radial = dist > ideal + 40 ? 1 : dist < ideal - 40 ? -1 : 0;
    e.vx += Math.cos(e.angle) * e.speed * radial * 2 * dt;
    e.vy += Math.sin(e.angle) * e.speed * radial * 2 * dt;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 520 && p.alive) {
      e.fireTimer = world.random.range(1.8, 2.6);
      fireEnemyBullet(world, e.x, e.y, want);
    }
  } else if (e.kind === 'brute') {
    e.vx += Math.cos(e.angle) * e.speed * 2.2 * dt;
    e.vy += Math.sin(e.angle) * e.speed * 2.2 * dt;
  } else if (e.kind === 'boss') {
    stepBoss(world, e, dt, dist, want);
  }
  const speed = Math.hypot(e.vx, e.vy);
  const max = e.speed * 1.6;
  if (speed > max) {
    e.vx = (e.vx / speed) * max;
    e.vy = (e.vy / speed) * max;
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const m = e.radius + 20;
  if (e.x < -m) e.x = -m + 2;
  if (e.x > FIELD.width + m) e.x = FIELD.width + m - 2;
  if (e.y < -m) e.y = -m + 2;
  if (e.y > FIELD.height + m) e.y = FIELD.height + m - 2;
}

function stepBoss(world, boss, dt, dist, want) {
  const p = world.player;
  boss.vx += Math.cos(boss.angle) * boss.speed * 2 * dt;
  boss.vy += Math.sin(boss.angle) * boss.speed * 2 * dt;
  boss.fireTimer -= dt;
  boss.burstTimer -= dt;
  boss.spawnTimer -= dt;
  if (boss.y < 130 && boss.fireTimer <= 0) boss.fireTimer = 0.2;
  if (boss.fireTimer <= 0 && p.alive) {
    boss.fireTimer = 1.15;
    // A three-shot fan at the player.
    for (let i = -1; i <= 1; i += 1) {
      fireEnemyBullet(world, boss.x, boss.y, want + i * 0.22, ENEMY_BULLET.speed * 1.15);
    }
  }
  if (boss.burstTimer <= 0) {
    boss.burstTimer = 5.5;
    // A radial ring the player must dash or slip through.
    for (let i = 0; i < 14; i += 1) {
      fireEnemyBullet(world, boss.x, boss.y, (i / 14) * Math.PI * 2 + world.time, ENEMY_BULLET.speed * 0.8);
    }
    world.shake = Math.min(14, world.shake + 5);
  }
  if (boss.spawnTimer <= 0) {
    boss.spawnTimer = 7;
    if (world.enemies.length < 30) {
      spawnEnemy(world, 'drifter');
      const last = world.enemies[world.enemies.length - 1];
      last.x = boss.x + world.random.range(-60, 60);
      last.y = boss.y + world.random.range(-40, 60);
    }
  }
  if (dist < 200) {
    // Too close: the Maw shoves the player away.
    boss.vx -= Math.cos(want) * 60 * dt;
    boss.vy -= Math.sin(want) * 60 * dt;
  }
}

function collide(world) {
  const p = world.player;
  let events = EVENT_NONE;
  // Player bullets vs enemies.
  for (const b of world.bullets) {
    if (b.life <= 0) continue;
    for (const e of world.enemies) {
      if (!e.active) continue;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const r = e.radius + b.radius;
      if (dx * dx + dy * dy < r * r) {
        b.life = 0;
        e.hp -= b.damage;
        e.hitFlash = 0.08;
        addParticles(world, b.x, b.y, '#a5f3fc', 4, 140, 0.3, 2);
        if (e.hp <= 0) events |= killEnemy(world, e, true);
        break;
      }
    }
  }
  // Enemies vs player (touch damage).
  if (p.alive) {
    for (const e of world.enemies) {
      if (!e.active) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const r = e.radius + p.radius - 4;
      if (dx * dx + dy * dy < r * r) {
        events |= hurtPlayer(world, e.kind === 'boss' ? 30 : e.kind === 'brute' ? 20 : 12);
        // Shove the enemy back so it cannot stick to the player.
        const d = Math.hypot(dx, dy) || 1;
        e.x = p.x + (dx / d) * r;
        e.y = p.y + (dy / d) * r;
        e.vx = (dx / d) * 120;
        e.vy = (dy / d) * 120;
      }
    }
    // Enemy bullets vs player.
    for (const b of world.enemyBullets) {
      if (b.life <= 0) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const r = b.radius + p.radius - 6;
      if (dx * dx + dy * dy < r * r) {
        b.life = 0;
        events |= hurtPlayer(world, 10);
      }
    }
  }
  // Pickups: magnet pulls shards in, the player collects on touch.
  const magnet = PLAYER.magnetRadius * p.magnetMul;
  for (const pk of world.pickups) {
    if (pk.life <= 0) continue;
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (p.alive && dist < magnet && pk.kind === 'shard') {
      pk.vx += (dx / dist) * 900 * STEP;
      pk.vy += (dy / dist) * 900 * STEP;
    }
    if (p.alive && dist < PLAYER.pickupRadius) {
      pk.life = 0;
      if (pk.kind === 'shard') {
        world.shards += pk.value;
        addText(world, pk.x, pk.y - 8, '+1 ◆', '#fbbf24');
      } else if (pk.kind === 'heart') {
        p.hull = Math.min(p.maxHull, p.hull + pk.value);
        addText(world, pk.x, pk.y - 8, `+${pk.value} HULL`, '#4ade80');
      }
    }
  }
  return events;
}

function prune(world) {
  world.bullets = world.bullets.filter((b) => b.life > 0);
  world.enemyBullets = world.enemyBullets.filter((b) => b.life > 0);
  world.enemies = world.enemies.filter((e) => e.active);
  world.pickups = world.pickups.filter((pk) => pk.life > 0);
  world.particles = world.particles.filter((pt) => pt.life > 0);
  world.texts = world.texts.filter((t) => t.life > 0);
}

/** Advance the world one fixed step. `input` supplies direction/aim/fire; in the
 * title screen the world idles as an attract demo. Returns an event bitmask. */
export function stepWorld(world, input, dt = STEP) {
  world.time += dt;
  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt * 1.4);
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0 && world.combo > 1) world.combo = 1;
  }
  for (const s of world.stars) s.twinkle += dt * 2;

  if (world.phase === PHASE_TITLE) {
    // Attract mode: a few drifters wander while the title sits over them.
    if (world.enemies.length < 5 && world.random.next() < 0.02) spawnEnemy(world, 'drifter');
    for (const e of world.enemies) stepEnemy(world, e, dt);
    for (const pt of world.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    prune(world);
    return EVENT_NONE;
  }
  if (world.phase !== PHASE_PLAY) return EVENT_NONE;

  const p = world.player;
  let events = EVENT_NONE;

  // Spawning: trickle the queue, then the boss once the queue is empty.
  if (world.bossWarn > 0) {
    world.bossWarn -= dt;
    if (world.bossWarn <= 0) {
      spawnBoss(world);
      events |= EVENT_BOSS;
    }
  } else if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = Math.max(0.25, 0.9 - world.wave * 0.05);
      spawnEnemy(world, world.spawnQueue.shift());
    }
  }

  stepPlayer(world, input, dt);

  for (const e of world.enemies) {
    if (e.active) stepEnemy(world, e, dt);
  }
  for (const b of world.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  for (const b of world.enemyBullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) b.life = 0;
  }
  for (const pk of world.pickups) {
    pk.life -= dt;
    pk.bob += dt * 3;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.vx *= 0.98;
    pk.vy *= 0.98;
  }
  for (const pt of world.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.985;
    pt.vy *= 0.985;
  }
  for (const t of world.texts) {
    t.life -= dt;
    t.y -= 34 * dt;
  }

  events |= collide(world);
  prune(world);

  if (events & EVENT_OVER) return events;
  if (events & EVENT_VICTORY) return events;

  // Wave clear: queue empty, no boss pending, no enemies left.
  if (world.spawnQueue.length === 0 && world.bossWarn <= 0 && world.enemies.length === 0) {
    if (world.victory) return events;
    world.score += 100 * world.wave;
    addText(world, FIELD.width / 2, FIELD.height / 2 - 60, `WAVE BONUS +${100 * world.wave}`, '#fbbf24');
    events |= EVENT_WAVE_CLEAR;
    openShop(world);
  }
  return events;
}

/** Continue after the win: endless waves, no second victory screen. */
export function continueEndless(world) {
  world.endless = true;
  world.victory = false;
  world.phase = PHASE_PLAY;
  startWave(world, world.wave + 1);
}

/** The autopilot the screenshot scenes (and the title attract mode's firing) use:
 * chase the nearest enemy, fire at it, dash away when something gets too close.
 * The steering is recomputed on every read, so it tracks the live world. */
export function autopilotInput(world) {
  const p = world.player;

  function steer() {
    let target = null;
    let best = Infinity;
    for (const e of world.enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) {
        best = d;
        target = e;
      }
    }
    let mx = 0;
    let my = 0;
    let aimX = p.x;
    let aimY = p.y - 100;
    let dash = false;
    if (target) {
      aimX = target.x;
      aimY = target.y;
      // Keep a little distance from brutes and the boss, close in on the rest.
      const want = target.kind === 'brute' || target.kind === 'boss' ? 320 : 180;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const toward = d > want + 30 ? 1 : d < want - 60 ? -1 : 0;
      mx = (dx / d) * toward;
      my = (dy / d) * toward;
      // Strafe sideways while closing in, so the pilot does not fly straight in.
      const strafe = Math.sin(world.time * 1.7) * 0.6;
      mx += (-dy / d) * strafe;
      my += (dx / d) * strafe;
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
      if (best < 90) dash = true;
    } else {
      mx = Math.cos(world.time * 0.5);
      my = Math.sin(world.time * 0.5);
    }
    return { mx, my, aimX, aimY, dash, hasTarget: target !== null };
  }

  return {
    direction() {
      const s = steer();
      return { x: s.mx, y: s.my };
    },
    aimAngle() {
      const s = steer();
      return Math.atan2(s.aimY - p.y, s.aimX - p.x);
    },
    firing() {
      return steer().hasTarget;
    },
    dashHeld() {
      return steer().dash;
    },
  };
}

/** A pilot that never moves or fires: used for the game-over screenshot scene. */
export function idleInput() {
  return {
    direction: () => ({ x: 0, y: 0 }),
    aimAngle: () => -Math.PI / 2,
    firing: () => false,
    dashHeld: () => false,
  };
}

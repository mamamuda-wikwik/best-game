// Everything the player sees: the aurora starfield, the ships and beasts, the
// bullets and sparks, the HUD, and every screen (title, shop, pause, game over,
// victory). One canvas, one logical 1280x720 field, scaled to the window.

import { FIELD, FONT, FONT_DISPLAY, PALETTE } from './config.js';
import { PHASE_OVER, PHASE_PLAY, PHASE_SHOP, PHASE_TITLE, PHASE_WIN } from './world.js';

export const SCREEN_TITLE = PHASE_TITLE;
export const SCREEN_PLAY = PHASE_PLAY;
export const SCREEN_SHOP = PHASE_SHOP;
export const SCREEN_OVER = PHASE_OVER;
export const SCREEN_WIN = PHASE_WIN;
export const SCREEN_PAUSED = 'paused';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, x, y, radius, points, rotation) {
  ctx.beginPath();
  for (let i = 0; i < points; i += 1) {
    const a = rotation + (i / points) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - FIELD.width * scale) / 2, (canvas.height - FIELD.height * scale) / 2);
  }

  function drawBackground(world) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, '#0a1030');
    g.addColorStop(0.55, PALETTE.space);
    g.addColorStop(1, PALETTE.spaceDeep);
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);

    // Soft nebula blooms for depth.
    const blooms = [
      { x: 220, y: 150, r: 260, colour: '139, 92, 246' },
      { x: 1050, y: 520, r: 300, colour: '45, 226, 197' },
      { x: 700, y: 90, r: 200, colour: '244, 114, 182' },
      { x: 150, y: 600, r: 220, colour: '59, 130, 246' },
    ];
    for (const b of blooms) {
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, `rgba(${b.colour}, 0.10)`);
      rg.addColorStop(1, `rgba(${b.colour}, 0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    // Aurora curtains drifting across the sky: thin, wavy ribbons.
    for (let i = 0; i < 3; i += 1) {
      const colours = [PALETTE.auroraTeal, PALETTE.auroraViolet, PALETTE.auroraPink];
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.04 * Math.sin(world.time * 0.4 + i * 2);
      ctx.fillStyle = colours[i];
      ctx.beginPath();
      const baseY = 110 + i * 200;
      const wave = (x) => baseY
        + Math.sin(x * 0.006 + world.time * 0.3 + i * 1.7) * 72
        + Math.sin(x * 0.013 + world.time * 0.55 + i * 2.9) * 26;
      ctx.moveTo(-40, wave(-40));
      for (let x = -40; x <= FIELD.width + 40; x += 40) ctx.lineTo(x, wave(x));
      for (let x = FIELD.width + 40; x >= -40; x -= 40) ctx.lineTo(x, wave(x) + 52);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Stars, twinkling with depth.
    for (const s of world.stars) {
      const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(s.twinkle)) * s.depth;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawShip(world) {
    const p = world.player;
    if (!p.alive) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && p.dashTimer <= 0 && Math.floor(world.time * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    // Engine glow.
    const back = p.angle + Math.PI;
    const flame = 10 + (p.thrust > 0 ? 8 + Math.sin(world.time * 30) * 4 : 3);
    ctx.fillStyle = '#2de2c5';
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(back) * 12, Math.sin(back) * 12);
    ctx.lineTo(Math.cos(back - 0.35) * (12 + flame), Math.sin(back - 0.35) * (12 + flame));
    ctx.lineTo(Math.cos(back + 0.35) * (12 + flame), Math.sin(back + 0.35) * (12 + flame));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = p.invuln > 0 && p.dashTimer <= 0 && Math.floor(world.time * 14) % 2 === 0 ? 0.35 : 1;
    // Hull: a swept dart with a bright core.
    ctx.rotate(p.angle);
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, -13);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    // Dash trail.
    if (p.dashTimer > 0) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-46, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(world, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    const flash = e.hitFlash > 0;
    ctx.fillStyle = flash ? '#ffffff' : e.colour;
    ctx.shadowColor = e.colour;
    ctx.shadowBlur = e.kind === 'boss' ? 30 : 12;
    if (e.kind === 'drifter') {
      poly(ctx, 0, 0, e.radius, 3, Math.PI / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'weaver') {
      poly(ctx, 0, 0, e.radius, 4, Math.PI / 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff7ed';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.5, 0);
      ctx.lineTo(e.radius * 0.5, 0);
      ctx.stroke();
    } else if (e.kind === 'spitter') {
      poly(ctx, 0, 0, e.radius, 4, 0);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ede9fe';
      ctx.beginPath();
      ctx.arc(e.radius * 0.35, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-e.radius * 0.35, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'brute') {
      poly(ctx, 0, 0, e.radius, 6, 0);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 3;
      poly(ctx, 0, 0, e.radius * 0.62, 6, 0);
      ctx.stroke();
      ctx.fillStyle = '#fecaca';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'boss') {
      // The Maw: a spiked ring with a hungry core.
      ctx.rotate(world.time * 0.4);
      poly(ctx, 0, 0, e.radius, 12, 0);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3b0764';
      poly(ctx, 0, 0, e.radius * 0.68, 12, Math.PI / 12);
      ctx.fill();
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.3 + Math.sin(world.time * 5) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1033';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar over anything hurt.
    if (e.hp < e.maxHp && e.kind !== 'boss') {
      const w = e.radius * 2;
      const y = e.y - e.radius - 10;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(e.x - w / 2, y, w, 5);
      ctx.fillStyle = e.colour;
      ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }

  function drawBullets(world) {
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 10;
    ctx.fillStyle = PALETTE.bullet;
    for (const b of world.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = '#c084fc';
    ctx.fillStyle = '#e9d5ff';
    for (const b of world.enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
    }
    ctx.restore();
  }

  function drawPickups(world) {
    for (const pk of world.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'shard') {
        ctx.rotate(world.time * 2 + pk.bob);
        ctx.shadowColor = PALETTE.gold;
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.gold;
        poly(ctx, 0, 0, 8, 4, 0);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fffbeb';
        poly(ctx, 0, 0, 4, 4, 0);
        ctx.fill();
      } else {
        ctx.shadowColor = PALETTE.heal;
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.heal;
        ctx.beginPath();
        ctx.arc(-3.5, -2, 4.5, 0, Math.PI * 2);
        ctx.arc(3.5, -2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7.5, -1);
        ctx.lineTo(7.5, -1);
        ctx.lineTo(0, 9);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
  }

  function drawParticles(world) {
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.colour;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center';
    for (const t of world.texts) {
      ctx.globalAlpha = Math.min(1, t.life / 0.4);
      ctx.fillStyle = t.colour;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, w, h, frac, colour, bg = 'rgba(15, 23, 42, 0.85)') {
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = colour;
      roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, frac)), h - 4, (h - 4) / 2);
      ctx.fill();
    }
  }

  function drawHUD(world, best) {
    const p = world.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Score block, top left.
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px ' + FONT_DISPLAY;
    ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 20, 42);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, world.score).toLocaleString('en-US')}    WAVE ${world.wave}    KILLS ${world.kills}`, 20, 66);
    // Hull bar.
    bar(20, 78, 220, 16, p.hull / p.maxHull, p.hull / p.maxHull > 0.35 ? '#4ade80' : '#fb7185');
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(`HULL ${Math.ceil(p.hull)} / ${p.maxHull}`, 248, 91);
    // Dash cooldown.
    const dashFrac = 1 - Math.max(0, p.dashCooldown) / (PLAYER_DASH_CD(p));
    bar(20, 102, 220, 8, dashFrac, '#67e8f9');
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText(p.dashCooldown <= 0 ? 'DASH READY  [SPACE]' : 'DASH…', 248, 110);
    // Shards and combo, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 26px ' + FONT_DISPLAY;
    ctx.fillText(`◆ ${world.shards}`, FIELD.width - 20, 42);
    if (world.combo > 1) {
      ctx.fillStyle = world.combo >= 5 ? '#f472b6' : '#fbbf24';
      ctx.font = 'bold 22px ' + FONT_DISPLAY;
      ctx.fillText(`COMBO x${world.combo}`, FIELD.width - 20, 74);
      bar(FIELD.width - 170, 84, 150, 6, world.comboTimer / 3, '#fbbf24');
    }
    ctx.textAlign = 'left';
    // Boss bar.
    if (world.boss && world.boss.active) {
      const b = world.boss;
      const w = 560;
      const x = (FIELD.width - w) / 2;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0abfc';
      ctx.font = 'bold 17px ' + FONT_DISPLAY;
      ctx.fillText('THE MAW', FIELD.width / 2, 34);
      bar(x, 42, w, 14, b.hp / b.maxHp, '#e879f9');
      ctx.textAlign = 'left';
    }
    // Wave banner.
    if (world.bannerTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, world.bannerTimer);
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px ' + FONT_DISPLAY;
      ctx.fillStyle = PALETTE.text;
      ctx.shadowColor = PALETTE.auroraTeal;
      ctx.shadowBlur = 24;
      ctx.fillText(world.banner, FIELD.width / 2, 200);
      ctx.restore();
      ctx.textAlign = 'left';
    }
  }

  function PLAYER_DASH_CD(p) {
    return 1.6 / p.dashMul;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45, 226, 197, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawTitle(world, best) {
    ctx.fillStyle = 'rgba(4, 6, 15, 0.45)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.auroraTeal;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText('A  N E O N  A R E N A  S H O O T E R', FIELD.width / 2, 148);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 92px ' + FONT_DISPLAY;
    ctx.shadowColor = PALETTE.auroraViolet;
    ctx.shadowBlur = 34;
    ctx.fillText('AURORA WAKE', FIELD.width / 2, 248);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c4b5fd';
    ctx.font = '20px ' + FONT;
    ctx.fillText('Ride the aurora. Break the waves. Slay the Maw.', FIELD.width / 2, 292);
    panel(FIELD.width / 2 - 330, 330, 660, 148);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 19px ' + FONT;
    ctx.fillText('HOW TO PLAY', FIELD.width / 2, 362);
    ctx.font = '17px ' + FONT;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('WASD / Arrows — fly      Mouse — aim      Hold Click — fire', FIELD.width / 2, 392);
    ctx.fillText('SPACE — dash through danger      P — pause      M — mute', FIELD.width / 2, 420);
    ctx.fillText('Collect ◆ shards from fallen beasts, then spend them in the shop.', FIELD.width / 2, 448);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 21px ' + FONT;
    ctx.fillText(`BEST SCORE  ${Math.max(best, world.score).toLocaleString('en-US')}`, FIELD.width / 2, 524);
    const pulse = 0.75 + 0.25 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px ' + FONT_DISPLAY;
    ctx.fillText('PRESS SPACE OR CLICK TO LAUNCH', FIELD.width / 2, 580);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px ' + FONT;
    ctx.fillText('Survive 10 waves and defeat THE MAW to win — then keep flying, endlessly.', FIELD.width / 2, 640);
    ctx.textAlign = 'left';
  }

  function drawShop(world) {
    ctx.fillStyle = 'rgba(4, 6, 15, 0.55)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 40px ' + FONT_DISPLAY;
    ctx.fillText(`WAVE ${world.wave} CLEARED`, FIELD.width / 2, 110);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    ctx.fillText(`You hold ◆ ${world.shards} shards — spend them, then dive back in.`, FIELD.width / 2, 148);
    const cardW = 300;
    const gap = 24;
    const total = world.shop.length * cardW + (world.shop.length - 1) * gap;
    let x = (FIELD.width - total) / 2;
    const y = 200;
    world.shop.forEach((up, i) => {
      const afford = world.shards >= up.cost;
      panel(x, y, cardW, 220);
      ctx.fillStyle = afford ? PALETTE.auroraTeal : PALETTE.muted;
      ctx.font = 'bold 24px ' + FONT_DISPLAY;
      ctx.fillText(up.name, x + cardW / 2, y + 52);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '17px ' + FONT;
      ctx.fillText(up.desc, x + cardW / 2, y + 92);
      ctx.fillStyle = afford ? PALETTE.gold : '#64748b';
      ctx.font = 'bold 26px ' + FONT_DISPLAY;
      ctx.fillText(`◆ ${up.cost}`, x + cardW / 2, y + 150);
      ctx.fillStyle = afford ? PALETTE.text : '#64748b';
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillText(afford ? `PRESS ${i + 1}  OR  CLICK` : 'NOT ENOUGH SHARDS', x + cardW / 2, y + 192);
      x += cardW + gap;
    });
    const pulse = 0.75 + 0.25 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 24px ' + FONT_DISPLAY;
    ctx.fillText('PRESS ENTER OR CLICK CONTINUE TO FLY ON', FIELD.width / 2, 500);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    ctx.fillText(`Score ${world.score.toLocaleString('en-US')}   •   Hull ${Math.ceil(world.player.hull)} / ${world.player.maxHull}   •   Wave ${world.wave} of 10`, FIELD.width / 2, 540);
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4, 6, 15, 0.6)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 56px ' + FONT_DISPLAY;
    ctx.fillText('PAUSED', FIELD.width / 2, 340);
    ctx.font = '20px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P or click to keep flying', FIELD.width / 2, 384);
    ctx.textAlign = 'left';
  }

  function drawOver(world, best) {
    ctx.fillStyle = 'rgba(20, 4, 12, 0.62)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 72px ' + FONT_DISPLAY;
    ctx.shadowColor = '#fb7185';
    ctx.shadowBlur = 28;
    ctx.fillText('THE WAKE FADES', FIELD.width / 2, 210);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px ' + FONT_DISPLAY;
    ctx.fillText(`SCORE  ${world.score.toLocaleString('en-US')}`, FIELD.width / 2, 290);
    ctx.font = '21px ' + FONT;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`Best ${Math.max(best, world.score).toLocaleString('en-US')}      •      Wave ${world.wave}      •      ${world.kills} beasts down      •      Best combo x${world.bestCombo}`, FIELD.width / 2, 336);
    const pulse = 0.75 + 0.25 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px ' + FONT_DISPLAY;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY AGAIN', FIELD.width / 2, 420);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    ctx.fillText('The aurora keeps its light for those who return.', FIELD.width / 2, 470);
    ctx.textAlign = 'left';
  }

  function drawWin(world, best) {
    ctx.fillStyle = 'rgba(4, 12, 8, 0.55)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 76px ' + FONT_DISPLAY;
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 30;
    ctx.fillText('THE MAW IS BROKEN', FIELD.width / 2, 200);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 28px ' + FONT_DISPLAY;
    ctx.fillText('YOU WIN — the aurora is yours.', FIELD.width / 2, 256);
    ctx.font = '21px ' + FONT;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`Score ${world.score.toLocaleString('en-US')}      •      Best ${Math.max(best, world.score).toLocaleString('en-US')}      •      ${world.kills} beasts down      •      Best combo x${world.bestCombo}`, FIELD.width / 2, 306);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 24px ' + FONT_DISPLAY;
    const pulse = 0.75 + 0.25 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillText('ENTER — fly on, endlessly      •      SPACE — play again', FIELD.width / 2, 400);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function draw(world, screen, best) {
    fit();
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    ctx.save();
    if (world.shake > 0) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    drawBackground(world);
    drawPickups(world);
    drawBullets(world);
    for (const e of world.enemies) {
      if (e.active) drawEnemy(world, e);
    }
    drawShip(world);
    drawParticles(world);
    ctx.restore();
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${world.flash * 0.35})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_SHOP) drawHUD(world, best);
    if (screen === SCREEN_TITLE) drawTitle(world, best);
    else if (screen === SCREEN_SHOP) drawShop(world);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(world, best);
    else if (screen === SCREEN_WIN) drawWin(world, best);
  }

  return { draw, fit };
}

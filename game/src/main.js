// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between title, play, shop, paused, game
// over and victory screens.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createSound } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import {
  EVENT_BOSS, EVENT_HIT, EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR,
  PHASE_OVER, PHASE_PLAY, PHASE_SHOP, PHASE_TITLE, PHASE_WIN,
  buyUpgrade, continueEndless, createWorld, resetWorld, startWave, stepWorld,
} from './world.js';
import { createRenderer, SCREEN_PAUSED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

// The live game state, for play-testing and debugging from the console.
window.__game = { world, screen: PHASE_TITLE };

function runShot(name) {
  const scene = stageShot(name, world);
  window.__game.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = PHASE_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  function announce(message) {
    status.textContent = message;
  }

  function setScreen(next) {
    screen = next;
    window.__game.screen = next;
  }

  function startGame() {
    sound.unlock();
    resetWorld(world);
    accumulator = 0;
    setScreen(PHASE_PLAY);
    announce('Playing. Wave 1. Good hunting.');
  }

  function endGame() {
    setScreen(PHASE_OVER);
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    sound.gameOver();
    announce(`Game over. Score ${world.score}. Best ${best}.`);
  }

  function winGame() {
    setScreen(PHASE_WIN);
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    sound.victory();
    announce(`Victory. Score ${world.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_VICTORY) winGame();
    else if (events & EVENT_WAVE_CLEAR) {
      setScreen(PHASE_SHOP);
      sound.waveClear();
      announce(`Wave ${world.wave} cleared. Shop open.`);
    } else if (events & EVENT_BOSS) {
      sound.bossAlarm();
      announce('The Maw approaches.');
    } else if (events & EVENT_HIT) {
      sound.hit();
      announce(`Hit. Hull ${Math.ceil(world.player.hull)}.`);
    }
  }

  function shopClickZones() {
    const cardW = 300;
    const gap = 24;
    const total = world.shop.length * cardW + (world.shop.length - 1) * gap;
    let x = (1280 - total) / 2;
    const zones = [];
    world.shop.forEach((up, i) => {
      zones.push({ x, y: 200, w: cardW, h: 220, index: i, up });
      x += cardW + gap;
    });
    return zones;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      sound.setMuted(muted);
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    const click = input.takeClick();
    if (click) sound.unlock();
    if (screen === PHASE_TITLE) {
      if ((actions & ACTION_CONFIRM) || click) startGame();
      return;
    }
    if (screen === PHASE_OVER) {
      if ((actions & ACTION_CONFIRM) || click) startGame();
      return;
    }
    if (screen === PHASE_WIN) {
      if (actions & ACTION_CONFIRM) continueEndless(world), setScreen(PHASE_PLAY);
      else if (click) {
        // Clicking the upper half continues endlessly; the lower half restarts.
        if (click.y < 460) {
          continueEndless(world);
          setScreen(PHASE_PLAY);
        } else {
          startGame();
        }
      }
      return;
    }
    if (screen === PHASE_SHOP) {
      if (click) {
        let bought = false;
        for (const zone of shopClickZones()) {
          if (click.x >= zone.x && click.x <= zone.x + zone.w && click.y >= zone.y && click.y <= zone.y + zone.h) {
            if (buyUpgrade(world, zone.index)) sound.buy();
            else sound.denied();
            bought = true;
            break;
          }
        }
        if (!bought && click.y > 480) {
          startWave(world, world.wave + 1);
          setScreen(PHASE_PLAY);
        }
      }
      const digit = input.takeDigit();
      if (digit >= 1 && digit <= world.shop.length) {
        if (buyUpgrade(world, digit - 1)) sound.buy();
        else sound.denied();
      }
      if (actions & ACTION_CONFIRM) {
        startWave(world, world.wave + 1);
        setScreen(PHASE_PLAY);
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if ((actions & (ACTION_PAUSE | ACTION_CONFIRM)) || click) setScreen(PHASE_PLAY);
      return;
    }
    // PHASE_PLAY
    if (actions & ACTION_PAUSE) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === PHASE_PLAY) {
      while (accumulator >= STEP && screen === PHASE_PLAY) {
        const events = stepWorld(world, input, STEP);
        handleEvents(events);
        accumulator -= STEP;
      }
    } else if (screen === PHASE_TITLE) {
      while (accumulator >= STEP) {
        stepWorld(world, input, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting beasts feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === PHASE_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  });

  announce('Aurora Wake. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

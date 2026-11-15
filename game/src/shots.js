// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by the
// autopilot (chase the nearest beast, fire at it, dash clear when crowded), so the
// frame is what a real game looks like and the same seed always gives the same
// frame. The end scene's pilot never moves or fires, so the beasts catch it.

import { STEP } from './config.js';
import {
  autopilotInput, idleInput, resetWorld, startWave, stepWorld,
  PHASE_OVER, PHASE_PLAY, PHASE_TITLE,
} from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 13;
const BOSS_SECONDS = 5;
const END_LIMIT_SECONDS = 600;

function stepFor(world, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = stepWorld(world, input, STEP);
    if (world.phase === PHASE_OVER) return true;
    void events;
  }
  return false;
}

/**
 * Set `world` to the named scene (start, play, boss or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    resetWorld(world);
    startWave(world, 4);
    stepFor(world, autopilotInput(world), PLAY_SECONDS);
    if (world.phase === PHASE_OVER) {
      // The pilot died staging the shot: restage with a sturdier ship.
      resetWorld(world);
      world.player.maxHull = 200;
      world.player.hull = 200;
      startWave(world, 4);
      stepFor(world, autopilotInput(world), PLAY_SECONDS);
    }
    return { screen: world.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  if (name === 'boss') {
    resetWorld(world);
    // A ship that has already earned its wings, mid-fight with the Maw.
    world.player.hull = world.player.maxHull;
    world.player.damageMul = 1.35;
    world.player.fireMul = 1.25;
    startWave(world, 5);
    // Let the wave trickle in, then force the boss out for the shot.
    stepFor(world, autopilotInput(world), 3);
    if (world.bossWarn > 0) {
      world.bossWarn = 0;
      const { boss } = world;
      void boss;
    }
    // Spawn the boss directly if the queue has not brought it yet.
    if (!world.boss) {
      world.spawnQueue = [];
      world.bossWarn = 0.01;
      stepFor(world, autopilotInput(world), 0.5);
    }
    stepFor(world, autopilotInput(world), BOSS_SECONDS);
    if (world.phase === PHASE_OVER || !world.boss) {
      // The pilot died staging the shot, or slew the Maw too fast: restage with
      // a sturdier ship and a shorter fight so the boss is still standing.
      resetWorld(world);
      world.player.maxHull = 240;
      world.player.hull = 240;
      startWave(world, 5);
      world.spawnQueue = [];
      world.bossWarn = 0.01;
      stepFor(world, autopilotInput(world), 0.5);
      stepFor(world, autopilotInput(world), 5);
    }
    return { screen: world.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  if (name === 'end') {
    resetWorld(world);
    startWave(world, 3);
    // The pilot fights well for a while, so the results screen has real stats,
    // then stops moving and firing: the beasts catch it.
    stepFor(world, autopilotInput(world), 12);
    let over = false;
    for (let i = 0; i < END_LIMIT_SECONDS / STEP && !over; i += 1) {
      over = (stepWorld(world, idleInput(), STEP) & 2) !== 0;
      if (world.phase === 'shop') {
        // Survived a wave by luck of the spawn: start the next one.
        startWave(world, world.wave + 1);
      }
    }
    return { screen: SCREEN_OVER, best: world.score };
  }
  // Start: the title over an attract-mode world that has been wandering a while.
  world.phase = PHASE_TITLE;
  stepFor(world, idleInput(), START_SECONDS);
  return { screen: SCREEN_TITLE, best: 0 };
}

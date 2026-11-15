[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mamamuda-wikwik/best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mamamuda-wikwik/best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# AURORA WAKE

A neon arena shooter for the make.fun **best-game-01** bounty — see the bounty at https://make.fun/bounty/best-game-01. Ride the aurora,
break the waves, slay the Maw.

You fly a lone ship through a living aurora. Star-beasts drift in from the dark
— pink Drifters that chase you, orange Weavers that zig-zag in, violet Spitters
that shoot back, red Brutes that soak up fire — and every fifth wave the Maw
itself descends, a spiked ring with a hungry core that fires fans and radial
rings and births more beasts. Destroy them, collect the ◆ shards they drop,
and spend those shards in the shop between waves on lasting upgrades: heavier
cannons, faster triggers, thicker plating, quicker dashes, a wider magnet, twin
cannons. Chain kills to raise your combo multiplier. Beat the wave-10 boss to
win — then keep flying, endlessly.

## How to play

- **WASD / Arrow keys** — fly
- **Mouse** — aim
- **Hold left click** (or J / Z) — fire
- **Space / Shift** — dash (brief invulnerability, recharges)
- **P / Esc** — pause
- **M** — mute
- **1–6 / click** — buy an upgrade in the shop; **Enter / click Continue** — next wave

## The loop

Title → waves of beasts → shop between waves → boss every 5th wave →
victory at wave 10 (or game over, with your stats and a restart). Your best
score is kept in the browser. Every sound is synthesised live with WebAudio —
no audio files. The game is plain static files under `game/` and runs offline
in a desktop browser with no network request.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game's own
code, staged deterministically with `?shot=start|play|boss|end&seed=7` (see
`shots.json` and `game/src/shots.js`).

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Files

- `game/index.html` — the page; `game/src/` holds the game, one job per file:
  `config.js` (tuning + palette), `random.js` (seeded RNG), `audio.js`
  (synthesised sound + music), `input.js` (keyboard + mouse),
  `world.js` (simulation: waves, beasts, boss, shop, collisions),
  `render.js` (all drawing: aurora, ships, HUD, screens), `shots.js`
  (deterministic screenshot scenes), `main.js` (boot + game loop)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `shots.json` — how each screenshot was taken

## License

MIT — see `LICENSE`.

---

Built for make.fun. If you try make.fun yourself, my referral code is
**tdgxqn9n**.

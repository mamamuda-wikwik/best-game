// Every sound in AURORA WAKE is synthesised live with WebAudio: no audio files,
// nothing fetched. Short effects are one-shot oscillators and filtered noise;
// the music is a slow two-oscillator aurora pad with a drifting filter, plus a
// soft pulse. Created lazily on the first user gesture; muted with M.

export function createSound() {
  let ctx = null;
  let master = null;
  let musicNodes = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ type = 'sine', from = 440, to = null, dur = 0.15, vol = 0.2, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.3, vol = 0.25, freq = 1200, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  function startMusic() {
    if (!ctx || musicNodes) return;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    padGain.connect(master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.connect(padGain);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    const notes = [110, 164.81, 220, 277.18];
    const oscs = notes.map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = i % 2 === 0 ? 4 : -5;
      osc.connect(filter);
      osc.start();
      return osc;
    });
    lfo.start();
    // A soft heartbeat under the pad, one pulse a second.
    const pulse = setInterval(() => {
      if (!ctx || muted) return;
      tone({ type: 'sine', from: 55, to: 40, dur: 0.22, vol: 0.12 });
    }, 1000);
    musicNodes = { oscs, lfo, padGain, pulse };
  }

  function stopMusic() {
    if (!musicNodes) return;
    clearInterval(musicNodes.pulse);
    for (const osc of musicNodes.oscs) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    try { musicNodes.lfo.stop(); } catch { /* already stopped */ }
    musicNodes = null;
  }

  return {
    unlock() { if (ensure()) startMusic(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) stopMusic();
      else if (ctx) startMusic();
    },
    isMuted() { return muted; },
    shoot() { tone({ type: 'square', from: 880, to: 320, dur: 0.08, vol: 0.08 }); },
    enemyShoot() { tone({ type: 'sawtooth', from: 300, to: 140, dur: 0.14, vol: 0.06 }); },
    explosion(big = false) {
      noise({ dur: big ? 0.7 : 0.35, vol: big ? 0.4 : 0.22, freq: big ? 700 : 1400 });
      tone({ type: 'sine', from: big ? 160 : 220, to: 40, dur: big ? 0.5 : 0.25, vol: 0.25 });
    },
    hit() { tone({ type: 'square', from: 200, to: 90, dur: 0.09, vol: 0.14 }); noise({ dur: 0.08, vol: 0.1, freq: 2500 }); },
    pickup() { tone({ type: 'sine', from: 660, to: 990, dur: 0.1, vol: 0.12 }); tone({ type: 'sine', from: 990, to: 1320, dur: 0.12, vol: 0.1, delay: 0.07 }); },
    heal() { tone({ type: 'sine', from: 520, to: 780, dur: 0.18, vol: 0.14 }); },
    dash() { noise({ dur: 0.18, vol: 0.14, freq: 3200 }); },
    comboLost() { tone({ type: 'sine', from: 330, to: 220, dur: 0.15, vol: 0.08 }); },
    waveClear() {
      tone({ type: 'sine', from: 523, dur: 0.12, vol: 0.14 });
      tone({ type: 'sine', from: 659, dur: 0.12, vol: 0.14, delay: 0.1 });
      tone({ type: 'sine', from: 784, dur: 0.22, vol: 0.16, delay: 0.2 });
    },
    bossAlarm() {
      tone({ type: 'sawtooth', from: 110, to: 220, dur: 0.5, vol: 0.16 });
      tone({ type: 'sawtooth', from: 110, to: 220, dur: 0.5, vol: 0.16, delay: 0.55 });
    },
    buy() { tone({ type: 'sine', from: 880, to: 1174, dur: 0.12, vol: 0.14 }); },
    denied() { tone({ type: 'square', from: 180, to: 120, dur: 0.15, vol: 0.1 }); },
    gameOver() {
      tone({ type: 'sine', from: 392, to: 196, dur: 0.5, vol: 0.18 });
      tone({ type: 'sine', from: 311, to: 155, dur: 0.7, vol: 0.18, delay: 0.4 });
    },
    victory() {
      const seq = [523, 659, 784, 1046];
      seq.forEach((f, i) => tone({ type: 'sine', from: f, dur: 0.25, vol: 0.16, delay: i * 0.14 }));
    },
  };
}

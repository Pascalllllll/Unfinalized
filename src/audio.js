// Small synthesized sounds. Nothing is loaded from disk.

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq, to = freq, dur = 0.15, type = 'sine', gain = 0.2, delay = 0 }) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.12, gain = 0.15, freq = 1200 }) {
  const c = ac();
  if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export const sfx = {
  unlock() { ac(); },
  get muted() { return muted; },
  toggle() { muted = !muted; return muted; },
  jump() { tone({ freq: 320, to: 520, dur: 0.09, type: 'triangle', gain: 0.08 }); },
  land(k) { tone({ freq: 140, to: 60, dur: 0.12, gain: 0.08 + k * 0.2 }); noise({ dur: 0.05, gain: 0.05 + k * 0.1, freq: 700 }); },
  dash() { noise({ dur: 0.18, gain: 0.18, freq: 2200 }); },
  spring() { tone({ freq: 200, to: 900, dur: 0.28, type: 'square', gain: 0.06 }); },
  // Two stone knocks when a new block lands on the tower.
  block() { tone({ freq: 90, to: 70, dur: 0.35, gain: 0.25 }); tone({ freq: 135, to: 100, dur: 0.3, gain: 0.15, delay: 0.09 }); },
  lose() { tone({ freq: 220, to: 55, dur: 0.9, type: 'sawtooth', gain: 0.08 }); },
  win() { [392, 523, 659].forEach((f, i) => tone({ freq: f, dur: 0.4, type: 'triangle', gain: 0.1, delay: i * 0.12 })); },
};

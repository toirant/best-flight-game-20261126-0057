// Kestrel Courier — sound, synthesised live with Web Audio.
// No audio files: the engine is a detuned sawtooth pair through a low-pass
// filter, the wind is filtered noise, and the ring chime, touchdown thump
// and crash are short envelopes. Everything starts on the first gesture.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc1: null,
    engineOsc2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

// Call from a user gesture (click / keypress). Safe to call repeatedly.
export function ensureAudio(audio) {
  if (audio.started) {
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(ctx.destination);
    // Engine: two saws a few hertz apart, low-passed.
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    audio.engineOsc1 = ctx.createOscillator();
    audio.engineOsc1.type = 'sawtooth';
    audio.engineOsc1.frequency.value = 62;
    audio.engineOsc2 = ctx.createOscillator();
    audio.engineOsc2.type = 'sawtooth';
    audio.engineOsc2.frequency.value = 65.5;
    audio.engineOsc1.connect(filter);
    audio.engineOsc2.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc1.start();
    audio.engineOsc2.start();
    // Wind: looped noise through a band-pass, gain follows airspeed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSource = ctx.createBufferSource();
    audio.windSource.buffer = buffer;
    audio.windSource.loop = true;
    audio.windFilter = ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 700;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSource.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSource.start();
    audio.started = true;
  } catch {
    // Audio is decoration: a browser without it still plays.
    audio.started = false;
  }
}

// Every frame: engine pitch follows throttle, wind follows airspeed.
export function updateAudio(audio, plane) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const rpm = 52 + plane.throttle * 68 + plane.speed * 0.12;
  audio.engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
  audio.engineOsc2.frequency.setTargetAtTime(rpm * 1.06, t, 0.08);
  audio.engineGain.gain.setTargetAtTime(0.02 + plane.throttle * 0.05, t, 0.1);
  const wind = Math.max(0, (plane.speed - 40) / 160) * 0.16;
  audio.windGain.gain.setTargetAtTime(wind, t, 0.15);
  audio.windFilter.frequency.setTargetAtTime(500 + plane.speed * 6, t, 0.15);
}

function blip(audio, freq, when, dur, type, vol) {
  if (!audio.started || !audio.ctx) return;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, audio.ctx.currentTime + when);
  gain.gain.linearRampToValueAtTime(vol, audio.ctx.currentTime + when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + when + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(audio.ctx.currentTime + when);
  osc.stop(audio.ctx.currentTime + when + dur + 0.05);
}

// A bright rising arpeggio when a ring is flown.
export function playRingChime(audio) {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(audio, f, i * 0.07, 0.5, 'sine', 0.22));
}

// A low thump on touchdown.
export function playThud(audio) {
  if (!audio.started || !audio.ctx) return;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, audio.ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, audio.ctx.currentTime + 0.25);
  gain.gain.setValueAtTime(0.5, audio.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(audio.ctx.currentTime + 0.35);
}

// Noise burst for a crash.
export function playCrash(audio) {
  if (!audio.started || !audio.ctx) return;
  const len = audio.ctx.sampleRate * 0.5;
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.5;
  src.connect(gain);
  gain.connect(audio.master);
  src.start();
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master && audio.ctx) {
    audio.master.gain.setTargetAtTime(audio.muted ? 0 : 0.5, audio.ctx.currentTime, 0.05);
  }
  return audio.muted;
}

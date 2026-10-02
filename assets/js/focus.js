// Focus mode: a timed study session with a target, full screen, screen kept awake,
// optional generated ambient sound, a count of times you left the app, and a short
// review at the end. The running session survives a reload; history stays on the device.

const LOG = 'hscos:focus:v1';
const RUN = 'hscos:focus-run:v1';
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

let log = read(LOG, []);
let run = read(RUN, null); // { target, taskKey, taskId, minutes, start, pausedAt, pausedMs, leaves, sound }

export const focusLog = () => log;
export const focusRun = () => run;

export function startFocus({ target, minutes, sound, taskKey, taskId }) {
  run = { target: String(target ?? '').trim().slice(0, 200), minutes, sound: sound || 'none', taskKey: taskKey || null, taskId: taskId || null, start: Date.now(), pausedAt: null, pausedMs: 0, leaves: 0 };
  write(RUN, run);
  enterFullscreen();
  wake(true);
  playSound(run.sound);
}

export function elapsedMs(now = Date.now()) {
  if (!run) return 0;
  return (run.pausedAt ?? now) - run.start - run.pausedMs;
}
export const totalMs = () => (run ? run.minutes * 60000 : 0);
export const isPaused = () => !!run?.pausedAt;

export function togglePause() {
  if (!run) return;
  if (run.pausedAt) {
    run.pausedMs += Date.now() - run.pausedAt;
    run.pausedAt = null;
    playSound(run.sound);
  } else {
    run.pausedAt = Date.now();
    stopSound();
  }
  write(RUN, run);
}

export function noteLeave() {
  if (!run || run.pausedAt) return;
  run.leaves += 1;
  write(RUN, run);
}

// End the session (finished or stopped early) and return its summary for the review screen.
export function endFocus() {
  if (!run) return null;
  const studied = Math.max(0, Math.round(Math.min(elapsedMs(), totalMs()) / 60000));
  const s = { id: Date.now().toString(36), at: run.start, target: run.target, planned: run.minutes, minutes: studied, leaves: run.leaves, taskKey: run.taskKey, taskId: run.taskId, rating: null, done: null, note: '' };
  log.unshift(s);
  log = log.slice(0, 300);
  write(LOG, log);
  run = null;
  try { localStorage.removeItem(RUN); } catch { /* ignore */ }
  stopSound();
  wake(false);
  exitFullscreen();
  return s;
}

export function reviewFocus(id, patch) {
  const s = log.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
  write(LOG, log);
}

export function focusStats() {
  const today = new Date().toDateString();
  const todays = log.filter((s) => new Date(s.at).toDateString() === today);
  const week = log.filter((s) => Date.now() - s.at < 7 * 864e5);
  return {
    todayMin: todays.reduce((n, s) => n + s.minutes, 0),
    todayCount: todays.length,
    weekMin: week.reduce((n, s) => n + s.minutes, 0),
    avgRating: (() => { const r = log.filter((s) => s.rating).slice(0, 20); return r.length ? r.reduce((n, s) => n + s.rating, 0) / r.length : 0; })(),
  };
}

export const importFocus = (arr) => { log = Array.isArray(arr) ? arr : []; write(LOG, log); };

// ---------- full screen + wake lock ----------

function enterFullscreen() {
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); } catch { /* not allowed */ }
}
function exitFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch { /* ignore */ }
}
let lock = null;
async function wake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch { lock = null; }
}
export const rewake = () => run && !run.pausedAt && wake(true);

// ---------- ambient sound (generated, no files) ----------

export const SOUNDS = [['none', 'কোনো শব্দ নয়'], ['rain', 'বৃষ্টি'], ['brown', 'গভীর নয়েজ'], ['white', 'হালকা নয়েজ']];
let audio = null;
function noiseBuffer(ctx, kind) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
  }
  return buf;
}
export function playSound(kind) {
  stopSound();
  if (!kind || kind === 'none') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, kind === 'brown' ? 'brown' : 'white');
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = kind === 'white' ? 0.05 : kind === 'brown' ? 0.35 : 0.12;
    let node = src;
    if (kind === 'rain') {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5000;
      node.connect(bp); bp.connect(lp); node = lp;
      // slow swell so it sounds like rain rather than static
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.12; depth.gain.value = 0.04;
      lfo.connect(depth).connect(gain.gain);
      lfo.start();
    } else if (kind === 'white') {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3000;
      node.connect(lp); node = lp;
    }
    node.connect(gain).connect(ctx.destination);
    src.start();
    audio = ctx;
  } catch { audio = null; }
}
export function stopSound() {
  try { audio?.close(); } catch { /* ignore */ }
  audio = null;
}

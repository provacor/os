// Study alarms: up to five countdowns (1 minute to 3 hours), each with its own note.
// Alarms are stored as end times, so they survive a reload and keep counting while
// the app is closed; the sound itself can only play while the app is open.

const KEY = 'hscos:alarms:v1';
const AWAKE = 'hscos:alarms:awake';
export const MAX_ALARMS = 5;
export const MAX_MINUTES = 180;

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: alarms stay in memory for this visit */
  }
}

let alarms = read(KEY, []).filter((a) => a && a.end && a.minutes);
const save = () => write(KEY, alarms);

export const listAlarms = () => alarms;
export const keepAwake = () => read(AWAKE, true);

export function addAlarm(minutes, note) {
  const m = Math.round(Number(minutes));
  if (!(m >= 1 && m <= MAX_MINUTES) || alarms.length >= MAX_ALARMS) return false;
  alarms.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    minutes: m,
    note: String(note ?? '').trim().slice(0, 200),
    end: Date.now() + m * 60000,
    fired: false,
    stopped: false,
  });
  save();
  unlockAudio();
  askNotify();
  syncWakeLock();
  return true;
}

export function removeAlarm(id) {
  alarms = alarms.filter((a) => a.id !== id);
  save();
  syncRinging();
  syncWakeLock();
}

export function stopAlarm(id) {
  const a = alarms.find((x) => x.id === id);
  if (a) { a.stopped = true; save(); }
  syncRinging();
}

export function restartAlarm(id) {
  const a = alarms.find((x) => x.id === id);
  if (!a) return;
  Object.assign(a, { end: Date.now() + a.minutes * 60000, fired: false, stopped: false });
  save();
  unlockAudio();
  syncRinging();
  syncWakeLock();
}

export function setKeepAwake(on) {
  write(AWAKE, !!on);
  syncWakeLock();
}

// ---------- time helpers ----------

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const pad = (n) => String(n).padStart(2, '0');

export function leftText(a, now = Date.now()) {
  const s = Math.max(0, Math.ceil((a.end - now) / 1000));
  return bn(`${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
}
export const leftPct = (a, now = Date.now()) => Math.min(100, Math.max(0, 100 - ((a.end - now) / (a.minutes * 60000)) * 100));
export function clockText(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  return bn(`${h % 12 || 12}:${pad(d.getMinutes())}`) + (h < 12 ? ' AM' : ' PM');
}
export function durationText(m) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return bn([h ? `${h} ঘণ্টা` : '', r ? `${r} মিনিট` : ''].filter(Boolean).join(' '));
}

// ---------- ringing ----------

let ctx;
function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    /* no Web Audio: vibration and notification still work */
  }
}

function beep() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [0, 0.22, 0.44].forEach((o) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t + o);
    g.gain.exponentialRampToValueAtTime(0.25, t + o + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(t + o);
    osc.stop(t + o + 0.2);
  });
}

function askNotify() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  } catch {
    /* notifications not supported */
  }
}

function notify(a) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const body = a.note || `${durationText(a.minutes)}ের অ্যালার্ম`;
    const opts = { body, tag: `alarm-${a.id}`, renotify: true, requireInteraction: true, icon: 'assets/img/avatar.jpg' };
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((r) => r.showNotification('⏰ সময় শেষ!', opts));
    else new Notification('⏰ সময় শেষ!', opts);
  } catch {
    /* ignore */
  }
}

let ringTimer = null;
const ringing = () => alarms.filter((a) => a.fired && !a.stopped);

function syncRinging() {
  const list = ringing();
  let box = document.getElementById('alarmRing');
  if (!list.length) {
    box?.remove();
    clearInterval(ringTimer);
    ringTimer = null;
    try { navigator.vibrate?.(0); } catch { /* ignore */ }
    return;
  }
  if (!box) {
    box = document.createElement('div');
    box.id = 'alarmRing';
    box.className = 'alarm-ring';
    box.setAttribute('role', 'alertdialog');
    document.body.appendChild(box);
  }
  box.innerHTML = `<div class="ar-card">
      <div class="ar-bell">⏰</div>
      <h2>সময় শেষ!</h2>
      ${list.map((a) => `<div class="ar-row"><span>${a.note ? escapeHtml(a.note) : `${durationText(a.minutes)}ের অ্যালার্ম`}</span>
        <button class="btn btn-primary tap" data-alarm-stop="${a.id}">বন্ধ করো</button></div>`).join('')}
    </div>`;
  if (!ringTimer) {
    const ring = () => {
      beep();
      try { navigator.vibrate?.([500, 200, 500]); } catch { /* ignore */ }
    };
    ring();
    ringTimer = setInterval(ring, 1500);
  }
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- screen wake lock (keeps the countdown alive on phones) ----------

let lock = null;
async function syncWakeLock() {
  const want = keepAwake() && alarms.some((a) => !a.fired) && document.visibilityState === 'visible';
  try {
    if (want && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!want && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}

// ---------- tick ----------

// Called once a second by the app shell: fires due alarms and updates any countdown on screen.
export function tickAlarms() {
  const now = Date.now();
  let changed = false;
  for (const a of alarms) {
    if (!a.fired && a.end <= now) {
      a.fired = true;
      changed = true;
      notify(a);
    }
  }
  if (changed) {
    save();
    syncRinging();
    syncWakeLock();
  }
  document.querySelectorAll('[data-alarm-left]').forEach((el) => {
    const a = alarms.find((x) => x.id === el.dataset.alarmLeft);
    if (!a) return;
    el.textContent = a.fired ? 'সময় শেষ' : leftText(a, now);
    el.closest('.alarm')?.style.setProperty('--p', `${leftPct(a, now)}%`);
    el.closest('.alarm')?.classList.toggle('fired', a.fired);
  });
  return changed;
}

export function startAlarms(onFire) {
  syncRinging();
  syncWakeLock();
  document.addEventListener('visibilitychange', () => { syncWakeLock(); tickAlarms(); });
  // The first tap anywhere unlocks sound after a reload.
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  setInterval(() => tickAlarms() && onFire?.(), 1000);
  if (tickAlarms()) onFire?.();
}

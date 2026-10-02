// Personal profile (name, photo, leaderboard privacy) and real app-usage time.
// Everything is stored only in this browser. Usage counts seconds while the app
// is open and on screen, per day, so it can feed a leaderboard later.

const PROFILE = 'hscos:profile:v1';
const USAGE = 'hscos:usage:v1';

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
    return true;
  } catch {
    return false; // storage full or unavailable
  }
}

// anonymous defaults to true: nobody shows by name unless they choose to.
let profile = { name: '', photo: '', anonymous: true, leaderboard: true, ...read(PROFILE, {}) };
let usage = read(USAGE, {});

export const getProfile = () => profile;

export function updateProfile(patch) {
  const next = { ...profile, ...patch };
  next.name = String(next.name ?? '').trim().slice(0, 40);
  if (!write(PROFILE, next)) return false;
  profile = next;
  return true;
}

// Shrink a picked image to a 160px square JPEG data URL so it fits in storage.
export function imageToAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('not an image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 160, 160);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
    img.src = url;
  });
}

// ---------- usage time ----------

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The leaderboard week runs Saturday to Friday; its key is that Saturday's date.
export function weekKey(d = new Date()) {
  const s = new Date(d);
  s.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return dayKey(s);
}

export function weekSeconds() {
  const start = weekKey();
  return Object.entries(usage).reduce((n, [k, s]) => (k >= start ? n + s : n), 0);
}

export function usageStats() {
  const today = dayKey();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const wk = dayKey(weekStart);
  let week = 0;
  let total = 0;
  for (const [k, s] of Object.entries(usage)) {
    total += s;
    if (k >= wk) week += s;
  }
  return { today: usage[today] ?? 0, week, total, days: Object.keys(usage).length };
}

let last = Date.now();
function track() {
  const now = Date.now();
  // Count only time on screen; ignore long gaps (sleep, background) between ticks.
  const gap = (now - last) / 1000;
  last = now;
  if (document.visibilityState !== 'visible' || gap > 30) return;
  const k = dayKey();
  usage[k] = Math.round((usage[k] ?? 0) + gap);
}

export function startUsage() {
  setInterval(track, 5000);
  setInterval(() => write(USAGE, usage), 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // count the last few seconds on screen, then save before the page may be frozen
      const k = dayKey();
      usage[k] = Math.round((usage[k] ?? 0) + Math.min(30, (Date.now() - last) / 1000));
      write(USAGE, usage);
    }
    last = Date.now();
  });
}

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
export function durationBn(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (!h && !m) return bn(`${Math.floor(sec)} সেকেন্ড`);
  return bn([h ? `${h} ঘণ্টা` : '', m ? `${m} মিনিট` : ''].filter(Boolean).join(' '));
}

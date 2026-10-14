// One learning + reward store for every game (the game zone and the new game zone).
//
//   hscos:games:v1  (S) — per-question learning: mastery streak (m), stats + review schedule (q),
//                        records (best, stars), XP, sound, daily history (h)
//   hscos:arena:v1  (A) — rewards and game worlds: coins, one-time claims, missions, streak days,
//                        achievements, and each new game's saved state
//
// Rules the games rely on:
// - A question is "mastered" after two right answers in a row (S.m[id] >= 2). An answer helped by
//   a 50:50 never raises mastery; a wrong one still resets it.
// - XP, coins and farm water come at most once per question per day, and one-time rewards are
//   claimed by key — replaying an activity never pays twice.
// - Mastery depends only on answers, never on XP, coins or time.
// - Dates are the phone's local date (YYYY-MM-DD).

import { recordAttempt } from './learn.js?v=202610141937';

const GKEY = 'hscos:games:v1';
const AKEY = 'hscos:arena:v1';
const read = (k) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

// ---------- dates ----------
const p2 = (n) => String(n).padStart(2, '0');
export const dayStr = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return dayStr(new Date(y, m - 1, d + n));
}
export const today = () => dayStr();

// ---------- the learning store (migrated in place: old fields are kept as they are) ----------
export const S = read(GKEY);
S.m = obj(S.m); S.best = obj(S.best); S.stars = obj(S.stars); S.q = obj(S.q); S.h = obj(S.h);
S.xp = num(S.xp); S.sound = S.sound !== false;
S.xd = obj(S.xd);
export function saveS() {
  try { localStorage.setItem(GKEY, JSON.stringify(S)); } catch { /* keeps for this visit */ }
}

// ---------- the reward / world store ----------
export const A = read(AKEY);
A.coins = num(A.coins); A.gems = num(A.gems); A.energy = num(A.energy);
A.claimed = obj(A.claimed); A.days = obj(A.days); A.ach = obj(A.ach); A.settings = obj(A.settings);
A.stats = obj(A.stats); A.stats.n = num(A.stats.n); A.stats.c = num(A.stats.c); A.stats.rec = num(A.stats.rec);
if (!A.migrated) { A.stats.n = Math.max(A.stats.n, Object.keys(S.m).length); A.migrated = 1; }
A.today = obj(A.today);
export function saveA() {
  try { localStorage.setItem(AKEY, JSON.stringify(A)); } catch { /* keeps for this visit */ }
}
export function saveAll() { saveS(); saveA(); }
// A game's own saved state: A.g[name], created with defaults and repaired if a field is broken.
export function gameState(name, defaults) {
  A.g = obj(A.g);
  const cur = obj(A.g[name]);
  for (const [k, v] of Object.entries(defaults)) {
    if (cur[k] === undefined || typeof cur[k] !== typeof v || Array.isArray(cur[k]) !== Array.isArray(v)) cur[k] = JSON.parse(JSON.stringify(v));
  }
  A.g[name] = cur;
  return cur;
}

// ---------- reading progress ----------
export const masteryOf = (id) => num(S.m[id]);
export const isMastered = (id) => masteryOf(id) >= 2;
export const statOf = (id) => S.q[id] ?? null;
export const bestOf = (k) => num(S.best[k]);
export const starsOf = (k) => num(S.stars[k]);
export const xp = () => S.xp;
export const playerLevel = () => Math.floor(Math.sqrt(S.xp / 40)) + 1;
export const levelFloor = (lv) => 40 * (lv - 1) ** 2;
export const soundOn = () => S.sound;
export function toggleSound() { S.sound = !S.sound; saveS(); return S.sound; }
export const animOn = () => A.settings.anim !== 'off';
export function setAnim(v) { A.settings.anim = v; saveA(); document.documentElement.classList.toggle('ar-calm', v === 'off'); }
document.documentElement.classList.toggle('ar-calm', A.settings.anim === 'off');

// Today's counters (for daily missions); reset when the date changes.
export function todayCounters() {
  const d = today();
  if (A.today.date !== d) A.today = { date: d, n: 0, c: 0, rec: {}, mas: 0, mtp: {}, rev: 0, ses: 0 };
  A.today.rec = obj(A.today.rec); A.today.mtp = obj(A.today.mtp);
  return A.today;
}

// ---------- spaced review ----------
export const INTERVALS = [0, 1, 3, 7, 16, 35]; // days until the next review, by box
export const isDue = (id, d = today()) => { const r = S.q[id]; return !!r && (r.due ?? d) <= d; };

// ---------- recording one answer (every game calls this) ----------
// q: { id, src, ch?, tp? }. Returns what changed, for the game's feedback.
const listeners = new Set();
export const onAnswer = (fn) => listeners.add(fn);
export function recordAnswer(q, ok, { assisted = false } = {}) {
  const id = q.id, d = today(), t = todayCounters();
  const before = masteryOf(id);
  if (!ok) S.m[id] = 0;
  else if (!assisted) S.m[id] = Math.min(3, before + 1);
  const nowMastered = masteryOf(id) >= 2 && before < 2;

  const r = S.q[id] = obj(S.q[id]);
  const wasWrong = num(r.w) > 0;
  r.n = num(r.n) + 1;
  if (ok) r.c = num(r.c) + 1; else r.w = num(r.w) + 1;
  r.last = d;
  if (q.ch) r.ch = q.ch;
  if (q.tp) r.tp = q.tp;
  if (ok && !assisted) { r.box = Math.min(5, num(r.box) + 1); r.due = addDays(d, INTERVALS[r.box]); }
  else if (!ok) { r.box = 0; r.due = d; }

  // rewards: once per question per day
  if (S.xd.d !== d) S.xd = { d, ids: {} };
  S.xd.ids = obj(S.xd.ids);
  let gainXp = 0, gainCoin = 0;
  if (ok && !S.xd.ids[id]) {
    S.xd.ids[id] = 1;
    gainXp = assisted ? 1 : 3;
    gainCoin = 1;
    S.xp += gainXp;
    A.coins += gainCoin;
    const farm = gameState('farm', FARM_DEFAULTS);
    farm.water += 1;
  }
  if (nowMastered && !r.everM) {
    r.everM = 1;
    gameState('farm', FARM_DEFAULTS).seeds += 1;
    t.mas += 1;
    if (q.ch) t.mtp[`${q.ch}/${q.tp ?? 'all'}`] = num(t.mtp[`${q.ch}/${q.tp ?? 'all'}`]) + 1;
  }
  let recovered = false;
  if (ok && wasWrong && !t.rec[id]) { t.rec[id] = 1; A.stats.rec += 1; recovered = true; }

  t.n += 1; if (ok) t.c += 1;
  A.stats.n += 1; if (ok) A.stats.c += 1;
  A.days[d] = num(A.days[d]) + 1;
  const h = S.h[d] = obj(S.h[d]);
  h.n = num(h.n) + 1; if (ok) h.c = num(h.c) + 1; if (nowMastered) h.m = num(h.m) + 1;
  const keys = Object.keys(S.h).sort();
  while (keys.length > 60) delete S.h[keys.shift()];

  if (q.src === 'mcq') recordAttempt(id, ok); // the MCQ review list and weak-topic stats
  saveAll();
  const res = { ok, gainXp, gainCoin, nowMastered, recovered };
  listeners.forEach((fn) => { try { fn(q, res); } catch { /* a listener must not break answering */ } });
  return res;
}

// A finished game: keeps the record, and pays XP only for beating it (so replays pay nothing).
export function finishRecord(key, score, stars = null) {
  const prev = bestOf(key);
  let gainXp = 0;
  if (score > prev) {
    S.best[key] = score;
    gainXp = Math.min(50, Math.round((score - prev) / 20));
    S.xp += gainXp;
  }
  if (stars != null && stars > starsOf(key)) S.stars[key] = stars;
  todayCounters().ses += 1;
  saveAll();
  return { prev, newBest: score > prev && score > 0, gainXp };
}
// One-time rewards (a chest, a stage, a mission…). Returns false if already claimed.
export function claim(key, { coins = 0, xp: x = 0, gems = 0, energy = 0 } = {}) {
  if (A.claimed[key]) return false;
  A.claimed[key] = today();
  A.coins += coins; S.xp += x; A.gems += gems; A.energy += energy;
  saveAll();
  return true;
}
export const claimed = (key) => !!A.claimed[key];
export function spend(kind, n) {
  if (num(A[kind]) < n) return false;
  A[kind] -= n;
  saveA();
  return true;
}

// ---------- streak ----------
export const ACTIVE_MIN = 5; // answers that make a day count
export function streak() {
  const active = (d) => num(A.days[d]) >= ACTIVE_MIN;
  let d = today(), n = 0;
  if (!active(d)) d = addDays(d, -1);
  while (active(d)) { n++; d = addDays(d, -1); }
  return n;
}
export function bestStreak() {
  const days = Object.keys(A.days).filter((d) => num(A.days[d]) >= ACTIVE_MIN).sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

// ---------- farm defaults live here so answering can add water/seeds ----------
export const FARM_DEFAULTS = { seeds: 3, water: 5, plots: [], harvests: 0, deco: {}, golden: 0 };

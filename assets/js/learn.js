// Practice data on this device: MCQ attempts (for weak-topic analysis), the spaced-repetition
// schedule, exam history, bookmarks, personal notes, the daily goal and offline chapters.
// Everything lives in localStorage under "hscos:", so the encrypted backup carries it too.

const KEYS = {
  att: 'hscos:attempts:v1',
  srs: 'hscos:srs:v1',
  exams: 'hscos:exams:v1',
  bm: 'hscos:bookmarks:v1',
  notes: 'hscos:notes:v1',
  goal: 'hscos:goal:v1',
  off: 'hscos:offline:v1',
};
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* keeps for this visit */ }
}
const DAY = 864e5;
export const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ---------- item lookup ----------
let byItem = null;
export function indexItems(model) {
  byItem = new Map();
  for (const sec of model.sections) for (const it of sec.items) byItem.set(it.id, { it, sec });
}
export const itemRef = (id) => byItem?.get(id) ?? null;
export const isMcq = (it) => !!(it?.question && it?.options);
export const rightIndex = (it) => {
  const ans = String(it.correctAnswer ?? '').trim();
  return (it.options ?? []).findIndex((o, i) => ans === String(i) || ans === String(o).trim());
};

// ---------- MCQ attempts ----------
let att = read(KEYS.att, {});
export function recordAttempt(id, correct) {
  const a = att[id] ?? { n: 0, w: 0 };
  a.n += 1;
  if (!correct) a.w += 1;
  a.last = Date.now();
  a.ok = !!correct;
  att[id] = a;
  write(KEYS.att, att);
  bumpGoal();
  if (!correct) srsSchedule(id, 0);
}
export const attemptOf = (id) => att[id] ?? null;
export const everWrong = (id) => (att[id]?.w ?? 0) > 0;

// ---------- spaced repetition (Leitner boxes) ----------
export const INTERVALS = [1, 3, 7, 16, 35]; // days until the next look, per box
let srs = read(KEYS.srs, {});
function srsSchedule(id, box) {
  srs[id] = { box, due: startOfDay() + INTERVALS[Math.min(box, INTERVALS.length - 1)] * DAY };
  write(KEYS.srs, srs);
}
export function srsAdd(id) {
  if (!srs[id]) srsSchedule(id, 0);
}
export function srsReview(id, remembered) {
  const box = srs[id]?.box ?? 0;
  if (remembered && box + 1 >= INTERVALS.length) { delete srs[id]; write(KEYS.srs, srs); return 'mastered'; }
  srsSchedule(id, remembered ? box + 1 : 0);
  return remembered ? 'later' : 'tomorrow';
}
export function srsDue(now = Date.now()) {
  return Object.entries(srs).filter(([id, s]) => s.due <= now && itemRef(id)).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
}
export function srsNext() {
  const ds = Object.values(srs).map((s) => s.due).filter((d) => d > Date.now());
  return ds.length ? Math.min(...ds) : null;
}
export const srsCount = () => Object.keys(srs).length;
export const srsBox = (id) => srs[id]?.box ?? null;

// ---------- exams ----------
let exams = read(KEYS.exams, []);
export const examHistory = () => exams;
export function saveExam(rec) {
  exams = [rec, ...exams].slice(0, 50);
  write(KEYS.exams, exams);
}

// ---------- bookmarks & notes ----------
let bm = read(KEYS.bm, {});
export const isBookmarked = (id) => !!bm[id];
export function toggleBookmark(id) {
  if (bm[id]) delete bm[id];
  else bm[id] = Date.now();
  write(KEYS.bm, bm);
  return !!bm[id];
}
export const bookmarks = () => Object.entries(bm).sort((a, b) => b[1] - a[1]).map(([id]) => id);
let notes = read(KEYS.notes, {});
export const noteOf = (id) => notes[id]?.text ?? '';
export function setNote(id, text) {
  const t = String(text ?? '').trim();
  if (t) notes[id] = { text: t, at: Date.now() };
  else delete notes[id];
  write(KEYS.notes, notes);
}
export const notedItems = () => Object.entries(notes).sort((a, b) => b[1].at - a[1].at).map(([id]) => id);

// ---------- daily goal & reminder ----------
const GOAL_DEFAULT = { mcq: 30, time: '20:00', remind: false, day: '', count: 0, notified: '' };
let goal = { ...GOAL_DEFAULT, ...read(KEYS.goal, {}) };
function bumpGoal() {
  const d = todayStr();
  if (goal.day !== d) { goal.day = d; goal.count = 0; }
  goal.count += 1;
  write(KEYS.goal, goal);
}
export function goalState() {
  const d = todayStr();
  return { ...goal, count: goal.day === d ? goal.count : 0 };
}
export function setGoal(patch) {
  goal = { ...goal, ...patch };
  write(KEYS.goal, goal);
}

// ---------- offline chapters ----------
let off = read(KEYS.off, {});
export const offlineOf = (chapterId) => off[chapterId] ?? null;
export function setOffline(chapterId, info) {
  if (info) off[chapterId] = info;
  else delete off[chapterId];
  write(KEYS.off, off);
}
export const offlineAll = () => off;

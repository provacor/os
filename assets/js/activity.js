// Real usage history on this device: recently opened chapters/sections,
// per-day activity (for streaks and the heatmap) and recent searches.
// Nothing here is estimated: every number comes from what the user did.

const RECENT = 'hscos:recent:v1';
const ACTIVITY = 'hscos:activity:v1';
const SEARCHES = 'hscos:searches:v1';

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: history stays in memory for this visit */
  }
}

let recent = read(RECENT, []);
let activity = read(ACTIVITY, {});
let searches = read(SEARCHES, []);

export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function today() {
  const k = dayKey();
  activity[k] ??= { opened: [], done: 0 };
  return activity[k];
}

// ---- visits ----

export function recordVisit(chapterId, sectionId = null) {
  if (!chapterId) return;
  const prev = recent.find((r) => r.chapterId === chapterId);
  recent = [{ chapterId, sectionId: sectionId ?? prev?.sectionId ?? null, t: Date.now() }, ...recent.filter((r) => r.chapterId !== chapterId)].slice(0, 30);
  write(RECENT, recent);
  const t = today();
  if (!t.opened.includes(chapterId)) t.opened.push(chapterId);
  write(ACTIVITY, activity);
}

export function recentVisits() {
  return recent;
}

// ---- completions ----

export function recordDone(nowDone) {
  const t = today();
  t.done = Math.max(0, t.done + (nowDone ? 1 : -1));
  write(ACTIVITY, activity);
}

export function todayStats() {
  const t = activity[dayKey()] ?? { opened: [], done: 0 };
  return { chaptersOpened: t.opened.length, itemsDone: t.done };
}

// Activity score for a day: chapters opened + items completed.
export function dayScore(key) {
  const d = activity[key];
  return d ? d.opened.length + d.done : 0;
}

export function hasActivity() {
  return Object.keys(activity).some((k) => dayScore(k) > 0);
}

// Consecutive active days ending today (or yesterday, so a streak survives until tonight).
export function streak() {
  const d = new Date();
  if (!dayScore(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (dayScore(dayKey(d)) > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---- searches ----

export function recentSearches() {
  return searches;
}

export function addSearch(q) {
  const s = q.trim();
  if (s.length < 2) return;
  searches = [s, ...searches.filter((x) => x.toLowerCase() !== s.toLowerCase())].slice(0, 8);
  write(SEARCHES, searches);
}

export function clearSearches() {
  searches = [];
  write(SEARCHES, searches);
}

export function resetActivity() {
  recent = [];
  activity = {};
  write(RECENT, recent);
  write(ACTIVITY, activity);
}

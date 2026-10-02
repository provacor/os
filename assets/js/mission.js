// Personal Study Mission: a 7-day planner (today + next six days).
// Each day holds a task list and a free note. Stored only in this browser,
// so every person who opens the app gets their own private plan.

const KEY = 'hscos:mission:v1';
const KEEP_DAYS = 60; // older days are dropped so storage stays small

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

let plan = read();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
  } catch {
    /* storage unavailable: the plan stays in memory for this visit */
  }
}

export function dayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Today and the six days after it, as { key, date, offset }.
export function week() {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return { key: dayKey(d), date: d, offset: i };
  });
}

const day = (key) => (plan[key] ??= { tasks: [], note: '' });

export const tasksOf = (key) => plan[key]?.tasks ?? [];
export const noteOf = (key) => plan[key]?.note ?? '';

export function addTask(key, text) {
  const t = text.trim();
  if (!t) return false;
  day(key).tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t.slice(0, 300), done: false });
  save();
  return true;
}

export function toggleTask(key, id) {
  const t = tasksOf(key).find((x) => x.id === id);
  if (t) { t.done = !t.done; save(); }
}

export function deleteTask(key, id) {
  if (!plan[key]) return;
  plan[key].tasks = plan[key].tasks.filter((x) => x.id !== id);
  save();
}

export function setNote(key, text) {
  day(key).note = text.slice(0, 5000);
  save();
}

// Unfinished tasks from days before today, newest first.
export function leftovers(todayKey) {
  return Object.keys(plan)
    .filter((k) => k < todayKey)
    .sort()
    .reverse()
    .flatMap((k) => plan[k].tasks.filter((t) => !t.done).map((t) => ({ key: k, ...t })));
}

export function moveTask(fromKey, id, toKey) {
  const t = tasksOf(fromKey).find((x) => x.id === id);
  if (!t) return;
  plan[fromKey].tasks = plan[fromKey].tasks.filter((x) => x.id !== id);
  day(toKey).tasks.push(t);
  save();
}

// Drop days older than KEEP_DAYS and empty days.
(function prune() {
  const cut = new Date();
  cut.setDate(cut.getDate() - KEEP_DAYS);
  const cutKey = dayKey(cut);
  let changed = false;
  for (const k of Object.keys(plan)) {
    const d = plan[k];
    if (k < cutKey || !d || (!d.tasks?.length && !d.note)) { delete plan[k]; changed = true; }
  }
  if (changed) save();
})();

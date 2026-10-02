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

// One Saturday-to-Friday week (the Bangladesh school week) as { key, date, isToday }.
// offset 0 is the current week, 1 the next one, -1 the previous one.
export function week(offset = 0) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 1) % 7) + offset * 7);
  const todayKey = dayKey(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d);
    return { key, date: d, isToday: key === todayKey };
  });
}

export const todayKey = () => dayKey(new Date());

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

// Unfinished tasks from days before `beforeKey`, newest first.
export function leftovers(beforeKey) {
  return Object.keys(plan)
    .filter((k) => k < beforeKey)
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

// ---------- study-plan tasks (written by the planner) ----------

// Replace the planner's tasks on one day, keeping the person's own tasks.
export function setPlanTasks(key, tasks) {
  const d = day(key);
  d.tasks = [...d.tasks.filter((t) => !t.plan), ...tasks.map((t) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), done: false, plan: true, ...t }))];
  if (!d.tasks.length && !d.note) delete plan[key];
  save();
}

// Every planner task stored on the device, with its day.
export const allPlanTasks = () => Object.entries(plan).flatMap(([key, d]) => (d.tasks ?? []).filter((t) => t.plan).map((t) => ({ key, ...t })));

export const exportMission = () => plan;
export function importMission(obj) {
  plan = obj && typeof obj === 'object' ? obj : {};
  save();
}

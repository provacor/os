// Exam study planner. Given the exam date, daily study time and subjects, it spreads every
// unfinished chapter over the days left — weak chapters (open mistakes, low progress) get
// more time — leaves the last days for revision, and writes the tasks into Mission.
// Missed days are detected and the rest of the plan is rebuilt from today.

import { dayKey, todayKey, setPlanTasks, allPlanTasks } from './mission.js?v=202610030202';
import { progressOf } from './progress.js?v=202610030202';
import { mistakeWeight } from './mistakes.js?v=202610030202';

const KEY = 'hscos:plan:v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
let settings = read();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* keep in memory */ } };

export const planSettings = () => settings;
export const SUBJECT_ORDER = ['physics', 'chemistry', 'higher_math', 'biology', 'english'];

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
export const fmtMin = (m) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return bn([h ? `${h} ঘ` : '', r ? `${r} মি` : ''].filter(Boolean).join(' ') || '০ মি');
};

const atNoon = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
export const daysUntil = (iso) => Math.round((atNoon(iso) - atNoon(new Date())) / 864e5);

// minutes a chapter needs from scratch (English grammar topics are shorter)
const baseMinutes = (ch) => (ch.subject.id === 'english' ? 150 : 360);

// Minutes already studied per chapter through completed planner tasks.
function doneMinutes() {
  const m = {};
  for (const t of allPlanTasks()) if (t.done && t.ch) m[t.ch] = (m[t.ch] ?? 0) + (t.min ?? 0);
  return m;
}

export function buildPlan(model, opts) {
  settings = { ...opts, createdOn: todayKey(), builtOn: todayKey() };
  save();
  return applyPlan(model);
}

export function clearPlan() {
  const today = todayKey();
  for (const t of allPlanTasks()) if (t.key >= today) setPlanTasks(t.key, []);
  settings = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Regenerate today → exam from the current state. Returns a summary.
export function applyPlan(model) {
  if (!settings) return null;
  const today = new Date();
  const total = daysUntil(settings.examDate);
  if (total < 1) return { error: 'past' };

  // days we can study (skip the weekly day off), the last ones kept for revision
  const days = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (settings.offDay != null && settings.offDay !== '' && d.getDay() === Number(settings.offDay)) continue;
    days.push(dayKey(d));
  }
  if (!days.length) return { error: 'nodays' };
  const revisionDays = days.length >= 6 ? Math.min(10, Math.max(2, Math.round(days.length * 0.15))) : 0;
  const studyDays = days.slice(0, days.length - revisionDays);
  const revDays = days.slice(days.length - revisionDays);
  const cap = Math.round(settings.hours * 60);

  // what is left to study, weighted by weakness
  const weak = mistakeWeight();
  const done = doneMinutes();
  const chapters = model.chapters.filter((c) => settings.subjects.includes(c.subject.id));
  const need = [];
  for (const ch of chapters) {
    const left = 1 - progressOf(ch) / 100;
    const weight = 1 + Math.min(1, (weak[ch.id] ?? 0) * 0.15);
    const min = Math.max(0, baseMinutes(ch) * left * weight - (done[ch.id] ?? 0));
    if (min >= 20) need.push({ ch, min, weak: weak[ch.id] ?? 0 });
  }
  // a weekly review slot (every 7th study day) for the mistake book
  const reviewEvery = 7;
  const reviewSlots = studyDays.filter((_, i) => i % reviewEvery === reviewEvery - 1).length;
  const studyCap = studyDays.length * cap - reviewSlots * Math.min(60, cap / 2);
  const totalNeed = need.reduce((n, x) => n + x.min, 0);
  const scale = totalNeed > studyCap ? studyCap / totalNeed : 1;
  need.forEach((x) => (x.min = Math.max(20, Math.round((x.min * scale) / 10) * 10)));

  // interleave subjects so each day mixes them; weak chapters of each subject first
  const queues = SUBJECT_ORDER.filter((s) => settings.subjects.includes(s)).map((s) =>
    need.filter((x) => x.ch.subject.id === s).sort((a, b) => b.weak - a.weak || a.ch.paper.paperNo - b.ch.paper.paperNo || a.ch.order - b.ch.order));
  const order = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) order.push(q.shift());

  const plan = {};
  let di = 0;
  let free = cap;
  const slotsFor = (i) => (i % reviewEvery === reviewEvery - 1 ? cap - Math.min(60, cap / 2) : cap);
  free = slotsFor(0);
  for (const item of order) {
    let left = item.min;
    while (left > 0 && di < studyDays.length) {
      const take = Math.min(left, free);
      if (take >= 15) (plan[studyDays[di]] ??= []).push({ ch: item.ch.id, min: take, text: `${item.ch.subject.name} · ${item.ch.name} — ${fmtMin(take)}` });
      left -= take;
      free -= take;
      if (free < 15) { di++; free = slotsFor(di); }
    }
  }
  studyDays.forEach((k, i) => {
    if (i % reviewEvery === reviewEvery - 1) (plan[k] ??= []).push({ min: Math.min(60, cap / 2), text: `সাপ্তাহিক রিভিশন + Mistake Book — ${fmtMin(Math.min(60, cap / 2))}` });
  });
  const subjNames = model.subjects.filter((s) => settings.subjects.includes(s.id)).map((s) => s.name);
  revDays.forEach((k, i) => {
    const s = subjNames[i % subjNames.length];
    plan[k] = [{ min: cap, text: i === revDays.length - 1 ? `শেষ রিভিশন: সূত্র, ভুলের খাতা, আগের প্রশ্ন — ${fmtMin(cap)}` : `রিভিশন: ${s} — পুরো সিলেবাস একবার দেখা + MCQ অনুশীলন (${fmtMin(cap)})` }];
  });

  // write into Mission: replace planner tasks from today on, keep the person's own tasks
  const todayK = todayKey();
  for (const t of allPlanTasks()) if (t.key >= todayK && !plan[t.key]) setPlanTasks(t.key, []);
  for (const [k, tasks] of Object.entries(plan)) setPlanTasks(k, tasks);

  settings.builtOn = todayK;
  save();
  return {
    days: total, studyDays: studyDays.length, revisionDays, chapters: need.length,
    needMin: Math.round(totalNeed), capMin: studyCap, tight: scale < 1, scale,
  };
}

// Planner tasks from earlier days that were not done.
export function missedPlanTasks() {
  const today = todayKey();
  return allPlanTasks().filter((t) => t.key < today && !t.done && settings && t.key >= (settings.createdOn ?? '0'));
}

// Called once at start-up: if days were missed and the plan wasn't rebuilt today, rebuild it.
export function autoRebuild(model) {
  if (!settings || settings.builtOn === todayKey()) return null;
  if (daysUntil(settings.examDate) < 1) return null;
  const missed = missedPlanTasks().length;
  const res = applyPlan(model);
  return res && { ...res, missed };
}

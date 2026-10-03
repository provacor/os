// Exam planner page.

import { icon } from '../icons.js?v=202610030752';
import { esc } from '../components.js?v=202610030752';
import { planSettings, daysUntil, missedPlanTasks, fmtMin, SUBJECT_ORDER } from '../planner.js?v=202610030752';
import { allPlanTasks, todayKey } from '../mission.js?v=202610030752';

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
export const plannerState = { result: null };
const WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export function plannerView(model) {
  const s = planSettings();
  const r = plannerState.result;
  const defDate = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })();
  const tasks = allPlanTasks();
  const today = todayKey();
  const upcoming = tasks.filter((t) => t.key >= today).sort((a, b) => (a.key < b.key ? -1 : 1));
  const doneCount = tasks.filter((t) => t.done).length;
  const missed = s ? missedPlanTasks().length : 0;
  const next3 = [...new Set(upcoming.map((t) => t.key))].slice(0, 3);
  const dayLabel = (k) => { const d = new Date(`${k}T12:00:00`); return k === today ? 'আজ' : `${bn(d.getDate())}/${bn(d.getMonth() + 1)} ${WEEKDAYS[d.getDay()]}`; };

  const status = s ? `<section class="card pl-status rise" style="--i:1">
      <div class="pl-big"><b>${bn(Math.max(0, daysUntil(s.examDate)))}</b><span>দিন বাকি</span></div>
      <div class="pl-stats"><span>${icon('check')} ${bn(doneCount)}/${bn(tasks.length)} কাজ শেষ</span><span>${icon('clock')} দিনে ${fmtMin(s.hours * 60)}</span></div>
      ${missed ? `<p class="pl-warn">${icon('warn')} আগের ${bn(missed)}টি কাজ বাকি ছিল — প্ল্যান আজ থেকে নতুন করে সাজানো হয়েছে।</p>` : ''}
      ${r?.tight ? `<p class="pl-warn">${icon('info')} সময় কম: সব অধ্যায় পুরোপুরি পড়তে দিনে আরও প্রায় ${fmtMin(Math.max(0, (r.needMin - r.capMin) / Math.max(1, r.studyDays)))} লাগবে। তাই প্রতিটা অধ্যায়ে সময় একটু কমানো হয়েছে।</p>` : ''}
      ${next3.map((k) => `<div class="pl-day"><p class="pl-dh">${dayLabel(k)}</p><ul>${upcoming.filter((t) => t.key === k).map((t) => `<li class="${t.done ? 'done' : ''}">${t.done ? icon('check') : '•'} ${esc(t.text)}</li>`).join('')}</ul></div>`).join('')}
      <div class="pl-actions">
        <a class="btn btn-primary tap" href="#/mission">${icon('target')}<span>Mission-এ সব দিন দেখো</span></a>
        <button class="btn tap" data-plan-ai>${icon('sparkle')}<span>AI-কে প্ল্যান দেখাও</span></button>
        <button class="link pl-clear" data-plan-clear>প্ল্যান মুছে ফেলো</button>
      </div>
    </section>` : '';

  const subs = SUBJECT_ORDER.map((id) => model.byId.get(id)).filter(Boolean);
  return {
    nav: 'mission',
    title: 'Study planner',
    back: '#/mission',
    html: `<header class="page-title rise"><p class="eyebrow">Exam planner</p><h1>পরীক্ষার প্ল্যান</h1>
        <p class="muted">পরীক্ষার তারিখ আর দিনে কতক্ষণ পড়বে বললেই প্রতিদিনের পড়া সাজিয়ে Mission-এ বসিয়ে দেবে। দুর্বল অধ্যায় (Mistake Book-এ বেশি ভুল) বেশি সময় পায়। কোনো দিন মিস হলে বাকি প্ল্যান নিজে থেকে নতুন করে সাজায়।</p></header>
      ${status}
      <form class="card pl-form rise" style="--i:2" data-plan-form>
        <h2 class="card-title">${icon('notes')} ${s ? 'প্ল্যান বদলাও' : 'নতুন প্ল্যান'}</h2>
        <label class="pf-label" for="plDate">পরীক্ষার তারিখ</label>
        <input id="plDate" name="date" type="date" required min="${new Date(Date.now() + 864e5).toISOString().slice(0, 10)}" value="${esc(s?.examDate ?? defDate)}">
        <div class="chip-row pl-quick">${[30, 60, 90].map((d) => `<button type="button" class="chip" data-plan-days="${d}">${bn(d)} দিন পরে</button>`).join('')}</div>
        <label class="pf-label" for="plHours">দিনে কত ঘণ্টা পড়তে পারবে</label>
        <select id="plHours" name="hours">${[1, 1.5, 2, 3, 4, 5, 6, 8, 10].map((h) => `<option value="${h}" ${(s?.hours ?? 4) === h ? 'selected' : ''}>${fmtMin(h * 60)}</option>`).join('')}</select>
        <label class="pf-label" for="plOff">সাপ্তাহিক ছুটি (ঐচ্ছিক)</label>
        <select id="plOff" name="off"><option value="">কোনো ছুটি নেই</option>${WEEKDAYS.map((w, i) => `<option value="${i}" ${String(s?.offDay ?? '') === String(i) ? 'selected' : ''}>${w}</option>`).join('')}</select>
        <p class="pf-label">বিষয়</p>
        <div class="pl-subs">${subs.map((x) => `<label class="pl-sub"><input type="checkbox" name="subj" value="${x.id}" ${!s || s.subjects.includes(x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')}</div>
        <button class="btn btn-primary tap" type="submit">${icon('spark')}<span>${s ? 'আবার সাজাও' : 'প্ল্যান বানাও'}</span></button>
        ${s ? '<p class="muted small">আবার সাজালে আজ থেকে পরের দিনগুলোর প্ল্যান বদলাবে। তোমার নিজের লেখা কাজ থেকে যাবে।</p>' : ''}
      </form>`,
  };
}

// Text handed to the AI tutor for advice on the current plan.
export function planSummary(model) {
  const s = planSettings();
  if (!s) return '';
  const subs = s.subjects.map((id) => model.byId.get(id)?.name).filter(Boolean).join(', ');
  const tasks = allPlanTasks().filter((t) => t.key >= todayKey()).slice(0, 14).map((t) => `${t.key}: ${t.text}`).join('\n');
  return `আমার HSC পরীক্ষা ${daysUntil(s.examDate)} দিন পরে। দিনে ${s.hours} ঘণ্টা পড়তে পারি। বিষয়: ${subs}। অ্যাপ এই প্ল্যান বানিয়েছে (প্রথম কয়েক দিন):\n${tasks}\n\nএই প্ল্যান কেমন? কী বদলালে ভালো হবে, আর কীভাবে পড়লে বেশি মনে থাকবে — সংক্ষেপে পরামর্শ দাও।`;
}

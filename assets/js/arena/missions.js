// 10. Daily Missions & Streaks — four missions made each day from the player's own data (wrong
// questions waiting, a topic not yet mastered…), each paid once. A day with at least five answers
// keeps the streak; a broken streak never deletes any progress. Dates are the phone's local date.

import { esc, bn, bar, chapters, topicsOf, chapterById, topicName, hashStr, seeded, refresh, sfx } from './core.js?v=202610150320';
import { S, A, saveA, todayCounters, claim, claimed, isMastered, statOf, streak, bestStreak, today, addDays, ACTIVE_MIN } from '../learnstore.js?v=202610150320';
import { questionsOf } from '../gamedata.js?v=202610150320';

export const meta = { id: 'missions', emoji: '🎯', name: 'দৈনিক মিশন ও ধারা', desc: 'প্রতিদিন তোমার নিজের পড়া থেকে ৪টি মিশন — শেষ করলে XP আর কয়েন। টানা পড়লে ধারা বাড়ে, ভাঙলেও কিছু হারায় না।', need: 0 };
const REWARD = { xp: 20, coins: 15 }, BONUS = { coins: 25, gems: 1 };

// Today's missions, made once per day and then kept (so they don't change mid-day).
export function missions() {
  const t = todayCounters();
  if (Array.isArray(t.plan) && t.plan.length) return t.plan;
  const rnd = seeded(hashStr(`missions:${t.date}`));
  const waiting = Object.entries(S.q).filter(([id, r]) => r?.w > 0 && !isMastered(id)).length;
  const plan = [{ id: 'answer', goal: 10 }];
  plan.push(waiting >= 5 ? { id: 'recover', goal: 5 } : { id: 'correct', goal: 8 });
  plan.push(rnd() < 0.5 ? { id: 'revise', goal: 1 } : { id: 'round', goal: 1 });
  const fresh = (ch, tp) => questionsOf(ch, tp).filter((s) => !isMastered(s.id) && !statOf(s.id)?.everM).length;
  const cands = chapters().flatMap((c) => topicsOf(c.id).map((tp) => ({ ch: c.id, tp: tp.id }))).filter((x) => fresh(x.ch, x.tp) >= 1);
  if (cands.length) {
    const x = cands[Math.floor(rnd() * cands.length)];
    plan.push({ id: 'master', goal: Math.min(3, fresh(x.ch, x.tp)), ch: x.ch, tp: x.tp });
  } else plan.push({ id: 'answer20', goal: 20 });
  t.plan = plan;
  saveA();
  return plan;
}

function describe(m) {
  const t = todayCounters();
  switch (m.id) {
    case 'answer': return { e: '✍️', text: `আজ ${bn(m.goal)}টি প্রশ্নের উত্তর দাও`, have: t.n, go: '#/arena/race' };
    case 'answer20': return { e: '✍️', text: `আজ ${bn(m.goal)}টি প্রশ্নের উত্তর দাও`, have: t.n, go: '#/arena/arcade' };
    case 'recover': return { e: '🩹', text: `আগে ভুল হওয়া ${bn(m.goal)}টি প্রশ্ন এবার সঠিক করো`, have: Object.keys(t.rec).length, go: '#/arena/revision' };
    case 'correct': return { e: '✅', text: `আজ ${bn(m.goal)}টি সঠিক উত্তর দাও`, have: t.c, go: '#/arena/kingdom' };
    case 'revise': return { e: '🤖', text: 'রিভিশন বটের একটি সেশন শেষ করো', have: t.rev, go: '#/arena/revision' };
    case 'round': return { e: '🎮', text: 'যেকোনো গেমের একটি রাউন্ড শেষ করো', have: t.ses, go: '#/arena/arcade' };
    case 'master': {
      const name = topicName(m.ch, m.tp) ?? '';
      return { e: '🎓', text: `“${name}” টপিকে ${bn(m.goal)}টি নতুন প্রশ্ন আয়ত্তে আনো`, sub: chapterById(m.ch)?.name ?? '', have: t.mtp[`${m.ch}/${m.tp}`] ?? 0, go: `#/arena/revision/${encodeURIComponent(m.ch)}/${encodeURIComponent(m.tp)}` };
    }
    default: return { e: '🎯', text: '', have: 0, go: '#/arena' };
  }
}
const mKey = (m) => `mission:${todayCounters().date}:${m.id}`;
export function missionSummary() {
  const list = missions();
  const done = list.filter((m) => describe(m).have >= m.goal).length;
  const got = list.filter((m) => claimed(mKey(m))).length;
  return { done, got, total: list.length };
}
export function progress() {
  const s = missionSummary();
  return Math.round((s.done / s.total) * 100);
}

export function view({ b }) {
  if (b) return null;
  const list = missions();
  const t = todayCounters();
  const rows = list.map((m) => {
    const d = describe(m);
    const ok = d.have >= m.goal, got = claimed(mKey(m));
    return `<div class="ar-mission ${ok ? 'done' : ''} ${got ? 'got' : ''}"><span class="ar-mission-e">${d.e}</span>
        <span class="ar-mission-body"><b>${esc(d.text)}</b>${d.sub ? `<small>${esc(d.sub)}</small>` : ''}
          ${bar(Math.round(Math.min(100, (d.have / m.goal) * 100)), 'bar-thin')}<small>${bn(Math.min(d.have, m.goal))}/${bn(m.goal)}</small></span>
        ${got ? '<small class="ar-got">✓ নেওয়া হয়েছে</small>' : ok ? `<button class="btn btn-primary tap" data-ms-claim="${m.id}">🎁 নাও</button>` : `<a class="btn tap" href="${d.go}">খেলো</a>`}</div>`;
  }).join('');
  const all = list.every((m) => claimed(mKey(m)));
  const bonusGot = claimed(`mission:bonus:${t.date}`);
  return {
    title: meta.name,
    html: `<div id="arMs"><header class="ar-hero rise"><span class="ar-hero-emoji">🎯</span><div><h1>আজকের মিশন</h1>
        <p class="muted small">${esc(t.date)} · প্রতিটা মিশনে +${bn(REWARD.xp)} XP আর +${bn(REWARD.coins)} 🪙 — সব শেষ হলে বোনাস +${bn(BONUS.coins)} 🪙 আর 💎</p></div></header>
      <section class="block">${rows}
        <div class="ar-mission bonus ${bonusGot ? 'got' : ''}"><span class="ar-mission-e">🎁</span><span class="ar-mission-body"><b>সব মিশন শেষের বোনাস</b><small>${bn(list.filter((m) => claimed(mKey(m))).length)}/${bn(list.length)} নেওয়া হয়েছে</small></span>
          ${bonusGot ? '<small class="ar-got">✓ নেওয়া হয়েছে</small>' : all ? '<button class="btn btn-primary tap" data-ms-bonus>🎁 বোনাস নাও</button>' : '<small class="muted">🔒</small>'}</div></section>
      ${streakCard()}
      </div>`,
    after: () => document.getElementById('arMs')?.addEventListener('click', (e) => {
      const c = e.target.closest('[data-ms-claim]');
      if (c) {
        const m = missions().find((x) => x.id === c.dataset.msClaim);
        if (m && describe(m).have >= m.goal && claim(mKey(m), REWARD)) sfx.up();
        return refresh();
      }
      if (e.target.closest('[data-ms-bonus]')) {
        if (missions().every((m) => claimed(mKey(m))) && claim(`mission:bonus:${todayCounters().date}`, BONUS)) sfx.win();
        return refresh();
      }
    }),
  };
}

export function streakCard() {
  const now = streak(), best = bestStreak();
  const d0 = today();
  const todayN = A.days[d0] ?? 0;
  const days = Array.from({ length: 28 }, (_, i) => addDays(d0, i - 27));
  const cells = days.map((d) => {
    const n = A.days[d] ?? 0;
    return `<span class="ar-day ${n >= ACTIVE_MIN ? 'on' : n ? 'some' : ''} ${d === d0 ? 'today' : ''}" title="${d}: ${bn(n)}টি উত্তর">${bn(Number(d.slice(8)))}</span>`;
  }).join('');
  return `<section class="block ar-streak"><div class="block-head"><h2>🔥 পড়ার ধারা</h2></div>
    <div class="ar-stats"><span><b>🔥 ${bn(now)}</b><small>টানা দিন</small></span><span><b>🏅 ${bn(best)}</b><small>সেরা ধারা</small></span><span><b>${bn(Math.min(todayN, ACTIVE_MIN))}/${bn(ACTIVE_MIN)}</b><small>আজ</small></span></div>
    <p class="muted small">${todayN >= ACTIVE_MIN ? '✓ আজকের দিনটা ধারায় যোগ হয়েছে!' : `আজ আরও ${bn(ACTIVE_MIN - todayN)}টি উত্তর দিলে আজকের দিনটা ধারায় যোগ হবে।`} ধারা ভাঙলেও তোমার আয়ত্ত, XP, কয়েন — কিছুই মুছে যায় না।</p>
    <div class="ar-cal" aria-label="গত ২৮ দিন">${cells}</div>
    <p class="muted small ar-legend"><i class="on"></i> ধারার দিন (≥${bn(ACTIVE_MIN)}টি উত্তর) <i class="some"></i> কিছু পড়া</p></section>`;
}

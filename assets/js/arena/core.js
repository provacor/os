// Shared parts of the new game zone (#/arena): question pools, smart picking, the question panel
// (with explanation and 50:50 / skip help), the results screen, and chapter/topic pickers.
// Every question is a gamedata.js spec — the chapter's own MCQ or content, never rewritten.

import { esc, bar, chapterNo } from '../components.js?v=202610150339';
import { questionsOf, sourcesOf, topicsOf as allTopicsOf, topicName, gameChapters, chapterById, sourceMeta, answersOf, compatible } from '../gamedata.js?v=202610150339';
import { makeQ, sfx, confetti, floatText, shuffle, bn } from '../games.js?v=202610150339';
import { recordAnswer, isMastered, masteryOf, statOf, isDue, today, gameState, finishRecord, animOn, saveAll } from '../learnstore.js?v=202610150339';
import { checkAchievements } from './achievements.js?v=202610150339';

export { bn, shuffle, sfx, confetti, floatText, esc, bar, animOn };
export const pad2 = (n) => String(n).padStart(2, '0');
// Re-renders the current page in place (after a purchase, a setting, a claim…).
export const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

// ---------- pools ----------
const poolCache = new Map();
// A spec can be played if it has ≥2 options of its own, or another answer of its kind can stand
// beside its answer as a wrong option.
const playable = (s) => (s.opts ? s.opts.length >= 2 : answersOf(s.ch, s.kind).some((c) => compatible(s.kind, s.a, c)));
// The playable questions of a scope (tp 'all' = the whole chapter).
export function poolOf(ch, tp = 'all', src = 'mcq') {
  const key = `${ch}|${tp}|${src}`;
  if (!poolCache.has(key)) poolCache.set(key, questionsOf(ch, tp, src).filter(playable));
  return poolCache.get(key);
}
// Several chapters together, each with the given source if it has it (else its default).
export const mixedPool = (chIds, src = 'mcq') => chIds.flatMap((ch) => poolOf(ch, 'all', validSrc(ch, 'all', src)));
export const ask = (spec, pool, maxLen = 0) => makeQ(spec, pool, spec.ch, maxLen);

// The source a scope plays by default: its MCQs, else whatever content it has.
export function defaultSrc(ch, tp = 'all') {
  const s = sourcesOf(ch, tp).map((x) => x.id);
  return s.includes('mcq') ? 'mcq' : s[0] ?? 'all';
}
export function validSrc(ch, tp, src) {
  if (src === 'all') return 'all';
  return sourcesOf(ch, tp).some((x) => x.id === src) ? src : defaultSrc(ch, tp);
}
export function srcChips(base, ch, tp, src) {
  const list = sourcesOf(ch, tp);
  if (list.length < 2) return '';
  const all = { ...sourceMeta('all'), count: questionsOf(ch, tp).length };
  return `<div class="gm-srcs ar-srcs">${[...list, all].map((x) => `<a class="gm-src tap ${x.id === src ? 'on' : ''}" href="${base}/${x.id}">${x.emoji} ${esc(x.name)} <small>${bn(x.count)}</small></a>`).join('')}</div>`;
}

// Revision order: wrong-and-not-mastered first, then due, then never tried, then a few mastered.
export function rank(spec, d = today()) {
  const r = statOf(spec.id);
  if (r && r.w > 0 && !isMastered(spec.id)) return 0;
  if (r && isDue(spec.id, d) && r.n) return 1;
  if (!r) return 2;
  return 3;
}
export function smartPick(pool, n) {
  const d = today();
  const groups = [[], [], [], []];
  for (const s of pool) groups[rank(s, d)].push(s);
  return groups.flatMap((g) => shuffle(g)).slice(0, n);
}
// An endless deck in revision order (refills when used up).
export function deck(pool) {
  let list = [];
  return { next() { if (!list.length) list = smartPick(pool, pool.length); return list.shift(); } };
}

// ---------- mastery of a scope ----------
export function scopeIds(ch, tp = 'all') {
  const mcq = questionsOf(ch, tp, 'mcq');
  return (mcq.length ? mcq : questionsOf(ch, tp)).map((s) => s.id);
}
export function masteryPct(ch, tp = 'all') {
  const ids = scopeIds(ch, tp);
  const done = ids.filter(isMastered).length;
  return { done, total: ids.length, pct: ids.length ? Math.round((done / ids.length) * 100) : 0 };
}
// Topic badge from real mastery: 1 bronze (30%), 2 silver (60%), 3 gold (90%).
export const badgeOf = (pct) => (pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0);
export const BADGE = ['', '🥉', '🥈', '🥇'];
export const chapters = () => gameChapters();
// Topics that have at least one question to play (a topic with only recall cards is left out).
export const topicsOf = (ch) => allTopicsOf(ch).filter((t) => questionsOf(ch, t.id).length);
export { topicName, chapterById };

// ---------- help (50:50 / skip), unlocked in the skill tree, refilled daily ----------
export function assistLeft() {
  const sk = gameState('skills', { nodes: {}, equip: {}, used: {} });
  const nodes = sk.nodes;
  const half = ['half1', 'half2', 'half3'].filter((k) => nodes[k]).length;
  const skip = ['skip1', 'skip2'].filter((k) => nodes[k]).length;
  if (sk.used.date !== today()) sk.used = { date: today(), half: 0, skip: 0 };
  return { half: Math.max(0, half - sk.used.half), skip: Math.max(0, skip - sk.used.skip), sk };
}
function useAssist(kind) {
  const a = assistLeft();
  if (a[kind] <= 0) return false;
  a.sk.used[kind] += 1;
  saveAll();
  return true;
}

// ---------- the question panel ----------
let keyHandler = null;
document.addEventListener('keydown', (e) => {
  if (!keyHandler || e.target.closest?.('input, textarea, select')) return;
  keyHandler(e);
});
const LETTER = 'কখগঘঙ';

// Shows one question in `box`. The answer is recorded (unless noRecord), the explanation shows
// after a mistake (or always), then onNext() continues — once. Returns { destroy, answer }:
// answer(-1) is a timeout (counts as wrong). optsClass styles the options (e.g. moving targets).
export function askQuestion(box, q, { label = '', assist = true, showExp = 'wrong', reveal = true, noRecord = false, autoNextMs = 850, optsClass = '', onAnswer, onNext, onSkip } = {}) {
  let locked = false, assisted = false, hidden = [], alive = true, moved = false;
  const next = () => { if (moved || !alive) return; moved = true; onNext?.(); };
  const paint = () => {
    const a = assist && !noRecord ? assistLeft() : { half: 0, skip: 0 };
    box.innerHTML = `<div class="ar-q">
        ${label ? `<p class="ar-qlabel">${label}</p>` : ''}
        ${q.figure ? `<div class="gm-fig">${q.figure}</div>` : ''}
        <p class="ar-qtext">${esc(q.q)}</p>
        <div class="ar-opts ${optsClass}">${q.opts.map((o, k) => `<button class="opt ar-opt tap" style="--k:${k}${hidden.includes(k) ? ';visibility:hidden' : ''}" data-ar-opt="${k}" ${hidden.includes(k) ? 'disabled aria-hidden="true"' : ''}><span class="opt-key">${LETTER[k]}</span><span>${esc(o.t)}</span></button>`).join('')}</div>
        ${a.half || a.skip ? `<div class="ar-assist">
          ${a.half && !assisted && q.opts.length > 2 ? `<button class="chip-btn tap" data-ar-half>✂️ ৫০:৫০ <small>(${bn(a.half)})</small></button>` : ''}
          ${a.skip ? `<button class="chip-btn tap" data-ar-skip>⏭ পাস <small>(${bn(a.skip)})</small></button>` : ''}
          <small class="muted">সাহায্য নিয়ে উত্তর দিলে আয়ত্ত বাড়ে না</small></div>` : ''}
        <div class="ar-fb" role="status"></div>
      </div>`;
  };
  const answer = (k) => {
    if (locked || !alive || hidden.includes(k)) return;
    locked = true;
    const ok = k === q.right;
    box.querySelectorAll('[data-ar-opt]').forEach((b) => {
      const i = Number(b.dataset.arOpt);
      b.disabled = true;
      if (i === q.right && (reveal || i === k)) b.classList.add('right');
      else if (i === k) b.classList.add('wrong');
    });
    box.querySelector('.ar-opts')?.classList.add('answered');
    box.querySelector('.ar-assist')?.remove();
    const res = noRecord ? { ok } : recordAnswer(q, ok, { assisted });
    (ok ? sfx.ok : sfx.bad)();
    if (res.nowMastered) floatText(box, '🎓 আয়ত্তে এল!', 'up');
    onAnswer?.(ok, res, k);
    const fb = box.querySelector('.ar-fb');
    if (!fb) return;
    const gain = res.gainXp ? `<small class="ar-gain">+${bn(res.gainXp)} XP · +${bn(res.gainCoin)} 🪙</small>` : '';
    if (!reveal) { // a pass-and-play round: the answer stays hidden from the next player
      fb.innerHTML = `<p class="${ok ? 'ar-ok' : 'ar-bad'}">${ok ? '✓ সঠিক!' : k < 0 ? '⏰ সময় শেষ' : '✗ ভুল'} ${gain}</p>`;
      setTimeout(() => { if (box.isConnected) next(); }, autoNextMs);
      return;
    }
    if (ok && showExp !== 'always') {
      fb.innerHTML = `<p class="ar-ok">✓ সঠিক! ${gain}</p>`;
      setTimeout(() => { if (box.isConnected) next(); }, autoNextMs);
      return;
    }
    fb.innerHTML = `<div class="gm-fb ${ok ? 'ok' : 'bad'}"><b>${ok ? '✓ সঠিক!' : `${k < 0 ? '⏰ সময় শেষ! ' : '✗ '}সঠিক উত্তর: ${esc(q.opts[q.right].t)}`}</b> ${gain}
        ${q.exp ? `<p>${esc(q.exp)}</p>` : ''}
        <button class="btn btn-primary tap" data-ar-next>পরেরটা →</button></div>`;
    fb.querySelector('[data-ar-next]')?.focus({ preventScroll: true });
  };
  box.onclick = (e) => {
    const o = e.target.closest('[data-ar-opt]');
    if (o) return answer(Number(o.dataset.arOpt));
    if (e.target.closest('[data-ar-next]')) return next();
    if (e.target.closest('[data-ar-half]') && !locked && useAssist('half')) {
      assisted = true;
      const wrongs = shuffle(q.opts.map((_, i) => i).filter((i) => i !== q.right));
      hidden = wrongs.slice(0, Math.max(1, q.opts.length - 2));
      sfx.pop();
      return paint();
    }
    if (e.target.closest('[data-ar-skip]') && !locked && useAssist('skip')) {
      locked = true; moved = true; sfx.pop();
      return (onSkip ?? onNext)?.();
    }
  };
  const keys = (e) => {
    if (!box.isConnected) return;
    const n = '12345১২৩৪৫'.indexOf(e.key);
    if (n >= 0 && !locked) { e.preventDefault(); return answer(n % 5); }
    if ((e.key === 'Enter' || e.key === ' ') && box.querySelector('[data-ar-next]')) { e.preventDefault(); next(); }
  };
  keyHandler = keys;
  paint();
  // a question that starts low on the screen (or above it) is brought into view
  const top = box.getBoundingClientRect().top;
  if (top < 0 || top > window.innerHeight * 0.6) window.scrollTo({ top: Math.max(0, window.scrollY + top - 80), behavior: animOn() ? 'smooth' : 'auto' });
  return {
    answer,
    destroy() { alive = false; if (keyHandler === keys) keyHandler = null; box.onclick = null; },
  };
}

// ---------- the results screen ----------
export function resultScreen(el, { emoji = '🎯', title, score = null, key = null, stars = null, won = false, lines = [], rewards = [], wrong = [], retry, back, backLabel = 'ফিরে যাও' }) {
  const rec = key != null && score != null ? finishRecord(key, score, stars) : null;
  rewards = [...rewards, ...checkAchievements().map((a) => `🏅 নতুন অর্জন: ${a.name}`)];
  (won ? sfx.win : sfx.up)();
  el.innerHTML = `<div class="gm-end ar-end rise">
      <div class="gm-end-emoji">${emoji}</div>
      <h2>${esc(title)}</h2>
      ${stars != null ? `<p class="gm-stars big">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></p>` : ''}
      ${score != null ? `<p class="gm-score">${bn(score)} <small>পয়েন্ট</small></p>` : ''}
      ${rec?.newBest ? `<p class="gm-best">🎉 নতুন রেকর্ড!${rec.gainXp ? ` +${bn(rec.gainXp)} XP` : ''}</p>` : rec?.prev ? `<p class="muted small">আগের সেরা: ${bn(rec.prev)}</p>` : ''}
      ${lines.filter(Boolean).map((l) => `<p class="muted small">${l}</p>`).join('')}
      ${rewards.length ? `<div class="ar-rewards">${rewards.map((r) => `<span class="ar-reward rise">${r}</span>`).join('')}</div>` : ''}
      <div class="row-btns">
        ${retry ? '<button class="btn btn-primary tap" data-ar-retry>🔁 আবার খেলো</button>' : ''}
        ${back ? `<a class="btn tap" href="${back}" data-ar-back>${backLabel}</a>` : ''}
      </div>
      ${wrong.length ? `<details class="gm-review" open><summary>যেগুলো ভুল হয়েছে (${bn(wrong.length)}টি) — সঠিক উত্তর আর ব্যাখ্যা</summary>
        ${wrong.map((q) => `<div class="gm-rv"><p class="gm-rv-q">${esc(q.q)}</p><p class="gm-rv-a">✓ ${esc(q.opts[q.right].t)}</p>${q.exp ? `<p class="gm-rv-e">${esc(q.exp)}</p>` : ''}</div>`).join('')}
        <p class="muted small">ভুলগুলো রিভিশন তালিকায় চলে গেছে — 🤖 রিভিশন বটে আবার আসবে।</p></details>` : ''}
    </div>`;
  el.querySelector('[data-ar-retry]')?.addEventListener('click', retry);
  // a link to the page we are already on would do nothing: re-render it instead
  el.querySelector('[data-ar-back]')?.addEventListener('click', (e) => { if (location.hash === back) { e.preventDefault(); refresh(); } });
  if (won && animOn()) confetti(el);
}

// ---------- running one game at a time ----------
let stopFn = null;
export function mount(fn) { stopFn?.(); stopFn = fn; }
export function unmount() { stopFn?.(); stopFn = null; keyHandler = null; }
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/arena/')) unmount(); });

// ---------- seeded randomness (same question set for every player of a tournament) ----------
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function seededShuffle(list, rnd) {
  const b = [...list];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// ---------- pickers ----------
// Chapters grouped by subject; href(ch) gives each row's link.
export function chapterList(href, extra = () => '') {
  const chs = chapters();
  const groups = [];
  for (const ch of chs) {
    let g = groups.find((x) => x.s === ch.subject);
    if (!g) groups.push(g = { s: ch.subject, list: [] });
    g.list.push(ch);
  }
  let i = 0;
  return groups.map(({ s, list }) => `<section class="block"><div class="block-head"><h2>${esc(s.name)}</h2></div><div class="gm-topics">${list.map((ch) => {
    const m = masteryPct(ch.id);
    return `<a class="gm-topic tap rise" style="--i:${Math.min(i++, 12)}" href="${href(ch)}">
        <span class="gm-topic-no">${chapterNo(ch) != null ? bn(pad2(chapterNo(ch))) : '★'}</span>
        <span class="gm-topic-body"><b>${esc(ch.name)}</b><small>${esc(ch.paper?.name ?? '')} · আয়ত্তে ${bn(m.pct)}% ${extra(ch)}</small>${bar(m.pct, 'bar-thin')}</span>
        <span class="gm-topic-pct">${bn(m.pct)}%</span></a>`;
  }).join('')}</div></section>`).join('') || '<p class="muted">এখনো কোনো অধ্যায়ে খেলার মতো প্রশ্ন নেই।</p>';
}
// Topics of a chapter (+ the whole chapter); href(tpId) gives each row's link.
export function topicList(ch, href, extra = () => '') {
  const tps = topicsOf(ch);
  const rows = tps.map((tp, i) => {
    const m = masteryPct(ch, tp.id);
    return `<a class="gm-topic tap rise" style="--i:${Math.min(i, 12)}" href="${href(tp.id)}">
        <span class="gm-topic-no">${bn(pad2(i + 1))}</span>
        <span class="gm-topic-body"><b>${esc(tp.name)}</b><small>আয়ত্তে ${bn(m.done)}/${bn(m.total)} ${extra(tp.id)}</small>${bar(m.pct, 'bar-thin')}</span>
        <span class="gm-topic-pct">${BADGE[badgeOf(m.pct)] || `${bn(m.pct)}%`}</span></a>`;
  }).join('');
  const all = masteryPct(ch);
  return `<div class="gm-topics">${rows}</div>
    <a class="gm-topic gm-all tap" href="${href('all')}"><span class="gm-topic-no">★</span><span class="gm-topic-body"><b>পুরো অধ্যায়</b><small>সব টপিক মিলিয়ে · আয়ত্তে ${bn(all.pct)}%</small></span><span class="gm-topic-pct">${bn(all.pct)}%</span></a>`;
}
export const scopeName = (ch, tp) => (tp === 'all' ? 'পুরো অধ্যায়' : topicName(ch, tp) ?? '');
export { masteryOf };

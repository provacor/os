// 8. Smart Revision Bot — builds each session in this order: questions answered wrong and not yet
// mastered, then the ones due today (the gap grows 1 → 3 → 7 → 16 → 35 days with every right
// answer and resets after a wrong one), then never-tried ones, then a few mastered ones. Every
// answer shows its explanation. Also shows the queue, the last 14 days and the weakest topics.

import { esc, bn, poolOf, mixedPool, smartPick, rank, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, validSrc, srcChips, scopeName, topicName } from './core.js?v=202610150224';
import { gameState, saveA, S, today, addDays, todayCounters, statOf } from '../learnstore.js?v=202610150224';

export const meta = { id: 'revision', emoji: '🤖', name: 'স্মার্ট রিভিশন বট', desc: 'আগে ভুল, তারপর আজকের পালা, তারপর নতুন — প্রতিটা উত্তরের সাথে ব্যাখ্যা। বিরতি বাড়ে ১ → ৩ → ৭ → ১৬ → ৩৫ দিন।', need: 0 };
const SIZES = [5, 10, 20];
const RANKS = [['⚠️', 'ভুল হয়েছিল, এখনো আয়ত্তে নয়', 'bad'], ['⏰', 'আজ রিভিশনের পালা', 'due'], ['🆕', 'এখনো চেষ্টা হয়নি', 'new'], ['✅', 'আয়ত্তে / পরে আসবে', 'ok']];
const st = () => gameState('revision', { size: 10 });

export function chapterInfo(ch) {
  const d = today();
  const n = poolOf(ch, 'all', validSrc(ch, 'all', 'mcq')).filter((s) => rank(s, d) <= 1).length;
  return n ? `রিভিশনের অপেক্ষায় ${bn(n)}টি` : 'অপেক্ষায় কিছু নেই';
}

export function progress() {
  // of everything tried so far, how much is mastered
  const tried = Object.keys(S.q).filter((id) => S.q[id]?.n);
  return tried.length ? Math.round((tried.filter((id) => (S.m[id] ?? 0) >= 2).length / tried.length) * 100) : 0;
}

export function view({ b: ch, c: tp, d: src }) {
  if (ch && ch !== 'mix' && !chapterById(ch)) return null;
  const mix = !ch || ch === 'mix';
  tp = mix ? 'all' : tp || 'all';
  if (!mix && tp !== 'all' && !topicsOf(ch).some((t) => t.id === tp)) return null;
  src = mix ? (src === 'all' ? 'all' : 'mcq') : validSrc(ch, tp, src);
  const pool = mix ? mixedPool(chapters().map((c) => c.id), src) : poolOf(ch, tp, src);
  const counts = [0, 0, 0, 0];
  const d = today();
  for (const s of pool) counts[rank(s, d)]++;
  const base = mix ? '#/arena/revision/mix/all' : `#/arena/revision/${esc(ch)}/${esc(tp)}`;
  const scopeLine = mix ? 'সব অধ্যায় মিলিয়ে' : `${chapterById(ch).name} · ${scopeName(ch, tp)}`;
  const chips = mix
    ? `<div class="gm-srcs ar-srcs"><a class="gm-src tap ${src === 'mcq' ? 'on' : ''}" href="${base}/mcq">📝 MCQ (না থাকলে অন্য ধরন)</a><a class="gm-src tap ${src === 'all' ? 'on' : ''}" href="${base}/all">🎲 সব ধরন</a></div>`
    : srcChips(base, ch, tp, src);
  const topics = mix ? '' : `<div class="gm-srcs ar-scope"><a class="gm-src tap ${tp === 'all' ? 'on' : ''}" href="#/arena/revision/${esc(ch)}/all/${src}">★ পুরো অধ্যায়</a>${topicsOf(ch).map((t) => `<a class="gm-src tap ${tp === t.id ? 'on' : ''}" href="#/arena/revision/${esc(ch)}/${esc(t.id)}">${esc(t.name)}</a>`).join('')}</div>`;
  return {
    title: meta.name,
    back: mix ? undefined : '#/arena/revision',
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🤖</span><div><p class="eyebrow">রিভিশন সেন্টার</p><h1>স্মার্ট রিভিশন বট</h1>
        <p class="muted small">🤖 “আমি আগে তোমার ভুলগুলো আনব, তারপর আজকের পালা, তারপর নতুন। প্রতিটা উত্তরের পরে ব্যাখ্যা দেখাব।”</p></div></header>
      <p class="ar-scope-line">📍 ${esc(scopeLine)}</p>
      ${topics}${chips}
      <section class="gm ar-game" id="ar"></section>
      ${mix ? `<section class="block"><div class="block-head"><h2>একটা অধ্যায় বেছে রিভিশন</h2></div><div class="gm-srcs ar-scope">${chapters().map((c) => `<a class="gm-src tap" href="#/arena/revision/${esc(c.id)}">${esc(c.name)}</a>`).join('')}</div></section>` : ''}
      ${trends()}
      ${weakTopics()}
      <section class="block"><div class="row-btns"><a class="btn tap" href="#/review">🔁 MCQ রিভিউ তালিকা</a><a class="btn tap" href="#/mistakes">📕 ভুলের খাতা</a></div></section>`,
    after: () => lobby(document.getElementById('ar'), { mix, ch, tp, src, pool, counts }),
  };
}

function lobby(el, o) {
  mount(() => {});
  const paint = () => {
    const size = st().size;
    el.innerHTML = `<div class="ar-lobby rise">
        <div class="ar-queue">${RANKS.map(([e, label, cls], i) => `<span class="ar-qchip ${cls}"><b>${e} ${bn(o.counts[i])}</b><small>${label}</small></span>`).join('')}</div>
        <p class="muted small">সেশনে কতটি প্রশ্ন?</p>
        <div class="gm-srcs ar-sizes">${SIZES.map((n) => `<button class="gm-src tap ${n === size ? 'on' : ''}" data-rv-size="${n}">${bn(n)}টি</button>`).join('')}</div>
        ${o.pool.length ? '<button class="btn btn-primary tap ar-go" data-rv-go>🤖 রিভিশন শুরু</button>' : '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'}
      </div>`;
  };
  el.onclick = (e) => {
    const s = e.target.closest('[data-rv-size]');
    if (s) { st().size = Number(s.dataset.rvSize); saveA(); return paint(); }
    if (e.target.closest('[data-rv-go]')) { el.onclick = null; session(el, o); }
  };
  paint();
}

function session(el, o) {
  const size = SIZES.includes(st().size) ? st().size : 10;
  const qs = smartPick(o.pool, size).map((s) => ask(s, o.mix ? poolOf(s.ch, 'all', validSrc(s.ch, 'all', o.src)) : o.pool));
  let i = 0, right = 0, rec = 0, mast = 0;
  const wrong = [];
  const step = () => {
    if (i >= qs.length) return end();
    const q = qs[i];
    const r = statOf(q.id);
    const why = !r ? '🆕 নতুন প্রশ্ন' : r.w && rank({ id: q.id }) === 0 ? '⚠️ আগে ভুল হয়েছিল' : (r.due ?? today()) <= today() ? '⏰ আজ রিভিশনের পালা' : '✅ ঝালিয়ে নেওয়া';
    el.innerHTML = `<div class="gm-hud"><span>🤖 ${bn(i + 1)}/${bn(qs.length)}</span><span class="gm-prog"><i style="width:${(i / qs.length) * 100}%"></i></span><span>✓ ${bn(right)}</span></div><div id="arq"></div>`;
    const panel = askQuestion(el.querySelector('#arq'), q, {
      label: `${why}${o.mix ? ` · ${esc(chapterById(q.ch)?.name ?? '')}` : ''}`, showExp: 'always',
      onAnswer: (ok, res) => { if (ok) right++; else wrong.push(q); if (res.recovered) rec++; if (res.nowMastered) mast++; },
      onNext: () => { panel.destroy(); i++; step(); },
    });
  };
  const end = () => {
    const t = todayCounters();
    t.rev += 1;
    saveA();
    const tomorrow = addDays(today(), 1);
    const dueSoon = Object.values(S.q).filter((r) => r?.due && r.due <= tomorrow).length;
    resultScreen(el, {
      emoji: '🤖', title: right === qs.length ? 'দারুণ! সব সঠিক' : 'রিভিশন শেষ', score: right * 10,
      key: `revision/${o.mix ? 'mix' : `${o.ch}/${o.tp}`}`, won: right === qs.length, wrong,
      lines: [`${bn(qs.length)}টির মধ্যে ${bn(right)}টি সঠিক`, rec ? `🩹 ${bn(rec)}টি আগের ভুল এবার সঠিক` : '', mast ? `🎓 ${bn(mast)}টি নতুন করে আয়ত্তে` : '', `⏰ আজ-কালের মধ্যে রিভিশনের পালা: ${bn(dueSoon)}টি`],
      retry: () => session(el, o), back: o.mix ? '#/arena/revision' : `#/arena/revision/${o.ch}/${o.tp}/${o.src}`, backLabel: '🤖 রিভিশন সেন্টার',
    });
  };
  mount(() => {});
  step();
}

function trends() {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const rows = days.map((d) => ({ d, n: S.h[d]?.n ?? 0, c: S.h[d]?.c ?? 0, m: S.h[d]?.m ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0), right = rows.reduce((s, r) => s + r.c, 0), mast = rows.reduce((s, r) => s + r.m, 0);
  if (!total) return '<section class="block"><div class="block-head"><h2>📈 গত ১৪ দিন</h2></div><p class="muted small">এখনো কোনো উত্তর নেই — খেলা শুরু করলে এখানে দিনভিত্তিক হিসাব দেখা যাবে।</p></section>';
  return `<section class="block"><div class="block-head"><h2>📈 গত ১৪ দিন</h2></div>
    <p class="muted small">${bn(total)}টি উত্তর · নির্ভুলতা ${bn(Math.round((right / total) * 100))}% · ${bn(mast)}টি নতুন আয়ত্তে</p>
    <div class="ar-chart" role="img" aria-label="গত ১৪ দিনের উত্তর আর নির্ভুলতা">${rows.map((r) => `<span class="ar-col" title="${r.d}: ${bn(r.n)}টি উত্তর, ${bn(r.c)}টি সঠিক"><i class="all" style="height:${(r.n / max) * 100}%"><i class="ok" style="height:${r.n ? (r.c / r.n) * 100 : 0}%"></i></i><small>${bn(Number(r.d.slice(8)))}</small></span>`).join('')}</div>
    <p class="muted small ar-legend"><i class="ok"></i> সঠিক <i class="all"></i> মোট</p></section>`;
}

function weakTopics() {
  const by = new Map();
  for (const r of Object.values(S.q)) {
    if (!r?.ch || !r.tp || !r.n) continue;
    const key = `${r.ch}/${r.tp}`;
    const x = by.get(key) ?? { ch: r.ch, tp: r.tp, n: 0, c: 0 };
    x.n += r.n; x.c += r.c ?? 0;
    by.set(key, x);
  }
  const list = [...by.values()].filter((x) => x.n >= 3 && chapterById(x.ch) && topicName(x.ch, x.tp)).sort((a, b) => a.c / a.n - b.c / b.n).slice(0, 5);
  if (!list.length) return '';
  return `<section class="block"><div class="block-head"><h2>🎯 দুর্বল টপিক</h2></div><div class="gm-topics">${list.map((x) => {
    const pct = Math.round((x.c / x.n) * 100);
    return `<a class="gm-topic tap" href="#/arena/revision/${esc(x.ch)}/${esc(x.tp)}"><span class="gm-topic-no">${pct < 50 ? '⚠️' : '📉'}</span>
      <span class="gm-topic-body"><b>${esc(topicName(x.ch, x.tp))}</b><small>${esc(chapterById(x.ch).name)} · ${bn(x.n)}টি উত্তরে ${bn(pct)}% সঠিক</small></span><span class="gm-topic-pct">${bn(pct)}%</span></a>`;
  }).join('')}</div></section>`;
}


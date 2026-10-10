// Practice tools: hub, timed exam, weak topics, spaced-repetition review, flashcards,
// saved items (bookmarks + notes) and AI marking of creative questions.

import { icon } from '../icons.js?v=202610101347';
import { esc, ring, bar, emptyState, chapterEyebrow } from '../components.js?v=202610101347';
import { itemCard } from './section.js?v=202610101347';
import { tocOf } from './topic.js?v=202610101347';
import {
  itemRef, isMcq, rightIndex, attemptOf, everWrong, srsDue, srsNext, srsCount, examHistory,
  bookmarks, notedItems, noteOf, goalState, offlineAll,
} from '../learn.js?v=202610101347';
import { hasKey } from '../ai.js?v=202610101347';

export const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const LET = 'কখগঘ';
const fmtTime = (s) => `${bn(Math.floor(s / 60))}:${bn(String(Math.max(0, s % 60)).padStart(2, '0'))}`;
const dateBn = (t) => bn(new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

// ---------- shared lookups ----------
export function mcqChapters(model) {
  return model.chapters.filter((c) => c.sections.some((s) => s.type === 'mcq' && s.items.length));
}
const mcqIdsOf = (ch) => ch.sections.filter((s) => s.type === 'mcq').flatMap((s) => s.items.map((it) => it.id));
export function poolFor(model, chapterId, topicId) {
  const ch = model.byId.get(chapterId);
  if (!ch) return [];
  const all = mcqIdsOf(ch);
  if (!topicId) return all;
  const tp = tocOf(chapterId)?.topics.find((t) => t.id === topicId);
  const set = new Set(tp?.items ?? []);
  return all.filter((id) => set.has(id));
}

// Weak / strong topics from MCQ attempts (needs a few attempts to judge).
export function topicStats(model) {
  const out = [];
  for (const ch of mcqChapters(model)) {
    const t = tocOf(ch.id);
    if (!t) continue;
    for (const tp of t.topics) {
      let n = 0, w = 0, seen = 0;
      const ids = tp.items.filter((id) => id.includes('_mcq_'));
      for (const id of ids) {
        const a = attemptOf(id);
        if (!a) continue;
        seen++;
        n += a.n;
        w += a.w;
      }
      if (n) out.push({ ch, tp, n, w, seen, total: ids.length, acc: Math.round(((n - w) / n) * 100) });
    }
  }
  return out;
}
export const weakTopics = (model) => topicStats(model).filter((s) => s.n >= 5 && s.acc < 60).sort((a, b) => a.acc - b.acc);

// ---------- hub ----------
export function practiceView(model) {
  const due = srsDue().length;
  const g = goalState();
  const weak = weakTopics(model);
  const tiles = [
    ['#/exam', 'mcq', 'পরীক্ষা দাও', 'বোর্ডের মতো MCQ, টাইমারসহ', 'violet'],
    ['#/review', 'revision', `আজকের রিভিশন${due ? ` · ${bn(due)}` : ''}`, 'যা ভুলে যাওয়ার সময় হয়েছে', 'teal'],
    ['#/cards', 'concept', 'ফ্ল্যাশকার্ড', 'Formula, Reaction, Concept, ক/খ', 'amber'],
    ['#/insights', 'chart', 'দুর্বল টপিক', weak.length ? `${bn(weak.length)}টি টপিকে বেশি ভুল` : 'পরীক্ষা দিলে বের হবে', 'rose'],
    ['#/saved', 'check', 'সেভ করা', '⭐ বুকমার্ক ও 📝 নিজের নোট', 'blue'],
    ['#/ai', 'sparkle', 'CQ-তে AI নম্বর', 'CQ কার্ডের "✍️ উত্তর লিখে নম্বর নাও"', 'green'],
  ];
  const off = Object.entries(offlineAll()).map(([id, o]) => [model.byId.get(id), o]).filter(([c]) => c);
  return {
    nav: 'home', title: 'অনুশীলন', back: '#/',
    html: `<header class="page-title rise"><p class="eyebrow">Practice</p><h1>অনুশীলন</h1>
        <p class="muted">পরীক্ষা, রিভিশন আর লক্ষ্য — সব এক জায়গায়।</p></header>
      ${goalCard(g)}
      <div class="tools px-tools">${tiles.map(([h, ic, t, d, hue], i) => `<a class="tool hue-${hue} rise" style="--i:${i}" href="${h}"><span class="tool-ic">${icon(ic)}</span><b>${t}</b><small>${d}</small></a>`).join('')}</div>
      <section class="card rise px-goal-set"><h2 class="card-title">${icon('bell')} রোজকার লক্ষ্য ও রিমাইন্ডার</h2>
        <label class="pf-label">দিনে কয়টা MCQ <b>${bn(g.mcq)}</b></label>
        <div class="seg seg-5">${[10, 20, 30, 50, 100].map((v) => `<button class="seg-btn ${g.mcq === v ? 'on' : ''}" data-goal-mcq="${v}">${bn(v)}</button>`).join('')}</div>
        <label class="pf-label" for="goalTime">রিমাইন্ডারের সময়</label>
        <input id="goalTime" class="px-time" type="time" value="${esc(g.time)}" data-goal-time>
        <label class="a11y-row"><span><b>অ্যাপ খোলা থাকলে নোটিফিকেশন</b><small class="muted">সময় হলে লক্ষ্য পূরণ না হলে মনে করিয়ে দেবে</small></span><input type="checkbox" class="switch" data-goal-remind ${g.remind ? 'checked' : ''}></label>
        <button class="btn tap" data-goal-ics>${icon('clock')}<span>ফোনের ক্যালেন্ডারে রোজ রিমাইন্ডার যোগ করো</span></button>
        <p class="muted small">অ্যাপ বন্ধ থাকলেও মনে করাতে চাইলে ক্যালেন্ডারের রিমাইন্ডারটা যোগ করো — ফাইলটা খুললে ফোনের ক্যালেন্ডার রোজ ওই সময়ে বাজবে।</p>
      </section>
      <section class="card rise"><h2 class="card-title">${icon('file')} অফলাইনে রাখা অধ্যায়</h2>
        ${off.length ? off.map(([c, o]) => `<a class="tp-link tap" href="#/c/${esc(c.id)}">${icon('check')}<span>${esc(c.name)} <small class="muted">· ${bn((o.bytes / 1048576).toFixed(1))} MB · ${dateBn(o.at)}</small></span>${icon('chevron', 'cc-chev')}</a>`).join('')
          : '<p class="muted small">কোনো অধ্যায় অফলাইনে রাখা নেই। অধ্যায়ের পেজে "অফলাইনে রাখো" চাপো।</p>'}
      </section>
      <section class="card rise"><h2 class="card-title">${icon('key')} অন্য ফোনে প্রগ্রেস</h2>
        <p class="muted small">সব প্রগ্রেস, রিভিশন, বুকমার্ক আর পরীক্ষার ফল ব্যাকআপ ফাইলে যায়। নতুন ফোনে সেই ফাইল রিস্টোর করলেই সব চলে আসবে।</p>
        <a class="btn tap" href="#/backup">${icon('key')}<span>ব্যাকআপ ও রিস্টোর</span></a></section>`,
  };
}

export function goalCard(g = goalState()) {
  const pct = Math.min(100, Math.round((g.count / Math.max(1, g.mcq)) * 100));
  return `<a class="card px-goal rise tap" href="#/practice">
      ${ring(pct, { size: 52, stroke: 5 })}
      <span><b>আজকের লক্ষ্য: ${bn(g.count)}/${bn(g.mcq)} MCQ</b><small class="muted">${pct >= 100 ? 'লক্ষ্য পূরণ! 🎉' : `আরও ${bn(g.mcq - g.count)}টা বাকি`}</small></span>${icon('chevron', 'cc-chev')}
    </a>`;
}

// ---------- exam ----------
export const exam = { setup: { chapterId: '', topicId: '', count: 25, minutes: 25, mode: 'all' }, run: null, result: null };
const MODES = [['all', 'সব প্রশ্ন'], ['unseen', 'আগে দেখিনি'], ['wrong', 'আগে ভুল হয়েছিল']];

export function filterPool(ids, mode) {
  if (mode === 'unseen') return ids.filter((id) => !attemptOf(id));
  if (mode === 'wrong') return ids.filter((id) => everWrong(id));
  return ids;
}

export function examView(model, sub) {
  if (sub === 'run' && exam.run) return examRunView();
  if (sub === 'result' && exam.result) return examResultView(model);
  const s = exam.setup;
  const chs = mcqChapters(model);
  if (!s.chapterId || !model.byId.get(s.chapterId)) s.chapterId = chs[0]?.id ?? '';
  const topics = tocOf(s.chapterId)?.topics ?? [];
  if (s.topicId && !topics.some((t) => t.id === s.topicId)) s.topicId = '';
  const pool = filterPool(poolFor(model, s.chapterId, s.topicId), s.mode);
  const hist = examHistory().slice(0, 10);
  return {
    nav: 'home', title: 'পরীক্ষা', back: '#/practice',
    html: `<header class="page-title rise"><p class="eyebrow">Exam</p><h1>MCQ পরীক্ষা</h1>
        <p class="muted">বোর্ডের মতো: ২৫টি প্রশ্ন, ২৫ মিনিট। শেষে স্কোর আর ভুলগুলোর ব্যাখ্যা।</p></header>
      <section class="card rise px-form">
        <label class="pf-label" for="exCh">অধ্যায়</label>
        <select id="exCh" class="px-select" data-ex-set="chapterId">${chs.map((c) => `<option value="${esc(c.id)}" ${c.id === s.chapterId ? 'selected' : ''}>${esc(c.subject.name)} · ${esc(c.name)}</option>`).join('')}</select>
        <label class="pf-label" for="exTp">টপিক</label>
        <select id="exTp" class="px-select" data-ex-set="topicId"><option value="">পুরো অধ্যায়</option>${topics.map((t, i) => `<option value="${esc(t.id)}" ${t.id === s.topicId ? 'selected' : ''}>${bn(i + 1)}. ${esc(t.name)}</option>`).join('')}</select>
        <label class="pf-label">কোন প্রশ্ন</label>
        <div class="seg seg-3">${MODES.map(([v, l]) => `<button class="seg-btn ${s.mode === v ? 'on' : ''}" data-ex-mode="${v}">${l}</button>`).join('')}</div>
        <label class="pf-label">প্রশ্ন সংখ্যা ও সময়</label>
        <div class="seg seg-4">${[[10, 10], [25, 25], [50, 50], [100, 100]].map(([n, m]) => `<button class="seg-btn ${s.count === n ? 'on' : ''}" data-ex-count="${n}" data-ex-min="${m}">${bn(n)}টি · ${bn(m)} মি.</button>`).join('')}</div>
        <p class="muted small">এই বাছাইয়ে ${bn(pool.length)}টি প্রশ্ন আছে${pool.length < s.count ? ` — সবগুলো (${bn(pool.length)}টি) আসবে` : ''}।</p>
        <button class="btn btn-primary tap" data-ex-start ${pool.length ? '' : 'disabled'}>${icon('play')}<span>পরীক্ষা শুরু করো</span></button>
      </section>
      ${hist.length ? `<section class="block"><div class="block-head"><h2>আগের পরীক্ষা</h2></div><div class="list-card">${hist.map((h) => `<div class="lib-row"><span class="lib-body"><span class="lib-title">${esc(h.label)}</span><span class="lib-meta">${dateBn(h.at)} · ${bn(h.right)}/${bn(h.total)} সঠিক · ${fmtTime(h.secs)}</span></span><span class="lib-pct">${bn(Math.round((h.right / h.total) * 100))}%</span></div>`).join('')}</div></section>` : ''}`,
  };
}

function examRunView() {
  const r = exam.run;
  const answered = Object.keys(r.ans).length;
  const qs = r.ids.map((id, i) => {
    const { it } = itemRef(id);
    return `<article class="item-card mcq px-q" id="exq${i}">
        <p class="mcq-q"><span class="mcq-n">${bn(i + 1)}.</span> ${esc(it.question)}</p>
        <div class="opts">${it.options.map((o, k) => `<button class="opt ${r.ans[i] === k ? 'picked' : ''}" data-ex-q="${i}" data-k="${k}"><span class="opt-key">${LET[k] ?? k + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>
      </article>`;
  }).join('');
  return {
    nav: 'home', title: 'পরীক্ষা চলছে', back: '#/exam', focus: true,
    html: `<div class="px-bar"><span class="px-clock" id="exClock">${fmtTime(Math.max(0, Math.round((r.end - Date.now()) / 1000)))}</span>
        <span class="muted small" id="exCount">${bn(answered)}/${bn(r.ids.length)} উত্তর</span>
        <button class="btn btn-primary tap" data-ex-submit>জমা দাও</button></div>
      <p class="muted small px-label">${esc(r.label)}</p>
      <div class="items">${qs}</div>
      <button class="btn btn-primary tap px-submit-end" data-ex-submit>${icon('check')}<span>পরীক্ষা জমা দাও</span></button>`,
  };
}

function examResultView() {
  const x = exam.result;
  const pct = Math.round((x.right / x.total) * 100);
  const wrongCards = x.items.filter((q) => q.chosen !== q.right).map((q, n) => {
    const { it } = itemRef(q.id);
    return `<article class="item-card mcq answered ${q.chosen == null ? '' : 'wrong'}">
        <p class="mcq-q"><span class="mcq-n">${bn(q.n)}.</span> ${esc(it.question)}</p>
        <div class="opts">${it.options.map((o, k) => `<div class="opt ${k === q.right ? 'right' : k === q.chosen ? 'wrong' : ''}"><span class="opt-key">${LET[k]}</span><span>${esc(o)}</span></div>`).join('')}</div>
        ${it.explanation ? `<p class="mcq-exp">${esc(it.explanation)}</p>` : ''}
        <p class="muted small">${q.chosen == null ? 'উত্তর দাওনি' : `তোমার উত্তর: ${LET[q.chosen]}`}</p>
      </article>`;
  }).join('');
  return {
    nav: 'home', title: 'ফলাফল', back: '#/exam',
    html: `<header class="tp-hero rise"><div><p class="eyebrow">ফলাফল</p><h1>${bn(x.right)}/${bn(x.total)} সঠিক</h1>
        <p class="muted small">${esc(x.label)} · সময় ${fmtTime(x.secs)}</p></div>${ring(pct, { size: 76, stroke: 6 })}</header>
      <div class="px-score">
        <div><b>${bn(x.right)}</b><small>সঠিক</small></div><div><b>${bn(x.wrong)}</b><small>ভুল</small></div><div><b>${bn(x.skipped)}</b><small>উত্তর দাওনি</small></div>
      </div>
      <p class="muted small">ভুলগুলো "ভুলের খাতা" আর "আজকের রিভিশন"-এ জমা হয়েছে।</p>
      <div class="row-btns">${x.wrong + x.skipped ? '<button class="btn btn-primary tap" data-ex-retry>ভুলগুলো আবার পরীক্ষা দাও</button>' : ''}<a class="btn tap" href="#/exam">নতুন পরীক্ষা</a><a class="btn tap" href="#/insights">দুর্বল টপিক দেখো</a></div>
      ${wrongCards ? `<section class="block"><div class="block-head"><h2>ভুল ও বাদ পড়া প্রশ্ন</h2></div><div class="items">${wrongCards}</div></section>` : `<p class="tp-done">${icon('check')}<span>সব সঠিক! দারুণ।</span></p>`}`,
  };
}

// ---------- weak topics ----------
export function insightsView(model) {
  const all = topicStats(model).filter((s) => s.n >= 5).sort((a, b) => a.acc - b.acc);
  const row = (s, i) => `<div class="card px-topic rise" style="--i:${Math.min(i, 10)}">
      <div class="px-topic-head"><span><b>${esc(s.tp.name)}</b><small class="muted">${esc(s.ch.subject.name)} · ${esc(s.ch.name)}</small></span><span class="px-acc ${s.acc < 60 ? 'bad' : s.acc < 80 ? 'mid' : 'good'}">${bn(s.acc)}%</span></div>
      ${bar(s.acc, 'bar-thin')}
      <p class="muted small">${bn(s.n)} বার চেষ্টা · ${bn(s.w)} ভুল · ${bn(s.seen)}/${bn(s.total)}টি প্রশ্ন দেখেছ</p>
      <div class="row-btns"><button class="btn tap" data-ex-quick="${esc(s.ch.id)}/${esc(s.tp.id)}">${icon('mcq')}<span>এই টপিকে পরীক্ষা</span></button>
        <a class="btn tap" href="#/t/${esc(s.ch.id)}/${esc(s.tp.id)}">${icon('notes')}<span>টপিক পড়ো</span></a>
        ${s.acc < 60 ? `<button class="btn tap" data-mission-add="${esc(`দুর্বল টপিক পড়ো: ${s.tp.name} (${s.ch.name})`)}">${icon('target')}<span>আজকের মিশনে যোগ</span></button>` : ''}</div>
    </div>`;
  return {
    nav: 'home', title: 'দুর্বল টপিক', back: '#/practice',
    html: `<header class="page-title rise"><p class="eyebrow">Insights</p><h1>কোন টপিকে দুর্বল</h1>
        <p class="muted">প্রতিটা টপিকের MCQ-তে কত শতাংশ সঠিক হচ্ছে। ৬০%-এর নিচে মানে দুর্বল — আগে সেগুলো পড়ো।</p></header>
      ${all.length ? all.map(row).join('') : emptyState({ iconName: 'chart', title: 'এখনো যথেষ্ট তথ্য নেই', text: 'কয়েকটা MCQ পরীক্ষা দিলে বা সেকশনে MCQ-র উত্তর দিলে (প্রতি টপিকে অন্তত ৫ বার) এখানে দুর্বল টপিক দেখাবে।', extra: '<a class="btn btn-primary" href="#/exam">পরীক্ষা দাও</a>' })}`,
  };
}

// ---------- spaced-repetition review ----------
export function reviewView() {
  const ids = srsDue().slice(0, 30);
  const next = srsNext();
  const cards = ids.map((id, n) => {
    const { it, sec } = itemRef(id);
    return `<div class="rv-wrap" data-rv-wrap="${esc(id)}"><p class="muted small rv-from">${esc(sec.chapter.name)} · ${esc(sec.label)}</p>${itemCard(it, sec, n)}
        <div class="rv-btns"><button class="btn tap rv-no" data-rv="${esc(id)}" data-ok="0">✗ ভুলে গেছি</button><button class="btn btn-primary tap" data-rv="${esc(id)}" data-ok="1">✓ মনে ছিল</button></div></div>`;
  }).join('');
  return {
    nav: 'home', title: 'আজকের রিভিশন', back: '#/practice',
    html: `<header class="page-title rise"><p class="eyebrow">Spaced repetition</p><h1>আজকের রিভিশন</h1>
        <p class="muted">ভুল করা MCQ আর Done করা পড়া ১, ৩, ৭, ১৬ আর ৩৫ দিন পর আবার আসে — মনে থাকলে বিরতি বাড়ে, ভুলে গেলে কাল আবার।</p>
        <p class="small"><b id="rvLeft">${bn(srsDue().length)}</b>টি বাকি · মোট ${bn(srsCount())}টি রিভিশনে আছে</p></header>
      ${ids.length ? `<div class="rv-list">${cards}</div>` : emptyState({ iconName: 'revision', title: 'আজকের রিভিশন শেষ 🎉', text: next ? `পরের রিভিশন ${dateBn(next)} তারিখে।` : 'MCQ-র ভুল আর "Mark as done" করা পড়া এখানে নিজে থেকে জমা হবে।' })}`,
  };
}

// ---------- flashcards ----------
const CARD_TYPES = new Set(['formula', 'reaction', 'concept', 'identification', 'conversion', 'mechanism', 'ka', 'kha', 'definition', 'derivation']);
export function cardOf(it, sec) {
  if (!CARD_TYPES.has(sec.type)) return null;
  if (it.question && it.answer) return { front: it.question, back: it.answer };
  if (sec.type === 'reaction' && it.formulas?.[0]) {
    const eq = it.formulas[0];
    const cut = eq.lastIndexOf('→');
    return cut > 0 ? { front: `${it.title ? `${it.title}\n` : ''}${eq.slice(0, cut)}→ ?`, back: `${eq}${it.note ? `\n\n${it.note}` : ''}` } : null;
  }
  if (it.formulas) return { front: it.title, back: `${it.formulas.join('\n')}${it.note ? `\n\n${it.note}` : ''}` };
  if (it.steps) return { front: it.title, back: `${it.steps.join('\n')}\n→ ${it.result ?? ''}` };
  if (it.title && it.body) return { front: `${it.topic ? `${it.topic}\n` : ''}${it.title}`, back: it.body };
  return null;
}
export const deck = { key: '', ids: [], i: 0, flipped: false, known: 0, unknown: 0 };
export function deckIds(model, chapterId, topicId) {
  const ch = model.byId.get(chapterId);
  if (!ch) return [];
  const set = topicId ? new Set(tocOf(chapterId)?.topics.find((t) => t.id === topicId)?.items ?? []) : null;
  return ch.sections.flatMap((s) => s.items.filter((it) => (!set || set.has(it.id)) && cardOf(it, s)).map((it) => it.id));
}
export function cardsView(model, chapterId, topicId) {
  if (!chapterId) {
    const chs = model.chapters.filter((c) => deckIds(model, c.id).length);
    return {
      nav: 'home', title: 'ফ্ল্যাশকার্ড', back: '#/practice',
      html: `<header class="page-title rise"><p class="eyebrow">Flashcards</p><h1>ফ্ল্যাশকার্ড</h1><p class="muted">অধ্যায় বেছে নাও। কার্ডে চাপ দিলে উল্টে উত্তর দেখাবে।</p></header>
        <div class="list-card">${chs.map((c, i) => `<a class="lib-row rise" style="--i:${i}" href="#/cards/${esc(c.id)}"><span class="lib-body"><span class="lib-title">${esc(c.name)}</span><span class="lib-meta">${esc(c.subject.name)} · ${esc(chapterEyebrow(c))} · ${bn(deckIds(model, c.id).length)}টি কার্ড</span></span>${icon('chevron')}</a>`).join('') || '<p class="muted small">এখনো কোনো কার্ড নেই।</p>'}</div>`,
    };
  }
  const key = `${chapterId}/${topicId ?? ''}`;
  if (deck.key !== key) {
    const ids = deckIds(model, chapterId, topicId);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    Object.assign(deck, { key, ids, i: 0, flipped: false, known: 0, unknown: 0 });
  }
  const ch = model.byId.get(chapterId);
  const tp = topicId ? tocOf(chapterId)?.topics.find((t) => t.id === topicId) : null;
  const done = deck.i >= deck.ids.length;
  let body;
  if (!deck.ids.length) body = emptyState({ iconName: 'concept', title: 'এখানে কোনো কার্ড নেই', text: 'Formula, Reaction, Concept বা ক/খ যোগ হলে কার্ড তৈরি হবে।' });
  else if (done) body = `<div class="card fc-done rise"><h2>সব কার্ড দেখা শেষ!</h2><p>${bn(deck.known)}টি জানো · ${bn(deck.unknown)}টি জানো না (রিভিশনে জমা হয়েছে)</p><button class="btn btn-primary tap" data-fc="restart">আবার শুরু করো</button></div>`;
  else {
    const { it, sec } = itemRef(deck.ids[deck.i]);
    const c = cardOf(it, sec);
    body = `<p class="muted small fc-meta">${bn(deck.i + 1)}/${bn(deck.ids.length)} · ${esc(sec.label)} · ✓ ${bn(deck.known)} · ✗ ${bn(deck.unknown)}</p>
      <button class="fc-card ${deck.flipped ? 'flipped' : ''}" data-fc="flip" id="fcCard" aria-label="কার্ড উল্টাও">
        <span class="fc-face fc-front"><small>প্রশ্ন</small><span class="pre">${esc(c.front)}</span></span>
        <span class="fc-face fc-back"><small>উত্তর</small><span class="pre">${esc(c.back)}</span></span>
      </button>
      <p class="muted small fc-hint">চাপ দিলে উল্টাবে · ডানে সোয়াইপ = জানি, বামে = জানি না</p>
      <div class="rv-btns"><button class="btn tap rv-no" data-fc="no">✗ জানি না</button><button class="btn btn-primary tap" data-fc="yes">✓ জানি</button></div>`;
  }
  return {
    nav: 'home', title: 'ফ্ল্যাশকার্ড', back: tp ? `#/t/${ch.id}/${tp.id}` : `#/c/${ch.id}`,
    html: `<header class="page-title rise"><p class="eyebrow">${esc(ch.name)}</p><h1>${esc(tp?.name ?? 'ফ্ল্যাশকার্ড')}</h1></header>${body}`,
  };
}

// ---------- saved ----------
export const savedState = { tab: 'bm' };
export function savedView() {
  const ids = (savedState.tab === 'bm' ? bookmarks() : notedItems()).filter((id) => itemRef(id));
  const cards = ids.map((id, n) => {
    const { it, sec } = itemRef(id);
    return `<p class="muted small rv-from"><a href="#/x/${esc(sec.id)}">${esc(sec.chapter.name)} · ${esc(sec.label)}</a></p>${itemCard(it, sec, n)}`;
  }).join('');
  return {
    nav: 'home', title: 'সেভ করা', back: '#/practice',
    html: `<header class="page-title rise"><p class="eyebrow">Saved</p><h1>সেভ করা</h1></header>
      <div class="seg seg-2"><button class="seg-btn ${savedState.tab === 'bm' ? 'on' : ''}" data-saved-tab="bm">⭐ বুকমার্ক (${bn(bookmarks().length)})</button><button class="seg-btn ${savedState.tab === 'notes' ? 'on' : ''}" data-saved-tab="notes">📝 নিজের নোট (${bn(notedItems().length)})</button></div>
      ${ids.length ? `<div class="items">${cards}</div>` : emptyState({ iconName: 'check', title: 'কিছু সেভ করা নেই', text: 'যেকোনো প্রশ্ন বা কার্ডের নিচে ⭐ চাপলে বুকমার্ক হবে, 📝 চাপলে নিজের নোট লিখতে পারবে।' })}`,
  };
}

// ---------- AI marking of a creative question ----------
export const MAX_MARKS = { ক: 1, খ: 2, গ: 3, ঘ: 4 };
export const grading = new Map(); // itemId → { answers, images, busy, result, error }
export function gradeView(model, itemId) {
  const ref = itemRef(itemId);
  if (!ref || !ref.it.parts) return null;
  const { it, sec } = ref;
  const g = grading.get(itemId) ?? { answers: {}, images: [] };
  grading.set(itemId, g);
  const res = g.result;
  const total = it.parts.reduce((n, p) => n + (MAX_MARKS[p.label] ?? 0), 0);
  return {
    nav: 'home', title: 'AI দিয়ে নম্বর', back: `#/x/${sec.id}`,
    html: `<header class="page-title rise"><p class="eyebrow">${esc(sec.chapter.name)} · ${esc(it.title ?? '')}</p><h1>উত্তর লেখো, AI নম্বর দেবে</h1>
        <p class="muted small">বোর্ডের নিয়মে (ক ১, খ ২, গ ৩, ঘ ৪) নম্বর ও কোথায় কাটল জানাবে। লিখে দাও বা খাতার ছবি দাও।</p></header>
      ${hasKey() ? '' : `<p class="card warn-note">${icon('warn')} আগে <a href="#/ai">AI শিক্ষক</a> পেজে API key বসাও।</p>`}
      ${it.stem ? `<div class="card cq-stem pre">${esc(it.stem)}</div>` : ''}
      <div class="gr-parts">${it.parts.map((p) => `<label class="gr-part"><span><b>${esc(p.label)})</b> ${esc(p.q)} <small class="muted">(${bn(MAX_MARKS[p.label] ?? '-')} নম্বর)</small></span>
          <textarea rows="${(MAX_MARKS[p.label] ?? 2) + 1}" data-gr-ans="${esc(p.label)}" placeholder="তোমার উত্তর…">${esc(g.answers[p.label] ?? '')}</textarea></label>`).join('')}</div>
      <label class="btn tap gr-photo">${icon('camera')}<span>খাতার ছবি দাও (${bn(g.images.length)}/৪)</span><input type="file" accept="image/*" multiple hidden data-gr-photo="${esc(itemId)}"></label>
      ${g.images.length ? `<div class="gr-thumbs">${g.images.map((src) => `<img src="${src}" alt="">`).join('')}</div>` : ''}
      <button class="btn btn-primary tap" data-gr-go="${esc(itemId)}" ${g.busy ? 'disabled' : ''}>${icon('sparkle')}<span>${g.busy ? 'নম্বর দেওয়া হচ্ছে…' : 'নম্বর দাও'}</span></button>
      ${g.error ? `<p class="card warn-note">${icon('warn')} ${esc(g.error)}</p>` : ''}
      ${res ? `<section class="card gr-result rise"><h2>মোট: ${bn(res.total)}/${bn(total)}</h2>
          ${res.parts.map((p) => `<div class="gr-row"><b>${esc(p.label)}) ${bn(p.marks)}/${bn(MAX_MARKS[p.label] ?? p.max)}</b><p>${esc(p.feedback)}</p></div>`).join('')}
          ${res.tips ? `<p class="muted small">${esc(res.tips)}</p>` : ''}</section>` : ''}
      <details class="ans"><summary>বইয়ের উত্তর দেখো</summary><div class="pre">${esc(it.parts.filter((p) => p.a).map((p) => `${p.label}) ${p.a}`).join('\n\n') || 'এই প্রশ্নের উত্তর দেওয়া নেই।')}</div></details>`,
  };
}

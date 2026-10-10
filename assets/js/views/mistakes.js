// My Mistake Book page.

import { icon } from '../icons.js?v=202610100121';
import { esc } from '../components.js?v=202610100121';
import { mistakes, KINDS, kindOf } from '../mistakes.js?v=202610100121';
import { hasKey } from '../ai.js?v=202610100121';

export const mistakeState = { filter: 'open', kind: 'all', retry: null };
const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const KEYS = 'কখগঘঙ';

function card(model, m) {
  const ch = m.chapterId ? model.byId.get(m.chapterId) : null;
  const k = kindOf(m.kind);
  const answers = m.source === 'mcq'
    ? `<p class="mk-ans bad">${icon('x')} তোমার উত্তর: ${esc(m.options?.[m.chosen] ?? '')}</p>
       ${mistakeState.retry === m.id ? '' : `<p class="mk-ans good">${icon('check')} সঠিক: ${esc(m.correct)}</p>`}`
    : `${m.myAnswer ? `<p class="mk-ans bad">${icon('x')} তোমার উত্তর: ${esc(m.myAnswer)}</p>` : ''}
       ${m.rightAnswer ? `<p class="mk-ans good">${icon('check')} সঠিক: ${esc(m.rightAnswer)}</p>` : ''}`;
  const retry = mistakeState.retry === m.id && m.options?.length
    ? `<div class="opts mk-retry">${m.options.map((o, i) => `<button class="opt" data-mk-answer="${i}" data-mk="${esc(m.id)}"><span class="opt-key">${KEYS[i] ?? i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`
    : '';
  const kindSel = `<select class="mk-kind-sel" data-mk-kind="${esc(m.id)}" aria-label="ভুলের ধরন">
      <option value="">ধরন বেছে নাও…</option>
      ${KINDS.map(([id, bnName]) => `<option value="${id}" ${m.kind === id ? 'selected' : ''}>${bnName}</option>`).join('')}
    </select>`;
  return `<li class="mk ${m.resolved ? 'fixed' : ''} ${k ? `hue-${k[3]}` : ''}">
      <div class="mk-top">
        ${k ? `<span class="mk-badge">${k[1]} <small>${k[2]}</small></span>` : '<span class="mk-badge none">ধরন ঠিক হয়নি</span>'}
        ${m.times > 1 ? `<span class="mk-times">${bn(m.times)} বার</span>` : ''}
        ${m.resolved ? `<span class="ok-tag">ঠিক হয়েছে</span>` : ''}
      </div>
      <p class="mk-q">${esc(m.question)}</p>
      ${answers}
      ${retry}
      ${m.explanation && mistakeState.retry !== m.id ? `<p class="mk-exp">${esc(m.explanation)}</p>` : ''}
      ${m.reason ? `<p class="mk-reason">${icon('sparkle')} ${esc(m.reason)}</p>` : ''}
      <p class="mk-meta">${ch ? `<a href="#/c/${esc(ch.id)}">${esc(ch.subject.name)} · ${esc(ch.name)}</a>` : 'অধ্যায় দেওয়া নেই'} · ${new Date(m.at).toLocaleDateString('bn-BD')}</p>
      <div class="mk-actions">
        ${kindSel}
        <button class="chip" data-mk-ai="${esc(m.id)}" ${hasKey() ? '' : 'title="AI সেটিংসে key দাও"'}>${icon('sparkle')} AI দিয়ে ধরন</button>
        ${m.source === 'mcq' && !m.resolved ? `<button class="chip" data-mk-retry="${esc(m.id)}">${icon('revision')} আবার চেষ্টা</button>` : ''}
        <button class="chip" data-mk-fix="${esc(m.id)}">${icon('check')} ${m.resolved ? 'আবার খোলো' : 'ঠিক হয়েছে'}</button>
        <button class="task-del" data-mk-del="${esc(m.id)}" aria-label="মুছো">${icon('trash')}</button>
      </div>
    </li>`;
}

export function mistakesView(model) {
  const all = mistakes();
  const open = all.filter((m) => !m.resolved);
  const counts = Object.fromEntries(KINDS.map(([id]) => [id, open.filter((m) => m.kind === id).length]));
  const unclassified = open.filter((m) => !m.kind).length;
  const max = Math.max(1, ...Object.values(counts));
  let shown = all.filter((m) => (mistakeState.filter === 'open' ? !m.resolved : mistakeState.filter === 'fixed' ? m.resolved : true));
  if (mistakeState.kind !== 'all') shown = shown.filter((m) => (mistakeState.kind === 'none' ? !m.kind : m.kind === mistakeState.kind));

  const bars = KINDS.map(([id, bnName, en, hue]) => `<button class="mk-bar hue-${hue} ${mistakeState.kind === id ? 'on' : ''}" data-mk-filter-kind="${id}">
      <span class="mk-bar-label">${bnName}<small>${en}</small></span>
      <span class="mk-bar-track"><span style="width:${(counts[id] / max) * 100}%"></span></span>
      <b>${bn(counts[id])}</b></button>`).join('');

  const chapters = model.chapters.map((c) => `<option value="${esc(c.id)}">${esc(c.subject.name)} · ${esc(c.name)}</option>`).join('');

  return {
    nav: 'progress',
    title: 'Mistake Book',
    back: '#/progress',
    html: `<header class="page-title rise"><p class="eyebrow">My Mistake Book</p><h1>ভুলের খাতা</h1>
        <p class="muted">MCQ-তে ভুল করলে নিজে থেকেই এখানে জমা হয়। খোলা ভুল ${bn(open.length)}টি, মোট ${bn(all.length)}টি।</p></header>

      <section class="card rise" style="--i:1">
        <h2 class="card-title">${icon('chart')} কোন ধরনের ভুল বেশি</h2>
        <div class="mk-bars">${bars}</div>
        ${unclassified ? `<button class="link" data-mk-filter-kind="none">${bn(unclassified)}টির ধরন এখনো ঠিক হয়নি →</button>` : ''}
      </section>

      <div class="chip-row mk-filters rise" style="--i:2">
        ${[['open', 'খোলা'], ['fixed', 'ঠিক হয়েছে'], ['all', 'সব']].map(([v, l]) => `<button class="chip ${mistakeState.filter === v ? 'on' : ''}" data-mk-filter="${v}">${l}</button>`).join('')}
        ${mistakeState.kind !== 'all' ? `<button class="chip on" data-mk-filter-kind="all">${esc(mistakeState.kind === 'none' ? 'ধরন ঠিক হয়নি' : kindOf(mistakeState.kind)[1])} ✕</button>` : ''}
      </div>

      ${shown.length ? `<ul class="mk-list">${shown.map((m) => card(model, m)).join('')}</ul>`
        : `<div class="empty sm"><div class="empty-art">${icon('check')}</div><h2>${all.length ? 'এই তালিকায় কিছু নেই' : 'এখনো কোনো ভুল নেই'}</h2><p>${all.length ? 'অন্য ফিল্টার দেখো।' : 'MCQ অনুশীলনে ভুল করলে বা নিচে নিজে যোগ করলে এখানে আসবে।'}</p></div>`}

      <details class="card mk-add rise" style="--i:3">
        <summary>${icon('notes')} পরীক্ষার খাতা থেকে ভুল যোগ করো</summary>
        <form class="mk-form" data-mk-form>
          <select name="chapter" aria-label="অধ্যায়"><option value="">অধ্যায় (ঐচ্ছিক)</option>${chapters}</select>
          <textarea name="question" rows="3" required maxlength="2000" placeholder="প্রশ্নটা লেখো"></textarea>
          <input name="mine" maxlength="1000" placeholder="আমার উত্তর ছিল…">
          <input name="right" maxlength="1000" placeholder="সঠিক উত্তর…">
          <select name="kind" aria-label="ভুলের ধরন"><option value="">ধরন (না জানলে AI দিয়ে পরে ঠিক করো)</option>${KINDS.map(([id, b, en]) => `<option value="${id}">${b} — ${en}</option>`).join('')}</select>
          <button class="btn btn-primary tap" type="submit">${icon('check')}<span>যোগ করো</span></button>
        </form>
      </details>`,
  };
}

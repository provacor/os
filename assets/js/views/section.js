// Section screen: the content of one chapter section (Notes, MCQ, Simulation, …).

import { icon } from '../icons.js?v=202610100121';
import { esc, plural, bar, ring, sectionHue, chapterEyebrow, chapterNo, pad2, emptyState } from '../components.js?v=202610100121';
import { progressOf, isItemDone } from '../progress.js?v=202610100121';
import { hfActive } from '../handsfree.js?v=202610100121';

const FORMAT = {
  pdf: { icon: 'file', open: 'Open PDF', label: 'PDF' },
  html: { icon: 'simulation', open: 'Full screen', label: 'Interactive' },
};

function doneButton(it) {
  const d = isItemDone(it.id);
  return `<button class="btn btn-done ${d ? 'on' : ''}" data-action="toggle-done" data-item="${esc(it.id)}" aria-pressed="${d}">
      <span class="check">${icon('check')}</span><span>${d ? 'Done' : 'Mark as done'}</span></button>`;
}

// MCQ items (future content): question + options, tap to answer with instant feedback.
function mcqCard(it, n) {
  const opts = (it.options ?? []).map((o, k) => `<button class="opt" data-action="mcq" data-item="${esc(it.id)}" data-k="${k}">
      <span class="opt-key">${'কখগঘ'[k] ?? k + 1}</span><span>${esc(o)}</span></button>`).join('');
  return `<article class="item-card mcq rise" style="--i:${n}" data-answer="${esc(it.correctAnswer ?? '')}">
      <p class="mcq-q"><span class="mcq-n">${n + 1}.</span> ${esc(it.question)}</p>
      <div class="opts">${opts}</div>
      ${it.explanation ? `<p class="mcq-exp" hidden>${esc(it.explanation)}</p>` : ''}
      <div class="item-foot">${[it.board, it.year].filter(Boolean).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}${doneButton(it)}</div>
    </article>`;
}

const txt = (s) => `<div class="pre">${esc(s)}</div>`;
const chips = (...xs) => xs.filter(Boolean).map((x) => `<span class="chip">${esc(x)}</span>`).join('');
const answerBox = (a, label = 'উত্তর দেখো') => `<details class="ans"><summary>${label}</summary>${txt(a)}</details>`;
const noteBox = (it) => (it.note ? `<div class="item-note pre">${esc(it.note)}</div>` : '');
const doneFoot = (it) => `<div class="item-foot">${doneButton(it)}</div>`;
const shell = (it, n, inner, cls = '') => `<article class="item-card rise ${cls} ${isItemDone(it.id) ? 'is-done' : ''}" style="--i:${Math.min(n, 12)}">${inner}${doneFoot(it)}</article>`;

// Creative question (or a numerical practice set): a stem and lettered parts, each answer folded away.
function cqCard(it, n) {
  const parts = it.parts.map((p) => `<div class="cq-part"><p class="cq-q"><b>${esc(p.label)})</b> ${esc(p.q)} ${chips(p.board)}</p>${p.a ? answerBox(p.a) : ''}</div>`).join('');
  return shell(it, n, `<h3 class="qa-title">${esc(it.title ?? '')} ${chips(it.board)}</h3>
      ${it.stem ? `<div class="cq-stem pre">${esc(it.stem)}</div>` : ''}${parts}${noteBox(it)}`);
}
// Short question with a folded answer (ক / খ).
function qaCard(it, n) {
  return shell(it, n, `<p class="mcq-q"><span class="mcq-n">${n + 1}.</span> ${esc(it.question)}</p>
      <div class="chip-row qa-chips">${chips(it.board)}</div>${answerBox(it.answer)}`);
}
function formulaCard(it, n) {
  const rows = (it.symbols ?? []).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return shell(it, n, `<h3 class="qa-title">${esc(it.title)}</h3>
      <div class="formula-lines">${it.formulas.map((f) => `<div>${esc(f)}</div>`).join('')}</div>
      ${rows ? `<details class="ans"><summary>প্রতীক, অর্থ ও একক</summary><div class="tbl-wrap"><table class="sym-table">${rows}</table></div></details>` : ''}${noteBox(it)}`);
}
function derivationCard(it, n) {
  return shell(it, n, `<h3 class="qa-title">${esc(it.title)}</h3>
      <ol class="steps">${it.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="result">${esc(it.result)}</div>${noteBox(it)}`);
}
// Graph / diagram: an inline SVG shipped with the content (repo-authored, not user input).
function figureCard(it, n) {
  return shell(it, n, `<h3 class="qa-title">${esc(it.title)}</h3><figure class="fig-wrap">${it.figure}</figure>${it.body ? txt(it.body) : ''}`);
}

function itemCard(it, sec, n) {
  if (it.question && it.options) return mcqCard(it, n);
  if (it.parts) return cqCard(it, n);
  if (it.question && it.answer) return qaCard(it, n);
  if (it.formulas) return formulaCard(it, n);
  if (it.steps) return derivationCard(it, n);
  if (it.figure) return figureCard(it, n);
  const kind = sec.contentKinds.find((k) => k.id === it.kind)?.label;
  const f = FORMAT[it.format] ?? { icon: sec.type, open: 'Open file', label: it.format?.toUpperCase() };
  const src = it.file ? esc(encodeURI(it.file)) : '';
  const meta = [kind, f.label, it.pages ? `${it.pages} pages` : null].filter(Boolean);
  const embed = it.format === 'html' && it.file
    ? `<div class="embed-wrap"><iframe class="item-embed" src="${src}" title="${esc(it.title ?? it.id)}" loading="lazy"></iframe></div>`
    : '';
  return `<article class="item-card rise ${isItemDone(it.id) ? 'is-done' : ''}" style="--i:${n}">
      <div class="item-head">
        <span class="item-icon hue-${sectionHue(sec.type)}">${icon(f.icon)}</span>
        <div class="item-text">
          <h3>${esc(it.title ?? it.id)}</h3>
          <p class="item-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</p>
        </div>
      </div>
      ${it.body ? `<div class="item-body">${esc(it.body)}</div>` : ''}${noteBox(it)}
      ${embed}
      <div class="item-foot">
        ${it.file ? `<a class="btn btn-primary tap" href="${src}" target="_blank" rel="noopener">${icon(it.format === 'html' ? 'expand' : 'file')}<span>${f.open}</span></a>` : ''}
        ${doneButton(it)}
      </div>
    </article>`;
}

// Items that carry a topic are grouped under a heading each time the topic changes.
function withTopics(items, render) {
  let last;
  return items.map((it, n) => {
    const head = it.topic && it.topic !== last ? `<h2 class="topic-head">${esc(it.topic)}</h2>` : '';
    last = it.topic ?? last;
    return head + render(it, n);
  }).join('');
}

export function sectionView(model, sec) {
  if (!sec || sec.level !== 'section') return null;
  const ch = sec.chapter;
  const hue = sectionHue(sec.type);
  const pct = progressOf(sec);

  const tabs = ch.sections
    .map((s) => `<a class="seg-tab ${s === sec ? 'on' : ''} ${s.contentCount || s.computed ? '' : 'dim'}" href="#/x/${esc(s.id)}" ${s === sec ? 'aria-current="page"' : ''}>${icon(s.type)}<span>${esc(s.label)}</span>${s.contentCount ? `<i>${s.contentCount}</i>` : ''}</a>`)
    .join('');

  let body;
  if (sec.computed) {
    const rows = ch.sections.filter((s) => s.trackable);
    body = `<div class="card progress-card rise">
        <div class="pc-top">${ring(progressOf(ch), { size: 84, stroke: 7 })}<div><p class="eyebrow">Overall</p><h2>${progressOf(ch)}% complete</h2>
        <p class="muted small">${rows.filter((s) => progressOf(s) === 100).length} of ${rows.length} sections finished</p></div></div>
        ${rows.map((s, i) => `<a class="pc-row rise" style="--i:${i}" href="#/x/${esc(s.id)}"><span class="sec-icon sm hue-${sectionHue(s.type)}">${icon(s.type)}</span><span class="pc-name">${esc(s.label)}</span><span class="pc-pct">${progressOf(s)}%</span>${bar(progressOf(s), 'bar-thin')}</a>`).join('')}
      </div>`;
  } else if (sec.items.length) {
    const kinds = sec.contentKinds.filter((k) => sec.items.some((it) => it.kind === k.id));
    body = `<div class="sec-progress rise"><div><span class="eyebrow">Section progress</span><b>${pct}%</b></div>${bar(pct, 'bar-hue')}<span class="muted small">${sec.items.filter((it) => isItemDone(it.id)).length}/${plural(sec.items.length, 'item')} done</span></div>
      <button class="btn tap hf-start ${hfActive() ? 'on' : ''}" data-hf-start="${esc(sec.id)}">${icon('speaker')}<span>${hfActive() ? 'হ্যান্ডস-ফ্রি বন্ধ করো' : 'ইয়ারবাডে শুনে শুনে পড়ো (হ্যান্ডস-ফ্রি)'}</span></button>
      ${kinds.length ? `<div class="chip-row">${kinds.map((k) => `<span class="chip on">${esc(k.label)} · ${sec.items.filter((it) => it.kind === k.id).length}</span>`).join('')}</div>` : ''}
      <div class="items">${withTopics(sec.items, (it, n) => itemCard(it, sec, n))}</div>`;
  } else {
    const planned = sec.contentKinds.length
      ? `<div class="planned"><p class="eyebrow">Will be organised as</p><div class="chip-row">${sec.contentKinds.map((k) => `<span class="chip">${esc(k.label)}</span>`).join('')}</div></div>`
      : '';
    body = emptyState({
      iconName: sec.type,
      hue,
      title: `${sec.label} haven't been added yet`,
      text: `${sec.emptyText} Once they are added to this chapter, they will appear here.`,
      extra: `${planned}<p class="readonly">${icon('info')} Content is added from the study library, so this screen is read-only.</p>`,
    });
  }

  return {
    nav: 'study',
    title: sec.label,
    back: `#/c/${ch.id}`,
    crumbs: [[ch.subject.name, `#/s/${ch.subject.id}`], [ch.paper.name, `#/p/${ch.paper.id}`], [chapterNo(ch) != null ? `Ch ${pad2(chapterNo(ch))}` : ch.name, `#/c/${ch.id}`], [sec.label, `#/x/${sec.id}`]],
    accent: ch.subject.accent,
    visit: { chapterId: ch.id, sectionId: sec.id },
    html: `<header class="sec-hero hue-${hue} rise">
        <span class="sec-icon lg">${icon(sec.type)}</span>
        <div><p class="eyebrow">${esc(ch.subject.name)} · ${esc(chapterEyebrow(ch))}</p><h1>${esc(sec.screenTitle)}</h1><p class="muted bn">${esc(ch.name)}</p></div>
      </header>
      <nav class="seg-tabs" aria-label="Sections of this chapter">${tabs}</nav>
      ${body}
      ${sec.type === 'notes' ? `<a class="btn btn-primary tap mm-after-notes" href="#/mm/${esc(ch.id)}">${icon('map')}<span>এই অধ্যায়ের মাইন্ড ম্যাপ দেখো</span></a>` : ''}`,
    after: () => document.querySelector('.seg-tab.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }),
  };
}

// Search: filters, recent searches, suggestions and grouped, highlighted results.

import { icon } from '../icons.js?v=202610101347';
import { esc, highlight, subjectGlyph, sectionHue } from '../components.js?v=202610101347';
import { search } from '../search.js?v=202610101347';
import { recentSearches } from '../activity.js?v=202610101347';
import { matchConcepts, conceptById } from '../concepts.js?v=202610101347';
import { videosOf } from '../videos.js?v=202610101347';
import { mistakes } from '../mistakes.js?v=202610101347';

let model = null;
export const setSearchModel = (m) => { model = m; };
const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

// Universal search: a question about an idea ("যে chapter-এ Snell's law আছে") is answered
// with the chapter and everything inside it, in study order.
const ROUTE = [
  ['chapter', 'Chapter', 'layers'],
  ['notes', 'Note', 'notes'],
  ['formula', 'Formula', 'formula'],
  ['simulation', 'Simulation', 'simulation'],
  ['mcq', 'MCQ', 'mcq'],
  ['cq', 'CQ', 'cq'],
  ['video', 'Video', 'video'],
  ['board', 'Previous questions', 'board'],
];
function conceptAnswer(q) {
  if (!model) return '';
  const found = matchConcepts(q, 2);
  if (!found.length) return '';
  return found.map((c) => {
    const blocks = c.chapters.map((chId) => {
      const ch = model.byId.get(chId);
      if (!ch) return '';
      const sec = (t) => ch.sections.find((x) => x.type === t);
      const vids = videosOf(ch.id);
      const words = [c.bn, c.en, ...(c.aliases ?? [])].map((w) => w.toLowerCase());
      const vidHits = vids.filter((v) => words.some((w) => `${v.title} ${v.topic}`.toLowerCase().includes(w)));
      const errs = mistakes().filter((m) => m.chapterId === ch.id && !m.resolved).length;
      const rows = ROUTE.map(([type, label, ic]) => {
        if (type === 'chapter') return `<a class="ua-row on" href="#/c/${esc(ch.id)}"><span class="ua-ic">${icon(ic)}</span><span class="ua-l">${label}</span><span class="ua-v">${esc(ch.name)}</span>${icon('chevron', 'r-chev')}</a>`;
        if (type === 'video') {
          const n = (vidHits.length || vids.length);
          return `<a class="ua-row ${n ? 'on' : ''}" href="#/c/${esc(ch.id)}"><span class="ua-ic">${icon(ic)}</span><span class="ua-l">${label}</span><span class="ua-v">${n ? `${bn(n)}টি ভিডিও${vidHits.length ? '' : ' (অধ্যায়ের)'}` : 'লিংক যোগ করো'}</span>${icon('chevron', 'r-chev')}</a>`;
        }
        const s = sec(type);
        if (!s) {
          if (type !== 'board') return '';
          return `<span class="ua-row"><span class="ua-ic">${icon(ic)}</span><span class="ua-l">${label}</span><span class="ua-v muted">এখনো যোগ হয়নি</span></span>`;
        }
        return `<a class="ua-row ${s.contentCount ? 'on' : ''}" href="#/x/${esc(s.id)}"><span class="ua-ic">${icon(ic)}</span><span class="ua-l">${label}</span><span class="ua-v">${s.contentCount ? `${bn(s.contentCount)}টি` : 'খালি'}</span>${icon('chevron', 'r-chev')}</a>`;
      }).join('');
      return `<div class="ua-chapter"><p class="ua-path">${esc(ch.subject.name)} · ${esc(ch.paper.name)}</p>${rows}
        ${errs ? `<a class="ua-row on" href="#/mistakes"><span class="ua-ic">${icon('warn')}</span><span class="ua-l">My mistakes</span><span class="ua-v">${bn(errs)}টি খোলা ভুল</span>${icon('chevron', 'r-chev')}</a>` : ''}</div>`;
    }).join('');
    const pre = c.prereqs.map((p) => conceptById(p)).filter(Boolean);
    return `<section class="card ua rise">
        <p class="eyebrow">${icon('sparkle')} সরাসরি উত্তর</p>
        <h2>${esc(c.bn)} <span class="muted">· ${esc(c.en)}</span></h2>
        ${blocks}
        ${pre.length ? `<p class="ua-pre"><span class="muted small">আগে জানতে হবে:</span> ${pre.map((p) => `<a class="chip" href="#/graph/${esc(p.id)}">${esc(p.bn)}</a>`).join('')}</p>` : ''}
        <a class="link" href="#/graph/${esc(c.id)}">Knowledge map-এ দেখো ${icon('chevron')}</a>
      </section>`;
  }).join('');
}

function extraResults(q, tokens) {
  const ql = q.toLowerCase();
  const out = [];
  if (!model) return out;
  for (const ch of model.chapters) {
    for (const v of videosOf(ch.id)) {
      const hay = `${v.title} ${v.topic} ${ch.name}`.toLowerCase();
      if (tokens.every((t) => hay.includes(t)) || hay.includes(ql)) out.push({ kind: 'video', title: v.title || v.topic || 'YouTube ভিডিও', path: [ch.subject.name, ch.name, v.topic].filter(Boolean), href: `#/c/${ch.id}` });
    }
  }
  for (const m of mistakes()) {
    const ch = m.chapterId ? model.byId.get(m.chapterId) : null;
    const hay = `${m.question} ${m.correct ?? ''} ${m.rightAnswer ?? ''} ${ch?.name ?? ''}`.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) out.push({ kind: 'mistake', title: m.question.slice(0, 120), path: ['Mistake Book', ch?.name].filter(Boolean), href: '#/mistakes' });
  }
  return out;
}

const GROUPS = [
  ['subject', 'Subjects'],
  ['paper', 'Papers'],
  ['chapter', 'Chapters'],
  ['topic', 'Topics'],
  ['content', 'Content'],
  ['section', 'Sections'],
];
const FILTERS = [['all', 'All'], ...GROUPS.filter(([k]) => k !== 'paper')];

export const searchState = { q: '', filter: 'all' };

export function hrefOf(r) {
  const n = r.node;
  if (n.level === 'subject') return `#/s/${n.id}`;
  if (n.level === 'paper') return `#/p/${n.id}`;
  if (n.level === 'chapter') return `#/c/${n.id}`;
  return `#/x/${n.id}`;
}

function iconFor(r) {
  const n = r.node;
  if (n.level === 'subject') return `<span class="r-icon acc-${esc(n.accent)}">${subjectGlyph(n)}</span>`;
  if (n.level === 'paper') return `<span class="r-icon acc-${esc(n.subject.accent)}">${subjectGlyph(n.subject)}</span>`;
  if (n.level === 'chapter') return `<span class="r-icon acc-${esc(n.subject.accent)}">${icon(r.level === 'topic' ? 'target' : 'layers')}</span>`;
  return `<span class="r-icon hue-${sectionHue(n.type)}">${icon(n.type)}</span>`;
}

export function resultsHtml(index) {
  const q = searchState.q.trim();
  if (!q) return idleHtml();
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const all = search(index, q, 400);
  const counts = Object.fromEntries(GROUPS.map(([k]) => [k, all.filter((r) => r.level === k).length]));
  const chips = FILTERS.map(([k, label]) => {
    const n = k === 'all' ? all.length : counts[k];
    return `<button class="chip filter ${searchState.filter === k ? 'on' : ''}" data-filter="${k}" ${n ? '' : 'disabled'}>${label}<i>${n}</i></button>`;
  }).join('');
  const shown = searchState.filter === 'all' ? all : all.filter((r) => r.level === searchState.filter);
  const answer = conceptAnswer(q);
  const extra = extraResults(q, tokens);
  const extraHtml = extra.length && searchState.filter === 'all'
    ? `<section class="r-group"><h3>Videos & mistakes</h3><ul class="results">${extra.slice(0, 12).map((r) => `<li><a href="${r.href}" data-result><span class="r-icon">${icon(r.kind === 'video' ? 'video' : 'warn')}</span>
        <span class="r-body"><span class="r-title">${highlight(r.title, tokens)}</span><span class="r-path">${esc(r.path.join(' › '))}</span></span>${icon('chevron', 'r-chev')}</a></li>`).join('')}</ul></section>`
    : '';
  if (!all.length && (answer || extraHtml)) return answer + extraHtml;
  if (!all.length) {
    return `<div class="chip-row filters">${chips}</div>
      <div class="empty sm"><div class="empty-art">${icon('search')}</div><h2>No match for “${esc(q)}”</h2><p>Try a chapter name in Bangla or English, a section (notes, mcq) or a subject.</p></div>`;
  }
  let i = 0;
  const groups = GROUPS.map(([k, label]) => {
    const rows = shown.filter((r) => r.level === k).slice(0, searchState.filter === 'all' ? 8 : 60);
    if (!rows.length) return '';
    const more = searchState.filter === 'all' && counts[k] > rows.length ? `<button class="more-btn" data-filter="${k}">Show all ${counts[k]} ${label.toLowerCase()}</button>` : '';
    return `<section class="r-group"><h3>${label}</h3><ul class="results">${rows
      .map((r) => `<li class="rise" style="--i:${Math.min(i++, 16)}"><a href="${hrefOf(r)}" data-result>${iconFor(r)}
          <span class="r-body"><span class="r-title">${highlight(r.title, tokens)}</span><span class="r-path">${highlight(r.path.join(' › '), tokens)}</span></span>${icon('chevron', 'r-chev')}</a></li>`)
      .join('')}</ul>${more}</section>`;
  }).join('');
  return `${answer}<div class="chip-row filters">${chips}</div>${groups}${extraHtml}`;
}

function idleHtml() {
  const recents = recentSearches();
  const suggestions = ["যে chapter-এ Snell's law আছে", 'মুক্তিবেগ', 'pH', 'Notes', 'Simulation', 'ভেক্টর', 'Preposition', 'সালোকসংশ্লেষণ'];
  return `${recents.length ? `<section class="r-group rise"><div class="block-head"><h3>Recent</h3><button class="link" data-action="clear-searches">Clear</button></div>
        <div class="chip-row">${recents.map((s) => `<button class="chip" data-q="${esc(s)}">${icon('clock')}${esc(s)}</button>`).join('')}</div></section>` : ''}
    <section class="r-group rise" style="--i:1"><h3>Try searching</h3>
      <div class="chip-row">${suggestions.map((s) => `<button class="chip" data-q="${esc(s)}">${icon('spark')}${esc(s)}</button>`).join('')}</div></section>
    <section class="r-group rise" style="--i:2"><h3>What you can find</h3>
      <ul class="hint-list">
        <li>${icon('sparkle')}<span><b>যেকোনো ধারণা বা সূত্র</b>: <em>যে chapter-এ Snell's law আছে</em> → Chapter, Note, Formula, Simulation, MCQ, CQ, Video, Previous questions</span></li>
        <li>${icon('layers')}<span><b>Chapters & topics</b> in Bangla or English: <em>মহাকর্ষ</em>, <em>Narration</em></span></li>
        <li>${icon('notes')}<span><b>Sections</b> combined with a subject: <em>physics notes</em>, <em>chemistry reaction</em></span></li>
        <li>${icon('file')}<span><b>Added content</b> by title: notes PDFs, simulations, questions</span></li>
      </ul></section>`;
}

export function searchView() {
  return {
    nav: 'search',
    title: 'Search',
    html: `<header class="page-title rise"><h1>Search</h1></header>
      <div class="search-box rise" style="--i:1">${icon('search')}
        <input id="q" type="search" placeholder="যেকোনো ধারণা, সূত্র, অধ্যায়… যেমন Snell's law" autocomplete="off" enterkeyhint="search" value="${esc(searchState.q)}" aria-label="Search">
        <button class="clear-q" data-action="clear-q" aria-label="Clear search" ${searchState.q ? '' : 'hidden'}>${icon('x')}</button>
      </div>
      <div id="results" aria-live="polite"></div>`,
    keepScroll: false,
    isSearch: true,
  };
}

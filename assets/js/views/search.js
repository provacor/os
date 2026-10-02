// Search: filters, recent searches, suggestions and grouped, highlighted results.

import { icon } from '../icons.js?v=202610021453';
import { esc, highlight, subjectGlyph, sectionHue } from '../components.js?v=202610021453';
import { search } from '../search.js?v=202610021453';
import { recentSearches } from '../activity.js?v=202610021453';

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
  return `<div class="chip-row filters">${chips}</div>${groups}`;
}

function idleHtml() {
  const recents = recentSearches();
  const suggestions = ['Notes', 'Simulation', 'ভেক্টর', 'গতিবিদ্যা', 'Preposition', 'জৈব রসায়ন', 'কোষ', 'MCQ'];
  return `${recents.length ? `<section class="r-group rise"><div class="block-head"><h3>Recent</h3><button class="link" data-action="clear-searches">Clear</button></div>
        <div class="chip-row">${recents.map((s) => `<button class="chip" data-q="${esc(s)}">${icon('clock')}${esc(s)}</button>`).join('')}</div></section>` : ''}
    <section class="r-group rise" style="--i:1"><h3>Try searching</h3>
      <div class="chip-row">${suggestions.map((s) => `<button class="chip" data-q="${esc(s)}">${icon('spark')}${esc(s)}</button>`).join('')}</div></section>
    <section class="r-group rise" style="--i:2"><h3>What you can find</h3>
      <ul class="hint-list">
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
        <input id="q" type="search" placeholder="Chapter, topic, section or content…" autocomplete="off" enterkeyhint="search" value="${esc(searchState.q)}" aria-label="Search">
        <button class="clear-q" data-action="clear-q" aria-label="Clear search" ${searchState.q ? '' : 'hidden'}>${icon('x')}</button>
      </div>
      <div id="results" aria-live="polite"></div>`,
    keepScroll: false,
    isSearch: true,
  };
}

// Reusable UI building blocks. Each returns an HTML string; views compose them.

import { icon } from './icons.js?v=202610021225';
import { progressOf } from './progress.js?v=202610021225';
import { contentCount, chapterCount } from './model.js?v=202610021225';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const plural = (n, word) => `${n} ${word.toLowerCase()}${n === 1 ? '' : 's'}`;
export const pad2 = (n) => String(n).padStart(2, '0');

// A subject's glyph: a custom round image when the subject defines one in
// data/subjects.json, otherwise the line icon. Drops into any .s-icon / .r-icon box.
export function subjectGlyph(s) {
  return s?.image
    ? `<img class="s-img" src="${esc(s.image)}" alt="" loading="lazy" decoding="async" width="56" height="56">`
    : icon(s?.id ?? 'layers');
}

// Each section type gets a hue so the chapter workspace reads at a glance.
const SECTION_HUE = {
  notes: 'blue', mcq: 'amber', cq: 'rose', formula: 'violet', concept: 'yellow', simulation: 'teal',
  mistakes: 'red', revision: 'cyan', progress: 'green', reaction: 'teal', conversion: 'cyan', mechanism: 'violet',
  identification: 'blue', derivation: 'violet', numerical: 'amber', graph: 'cyan', diagram: 'green', theorem: 'violet',
  problem_types: 'amber', solved: 'green', definition: 'blue', process: 'cyan', comparison: 'rose', classification: 'green',
  practice: 'amber', board: 'rose', rules: 'violet', examples: 'cyan',
};
export const sectionHue = (type) => SECTION_HUE[type] ?? 'blue';

// Chapter number to show: printed number, or list order for numbered-by-order papers (Chemistry).
export function chapterNo(ch) {
  if (ch.number != null) return ch.number;
  return ch.kind === 'chapter' ? ch.order : null;
}

export function chapterEyebrow(ch) {
  const n = chapterNo(ch);
  return n != null ? `Chapter ${pad2(n)}` : ch.paper.unitLabel;
}

// ---------- progress ----------

export function ring(pct, { size = 44, stroke = 4, label = true, cls = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = +(2 * Math.PI * r).toFixed(2);
  const off = +(c * (1 - pct / 100)).toFixed(2);
  return `<span class="ring ${cls}" style="--size:${size}px" role="img" aria-label="${pct}% complete">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" style="--c:${c};--off:${off}"/>
    </svg>${label ? `<span class="ring-label">${pct}<small>%</small></span>` : ''}</span>`;
}

export function bar(pct, cls = '') {
  return `<div class="bar ${cls}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="--p:${pct}%"></span></div>`;
}

// ---------- navigation ----------

export function crumbs(list) {
  if (!list.length) return '';
  return `<ol>${list
    .map(([t, href], i, arr) => (i === arr.length - 1 ? `<li aria-current="page">${esc(t)}</li>` : `<li><a href="${href}">${esc(t)}</a></li>`))
    .join('')}</ol>`;
}

// ---------- states ----------

export function emptyState({ iconName = 'layers', hue = 'blue', title, text, extra = '' }) {
  return `<div class="empty hue-${hue}">
      <div class="empty-art">${icon(iconName)}</div>
      <h2>${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${extra}
    </div>`;
}

export function skeleton(kind = 'cards', n = 4) {
  const one = kind === 'list'
    ? '<div class="sk sk-row"><span class="sk-b sk-dot"></span><span class="sk-lines"><span class="sk-b w60"></span><span class="sk-b w35"></span></span></div>'
    : '<div class="sk sk-card"><span class="sk-b sk-dot"></span><span class="sk-b w50"></span><span class="sk-b w80"></span><span class="sk-b w30"></span></div>';
  return `<div class="sk-wrap" aria-busy="true" aria-label="Loading">${one.repeat(n)}</div>`;
}

// ---------- cards ----------

export function subjectCard(s, { cont, i = 0 }) {
  const pct = progressOf(s);
  const total = chapterCount(s);
  const doneChapters = s.papers.flatMap((p) => p.chapters).filter((c) => progressOf(c) === 100).length;
  const unit = s.id === 'english' ? 'topics' : 'chapters';
  return `<article class="subject-card acc-${esc(s.accent)} pat-${esc(s.id)} rise" style="--i:${i}">
      <a class="cover-link" href="#/s/${esc(s.id)}" aria-label="Open ${esc(s.name)}"></a>
      <div class="sc-top">
        <span class="s-icon">${subjectGlyph(s)}</span>
        <div class="sc-title"><h3>${esc(s.name)}</h3><p>${s.papers.map((p) => esc(p.name)).join(' · ')}</p></div>
        ${ring(pct, { size: 46 })}
      </div>
      <div class="sc-stats">
        <span><b>${doneChapters}</b> / ${total} ${unit} completed</span>
        <span>${contentCount(s)} content</span>
      </div>
      ${bar(pct, 'bar-acc')}
      ${cont ? `<a class="sc-continue" href="${cont.href}"><span class="muted">${cont.label}</span><span class="sc-target">${esc(cont.title)}</span>${icon('arrow')}</a>` : ''}
    </article>`;
}

export function chapterCard(ch, i = 0) {
  const pct = progressOf(ch);
  const n = chapterNo(ch);
  const ready = ch.sections.filter((s) => s.contentCount > 0);
  const topics = (ch.topics ?? []).map((t) => (typeof t === 'string' ? t : t.name));
  const desc = topics.length
    ? topics.slice(0, 2).join(' · ') + (topics.length > 2 ? ` +${topics.length - 2}` : '')
    : ready.length
      ? ready.map((s) => s.label).join(' · ') + ' ready'
      : `${ch.sections.length} sections`;
  return `<a class="chapter-card rise ${pct === 100 ? 'is-done' : ''}" href="#/c/${esc(ch.id)}" style="--i:${Math.min(i, 14)}">
      <span class="cc-no">${n != null ? pad2(n) : icon('layers')}</span>
      <span class="cc-body">
        <span class="cc-title">${esc(ch.name)}${ch.verification === 'verified' ? '' : '<span class="flag" title="Needs checking against the syllabus image">verify</span>'}</span>
        <span class="cc-desc">${esc(desc)}</span>
      </span>
      ${ready.length ? `<span class="cc-pill">${ready.length} ready</span>` : ''}
      ${pct > 0 ? ring(pct, { size: 38, stroke: 3, cls: 'cc-ring' }) : ''}
      ${icon('chevron', 'cc-chev')}
    </a>`;
}

export function sectionCard(s, { big = false, i = 0 } = {}) {
  const pct = progressOf(s);
  const has = s.contentCount > 0;
  const meta = s.computed ? `${progressOf(s.chapter)}% overall` : has ? plural(s.contentCount, 'item') : 'Empty';
  return `<a class="section-card hue-${sectionHue(s.type)} ${big ? 'big' : ''} ${has || s.computed ? '' : 'is-empty'} rise" href="#/x/${esc(s.id)}" style="--i:${i}">
      <span class="sec-icon">${icon(s.type)}</span>
      <span class="sec-body">
        <span class="sec-label">${esc(s.label)}</span>
        ${big ? `<span class="sec-blurb">${esc(s.blurb)}</span>` : ''}
        <span class="sec-meta">${meta}${has && !s.computed ? ` · ${pct}%` : ''}</span>
      </span>
      ${big ? icon('arrow', 'sec-go') : ''}
      ${has && !s.computed ? `<span class="sec-bar" style="--p:${pct}%"></span>` : ''}
    </a>`;
}

// Highlight query tokens inside already-escaped text.
export function highlight(text, tokens) {
  let out = esc(text);
  tokens
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length)
    .forEach((t) => {
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      out = out.replace(re, (m) => `\u0000${m}\u0001`);
    });
  return out.replace(/\u0000/g, '<mark>').replace(/\u0001/g, '</mark>');
}

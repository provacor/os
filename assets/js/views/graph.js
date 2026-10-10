// Visual knowledge graph: concepts of a subject laid out in prerequisite layers.
// Tap a concept to light up what must come before it and what it leads to.

import { icon } from '../icons.js?v=202610100130';
import { esc } from '../components.js?v=202610100130';
import { allConcepts, conceptById, ancestors, descendants, depthOf } from '../concepts.js?v=202610100130';
import { progressOf } from '../progress.js?v=202610100130';

export const graphState = { subject: 'physics', sel: null };
const SUBJECTS = [['physics', 'পদার্থ'], ['chemistry', 'রসায়ন'], ['higher_math', 'উচ্চতর গণিত'], ['biology', 'জীববিজ্ঞান']];

export function graphView(model, focusId) {
  if (focusId && conceptById(focusId)) {
    graphState.sel = focusId;
    graphState.subject = conceptById(focusId).subject;
  }
  const subject = graphState.subject;
  const nodes = allConcepts().filter((c) => c.subject === subject);
  const memo = {};
  const layers = [];
  for (const c of nodes) (layers[depthOf(c.id, subject, memo)] ??= []).push(c);

  const sel = graphState.sel && conceptById(graphState.sel)?.subject === subject ? conceptById(graphState.sel) : null;
  const pre = new Set(sel ? ancestors(sel.id) : []);
  const post = new Set(sel ? descendants(sel.id) : []);
  const done = (c) => {
    const chs = c.chapters.map((id) => model.byId.get(id)).filter(Boolean);
    return chs.length ? Math.round(chs.reduce((n, ch) => n + progressOf(ch), 0) / chs.length) : 0;
  };

  const layerHtml = layers.map((list, i) => `<div class="kg-layer" data-depth="${i}">
      ${(list ?? []).map((c) => {
        const cls = !sel ? '' : c.id === sel.id ? 'sel' : pre.has(c.id) ? 'pre' : post.has(c.id) ? 'post' : 'dim';
        const p = done(c);
        return `<button class="kg-node ${cls} ${p === 100 ? 'done' : ''}" data-kg-node="${esc(c.id)}" id="kg-${esc(c.id)}" aria-pressed="${c.id === sel?.id}">
            <span>${esc(c.bn)}</span>${p ? `<i style="--p:${p}%"></i>` : ''}</button>`;
      }).join('')}
    </div>`).join('');

  const chip = (id) => {
    const c = conceptById(id);
    return c ? `<button class="chip" data-kg-node="${esc(c.id)}">${esc(c.bn)}${c.subject !== subject ? ` <small>· ${esc(SUBJECTS.find((s) => s[0] === c.subject)?.[1] ?? '')}</small>` : ''}</button>` : '';
  };
  const detail = sel ? `<section class="card kg-detail" aria-live="polite">
      <p class="eyebrow">${esc(sel.en)}</p>
      <h2>${esc(sel.bn)}</h2>
      <div class="kg-ch">${sel.chapters.map((id) => model.byId.get(id)).filter(Boolean).map((ch) => `<a class="chip" href="#/c/${esc(ch.id)}">${icon('layers')} ${esc(ch.paper.name)} · ${esc(ch.name)}</a>`).join('')}</div>
      ${sel.prereqs.length ? `<p class="kg-h">${icon('back')} আগে জানতে হবে</p><div class="chip-row">${sel.prereqs.map(chip).join('')}</div>` : '<p class="kg-h muted">এটা একটা ভিত্তি ধারণা, আগে কিছু লাগে না।</p>'}
      ${sel.next.length ? `<p class="kg-h">${icon('arrow')} এরপর যা শেখা যায়</p><div class="chip-row">${sel.next.map(chip).join('')}</div>` : ''}
      <a class="link" href="#/search" data-q="${esc(sel.bn)}">সব কনটেন্ট খোঁজো ${icon('chevron')}</a>
    </section>` : `<p class="muted small kg-tip">${icon('info')} কোনো ধারণায় চাপ দাও: <b class="kg-k pre">আগে যা জানতে হবে</b> আর <b class="kg-k post">এরপর যা আসে</b> আলাদা রঙে দেখাবে।</p>`;

  return {
    nav: 'study',
    title: 'Knowledge map',
    back: '#/study',
    html: `<header class="page-title rise"><p class="eyebrow">Knowledge graph</p><h1>ধারণার মানচিত্র</h1>
        <p class="muted">কোন ধারণা কোনটার পূর্বশর্ত, উপর থেকে নিচে সাজানো। ${nodes.length}টি ধারণা।</p></header>
      <div class="seg seg-4 kg-tabs" role="tablist">${SUBJECTS.map(([id, l]) => `<button class="seg-btn ${id === subject ? 'on' : ''}" data-kg-subject="${id}" aria-pressed="${id === subject}">${l}</button>`).join('')}</div>
      ${detail}
      <div class="kg" id="kg"><svg class="kg-lines" id="kgLines" aria-hidden="true"></svg>${layerHtml}</div>`,
    after: () => {
      drawEdges(nodes, sel, pre, post);
      if (sel && focusId) document.getElementById(`kg-${sel.id}`)?.scrollIntoView({ block: 'center' });
    },
  };
}

export function drawEdges(nodes, sel, pre, post) {
  const box = document.getElementById('kg');
  const svg = document.getElementById('kgLines');
  if (!box || !svg) return;
  const b = box.getBoundingClientRect();
  svg.setAttribute('width', b.width);
  svg.setAttribute('height', box.scrollHeight);
  const pos = (id) => {
    const r = document.getElementById(`kg-${id}`)?.getBoundingClientRect();
    return r && { x: r.left - b.left + r.width / 2, top: r.top - b.top, bottom: r.bottom - b.top };
  };
  const paths = [];
  for (const c of nodes) {
    const to = pos(c.id);
    for (const p of c.prereqs) {
      const from = pos(p);
      if (!from || !to) continue; // prerequisite from another subject
      let lit = '';
      if (sel && (c.id === sel.id || pre.has(c.id)) && pre.has(p)) lit = 'pre';
      else if (sel && (p === sel.id || post.has(p)) && post.has(c.id)) lit = 'post';
      const dim = sel && !lit ? 'dim' : '';
      const my = (from.bottom + to.top) / 2;
      paths.push(`<path class="${lit} ${dim}" d="M${from.x},${from.bottom} C${from.x},${my} ${to.x},${my} ${to.x},${to.top}"/>`);
    }
  }
  svg.innerHTML = paths.join('');
}

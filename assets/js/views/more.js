// More: appearance, data, syllabus source status, about.

import { icon } from '../icons.js';
import { esc } from '../components.js';
import { themePref } from '../theme.js';

export function moreView(model) {
  const pref = themePref();
  const seg = [['dark', 'Dark', 'moon'], ['light', 'Light', 'sun'], ['system', 'System', 'spark']]
    .map(([v, l, ic]) => `<button class="seg-btn ${pref === v ? 'on' : ''}" data-theme-set="${v}" aria-pressed="${pref === v}">${icon(ic)}<span>${l}</span></button>`)
    .join('');

  const rows = model.papers
    .map((p) => {
      const unverified = p.chapters.filter((c) => c.verification !== 'verified').length;
      return `<tr><td>${esc(p.subject.name)}</td><td>${esc(p.name)}</td><td>${p.chapters.length}</td>
        <td>${unverified ? `<span class="flag">${unverified} to verify</span>` : '<span class="ok-tag">Verified</span>'}</td></tr>`;
    })
    .join('');
  const content = model.sections.reduce((n, s) => n + s.items.length, 0);

  return {
    nav: 'more',
    title: 'More',
    html: `<header class="page-title rise"><h1>More</h1></header>
      <section class="card rise" style="--i:1"><h2 class="card-title">${icon('sun')} Appearance</h2><div class="seg">${seg}</div></section>
      <section class="card rise" style="--i:2"><h2 class="card-title">${icon('map')} Syllabus source</h2>
        <p class="muted small">Chapter names come from the syllabus photos. Items still marked <span class="flag">verify</span> need a check.</p>
        <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Paper</th><th>Ch.</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
      <section class="card rise" style="--i:3"><h2 class="card-title">${icon('trash')} Data on this device</h2>
        <p class="muted small">Progress, study history and recent searches are stored only in this browser.</p>
        <button class="btn btn-danger tap" data-action="reset">Reset progress & history</button></section>
      <section class="card about rise" style="--i:4"><div class="brand-mark">${icon('study')}</div>
        <div><h2>Provacor</h2><p class="muted small">HSC Science study OS · ${model.subjects.length} subjects · ${model.chapters.length} chapters & topics · ${content} content items</p></div></section>`,
  };
}

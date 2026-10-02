// Progress analytics. Only real data: completions and this device's study history.

import { icon } from '../icons.js';
import { esc, plural, ring, bar, chapterNo, pad2 } from '../components.js';
import { progressOf } from '../progress.js';
import { dayKey, dayScore, streak, hasActivity } from '../activity.js';
import { totals } from './shared.js';

function heatmap() {
  const weeks = 16;
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (weeks * 7 - 1) - ((end.getDay() + 1) % 7));
  const cells = [];
  let active = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const s = dayScore(dayKey(d));
    if (s) active++;
    const lvl = s === 0 ? 0 : s < 2 ? 1 : s < 4 ? 2 : s < 7 ? 3 : 4;
    cells.push(`<i class="hm l${lvl}" title="${dayKey(d)}: ${s} activit${s === 1 ? 'y' : 'ies'}"></i>`);
  }
  return { html: `<div class="heatmap" role="img" aria-label="Study activity over the last ${weeks} weeks">${cells.join('')}</div>`, active };
}

export function progressView(model) {
  const t = totals(model);
  const trackable = model.sections.filter((s) => s.trackable);
  const secDone = trackable.filter((s) => progressOf(s) === 100).length;
  const days = streak();
  const hm = heatmap();

  const overview = `<section class="card overview rise">
      ${ring(t.overall, { size: 104, stroke: 8, cls: 'big-ring' })}
      <div class="ov-text"><p class="eyebrow">Overall progress</p><h2>${t.overall}%</h2>
        <p class="muted small">Average completion across all ${t.chapters} chapters & topics</p></div>
    </section>
    <div class="tiles">
      <div class="tile rise" style="--i:1"><span>${icon('layers')}</span><b>${t.chaptersDone}<small>/${t.chapters}</small></b><em>chapters completed</em></div>
      <div class="tile rise" style="--i:2"><span>${icon('target')}</span><b>${t.chaptersStarted}</b><em>chapters started</em></div>
      <div class="tile rise" style="--i:3"><span>${icon('check')}</span><b>${t.doneItems}<small>/${t.items}</small></b><em>content items done</em></div>
      <div class="tile rise" style="--i:4"><span>${icon('notes')}</span><b>${secDone}<small>/${trackable.length}</small></b><em>sections finished</em></div>
    </div>`;

  const activity = `<section class="card rise" style="--i:5">
      <div class="block-head"><h2>Study activity</h2>${days ? `<span class="streak">${icon('flame')}${plural(days, 'day')} streak</span>` : ''}</div>
      ${hasActivity()
        ? `${hm.html}<div class="hm-legend"><span class="muted small">${hm.active} active ${hm.active === 1 ? 'day' : 'days'} in 16 weeks</span><span class="hm-scale"><span class="muted small">Less</span><i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i><span class="muted small">More</span></span></div>`
        : `<p class="muted small">Your activity will appear here as you open chapters and mark content as done. It is recorded on this device only.</p>`}
    </section>`;

  const subjects = model.subjects
    .map((s, si) => {
      const papers = s.papers
        .map((p) => {
          const rows = p.chapters
            .map((c) => `<a class="ch-row" href="#/c/${esc(c.id)}"><span class="ch-no">${chapterNo(c) != null ? pad2(chapterNo(c)) : '•'}</span><span class="ch-name">${esc(c.name)}</span><span class="ch-pct">${progressOf(c)}%</span>${bar(progressOf(c), 'bar-thin bar-acc')}</a>`)
            .join('');
          return `<div class="paper-prog"><div class="pp-head"><span>${esc(p.name)}</span><b>${progressOf(p)}%</b></div>${bar(progressOf(p), 'bar-acc')}
            <details class="ch-details"><summary>${plural(p.chapters.length, p.unitLabel)}${icon('down')}</summary><div class="ch-rows">${rows}</div></details></div>`;
        })
        .join('');
      return `<section class="card subj-prog acc-${esc(s.accent)} rise" style="--i:${6 + si}">
          <div class="sp-head"><span class="s-icon">${icon(s.id)}</span><h3>${esc(s.name)}</h3>${ring(progressOf(s), { size: 44 })}</div>
          ${papers}
        </section>`;
    })
    .join('');

  return {
    nav: 'progress',
    title: 'Progress',
    html: `<header class="page-title rise"><h1>Progress</h1><p class="muted">Tracked on this device from your completed content.</p></header>
      ${overview}${activity}<div class="block-head block"><h2>By subject</h2></div><div class="stack">${subjects}</div>`,
  };
}

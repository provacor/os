// Home: personal dashboard + subject cards. Every number shown is real.

import { icon } from '../icons.js?v=202610071239';
import { esc, ring, subjectCard, subjectGlyph, sectionHue, chapterEyebrow } from '../components.js?v=202610071239';
import { todayStats, streak, recentVisits } from '../activity.js?v=202610071239';
import { progressOf } from '../progress.js?v=202610071239';
import { continueTarget, subjectContinue, totals, greeting } from './shared.js?v=202610071239';

export function homeView(model) {
  const t = totals(model);
  const cont = continueTarget(model);
  const today = todayStats();
  const days = streak();

  const stats = [
    [`${t.chaptersStarted}<small>/${t.chapters}</small>`, 'chapters started'],
    [`${t.doneItems}<small>/${t.items}</small>`, 'items completed'],
    today.chaptersOpened || today.itemsDone ? [`${today.chaptersOpened}`, today.chaptersOpened === 1 ? 'chapter today' : 'chapters today'] : null,
    days ? [`${days}`, days === 1 ? 'day streak' : 'day streak'] : null,
  ].filter(Boolean);

  const hero = `<section class="hero rise">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-top">
        <div>
          <p class="eyebrow">${greeting()} 👋</p>
          <h1>Continue your HSC preparation</h1>
        </div>
        ${ring(t.overall, { size: 64, stroke: 5, cls: 'hero-ring' })}
      </div>
      ${cont ? `<a class="hero-cta tap" href="${cont.href}">
          <span class="cta-icon">${icon('play')}</span>
          <span class="cta-text"><span class="cta-label">${cont.resume ? 'Continue studying' : 'Start studying'}</span><span class="cta-title">${esc(cont.title)}</span><span class="cta-sub">${esc(cont.sub)}</span></span>
          ${icon('arrow', 'cta-arrow')}
        </a>` : ''}
      <dl class="hero-stats">${stats.map(([v, l]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </section>`;

  // Recently opened chapters (real history), max 3 besides the main continue target.
  const recents = recentVisits()
    .map((r) => model.byId.get(r.chapterId))
    .filter((c) => c?.level === 'chapter')
    .slice(0, 4);
  const recentHtml = recents.length > 1
    ? `<section class="block"><div class="block-head"><h2>Recently opened</h2></div>
        <div class="h-scroll">${recents
          .map((c, i) => `<a class="mini-card acc-${esc(c.subject.accent)} rise tap" style="--i:${i}" href="#/c/${esc(c.id)}">
              <span class="mini-top"><span class="s-icon sm">${subjectGlyph(c.subject)}</span><span class="muted">${esc(c.subject.name)}</span></span>
              <span class="mini-title">${esc(c.name)}</span>
              <span class="mini-meta">${esc(c.paper.name)} · ${chapterEyebrow(c)} · ${progressOf(c)}%</span>
            </a>`)
          .join('')}</div></section>`
    : '';

  const subjects = `<section class="block"><div class="block-head"><h2>Subjects</h2><a class="link" href="#/study">Curriculum map ${icon('chevron')}</a></div>
      <div class="subject-grid">${model.subjects.map((s, i) => subjectCard(s, { cont: subjectContinue(model, s), i: i + 1 })).join('')}</div></section>`;

  // Content that actually exists in the library.
  const library = model.sections.filter((s) => s.items.length);
  const libHtml = library.length
    ? `<section class="block"><div class="block-head"><h2>In your library</h2><span class="muted small">${library.reduce((n, s) => n + s.items.length, 0)} items</span></div>
        <div class="list-card">${library
          .map((s, i) => `<a class="lib-row rise" style="--i:${i}" href="#/x/${esc(s.id)}">
              <span class="sec-icon hue-${sectionHue(s.type)}">${icon(s.type)}</span>
              <span class="lib-body"><span class="lib-title">${esc(s.chapter.name)} · ${esc(s.label)}</span><span class="lib-meta">${esc(s.subject.name)} · ${esc(s.paper.name)} · ${esc(chapterEyebrow(s.chapter))}</span></span>
              <span class="lib-pct">${progressOf(s)}%</span>
            </a>`)
          .join('')}</div></section>`
    : '';

  const tools = [
    ['#/focus', 'play', 'Focus mode', 'মনোযোগ দিয়ে পড়া', 'teal'],
    ['#/planner', 'target', 'পরীক্ষার প্ল্যান', 'দিন ধরে পড়া সাজাও', 'violet'],
    ['#/mistakes', 'warn', 'ভুলের খাতা', 'Mistake Book', 'rose'],
    ['#/graph', 'map', 'ধারণার মানচিত্র', 'Knowledge map', 'blue'],
    ['#/ai', 'sparkle', 'AI শিক্ষক', 'ছবি তুলে প্রশ্ন', 'amber'],
    ['#/backup', 'key', 'ব্যাকআপ', 'এনক্রিপ্টেড', 'green'],
  ];
  const toolsHtml = `<section class="block"><div class="block-head"><h2>Tools</h2></div>
      <div class="tools">${tools.map(([href, ic, t, d, hue], i) => `<a class="tool hue-${hue} rise" style="--i:${i}" href="${href}"><span class="tool-ic">${icon(ic)}</span><b>${t}</b><small>${d}</small></a>`).join('')}</div></section>`;
  return { nav: 'home', title: 'Provacor', html: hero + toolsHtml + recentHtml + subjects + libHtml };
}

// Subject overview, chapter workspace and the curriculum map (Study tab).

import { icon } from '../icons.js?v=202610100150';
import { esc, plural, ring, bar, chapterCard, sectionCard, subjectGlyph, chapterEyebrow, chapterNo, pad2, emptyState } from '../components.js?v=202610100150';
import { progressOf } from '../progress.js?v=202610100150';
import { contentCount, chapterCount } from '../model.js?v=202610100150';
import { lastVisit } from './shared.js?v=202610100150';
import { videosBlock } from './videos.js?v=202610100150';
import { alarmsBlock } from './alarms.js?v=202610100150';
import { hasFullMapSync } from './mindmap.js?v=202610100150';
import { conceptsOfChapter } from '../concepts.js?v=202610100150';
import { tocCard } from './topic.js?v=202610100150';

const subjectCrumb = (s) => [s.name, `#/s/${s.id}`];

function fold(id, open, head, body) {
  return `<section class="fold ${open ? 'open' : ''}" id="${id}">
      <button class="fold-head" aria-expanded="${open}" data-fold>${head}${icon('down', 'fold-chev')}</button>
      <div class="fold-body"><div class="fold-inner">${body}</div></div>
    </section>`;
}

function paperChapters(paper) {
  if (!paper.chapters.length) {
    return emptyState({ iconName: 'layers', title: 'No chapters yet', text: 'This paper\'s chapter list has not been added from the syllabus.' });
  }
  const groups = paper.groups.length ? paper.groups : [{ id: null, name: null }];
  return groups
    .map((g) => {
      const list = paper.chapters.filter((c) => (g.id ? c.groupId === g.id : true));
      return `${g.name && paper.groups.length ? `<h3 class="group-label">${esc(g.name)}</h3>` : ''}
        <div class="chapter-list">${list.map((c, i) => chapterCard(c, i)).join('')}</div>`;
    })
    .join('');
}

// ---------- Subject ----------

export function subjectView(model, subject, openPaperId = null) {
  if (!subject || subject.level !== 'subject') return null;
  const pct = progressOf(subject);
  const total = chapterCount(subject);
  const unit = subject.id === 'english' ? 'Topic' : 'Chapter';
  const recent = lastVisit(model, (c) => c.subject === subject);
  const openId = openPaperId ?? recent?.chapter.paper.id ?? subject.papers[0]?.id;

  const hero = `<section class="page-hero acc-${esc(subject.accent)} pat-${esc(subject.id)} rise">
      <span class="s-icon lg">${subjectGlyph(subject)}</span>
      <div class="ph-text">
        <p class="eyebrow">HSC ${esc(subject.name)}</p>
        <h1>${esc(subject.name)}</h1>
        <p class="ph-meta">${plural(total, unit)} · ${plural(subject.papers.length, 'Paper')} · ${contentCount(subject)} content</p>
      </div>
      ${ring(pct, { size: 72, stroke: 6 })}
    </section>`;

  const papers = subject.papers
    .map((p) => {
      const pp = progressOf(p);
      const head = `<span class="fold-title"><span class="paper-no">${p.paperNo === 1 ? '১ম' : '২য়'}</span>
          <span><span class="ft-name">${esc(p.name)}${p.subtitle ? ` <span class="muted">· ${esc(p.subtitle)}</span>` : ''}</span>
          <span class="ft-meta">${plural(p.chapters.length, p.unitLabel)} · ${contentCount(p)} content · ${pp}%</span></span></span>`;
      return fold(`paper-${p.id}`, p.id === openId, head + bar(pp, 'bar-thin bar-acc fold-bar'), paperChapters(p));
    })
    .join('');

  return {
    nav: 'study',
    title: subject.name,
    back: '#/',
    crumbs: [subjectCrumb(subject)],
    accent: subject.accent,
    html: hero + `<div class="papers acc-${esc(subject.accent)}">${papers}</div>`,
    after: () => {
      if (openPaperId) document.getElementById(`paper-${openPaperId}`)?.scrollIntoView({ block: 'start' });
    },
  };
}

// ---------- Chapter workspace ----------

export function chapterView(model, ch) {
  if (!ch || ch.level !== 'chapter') return null;
  const pct = progressOf(ch);
  const ready = ch.sections.filter((s) => s.contentCount > 0);
  const rest = ch.sections.filter((s) => s.contentCount === 0 && !s.computed);
  const progressSec = ch.sections.find((s) => s.computed);
  const items = ch.sections.flatMap((s) => s.items);
  const doneItems = ready.reduce((n, s) => n + Math.round((progressOf(s) / 100) * s.items.length), 0);
  const topics = (ch.topics ?? []).map((t) => (typeof t === 'string' ? t : t.name));
  const siblings = ch.paper.chapters;
  const idx = siblings.indexOf(ch);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];

  const hero = `<section class="page-hero chapter-hero acc-${esc(ch.subject.accent)} pat-${esc(ch.subject.id)} rise">
      <div class="ph-text">
        <p class="eyebrow">${esc(ch.subject.name)} · ${esc(ch.paper.name)} · ${chapterEyebrow(ch)}</p>
        <h1 class="bn">${esc(ch.name)}</h1>
        <p class="ph-meta">${ready.length ? `${plural(ready.length, 'section')} ready · ${doneItems}/${items.length} items done` : 'No content added yet'}</p>
      </div>
      ${ring(pct, { size: 72, stroke: 6 })}
      ${ch.note ? `<p class="ph-note">${icon('info')} ${esc(ch.note)}</p>` : ''}
      ${topics.length ? `<div class="topic-row">${topics.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
    </section>`;

  const readyHtml = ready.length
    ? `<section class="block"><div class="block-head"><h2>Study now</h2></div>
        <div class="section-big">${ready.map((s, i) => sectionCard(s, { big: true, i })).join('')}</div></section>`
    : `<section class="block">${emptyState({ iconName: 'notes', title: 'Nothing to study here yet', text: 'Notes, MCQ and other material will appear here as soon as they are added to this chapter.' })}</section>`;

  const restHtml = rest.length
    ? fold('more-sections', !ready.length,
        `<span class="fold-title"><span><span class="ft-name">${ready.length ? 'Other sections' : 'All sections'}</span><span class="ft-meta">${plural(rest.length, 'section')} waiting for content</span></span></span>`,
        `<div class="section-grid">${rest.map((s, i) => sectionCard(s, { i })).join('')}</div>`)
    : '';

  const progressHtml = progressSec ? `<div class="block">${sectionCard(progressSec, { i: 0 })}</div>` : '';

  const pager = `<nav class="pager" aria-label="Chapter navigation">
      ${prev ? `<a class="tap" href="#/c/${esc(prev.id)}">${icon('back')}<span><small>Previous</small>${esc(prev.name)}</span></a>` : '<span></span>'}
      ${next ? `<a class="tap next" href="#/c/${esc(next.id)}"><span><small>Next</small>${esc(next.name)}</span>${icon('chevron')}</a>` : '<span></span>'}
    </nav>`;

  return {
    nav: 'study',
    title: chapterEyebrow(ch),
    back: `#/s/${ch.subject.id}`,
    crumbs: [subjectCrumb(ch.subject), [ch.paper.name, `#/p/${ch.paper.id}`], [chapterNo(ch) != null ? `Ch ${pad2(chapterNo(ch))}` : ch.name, `#/c/${ch.id}`]],
    accent: ch.subject.accent,
    visit: { chapterId: ch.id },
    html: hero + tocCard(ch) + readyHtml + mindmapCard(ch) + videosBlock(ch) + restHtml + progressHtml + pager,
  };
}

// Mind map entry, placed right after the chapter's notes.
function mindmapCard(ch) {
  const full = hasFullMapSync(ch.id);
  const n = conceptsOfChapter(ch.id).length;
  return `<section class="block"><a class="mm-card rise ${full ? 'full' : ''}" href="#/mm/${esc(ch.id)}">
      <span class="mm-card-art" aria-hidden="true"><svg viewBox="0 0 64 48" width="64" height="48"><path d="M14 24 C24 24 24 8 34 8 M14 24 C24 24 24 24 34 24 M14 24 C24 24 24 40 34 40 M44 8 C50 8 50 3 56 3 M44 8 C50 8 50 13 56 13" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="24" r="6" fill="currentColor"/><rect x="34" y="4" width="10" height="8" rx="3" fill="currentColor" opacity=".8"/><rect x="34" y="20" width="10" height="8" rx="3" fill="currentColor" opacity=".6"/><rect x="34" y="36" width="10" height="8" rx="3" fill="currentColor" opacity=".45"/></svg></span>
      <span class="mm-card-body"><b>মাইন্ড ম্যাপ</b>
        <small>${full ? 'নোট থেকে তৈরি · টপিক → উপটপিক → কী কী পড়তে হবে' : n ? 'খসড়া · নোট দিলে পুরো ম্যাপ তৈরি হবে' : 'নোট দিলে এই অধ্যায়ের ম্যাপ তৈরি হবে'}</small></span>
      ${full ? '<span class="ok-tag">পূর্ণ</span>' : '<span class="flag">খসড়া</span>'}${icon('chevron', 'cc-chev')}
    </a></section>`;
}

// ---------- Curriculum map ----------

export function studyMap(model) {
  const status = (c) => {
    const p = progressOf(c);
    return p === 100 ? 'done' : p > 0 ? 'started' : 'idle';
  };
  const subjects = model.subjects
    .map((s, si) => {
      const papers = s.papers
        .map((p) => {
          const groups = p.groups.length ? p.groups : [{ id: null, name: null }];
          const body = groups
            .map((g) => {
              const list = p.chapters.filter((c) => (g.id ? c.groupId === g.id : true));
              return `${g.name && p.groups.length ? `<li class="tree-group">${esc(g.name)}</li>` : ''}${list
                .map((c) => `<li><a class="tree-leaf st-${status(c)}" href="#/c/${esc(c.id)}">
                    <span class="leaf-dot"></span><span class="leaf-no">${chapterNo(c) != null ? pad2(chapterNo(c)) : '•'}</span>
                    <span class="leaf-name">${esc(c.name)}</span>
                    ${c.sections.some((x) => x.contentCount) ? `<span class="leaf-tag">${c.sections.filter((x) => x.contentCount).length} ready</span>` : ''}
                    ${c.verification === 'verified' ? '' : '<span class="flag">verify</span>'}
                  </a></li>`)
                .join('')}`;
            })
            .join('');
          return `<li class="tree-paper"><a class="tree-paper-head" href="#/p/${esc(p.id)}">${esc(p.name)}${p.subtitle ? ` <span class="muted">· ${esc(p.subtitle)}</span>` : ''}<span class="muted small">${p.chapters.length}</span></a><ul class="tree-leaves">${body}</ul></li>`;
        })
        .join('');
      const head = `<span class="fold-title"><span class="s-icon sm">${subjectGlyph(s)}</span><span><span class="ft-name">${esc(s.name)}</span>
          <span class="ft-meta">${plural(s.papers.length, 'paper')} · ${plural(chapterCount(s), s.id === 'english' ? 'topic' : 'chapter')} · ${progressOf(s)}%</span></span></span>`;
      return `<div class="acc-${esc(s.accent)} rise" style="--i:${si}">${fold(`map-${s.id}`, false, head, `<ul class="tree">${papers}</ul>`)}</div>`;
    })
    .join('');

  const legend = `<div class="legend"><span><i class="leaf-dot st-done"></i>Completed</span><span><i class="leaf-dot st-started"></i>In progress</span><span><i class="leaf-dot st-idle"></i>Not started</span></div>`;

  return {
    nav: 'study',
    title: 'Curriculum',
    html: `<div class="chip-row study-links rise"><a class="chip" href="#/graph">${icon('map')} ধারণার মানচিত্র</a><a class="chip" href="#/focus">${icon('play')} Focus mode</a><a class="chip" href="#/planner">${icon('target')} পরীক্ষার প্ল্যান</a></div>
      <header class="page-title rise"><p class="eyebrow">Study</p><h1>Curriculum map</h1>
        <p class="muted">${model.subjects.length} subjects · ${model.papers.length} papers · ${model.chapters.length} chapters & topics</p></header>
      ${legend}<div class="map">${subjects}</div>
      ${alarmsBlock()}`,
  };
}

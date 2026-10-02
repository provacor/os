// Helpers shared by several views: where "Continue" should go, real stats.

import { recentVisits } from '../activity.js?v=202610021219';
import { progressOf } from '../progress.js?v=202610021219';
import { chapterEyebrow } from '../components.js?v=202610021219';

// Most recent chapter (and section) the user actually opened that still exists.
export function lastVisit(model, filter = () => true) {
  for (const r of recentVisits()) {
    const ch = model.byId.get(r.chapterId);
    if (ch?.level === 'chapter' && filter(ch)) {
      const sec = r.sectionId ? model.byId.get(r.sectionId) : null;
      return { chapter: ch, section: sec?.level === 'section' ? sec : null, t: r.t };
    }
  }
  return null;
}

// Global "Continue studying" target: last visit, else first chapter that has content.
export function continueTarget(model) {
  const v = lastVisit(model);
  if (v) {
    return {
      href: v.section ? `#/x/${v.section.id}` : `#/c/${v.chapter.id}`,
      title: v.chapter.name,
      sub: `${v.chapter.subject.name} · ${v.chapter.paper.name} · ${chapterEyebrow(v.chapter)}${v.section ? ` · ${v.section.label}` : ''}`,
      resume: true,
    };
  }
  const withContent = model.chapters.find((c) => c.sections.some((s) => s.contentCount > 0));
  if (!withContent) return null;
  return {
    href: `#/c/${withContent.id}`,
    title: withContent.name,
    sub: `${withContent.subject.name} · ${withContent.paper.name} · ${chapterEyebrow(withContent)}`,
    resume: false,
  };
}

// Per-subject continue link: last chapter opened in that subject, else its first unfinished chapter.
export function subjectContinue(model, subject) {
  const v = lastVisit(model, (c) => c.subject === subject);
  if (v) return { href: `#/c/${v.chapter.id}`, label: 'Continue', title: `${chapterEyebrow(v.chapter)}: ${v.chapter.name}` };
  const first = subject.papers.flatMap((p) => p.chapters).find((c) => progressOf(c) < 100);
  if (!first) return null;
  return { href: `#/c/${first.id}`, label: 'Start', title: `${chapterEyebrow(first)}: ${first.name}` };
}

export function totals(model) {
  const items = model.sections.flatMap((s) => s.items);
  const doneItems = model.sections.reduce((n, s) => n + (s.items.length ? Math.round((progressOf(s) / 100) * s.items.length) : 0), 0);
  const chapterPct = model.chapters.map(progressOf);
  return {
    items: items.length,
    doneItems,
    chapters: model.chapters.length,
    chaptersStarted: chapterPct.filter((p) => p > 0).length,
    chaptersDone: chapterPct.filter((p) => p === 100).length,
    overall: chapterPct.length ? Math.round(chapterPct.reduce((a, b) => a + b, 0) / chapterPct.length) : 0,
  };
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Studying late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

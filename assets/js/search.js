// Global structure search over subjects, papers, chapters, topics and sections.
// Every query token must appear somewhere in the item's full path text,
// so "physics 1st notes" or "chemistry reaction" both work.

import { chapterTitle, pathOf } from './model.js?v=202610100204';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFC');
const RANK = { subject: 0, paper: 1, chapter: 2, topic: 3, section: 4, content: 5 };

export function buildIndex(model) {
  const items = [];
  const add = (node, level, title, extra = []) => {
    const path = pathOf(node);
    items.push({ node, level, title, path, hay: norm([...path, title, ...extra].join(' ')) });
  };

  model.subjects.forEach((s) => add(s, 'subject', s.name));
  model.papers.forEach((p) => add(p, 'paper', `${p.subject.name} ${p.name}`, [`${p.subject.name} ${p.paperNo === 1 ? '1st' : '2nd'}`]));
  model.chapters.forEach((c) => {
    const group = c.paper.groups.find((g) => g.id === c.groupId);
    add(c, 'chapter', chapterTitle(c), [group?.name, c.source?.wording, c.number != null ? `ch${c.number} chapter ${c.number}` : '']);
    (c.topics ?? []).forEach((t) => {
      const name = typeof t === 'string' ? t : t.name;
      items.push({ node: c, level: 'topic', title: name, path: pathOf(c), hay: norm([...pathOf(c), name].join(' ')) });
    });
  });
  model.sections.forEach((s) => {
    add(s, 'section', s.label, [s.type, s.screenTitle, ...s.contentKinds.map((k) => k.label)]);
    // Content items: searchable by their text fields, open their section.
    s.items.forEach((it) => {
      const kind = s.contentKinds.find((k) => k.id === it.kind)?.label;
      const text = [it.title, it.question, it.body, it.formula, it.stem, it.topic, ...(it.formulas ?? []), kind].filter(Boolean);
      items.push({ node: s, level: 'content', title: it.title ?? it.question ?? it.id, path: pathOf(s), hay: norm([...pathOf(s), s.label, ...text].join(' ')) });
    });
  });
  return items;
}

export function search(index, query, limit = 60) {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return index
    .filter((it) => tokens.every((t) => it.hay.includes(t)))
    .sort((a, b) => RANK[a.level] - RANK[b.level])
    .slice(0, limit);
}

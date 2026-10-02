// Pure data model: turns the raw JSON files into a linked tree
// Subject -> Paper -> Chapter -> Section. No DOM / browser APIs here,
// so tools/validate.mjs can import the exact same logic in Node.

export const DATA_FILES = {
  subjects: 'data/subjects.json',
  papers: 'data/papers.json',
  chapters: 'data/chapters.json',
  sectionTypes: 'data/section-types.json',
  templates: 'data/section-templates.json',
  exams: 'data/exams.json',
  content: 'content/index.json',
};

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

export function sectionId(chapterId, type) {
  return `${chapterId}_${type}`;
}

function resolveTemplate(templates, name) {
  const tpl = templates[name] ?? templates.default;
  return tpl.map((e) => (typeof e === 'string' ? { type: e } : e));
}

export function buildModel(raw) {
  const sectionTypes = raw.sectionTypes.sectionTypes;
  const templates = raw.templates.templates;
  const contentIndex = raw.content.sections ?? {};
  const exams = [...raw.exams.exams].sort(byOrder);
  const byId = new Map();

  const subjects = [...raw.subjects.subjects].sort(byOrder).map((s) => ({ ...s, level: 'subject', papers: [] }));
  subjects.forEach((s) => byId.set(s.id, s));

  const papers = [...raw.papers.papers]
    .sort((a, b) => a.paperNo - b.paperNo)
    .map((p) => {
      const subject = byId.get(p.subjectId);
      const paper = { ...p, level: 'paper', subject, chapters: [], groups: (p.groups ?? []).map((g) => ({ ...g })).sort(byOrder) };
      subject?.papers.push(paper);
      byId.set(paper.id, paper);
      return paper;
    });

  const chapters = [...raw.chapters.chapters]
    .sort((a, b) => (a.number ?? a.order ?? 0) - (b.number ?? b.order ?? 0))
    .map((c) => {
      const paper = byId.get(c.paperId);
      const subject = paper?.subject;
      const chapter = { ...c, level: 'chapter', paper, subject, sections: [] };
      const tplName = c.sectionTemplate ?? paper?.sectionTemplate ?? subject?.sectionTemplate ?? 'default';
      chapter.sections = resolveTemplate(templates, tplName).map((entry, i) => {
        const def = sectionTypes[entry.type] ?? {};
        const id = sectionId(chapter.id, entry.type);
        const reg = contentIndex[id];
        const section = {
          id,
          level: 'section',
          type: entry.type,
          order: i + 1,
          label: entry.label ?? def.label ?? entry.type,
          icon: def.icon ?? '•',
          screenTitle: entry.label ?? def.screenTitle ?? def.label,
          emptyText: def.emptyText ?? '',
          trackable: !!def.trackable,
          computed: !!def.computed,
          contentKinds: def.contentKinds ?? [],
          itemFields: def.itemFields ?? [],
          contentFile: reg?.file ?? null,
          contentCount: reg?.count ?? 0,
          chapter,
          paper,
          subject,
        };
        byId.set(id, section);
        return section;
      });
      paper?.chapters.push(chapter);
      byId.set(chapter.id, chapter);
      return chapter;
    });

  const sections = chapters.flatMap((c) => c.sections);
  return { subjects, papers, chapters, sections, exams, sectionTypes, templates, byId };
}

// ---- counting helpers (content, not progress) ----

export function contentCount(node) {
  switch (node.level) {
    case 'section': return node.contentCount;
    case 'chapter': return node.sections.reduce((n, s) => n + s.contentCount, 0);
    case 'paper': return node.chapters.reduce((n, c) => n + contentCount(c), 0);
    case 'subject': return node.papers.reduce((n, p) => n + contentCount(p), 0);
    default: return 0;
  }
}

export function chapterCount(node) {
  if (node.level === 'paper') return node.chapters.length;
  if (node.level === 'subject') return node.papers.reduce((n, p) => n + p.chapters.length, 0);
  return 0;
}

// Human path, e.g. "Physics › 1st Paper › Chapter 3 › Notes"
export function chapterTitle(ch) {
  const unit = ch.paper?.unitLabel ?? 'Chapter';
  return ch.number != null ? `${unit} ${ch.number}: ${ch.name}` : ch.name;
}

export function pathOf(node) {
  const parts = [];
  if (node.subject) parts.push(node.subject.name);
  if (node.level === 'subject') parts.push(node.name);
  if (node.paper) parts.push(node.paper.name);
  if (node.level === 'paper') parts.push(node.name);
  if (node.chapter) parts.push(chapterTitle(node.chapter));
  if (node.level === 'chapter') parts.push(chapterTitle(node));
  if (node.level === 'section') parts.push(node.label);
  return parts;
}

// Concept map: what each chapter is about (with Bangla/English aliases) and which concepts
// must be understood first. Powers the universal search and the knowledge graph.

let concepts = [];
let byId = new Map();

export function setConcepts(list) {
  concepts = list ?? [];
  byId = new Map(concepts.map((c) => [c.id, c]));
  for (const c of concepts) c.hay = norm([c.bn, c.en, c.id, ...(c.aliases ?? [])].join(' | '));
  for (const c of concepts) c.next = concepts.filter((d) => d.prereqs.includes(c.id)).map((d) => d.id);
}
export const allConcepts = () => concepts;
export const conceptById = (id) => byId.get(id);
export const conceptsOfChapter = (chapterId) => concepts.filter((c) => c.chapters.includes(chapterId));

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFC').replace(/[’'`´]/g, '').replace(/[-_/]/g, ' ');

// Filler words of a natural question: "যে chapter-এ Snell's law আছে", "where is lens maker formula"
const FILLER = new Set(['যে', 'যেই', 'কোন', 'কোনো', 'কোথায়', 'কোথাও', 'আছে', 'রয়েছে', 'অধ্যায়', 'অধ্যায়ে', 'অধ্যায়ের', 'chapter', 'chapterএ', 'chapter-এ', 'এ', 'এর', 'টা', 'টি', 'সম্পর্কে', 'বিষয়ে', 'দেখাও', 'খোঁজো', 'খুঁজো', 'পড়তে', 'চাই', 'কি', 'কী', 'which', 'where', 'is', 'the', 'in', 'of', 'about', 'find', 'show', 'me', 'chapters', 'topic', 'law?', 'সূত্রটা']);

export function cleanQuery(q) {
  return norm(q)
    .replace(/chapter\s*[-‐]?\s*এ/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !FILLER.has(t))
    .join(' ')
    .trim();
}

// Concepts matching a query, best first.
export function matchConcepts(query, limit = 3) {
  const q = cleanQuery(query);
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/);
  const scored = [];
  for (const c of concepts) {
    let score = 0;
    const names = [c.bn, c.en, ...(c.aliases ?? [])].map(norm);
    if (q.length <= 3) {
      // very short queries (pH, ac, emf) must match a whole word
      if (names.some((n) => n === q || n.split(/\s+/).includes(q))) score = 100;
      if (score) scored.push([score, c]);
      continue;
    }
    if (names.some((n) => n === q)) score = 100;
    else if (names.some((n) => n.includes(q))) score = 60;
    else if (names.some((n) => q.includes(n) && n.length >= 3)) score = 45;
    else if (tokens.every((t) => c.hay.includes(t))) score = 30;
    else {
      const hit = tokens.filter((t) => t.length >= 3 && c.hay.includes(t)).length;
      if (hit && hit >= Math.ceil(tokens.length / 2)) score = 10 + hit;
    }
    if (score) scored.push([score, c]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const best = scored[0]?.[0] ?? 0;
  // keep only results about as good as the best one, so "snell's law" doesn't drag in every other "law"
  return scored.filter(([s]) => s >= best * 0.6).slice(0, limit).map(([, c]) => c);
}

// All concepts that must come before `id` (transitively), nearest first.
export function ancestors(id) {
  const out = [];
  const seen = new Set();
  const queue = [...(byId.get(id)?.prereqs ?? [])];
  while (queue.length) {
    const x = queue.shift();
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
    queue.push(...(byId.get(x)?.prereqs ?? []));
  }
  return out;
}
export function descendants(id) {
  const out = [];
  const seen = new Set();
  const queue = [...(byId.get(id)?.next ?? [])];
  while (queue.length) {
    const x = queue.shift();
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
    queue.push(...(byId.get(x)?.next ?? []));
  }
  return out;
}

// Longest prerequisite chain inside the same subject (for layering the graph).
export function depthOf(id, subject, memo = {}) {
  if (memo[id] != null) return memo[id];
  const c = byId.get(id);
  const inSubject = (c?.prereqs ?? []).filter((p) => byId.get(p)?.subject === subject);
  memo[id] = inSubject.length ? 1 + Math.max(...inSubject.map((p) => depthOf(p, subject, memo))) : 0;
  return memo[id];
}

// Structure integrity check. Run: node tools/validate.mjs
// Uses the same buildModel() as the app, so what passes here is what the UI shows.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DATA_FILES, buildModel } from '../assets/js/model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = Object.fromEntries(Object.entries(DATA_FILES).map(([k, f]) => [k, JSON.parse(readFileSync(join(root, f), 'utf8'))]));
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);

const ID = /^[a-z][a-z0-9_]*$/;
const seen = new Set();
const checkId = (id, what) => {
  if (!ID.test(id)) err(`${what} id "${id}" must be lowercase snake_case`);
  if (seen.has(id)) err(`duplicate id "${id}"`);
  seen.add(id);
};

const types = raw.sectionTypes.sectionTypes;
const templates = raw.templates.templates;

for (const [name, list] of Object.entries(templates)) {
  const t = list.map((e) => (typeof e === 'string' ? e : e.type));
  t.forEach((x) => types[x] || err(`template "${name}" uses unknown section type "${x}"`));
  if (new Set(t).size !== t.length) err(`template "${name}" repeats a section type`);
  for (const core of ['notes', 'mcq']) if (!t.includes(core)) err(`template "${name}" is missing core section "${core}"`);
  if (name !== 'english_grammar_topic') {
    for (const core of ['cq', 'formula', 'concept', 'simulation', 'mistakes', 'revision', 'progress']) {
      if (!t.includes(core)) err(`template "${name}" is missing core section "${core}"`);
    }
  }
}

const subjectIds = new Set();
for (const s of raw.subjects.subjects) {
  checkId(s.id, 'subject');
  subjectIds.add(s.id);
  if (!templates[s.sectionTemplate]) err(`subject ${s.id}: unknown sectionTemplate "${s.sectionTemplate}"`);
}

const paperIds = new Map();
for (const p of raw.papers.papers) {
  checkId(p.id, 'paper');
  if (!subjectIds.has(p.subjectId)) err(`paper ${p.id}: unknown subject ${p.subjectId}`);
  const expect = `${p.subjectId}_${p.paperNo === 1 ? '1st' : '2nd'}`;
  if (p.id !== expect) err(`paper ${p.id}: id should be "${expect}"`);
  paperIds.set(p.id, p);
}
if ([...paperIds.keys()].includes('english_1st')) err('English 1st Paper must not exist');

const names = new Map();
for (const c of raw.chapters.chapters) {
  checkId(c.id, 'chapter');
  const p = paperIds.get(c.paperId);
  if (!p) { err(`chapter ${c.id}: unknown paper ${c.paperId}`); continue; }
  if (!c.id.startsWith(`${c.paperId}_`)) err(`chapter ${c.id}: id must start with "${c.paperId}_"`);
  if (c.number != null && c.id !== `${c.paperId}_ch${String(c.number).padStart(2, '0')}`) {
    err(`chapter ${c.id}: numbered chapter id should be ${c.paperId}_ch${String(c.number).padStart(2, '0')}`);
  }
  if (c.groupId && !p.groups?.some((g) => g.id === c.groupId)) err(`chapter ${c.id}: unknown group ${c.groupId}`);
  if ('exams' in c) err(`chapter ${c.id}: exam groupings are not part of the structure, remove "exams"`);
  const key = `${c.paperId}|${String(c.name).trim().toLowerCase()}`;
  if (names.has(key)) err(`chapter ${c.id}: duplicate of ${names.get(key)} (same name in the same paper)`);
  names.set(key, c.id);
  if (!['verified', 'needs_verification'].includes(c.verification)) err(`chapter ${c.id}: verification must be verified|needs_verification`);
  if (c.verification === 'verified' && !c.source?.wording) err(`chapter ${c.id}: verified chapters need source.wording`);
  if (c.verification !== 'verified') warnings.push(`${c.id} needs verification`);
}

const model = buildModel(raw);
model.sections.forEach((s) => checkId(s.id, 'section'));
for (const [id, reg] of Object.entries(raw.content.sections ?? {})) {
  const sec = model.byId.get(id);
  if (!sec || sec.level !== 'section') { err(`content/index.json: "${id}" is not a known section id`); continue; }
  if (!existsSync(join(root, reg.file))) { err(`content/index.json: ${id} file ${reg.file} is missing`); continue; }
  const data = JSON.parse(readFileSync(join(root, reg.file), 'utf8'));
  if (data.sectionId !== id) err(`${reg.file}: sectionId "${data.sectionId}" should be "${id}"`);
  if ((data.items ?? []).length !== reg.count) err(`content/index.json: ${id} count ${reg.count} but file has ${(data.items ?? []).length} items`);
  const kinds = new Set(sec.contentKinds.map((k) => k.id));
  for (const it of data.items ?? []) {
    if (!/^.+_\d{4}$/.test(it.id) || !it.id.startsWith(`${id}_`)) err(`${reg.file}: item id "${it.id}" should be ${id}_NNNN`);
    checkId(it.id, 'content item');
    if (it.kind != null && !kinds.has(it.kind)) err(`${reg.file}: item ${it.id} has unknown kind "${it.kind}"`);
    if (it.file && !existsSync(join(root, it.file))) err(`${reg.file}: item ${it.id} file ${it.file} is missing`);
  }
}
// Mind maps built from notes: known chapters, files present, every node has text.
const mmIndex = join(root, 'content/mindmaps/index.json');
if (existsSync(mmIndex)) {
  for (const [chId, file] of Object.entries(JSON.parse(readFileSync(mmIndex, 'utf8')).maps ?? {})) {
    if (model.byId.get(chId)?.level !== 'chapter') err(`mindmaps: unknown chapter ${chId}`);
    if (!existsSync(join(root, file))) { err(`mindmaps: ${file} is missing`); continue; }
    const mm = JSON.parse(readFileSync(join(root, file), 'utf8'));
    if (mm.chapterId !== chId) err(`${file}: chapterId should be ${chId}`);
    const ids = new Set();
    const check = (n) => {
      if (!n?.text) err(`${file}: a node has no text`);
      if (ids.has(n.id)) err(`${file}: duplicate node id ${n.id}`);
      ids.add(n.id);
      (n.children ?? []).forEach(check);
    };
    check(mm.root);
  }
}

// Concept map (universal search + knowledge graph): known chapters/subjects, known prereqs, no cycles.
const conceptsPath = join(root, 'data/concepts.json');
if (existsSync(conceptsPath)) {
  const cs = JSON.parse(readFileSync(conceptsPath, 'utf8')).concepts ?? [];
  const byId = new Map();
  for (const c of cs) {
    if (byId.has(c.id)) err(`concepts: duplicate id ${c.id}`);
    byId.set(c.id, c);
    if (!model.byId.get(c.subject)) err(`concepts: ${c.id} has unknown subject ${c.subject}`);
    for (const ch of c.chapters ?? []) if (model.byId.get(ch)?.level !== 'chapter') err(`concepts: ${c.id} points to unknown chapter ${ch}`);
  }
  const state = {};
  const visit = (id, trail) => {
    if (state[id] === 1) { err(`concepts: prerequisite cycle ${[...trail, id].join(' > ')}`); return; }
    if (state[id] === 2) return;
    state[id] = 1;
    for (const p of byId.get(id)?.prereqs ?? []) {
      if (!byId.has(p)) err(`concepts: ${id} has unknown prereq ${p}`);
      else visit(p, [...trail, id]);
    }
    state[id] = 2;
  };
  cs.forEach((c) => visit(c.id, []));
}
// Topic-wise contents: every item of a chapter sits under a topic (or chapter-wide), and every id is real.
const tocPath = join(root, 'content/toc.json');
if (existsSync(tocPath)) {
  const toc = JSON.parse(readFileSync(tocPath, 'utf8')).chapters ?? {};
  for (const [cid, t] of Object.entries(toc)) {
    const ch = model.byId.get(cid);
    if (ch?.level !== 'chapter') { err(`toc: unknown chapter ${cid}`); continue; }
    const ids = new Set(Object.entries(raw.content.sections ?? {})
      .filter(([sid]) => sid.startsWith(`${cid}_`) && model.byId.get(sid)?.chapter === ch)
      .flatMap(([, reg]) => JSON.parse(readFileSync(join(root, reg.file), 'utf8')).items.map((it) => it.id)));
    const placed = new Set([...t.general, ...t.topics.flatMap((tp) => tp.items)]);
    for (const id of placed) if (!ids.has(id)) err(`toc: ${cid} lists unknown item ${id}`);
    const missing = [...ids].filter((id) => !placed.has(id));
    if (missing.length) err(`toc: ${cid} has ${missing.length} item(s) under no topic (run node tools/build-toc.mjs), e.g. ${missing[0]}`);
  }
}
// Offline: the service worker's install list must name every script the app loads.
{
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const ver = readFileSync(join(root, 'index.html'), 'utf8').match(/app\.js\?v=([\w-]+)/)?.[1];
  const walkJs = (d) => readdirSync(join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkJs(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));
  const stale = walkJs('assets/js').filter((f) => !sw.includes(`'${f}?v=${ver}'`));
  if (stale.length) err(`sw.js SHELL is out of date (run node tools/bump-version.mjs), e.g. ${stale[0]}`);
}
model.papers.filter((p) => !p.chapters.length).forEach((p) => warnings.push(`${p.id} has no chapters yet (awaiting syllabus source)`));

console.log(`subjects ${model.subjects.length} · papers ${model.papers.length} · chapters ${model.chapters.length} · sections ${model.sections.length}`);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  - ${warnings.join('\n  - ')}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log('\nOK: structure is valid.');

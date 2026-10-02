// Structure integrity check. Run: node tools/validate.mjs
// Uses the same buildModel() as the app, so what passes here is what the UI shows.
import { readFileSync } from 'node:fs';
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
const examIds = new Set(raw.exams.exams.map((e) => e.id));

for (const [name, list] of Object.entries(templates)) {
  const t = list.map((e) => (typeof e === 'string' ? e : e.type));
  t.forEach((x) => types[x] || err(`template "${name}" uses unknown section type "${x}"`));
  if (new Set(t).size !== t.length) err(`template "${name}" repeats a section type`);
  for (const core of ['notes', 'mcq']) if (!t.includes(core)) err(`template "${name}" is missing core section "${core}"`);
  if (name !== 'english_grammar_unit' && !t.includes('cq')) err(`template "${name}" is missing core section "cq"`);
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

for (const c of raw.chapters.chapters) {
  checkId(c.id, 'chapter');
  const p = paperIds.get(c.paperId);
  if (!p) { err(`chapter ${c.id}: unknown paper ${c.paperId}`); continue; }
  if (!c.id.startsWith(`${c.paperId}_`)) err(`chapter ${c.id}: id must start with "${c.paperId}_"`);
  if (c.number != null && c.id !== `${c.paperId}_ch${String(c.number).padStart(2, '0')}`) {
    err(`chapter ${c.id}: numbered chapter id should be ${c.paperId}_ch${String(c.number).padStart(2, '0')}`);
  }
  if (c.groupId && !p.groups?.some((g) => g.id === c.groupId)) err(`chapter ${c.id}: unknown group ${c.groupId}`);
  for (const k of Object.keys(c.exams ?? {})) if (!examIds.has(k)) err(`chapter ${c.id}: unknown exam key ${k}`);
  if (!['verified', 'needs_verification'].includes(c.verification)) err(`chapter ${c.id}: verification must be verified|needs_verification`);
  if (c.verification === 'verified' && !(c.source?.image && c.source?.wording)) err(`chapter ${c.id}: verified chapters need source.image and source.wording`);
  if (c.verification !== 'verified') warnings.push(`${c.id} needs verification`);
}

const model = buildModel(raw);
model.sections.forEach((s) => checkId(s.id, 'section'));
for (const id of Object.keys(raw.content.sections ?? {})) {
  if (!model.byId.get(id) || model.byId.get(id).level !== 'section') err(`content/index.json: "${id}" is not a known section id`);
}
model.papers.filter((p) => !p.chapters.length).forEach((p) => warnings.push(`${p.id} has no chapters yet (awaiting syllabus source)`));

console.log(`subjects ${model.subjects.length} · papers ${model.papers.length} · chapters ${model.chapters.length} · sections ${model.sections.length}`);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  - ${warnings.join('\n  - ')}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log('\nOK: structure is valid.');

// Game Zone data: turns whatever a chapter has into game questions, automatically.
// Nothing is made up — every question, answer and wrong option is text that already exists in
// the chapter (its content sections or its mind map); wrong options are other answers of the
// same kind from the same topic/chapter. New chapters get games as soon as their content lands.
//
//   MCQ                         → the MCQ itself
//   ক / CQ-ক (question+answer)  → "এক কথায় প্রকাশ" (definition → term) and question → answer
//   খ / CQ-খ / long answers     → recall cards (think, reveal, self-check)
//   concept (title+body)        → "which concept is this?" + recall
//   formula (formulas+symbols)  → symbol → meaning, quantity → unit, formula → topic
//   reaction / conversion       → reactants → product, equation → name, conversion → steps
//   identification             → test → what it identifies, and the reverse
//   grammar rules / examples    → "which rule is this?" + recall
//   grammar practice / board    → question → answer (the gap's word, the changed sentence…)
//   mistakes ("ভুল:/সঠিক:")     → which statement is right
//   graph / diagram (figure)    → which figure is this?
//   anything with ≥2 steps      → put the steps in order
//   mind map                    → hint → topic, node → branch, recall

import { isMcq, rightIndex } from './learn.js?v=202610150356';
import { tocOf } from './views/topic.js?v=202610150356';

export const SOURCES = [
  { id: 'mcq', emoji: '📝', name: 'MCQ' },
  { id: 'term', emoji: '🔤', name: 'এক কথায় প্রকাশ' },
  { id: 'qa', emoji: '❓', name: 'জ্ঞানমূলক প্রশ্ন' },
  { id: 'formula', emoji: '🧮', name: 'সূত্র ও প্রতীক' },
  { id: 'reaction', emoji: '⚗️', name: 'বিক্রিয়া ও রূপান্তর' },
  { id: 'ident', emoji: '🔬', name: 'শনাক্তকরণ' },
  { id: 'concept', emoji: '💡', name: 'ধারণা চেনো' },
  { id: 'drill', emoji: '✍️', name: 'অনুশীলন ও বোর্ড প্রশ্ন' },
  { id: 'rule', emoji: '📏', name: 'Rule চেনো' },
  { id: 'fix', emoji: '✔️', name: 'ভুল না শুদ্ধ' },
  { id: 'figure', emoji: '🖼️', name: 'চিত্র চেনো' },
  { id: 'map', emoji: '🗺️', name: 'মাইন্ড ম্যাপ' },
];
export const sourceMeta = (id) => SOURCES.find((s) => s.id === id) ?? { id: 'all', emoji: '🎲', name: 'সব মিলিয়ে' };

let model = null;
export function initGameData(m) { model = m; cache.clear(); }

// ---------- mind maps (loaded once at start-up) ----------
const maps = new Map();
export async function loadGameMaps() {
  try {
    const r = await fetch('content/mindmaps/index.json', { cache: 'no-cache' });
    const idx = r.ok ? (await r.json()).maps ?? {} : {};
    await Promise.all(Object.entries(idx).map(async ([ch, file]) => {
      try {
        const res = await fetch(file, { cache: 'no-cache' });
        if (res.ok) maps.set(ch, (await res.json()).root);
      } catch { /* that chapter plays without its map */ }
    }));
  } catch { /* offline with nothing cached: games from content only */ }
  cache.clear();
}

// ---------- text helpers ----------
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s"'“”‘’`.,;:!?？।()[\]{}—–-]+/g, '');
const clean = (s) => String(s ?? '').replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, '').trim();
const TERM_RE = /^(.+?)\s*(?:কাকে\s*বলে|বলতে\s*কী\s*বোঝ(?:ায়|ো)?|কী\s*বোঝায়|কী\s*বুঝ(?:ায়)?|কী|কি)\s*[?？।]?\s*$/;
const BLANK = '＿＿＿';
const coreTerm = (s) => (TERM_RE.exec(String(s).trim())?.[1] ?? String(s)).replace(/[?？]\s*$/, '').trim();
// Hide the answer inside the clue: the whole term, without brackets, and its last two words
// (so "আলোর বিচ্ছুরণ ক্ষমতা" also hides "বিচ্ছুরণ ক্ষমতা").
function mask(text, term) {
  let out = String(text);
  const plain = coreTerm(term).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const words = plain.split(/\s+/);
  const parts = [term, coreTerm(term), plain, words.length >= 3 ? words.slice(-2).join(' ') : ''].filter((p, i, a) => p.length >= 2 && a.indexOf(p) === i);
  for (const p of parts.sort((a, b) => b.length - a.length)) out = out.split(p).join(BLANK);
  return out;
}
function excerpt(body, n = 240) {
  const s = String(body).trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const at = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('।'));
  return (at > n * 0.5 ? cut.slice(0, at + 1) : cut).trim() + ' …';
}
const stripNo = (s) => String(s).replace(/^\s*(?:[ivx]+|\d+|[০-৯]+)[.)]\s+/i, '').trim();
const line = (body, label) => (String(body).match(new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, 'm'))?.[1] ?? '').trim();
// Summaries ("এক নজরে", Bird's Eye View…) repeat the other parts, so "which part is this?" would be ambiguous.
const SUMMARY = /এক\s*নজরে|master\s*map|bird'?s\s*eye|সারসংক্ষেপ|সারকথা|এক\s*পাতায়/i;
const tokens = (s) => new Set(String(s).toLowerCase().match(/[a-z°Ωμ]+|[ঀ-৿]{2,}/g) ?? []);

// Two answers must not both be right: no near-identical names, no units that share a word.
export function compatible(kind, answer, cand) {
  const a = norm(answer), c = norm(cand);
  if (!c || a === c) return false;
  if (a.length <= 40 && c.length <= 40 && (a.includes(c) || c.includes(a))) return false;
  if (kind === 'unit') { const t = tokens(answer); for (const x of tokens(cand)) if (t.has(x)) return false; }
  return true;
}

// ---------- building one chapter ----------
const cache = new Map();
const ORDER = ['mcq', 'ka', 'kha', 'cq']; // ক/খ before CQ parts, so duplicates keep their own topic

function build(chId) {
  if (cache.has(chId)) return cache.get(chId);
  const ch = model?.byId.get(chId);
  const out = { specs: [], recall: [], orders: [], topics: [], fromMap: false };
  if (ch?.level !== 'chapter') { cache.set(chId, out); return out; }

  const toc = tocOf(chId);
  const topicOf = new Map();
  for (const tp of toc?.topics ?? []) for (const id of tp.items) topicOf.set(id, tp.id);
  const seenQ = new Set(), seenRecall = new Set();
  const add = (spec, item) => out.specs.push({ ...spec, ch: chId, topic: topicOf.get(item) });
  const addRecall = (id, item, front, back) => {
    const k = norm(front);
    if (!front || !back || seenRecall.has(k)) return;
    seenRecall.add(k);
    out.recall.push({ id: `${id}~rc`, ch: chId, front, back: String(back), topic: topicOf.get(item) });
  };
  // src 'qa' = ক/খ-type questions; 'drill' = grammar practice and board questions (gap-filling,
  // changing sentences…), whose wrong options are other answers of the same section kind
  const addQA = (id, item, q, a, src = 'qa') => {
    const k = norm(q);
    if (!q || !a || seenQ.has(k)) return;
    seenQ.add(k);
    const ans = String(a).trim();
    if (ans.length <= 260) add({ id: `${id}~qa`, src, q, a: ans, kind: src }, item);
    else addRecall(id, item, q, ans);
    if (src !== 'qa') return;
    const m = TERM_RE.exec(String(q).trim());
    const term = m?.[1]?.trim();
    if (term && term.length >= 2 && term.length <= 45 && !/[?？]|নিচের/.test(term) && ans.length <= 420) {
      add({ id: `${id}~term`, src: 'term', q: `এক কথায় কী?\n${mask(ans, term)}`, a: term, kind: 'term', exp: `${q}\n${ans}` }, item);
    }
  };
  const addOrder = (it) => {
    const steps = (it.steps ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (steps.length >= 2 && steps.length <= 9) out.orders.push({ id: `${it.id}~or`, ch: chId, title: it.title ?? '', steps, result: it.result ?? '', topic: topicOf.get(it.id) });
  };

  const secs = [...ch.sections].sort((x, y) => (ORDER.indexOf(x.type) + 1 || 99) - (ORDER.indexOf(y.type) + 1 || 99));
  for (const sec of secs) {
    if (sec.computed || ['notes', 'simulation', 'revision', 'numerical', 'progress'].includes(sec.type)) continue;
    for (const it of sec.items) {
      if (sec.type === 'mcq' || isMcq(it)) {
        const r = rightIndex(it);
        if (isMcq(it) && r >= 0 && it.options.length >= 2) add({ id: it.id, src: 'mcq', q: it.question, opts: it.options.map(String), right: r, exp: it.explanation ?? '' }, it.id);
        continue;
      }
      if (sec.type === 'kha' && it.question && it.answer) { addRecall(it.id, it.id, it.question, it.answer); continue; }
      if ((sec.type === 'practice' || sec.type === 'board') && it.question && it.answer) { addQA(it.id, it.id, it.question, it.answer, 'drill'); continue; }
      if (it.question && it.answer) { addQA(it.id, it.id, it.question, it.answer); continue; }
      if (Array.isArray(it.parts)) {
        it.parts.forEach((p, k) => {
          if (!p?.q || !p?.a) return;
          if (p.label === 'ক') addQA(`${it.id}#${k}`, it.id, p.q, p.a);
          else if (p.label === 'খ') addRecall(`${it.id}#${k}`, it.id, p.q, p.a);
        });
        continue;
      }
      if (sec.type === 'mistakes' && it.body) {
        const wrong = clean(line(it.body, 'ভুল')), right = clean(line(it.body, 'সঠিক'));
        if (wrong && right && norm(wrong) !== norm(right)) add({ id: `${it.id}~mf`, src: 'fix', q: 'কোনটি সঠিক?', opts: [right, wrong], right: 0, exp: it.body }, it.id);
        continue;
      }
      if (sec.type === 'identification' && it.body) {
        const r = line(it.body, 'বিকারক/পরীক্ষা'), o = line(it.body, 'পর্যবেক্ষণ'), c = line(it.body, 'সিদ্ধান্ত');
        if (r && o && it.title) {
          add({ id: `${it.id}~iw`, src: 'ident', q: `বিকারক/পরীক্ষা: ${r}\nপর্যবেক্ষণ: ${o}\n— কী শনাক্ত হলো?`, a: it.title, kind: 'idt', exp: c }, it.id);
          add({ id: `${it.id}~it`, src: 'ident', q: `“${it.title}” শনাক্ত করার পরীক্ষা ও পর্যবেক্ষণ কোনটি?`, a: `${r} → ${o}`, kind: 'idr', exp: c }, it.id);
        }
        continue;
      }
      if (it.figure && it.title) {
        const figure = String(it.figure).replace(/\saria-label="[^"]*"/g, ' aria-label="চিত্র"').replace(/<title>[\s\S]*?<\/title>/g, '');
        add({ id: `${it.id}~fg`, src: 'figure', q: 'চিত্র/লেখচিত্রটি কিসের?', figure, a: it.title, kind: 'fig', exp: it.body ?? '' }, it.id);
        continue;
      }
      if (Array.isArray(it.formulas)) {
        const lines = it.formulas.map((f) => String(f).trim()).filter(Boolean);
        if (sec.type === 'reaction') {
          lines.forEach((f, j) => {
            const arrows = [...f.matchAll(/→|⇌/g)];
            if (arrows.length === 1) {
              const at = arrows[0].index, lhs = f.slice(0, at).trim(), rhs = f.slice(at + 1).trim();
              if (lhs && rhs) add({ id: `${it.id}~p${j}`, src: 'reaction', q: `${lhs} ${f[at]} ？\n— উৎপাদ কী?`, a: rhs, kind: 'rhs', exp: it.note ?? '' }, it.id);
            }
          });
          if (lines[0] && it.title) add({ id: `${it.id}~n`, src: 'reaction', q: `${lines[0]}\n— এটি কোন বিক্রিয়া?`, a: it.title, kind: 'rname', exp: it.note ?? '' }, it.id);
        } else {
          (it.symbols ?? []).forEach((row, j) => {
            const [sym, meaning, unit] = Array.isArray(row) ? row : [row?.symbol, row?.meaning, row?.unit];
            if (!sym || !meaning) return;
            add({ id: `${it.id}~s${j}`, src: 'formula', q: `“${it.title}” — ${sym} দিয়ে কী বোঝায়?`, a: String(meaning), kind: 'sym', exp: unit ? `একক: ${unit}` : '' }, it.id);
            if (unit && !/^[—–-]+$/.test(String(unit).trim())) add({ id: `${it.id}~u${j}`, src: 'formula', q: `${meaning} (${sym})-এর একক কী?`, a: String(unit), kind: 'unit' }, it.id);
          });
          if (it.title && !SUMMARY.test(it.title)) lines.forEach((f, j) => add({ id: `${it.id}~f${j}`, src: 'formula', q: `নিচের সূত্রটি কোন বিষয়ের?\n${stripNo(f)}`, a: it.title, kind: 'ftitle', exp: it.note ?? '' }, it.id));
        }
        continue;
      }
      if (Array.isArray(it.steps)) {
        addOrder(it);
        if (sec.type === 'conversion' && it.title) add({ id: `${it.id}~cv`, src: 'reaction', q: `${it.title}\n— রূপান্তরটি কীভাবে?`, a: it.steps.join('\n'), kind: 'conv', exp: it.result ?? '' }, it.id);
        continue;
      }
      if (it.title && it.body && !['mistakes', 'identification'].includes(sec.type)) {
        // grammar rules and their examples: "which rule is this?"
        const rule = sec.type === 'rules' || sec.type === 'examples';
        const ask = sec.type === 'examples' ? 'নিচের উদাহরণগুলো কোন Rule-এর?' : rule ? 'নিচের বর্ণনাটি কোন Rule-এর?' : 'নিচের বর্ণনাটি কোন বিষয়ের?';
        add({ id: `${it.id}~ct`, src: rule ? 'rule' : 'concept', q: `${ask}\n${excerpt(mask(it.body, it.title))}`, a: it.title, kind: rule ? 'rtitle' : 'ctitle', exp: excerpt(it.body, 400) }, it.id);
        addRecall(it.id, it.id, it.title, it.body);
      }
    }
  }

  // mind map: hints and branches
  const root = maps.get(chId);
  if (root?.children?.length) {
    const useBranches = !toc?.topics?.length; // a notes-only chapter: its map branches are the topics
    out.fromMap = useBranches;
    const count = new Map();
    const all = [];
    const walk = (n, parent, branch, depth, path) => {
      all.push({ n, parent, branch, depth, path });
      const k = norm(n.text);
      count.set(k, (count.get(k) ?? 0) + 1);
      (n.children ?? []).forEach((c, i) => walk(c, n, depth === 0 ? i : branch, depth + 1, `${path}.${i + 1}`));
    };
    walk(root, null, -1, 0, 'm');
    const branchKeys = root.children.map((b) => norm(String(b.text).split(/\s+[—–:-]\s+|[,(]/)[0]));
    const mentionsOther = (text, branch) => {
      const head = norm(String(text).split(/\s+[—–:-]\s+|[,(]|\s/)[0]);
      return branchKeys.some((k, i) => i !== branch && k && head === k);
    };
    root.children.forEach((b, i) => { if (useBranches) out.topics.push({ id: `m${i + 1}`, name: String(b.text) }); });
    for (const { n, parent, branch, depth, path } of all) {
      if (depth === 0) continue;
      const text = String(n.text ?? '').trim();
      const topic = useBranches ? `m${branch + 1}` : undefined;
      const id = `map:${chId}:${path}`;
      if (n.hint && text.length <= 70 && String(n.hint).length <= 320) {
        const where = depth > 1 ? `“${parent.text}” অংশে — ` : '';
        out.specs.push({ id: `${id}~h`, ch: chId, src: 'map', q: `${where}নিচের কথাটি কোন বিষয়ের?\n${mask(n.hint, text)}`, a: text, kind: depth > 1 ? `map${branch}` : 'mapb', exp: `${text}: ${n.hint}`, topic });
        out.recall.push({ id: `${id}~rc`, ch: chId, front: depth > 1 ? `${parent.text} › ${text}` : text, back: String(n.hint), topic });
      }
      if (depth >= 2 && text.length <= 70 && count.get(norm(text)) === 1 && !SUMMARY.test(root.children[branch].text) && !mentionsOther(text, branch)) {
        out.specs.push({ id: `${id}~b`, ch: chId, src: 'map', q: `“${text}” — এটি কোন অংশের?`, a: String(root.children[branch].text), kind: 'mapbranch', topic });
      }
    }
  }

  // a generated question needs at least one other answer of its kind to make a wrong option
  const kinds = new Map();
  for (const s of out.specs) if (!s.opts) { const set = kinds.get(s.kind) ?? new Map(); set.set(norm(s.a), s.a); kinds.set(s.kind, set); }
  out.specs = out.specs.filter((s) => s.opts || (kinds.get(s.kind)?.size ?? 0) >= 2);
  out.answers = new Map([...kinds].map(([k, m]) => [k, [...m.values()]]));
  if (!out.topics.length) out.topics = (toc?.topics ?? []).map((t) => ({ id: t.id, name: t.name }));
  cache.set(chId, out);
  return out;
}

// ---------- queries ----------
const inTopic = (tpId) => (x) => tpId === 'all' || x.topic === tpId;
export const topicsOf = (chId) => build(chId).topics.filter((t) => hasTopicGames(chId, t.id));
export const topicName = (chId, tpId) => (tpId === 'all' ? 'পুরো অধ্যায়' : build(chId).topics.find((t) => t.id === tpId)?.name ?? null);
export const questionsOf = (chId, tpId, src = 'all') => build(chId).specs.filter((s) => inTopic(tpId)(s) && (src === 'all' || s.src === src));
export const recallOf = (chId, tpId) => build(chId).recall.filter(inTopic(tpId));
export const ordersOf = (chId, tpId) => build(chId).orders.filter(inTopic(tpId));
export const answersOf = (chId, kind) => build(chId).answers?.get(kind) ?? [];
export function factIds(chId, tpId) {
  return [...questionsOf(chId, tpId), ...recallOf(chId, tpId), ...ordersOf(chId, tpId)].map((x) => x.id);
}
export function sourcesOf(chId, tpId) {
  const qs = questionsOf(chId, tpId);
  return SOURCES.map((s) => ({ ...s, count: qs.filter((q) => q.src === s.id).length })).filter((s) => s.count);
}
export function hasTopicGames(chId, tpId) {
  return questionsOf(chId, tpId).length + recallOf(chId, tpId).length + ordersOf(chId, tpId).length > 0;
}
export const hasGameData = (chId) => hasTopicGames(chId, 'all');
export const gameChapters = () => (model?.chapters ?? []).filter((ch) => hasGameData(ch.id));
export const chapterById = (id) => model?.byId.get(id) ?? null;
export const ansOf = (spec) => (spec.opts ? spec.opts[spec.right] : spec.a);

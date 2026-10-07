// Chapter mind map page (#/mm/<chapterId>): built from the chapter's notes when a map
// exists in content/mindmaps, otherwise an outline from the concept map.

import { icon } from '../icons.js?v=202610071239';
import { esc } from '../components.js?v=202610071239';
import { MindMap, leaves, walk } from '../mindmap.js?v=202610071239';
import { conceptsOfChapter } from '../concepts.js?v=202610071239';

const KEY = 'hscos:mindmap:v1';
const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const readDone = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const saveDone = (chapterId, set) => {
  const all = readDone();
  all[chapterId] = [...set];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* keep in memory */ }
};

let registry = null;
async function mapIndex() {
  if (registry) return registry;
  try {
    const r = await fetch('content/mindmaps/index.json', { cache: 'no-cache' });
    registry = r.ok ? (await r.json()).maps ?? {} : {};
  } catch {
    registry = {};
  }
  return registry;
}
export const hasFullMapSync = (chapterId) => !!registry?.[chapterId];
export { mapIndex };
export async function hasFullMap(chapterId) {
  return !!(await mapIndex())[chapterId];
}

// Outline for chapters whose notes haven't been added yet.
function draftTree(ch) {
  const topics = (ch.topics ?? []).map((t) => (typeof t === 'string' ? t : t.name));
  const cs = conceptsOfChapter(ch.id);
  const kids = [
    ...cs.map((c) => ({ text: c.bn, hint: c.en, children: (c.aliases ?? []).filter((a) => /[ঀ-৿]/.test(a) && a !== c.bn).slice(0, 6).map((a) => ({ text: a })) })),
    ...topics.filter((t) => !cs.some((c) => c.bn === t)).map((t) => ({ text: t })),
  ];
  const root = { text: ch.name, children: kids.length ? kids : [{ text: 'এই অধ্যায়ের নোট যোগ হলে মাইন্ড ম্যাপ তৈরি হবে' }] };
  let i = 0;
  walk(root, (n) => { n.id = `d${i++}`; });
  return root;
}

export const mmState = { outline: false };
let current = null;

export function mindmapView(model, chapterId) {
  const ch = model.byId.get(chapterId);
  if (ch?.level !== 'chapter') return null;
  return {
    nav: 'study',
    title: 'Mind map',
    back: `#/c/${ch.id}`,
    crumbs: [[ch.subject.name, `#/s/${ch.subject.id}`], [ch.name, `#/c/${ch.id}`], ['Mind map', `#/mm/${ch.id}`]],
    html: `<header class="mm-head rise">
        <div><p class="eyebrow">${icon('map')} Mind map · ${esc(ch.subject.name)} ${esc(ch.paper.name)}</p>
          <h1 class="bn">${esc(ch.name)}</h1>
          <p class="mm-meta" id="mmMeta">লোড হচ্ছে…</p></div>
        <div class="mm-ring" id="mmRing"></div>
      </header>
      <div class="mm-bar rise" role="toolbar" aria-label="মাইন্ড ম্যাপ নিয়ন্ত্রণ">
        <div class="seg seg-2 mm-mode"><button class="seg-btn ${mmState.outline ? '' : 'on'}" data-mm-mode="map">${icon('map')}<span>ম্যাপ</span></button><button class="seg-btn ${mmState.outline ? 'on' : ''}" data-mm-mode="outline">${icon('rules')}<span>তালিকা</span></button></div>
        <div class="mm-tools" ${mmState.outline ? 'hidden' : ''}>
          <button class="icon-btn" data-mm-act="out" aria-label="ছোট করো">−</button>
          <button class="icon-btn" data-mm-act="in" aria-label="বড় করো">+</button>
          <button class="icon-btn" data-mm-act="fit" aria-label="পুরোটা দেখাও">${icon('target')}</button>
          <button class="icon-btn" data-mm-act="open" aria-label="সব খোলো">${icon('layers')}</button>
          <button class="icon-btn" data-mm-act="full" aria-label="পুরো স্ক্রিন">${icon('expand')}</button>
        </div>
      </div>
      <div class="mm-stage rise" id="mmStage" ${mmState.outline ? 'hidden' : ''}><div class="mm-host" id="mmHost" tabindex="-1"></div>
        <p class="mm-help">${icon('info')} টেনে সরাও · দুই আঙুলে zoom · শাখায় চাপ দিলে খুলবে/বন্ধ হবে · শেষ টপিকে চাপ দিলে ✓ পড়া হয়েছে</p></div>
      <div class="mm-outline rise" id="mmOutline" ${mmState.outline ? '' : 'hidden'}></div>`,
    after: () => mount(model, ch),
  };
}

async function mount(model, ch) {
  const idx = await mapIndex();
  let root;
  let full = false;
  if (idx[ch.id]) {
    try {
      const r = await fetch(idx[ch.id], { cache: 'no-cache' });
      root = (await r.json()).root;
      full = true;
    } catch { /* fall back to the outline */ }
  }
  root ??= draftTree(ch);
  const host = document.getElementById('mmHost');
  if (!host) return;
  await document.fonts?.ready;
  const done = new Set(readDone()[ch.id] ?? []);
  const update = () => {
    const all = leaves(root).filter((n) => n !== root);
    const d = all.filter((n) => done.has(n.id)).length;
    const pct = all.length ? Math.round((d / all.length) * 100) : 0;
    const meta = document.getElementById('mmMeta');
    if (meta) meta.innerHTML = `${full ? `<span class="ok-tag">নোট থেকে তৈরি</span>` : `<span class="flag">খসড়া</span>`} ${bn(root.children?.length ?? 0)}টি মূল টপিক · ${bn(all.length)}টি পড়ার বিষয় · ${bn(d)}টি পড়া হয়েছে`;
    const ring = document.getElementById('mmRing');
    if (ring) ring.innerHTML = `<span class="ring" style="--size:56px" role="img" aria-label="${pct}% পড়া হয়েছে"><svg viewBox="0 0 56 56" width="56" height="56"><circle class="ring-bg" cx="28" cy="28" r="24" stroke-width="5"/><circle class="ring-fg" cx="28" cy="28" r="24" stroke-width="5" style="--c:150.8;--off:${(150.8 * (1 - pct / 100)).toFixed(1)}"/></svg><span class="ring-label">${pct}<small>%</small></span></span>`;
    renderOutline(root, done);
  };
  current = new MindMap(host, root, {
    done,
    compact: innerWidth < 420,
    onToggleDone: (set) => { saveDone(ch.id, set); update(); },
  });
  current.chapterId = ch.id;
  current.update = update;
  update();
}

function renderOutline(root, done) {
  const box = document.getElementById('mmOutline');
  if (!box) return;
  const item = (n, depth) => {
    const kids = n.children ?? [];
    if (!kids.length) {
      return `<li class="mo-leaf ${done.has(n.id) ? 'done' : ''}"><label><input type="checkbox" data-mo="${esc(n.id)}" ${done.has(n.id) ? 'checked' : ''}><span>${esc(n.text)}${n.hint ? `<code>${esc(n.hint)}</code>` : ''}</span></label></li>`;
    }
    const all = leaves(n);
    const d = all.filter((x) => done.has(x.id)).length;
    return `<li><details ${depth < 1 ? 'open' : ''}><summary><span>${esc(n.text)}${n.hint ? `<code>${esc(n.hint)}</code>` : ''}</span><small>${bn(d)}/${bn(all.length)}</small></summary><ul>${kids.map((c) => item(c, depth + 1)).join('')}</ul></details></li>`;
  };
  box.innerHTML = `<ul class="mo-root">${(root.children ?? []).map((c, i) => `<li class="mo-branch hue-${['blue', 'violet', 'teal', 'amber', 'rose', 'green', 'cyan', 'red'][i % 8]}">${item(c, 0).replace(/^<li>|<\/li>$/g, '')}</li>`).join('')}</ul>`;
}

// Toolbar / outline actions, called from the app's click handler.
export function mindmapAction(el) {
  const act = el.dataset.mmAct;
  const mode = el.dataset.mmMode;
  if (mode) {
    mmState.outline = mode === 'outline';
    document.getElementById('mmStage').hidden = mmState.outline;
    document.getElementById('mmOutline').hidden = !mmState.outline;
    document.querySelector('.mm-tools').hidden = mmState.outline;
    document.querySelectorAll('[data-mm-mode]').forEach((b) => b.classList.toggle('on', b === el));
    if (!mmState.outline) current?.fit();
    return;
  }
  if (!current) return;
  if (act === 'in') current.zoom(1.25);
  else if (act === 'out') current.zoom(0.8);
  else if (act === 'fit') current.fit();
  else if (act === 'open') {
    const anyShut = (() => { let s = false; walk(current.root, (n) => { if (n.children?.length && !n.open) s = true; }); return s; })();
    current.setAll(anyShut);
  } else if (act === 'full') {
    const stage = document.getElementById('mmStage');
    if (document.fullscreenElement) document.exitFullscreen?.();
    else stage.requestFullscreen?.().then(() => setTimeout(() => current.fit(), 150)).catch(() => {});
  }
}

export function outlineToggle(input) {
  if (!current) return;
  const id = input.dataset.mo;
  if (input.checked) current.done.add(id); else current.done.delete(id);
  saveDone(current.chapterId, current.done);
  current.render();
  current.update();
}

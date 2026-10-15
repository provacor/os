// 7. Treasure Hunt — each topic hides a 3×3 map. Every right answer to a new question uncovers one
// piece, and that question becomes the piece's lock. When all pieces are found and every one of
// those questions is mastered, the topic's chest opens (once). All chests of a chapter lead to the
// chapter's great treasure. Everything found is kept in the collection.

import { esc, bn, poolOf, smartPick, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, validSrc, srcChips, chapterList, scopeName, floatText, hashStr, refresh, shuffle, sfx, confetti } from './core.js?v=202610150320';
import { gameState, claim, claimed, isMastered, saveA } from '../learnstore.js?v=202610150320';
import { questionsOf } from '../gamedata.js?v=202610150320';

export const meta = { id: 'treasure', emoji: '🗺️', name: 'গুপ্তধন শিকার', desc: 'সঠিক উত্তরে মানচিত্রের টুকরো, টুকরোর প্রশ্নগুলো আয়ত্তে আনলে সিন্দুক খোলে — অধ্যায় শেষে মহাগুপ্তধন!', need: 10 };
const PIECES = 9, SESSION = 6;
const ITEMS = [['💍', 'আংটি'], ['👑', 'মুকুট'], ['🏺', 'মাটির পাত্র'], ['🗝️', 'সোনার চাবি'], ['📜', 'প্রাচীন পুঁথি'], ['💎', 'হীরা'], ['⚱️', 'কলস'], ['🧭', 'কম্পাস'], ['🔱', 'ত্রিশূল'], ['🪙', 'মোহর'], ['🛡️', 'ঢাল'], ['⚔️', 'তলোয়ার'], ['🪔', 'প্রদীপ'], ['🎺', 'শিঙা'], ['🗿', 'মূর্তি'], ['🧿', 'তাবিজ']];
const st = () => gameState('treasure', { frags: {} });
const k = (ch, tp) => `${ch}/${tp}`;
const fragsOf = (ch, tp) => (Array.isArray(st().frags[k(ch, tp)]) ? st().frags[k(ch, tp)] : []);
const target = (ch, tp) => Math.min(PIECES, questionsOf(ch, tp).length);
const chestOpen = (ch, tp) => claimed(`treasure:chest:${k(ch, tp)}`);
const chestReady = (ch, tp) => { const f = fragsOf(ch, tp); return f.length >= target(ch, tp) && f.length > 0 && f.every(isMastered); };
const itemOf = (ch, tp) => ITEMS[hashStr(k(ch, tp)) % ITEMS.length];
const bigOpen = (ch) => claimed(`treasure:big:${ch}`);

export function chapterInfo(ch) {
  const tps = topicsOf(ch);
  return `সিন্দুক ${bn(tps.filter((t) => chestOpen(ch, t.id)).length)}/${bn(tps.length)}${bigOpen(ch) ? ' · 🏆' : ''}`;
}

export function progress() {
  let done = 0, total = 0;
  for (const c of chapters()) {
    for (const t of topicsOf(c.id)) {
      total += target(c.id, t.id) + 1;
      done += Math.min(target(c.id, t.id), fragsOf(c.id, t.id).length) + (chestOpen(c.id, t.id) ? 1 : 0);
    }
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function view({ b: ch, c: tp, d: src }) {
  if (!ch) return home();
  if (ch === 'collection') return collection();
  if (!chapterById(ch)) return null;
  if (!tp) return chapterView(ch);
  if (!topicsOf(ch).some((t) => t.id === tp)) return null;
  return topicView(ch, tp, src);
}

function home() {
  const found = chapters().flatMap((c) => topicsOf(c.id).filter((t) => chestOpen(c.id, t.id))).length;
  return {
    title: meta.name,
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🏴‍☠️</span><div><h1>গুপ্তধন শিকার</h1>
        <p class="muted small">প্রতিটা টপিকে ৩×৩ মানচিত্র। সঠিক উত্তরে টুকরো, টুকরোর প্রশ্নগুলো আয়ত্তে আনলে সিন্দুক!</p></div></header>
      <a class="ar-boss-card tap rise" href="#/arena/treasure/collection"><span class="ar-boss-face">🏛️</span><span><b>আমার সংগ্রহশালা</b><small>${bn(found)}টি সিন্দুক খোলা হয়েছে</small></span></a>
      ${chapterList((c) => `#/arena/treasure/${c.id}`, (c) => {
        const tps = topicsOf(c.id);
        return `· সিন্দুক ${bn(tps.filter((t) => chestOpen(c.id, t.id)).length)}/${bn(tps.length)} ${bigOpen(c.id) ? '· 🏆' : ''}`;
      })}`,
  };
}

const miniMap = (ch, tp) => {
  const n = fragsOf(ch, tp).length, T = target(ch, tp);
  return `<span class="ar-mini" aria-label="${bn(n)}/${bn(T)}টি টুকরো">${Array.from({ length: PIECES }, (_, i) => `<i class="${i >= T ? 'none' : i < n ? 'on' : ''}"></i>`).join('')}</span>`;
};

function chapterView(ch) {
  const c = chapterById(ch);
  const tps = topicsOf(ch);
  const allOpen = tps.length && tps.every((t) => chestOpen(ch, t.id));
  const rows = tps.map((t, i) => {
    const open = chestOpen(ch, t.id), ready = chestReady(ch, t.id);
    return `<a class="gm-topic tap rise" style="--i:${Math.min(i, 12)}" href="#/arena/treasure/${esc(ch)}/${esc(t.id)}">
        ${miniMap(ch, t.id)}
        <span class="gm-topic-body"><b>${esc(t.name)}</b><small>টুকরো ${bn(fragsOf(ch, t.id).length)}/${bn(target(ch, t.id))} ${open ? `· ${itemOf(ch, t.id)[0]} পাওয়া গেছে` : ready ? '· 🧰 সিন্দুক খোলার জন্য তৈরি!' : ''}</small></span>
        <span class="gm-topic-pct">${open ? '🧰✓' : ready ? '🧰' : '🔒'}</span></a>`;
  }).join('');
  return {
    title: c.name,
    back: '#/arena/treasure',
    html: `<div id="arTr"><header class="ar-hero rise"><span class="ar-hero-emoji">🗺️</span><div><p class="eyebrow">গুপ্তধন শিকার</p><h1>${esc(c.name)}</h1>
        <p class="muted small">প্রতিটা টপিকের সিন্দুক খুললে অধ্যায়ের মহাগুপ্তধনের দরজা খুলবে।</p></div></header>
      <div class="gm-topics">${rows}</div>
      <section class="block">${bigOpen(ch)
        ? '<div class="ar-boss-card won"><span class="ar-boss-face">🏆</span><span><b>মহাগুপ্তধন পাওয়া গেছে!</b><small>সংগ্রহশালায় রাখা আছে</small></span></div>'
        : allOpen
          ? '<button class="ar-boss-card tap rise" data-tr-big><span class="ar-boss-face">🏆</span><span><b>মহাগুপ্তধন খোলো!</b><small>🪙 ৫০০ · 💎 ৩</small></span></button>'
          : '<div class="ar-boss-card locked"><span class="ar-boss-face">🔒</span><span><b>অধ্যায়ের মহাগুপ্তধন</b><small>সব টপিকের সিন্দুক খুললে পাওয়া যাবে</small></span></div>'}</section></div>`,
    after: () => document.querySelector('[data-tr-big]')?.addEventListener('click', () => {
      if (topicsOf(ch).every((t) => chestOpen(ch, t.id)) && claim(`treasure:big:${ch}`, { coins: 500, gems: 3 })) {
        sfx.win(); confetti(document.getElementById('arTr'));
        setTimeout(refresh, 900);
      }
    }),
  };
}

function topicView(ch, tp, srcParam) {
  const c = chapterById(ch);
  const src = validSrc(ch, tp, srcParam);
  return {
    title: scopeName(ch, tp),
    back: `#/arena/treasure/${ch}`,
    html: `<p class="eyebrow">🗺️ ${esc(c.name)} · ${esc(scopeName(ch, tp))}</p>
      ${srcChips(`#/arena/treasure/${esc(ch)}/${esc(tp)}`, ch, tp, src)}
      <section class="gm ar-game" id="ar"></section>`,
    after: () => lobby(document.getElementById('ar'), { ch, tp, src }),
  };
}

function lobby(el, o) {
  const pool = poolOf(o.ch, o.tp, o.src);
  mount(() => {});
  const frags = fragsOf(o.ch, o.tp), T = target(o.ch, o.tp);
  const open = chestOpen(o.ch, o.tp), ready = chestReady(o.ch, o.tp);
  const [ie, iname] = itemOf(o.ch, o.tp);
  const byId = new Map(questionsOf(o.ch, o.tp).map((s) => [s.id, s]));
  const tiles = Array.from({ length: PIECES }, (_, i) => {
    if (i >= T) return '<span class="ar-tile none"></span>';
    const id = frags[i];
    if (!id) return `<span class="ar-tile hidden">❔</span>`;
    return `<span class="ar-tile on ${isMastered(id) ? 'm' : ''}" title="${isMastered(id) ? 'আয়ত্তে' : 'এখনো আয়ত্তে নয়'}">${i === 4 && frags.length >= T ? '❌' : '🗺️'}<small>${isMastered(id) ? '🔓' : '🔒'}</small></span>`;
  }).join('');
  const locks = frags.map((id) => {
    const s = byId.get(id);
    return s ? `<li class="${isMastered(id) ? 'ok' : ''}">${isMastered(id) ? '🔓' : '🔒'} ${esc(String(s.q).split('\n')[0].slice(0, 90))}${String(s.q).length > 90 ? '…' : ''}</li>` : '';
  }).join('');
  el.innerHTML = `<div class="ar-lobby rise">
      <div class="ar-tmap">${tiles}</div>
      <p class="muted small">টুকরো ${bn(frags.length)}/${bn(T)} · তালা খোলা ${bn(frags.filter(isMastered).length)}/${bn(frags.length)}</p>
      ${open ? `<div class="ar-chest open"><span>${ie}</span><b>${esc(iname)} — সংগ্রহশালায় আছে</b></div>`
        : ready ? `<button class="ar-chest tap ready" data-tr-chest><span>🧰</span><b>সিন্দুক খোলো!</b><small>🪙 ১০০ · 💎 ১</small></button>`
          : `<div class="ar-chest"><span>🧰</span><small>${frags.length < T ? 'সব টুকরো খুঁজে বের করো' : 'টুকরোর সব প্রশ্ন আয়ত্তে আনো (পরপর ২ বার সঠিক)'}</small></div>`}
      ${pool.length ? `<button class="btn btn-primary tap ar-go" data-tr-go>🔍 খোঁজ শুরু</button>` : '<p class="muted">এই ধরনে এখানে প্রশ্ন নেই — উপর থেকে অন্য ধরন বেছে নাও।</p>'}
      ${locks ? `<details class="gm-review"><summary>টুকরোর তালা (প্রশ্নগুলো)</summary><ul class="ar-locks">${locks}</ul></details>` : ''}
    </div>`;
  el.onclick = (e) => {
    if (e.target.closest('[data-tr-go]')) { el.onclick = null; hunt(el, o, pool); }
    if (e.target.closest('[data-tr-chest]') && chestReady(o.ch, o.tp) && claim(`treasure:chest:${k(o.ch, o.tp)}`, { coins: 100, gems: 1 })) {
      sfx.win(); confetti(el);
      setTimeout(() => lobby(el, o), 900);
    }
  };
}

function hunt(el, o, pool) {
  const s = st();
  const frags = fragsOf(o.ch, o.tp);
  s.frags[k(o.ch, o.tp)] = frags;
  const T = target(o.ch, o.tp);
  // the pieces' unmastered questions first (from any content type, to open the chest), then new
  // ones of the chosen type (to find pieces)
  const all = poolOf(o.ch, o.tp, 'all');
  const locks = shuffle(all.filter((p) => frags.includes(p.id) && !isMastered(p.id))).slice(0, SESSION);
  const rest = smartPick(pool.filter((p) => !frags.includes(p.id)), SESSION - locks.length);
  let qs = [...locks.map((x) => ask(x, all)), ...rest.map((x) => ask(x, pool))];
  if (!qs.length) qs = smartPick(pool, SESSION).map((x) => ask(x, pool)); // everything found: just practice
  let i = 0, right = 0, found = 0;
  const wrong = [];
  const step = () => {
    if (i >= qs.length) return end();
    el.innerHTML = `<div class="gm-hud"><span>🗺️ ${bn(frags.length)}/${bn(T)}</span><span class="gm-prog"><i style="width:${(i / qs.length) * 100}%"></i></span><span>✓ ${bn(right)}</span></div><div id="arq"></div>`;
    const q = qs[i];
    const panel = askQuestion(el.querySelector('#arq'), q, {
      label: `${frags.includes(q.id) ? '🔒 তালার প্রশ্ন' : '🔍 খোঁজের প্রশ্ন'} ${bn(i + 1)}/${bn(qs.length)}`,
      onAnswer: (ok) => {
        if (!ok) { wrong.push(q); return; }
        right++;
        if (!frags.includes(q.id) && frags.length < T) {
          frags.push(q.id); found++; saveA();
          floatText(el, '🗺️ নতুন টুকরো!', 'up');
        }
      },
      onNext: () => { panel.destroy(); i++; step(); },
    });
  };
  const end = () => resultScreen(el, {
    emoji: chestReady(o.ch, o.tp) ? '🧰' : '🗺️',
    title: chestReady(o.ch, o.tp) && !chestOpen(o.ch, o.tp) ? 'সিন্দুক খোলার জন্য তৈরি!' : found ? `${bn(found)}টি নতুন টুকরো পাওয়া গেছে` : 'খোঁজ চলছে…',
    score: right * 10, key: `treasure/${k(o.ch, o.tp)}`, won: chestReady(o.ch, o.tp), wrong,
    lines: [`${bn(qs.length)}টির মধ্যে ${bn(right)}টি সঠিক`, `টুকরো ${bn(frags.length)}/${bn(T)} · তালা খোলা ${bn(frags.filter(isMastered).length)}/${bn(frags.length)}`],
    retry: () => hunt(el, o, pool), back: `#/arena/treasure/${o.ch}/${o.tp}/${o.src}`, backLabel: '🗺️ মানচিত্রে ফেরো',
  });
  mount(() => {});
  step();
}

function collection() {
  const list = chapters().flatMap((c) => topicsOf(c.id).filter((t) => chestOpen(c.id, t.id)).map((t) => ({ c, t, item: itemOf(c.id, t.id) })));
  const bigs = chapters().filter((c) => bigOpen(c.id));
  return {
    title: 'সংগ্রহশালা',
    back: '#/arena/treasure',
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🏛️</span><div><h1>আমার সংগ্রহশালা</h1>
        <p class="muted small">${bn(list.length)}টি সিন্দুকের ধন · ${bn(bigs.length)}টি মহাগুপ্তধন</p></div></header>
      ${bigs.length ? `<section class="block"><div class="block-head"><h2>🏆 মহাগুপ্তধন</h2></div><div class="ar-collection">${bigs.map((c) => `<div class="ar-item big"><span>🏆</span><b>${esc(c.name)}</b></div>`).join('')}</div></section>` : ''}
      <section class="block"><div class="block-head"><h2>সিন্দুকের ধন</h2></div>
      ${list.length ? `<div class="ar-collection">${list.map(({ c, t, item }) => `<div class="ar-item"><span>${item[0]}</span><b>${esc(item[1])}</b><small>${esc(t.name)} · ${esc(c.name)}</small></div>`).join('')}</div>` : '<p class="muted">এখনো কোনো সিন্দুক খোলা হয়নি। একটা টপিক বেছে খোঁজ শুরু করো!</p>'}</section>`,
  };
}

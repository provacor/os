// 5. Study Farm — right answers bring water (once per question per day), newly mastered questions
// bring seeds, and topic mastery unlocks new crops. Crops never wilt: a missed day costs nothing.
// Finishing a chapter's topics (bronze or better) holds a harvest festival, once per chapter.

import { esc, bn, poolOf, smartPick, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, validSrc, srcChips, chapterList, topicList, scopeName, masteryPct, badgeOf, refresh, sfx, floatText } from './core.js?v=202610150320';
import { gameState, claim, claimed, spend, saveA, A, FARM_DEFAULTS } from '../learnstore.js?v=202610150320';

export const meta = { id: 'farm', emoji: '🌾', name: 'জ্ঞানের খামার', desc: 'সঠিক উত্তরে পানি, আয়ত্তে বীজ। টপিক আয়ত্ত করে নতুন ফসল খোলো, ফসল তুলে খামার সাজাও — দিন বাদ গেলেও কিছু নষ্ট হয় না।', need: 0 };
const CROPS = [
  { id: 'rice', e: '🌾', name: 'ধান', need: 0, water: 2, coins: 8 },
  { id: 'carrot', e: '🥕', name: 'গাজর', need: 1, water: 2, coins: 10 },
  { id: 'corn', e: '🌽', name: 'ভুট্টা', need: 2, water: 3, coins: 14 },
  { id: 'tomato', e: '🍅', name: 'টমেটো', need: 3, water: 3, coins: 16 },
  { id: 'potato', e: '🥔', name: 'আলু', need: 5, water: 3, coins: 18 },
  { id: 'eggplant', e: '🍆', name: 'বেগুন', need: 7, water: 4, coins: 24 },
  { id: 'pumpkin', e: '🎃', name: 'মিষ্টিকুমড়া', need: 10, water: 4, coins: 30 },
  { id: 'melon', e: '🍉', name: 'তরমুজ', need: 14, water: 5, coins: 40 },
];
const GOLDEN = { id: 'golden', e: '🌟', name: 'সোনালি ফসল', water: 5, coins: 100 };
const DECOS = [
  { id: 'flower', e: '🌻', name: 'সূর্যমুখী', cost: 20 },
  { id: 'tree', e: '🌳', name: 'আমগাছ', cost: 30 },
  { id: 'hen', e: '🐔', name: 'মুরগি', cost: 40 },
  { id: 'cow', e: '🐄', name: 'গরু', cost: 60 },
  { id: 'pond', e: '🦆', name: 'হাঁসের পুকুর', cost: 80 },
  { id: 'house', e: '🏡', name: 'খামারবাড়ি', cost: 150 },
  { id: 'tractor', e: '🚜', name: 'ট্রাক্টর', cost: 200 },
];
const SEED_COST = 5, WORK = 5;
const st = () => {
  const f = gameState('farm', { ...FARM_DEFAULTS, sel: 'rice' });
  while (f.plots.length < plotCount()) f.plots.push(null); // land is never taken back
  return f;
};
const cropById = (id) => (id === 'golden' ? GOLDEN : CROPS.find((c) => c.id === id));

// badges from real topic mastery
function badges() {
  let bronze = 0, silver = 0;
  const done = [];
  for (const c of chapters()) {
    const tps = topicsOf(c.id);
    let all = tps.length > 0;
    for (const t of tps) {
      const b = badgeOf(masteryPct(c.id, t.id).pct);
      if (b >= 1) bronze++; else all = false;
      if (b >= 2) silver++;
    }
    if (all) done.push(c);
  }
  return { bronze, silver, done };
}
let badgeCache = null;
const B = () => (badgeCache ??= badges());
function plotCount() { return 6 + Math.min(6, B().silver); }
const unlocked = (c) => B().bronze >= c.need;

export function progress() {
  badgeCache = null;
  const f = st();
  const n = CROPS.filter(unlocked).length + DECOS.filter((d) => f.deco[d.id]).length + chapters().filter((c) => claimed(`farm:harvest:${c.id}`)).length;
  const total = CROPS.length + DECOS.length + chapters().length;
  return total ? Math.round((n / total) * 100) : 0;
}

export function view({ b, c: ch, d: tp, e: src }) {
  badgeCache = null;
  if (b === 'work') return work(ch, tp, src);
  if (b) return null;
  return farmView();
}

function plotHtml(p, i) {
  if (!p) return `<button class="ar-plot empty tap" data-fm-plot="${i}" aria-label="খালি জমি — বীজ বোনো"><span>🟫</span><small>বোনো</small></button>`;
  const c = cropById(p.c);
  const ready = p.w >= c.water;
  const stage = ready ? c.e : p.w === 0 ? '🌱' : p.w * 2 < c.water ? '🌿' : '🪴';
  return `<button class="ar-plot tap ${ready ? 'ready' : ''}" data-fm-plot="${i}" aria-label="${esc(c.name)} — ${ready ? 'তোলার জন্য তৈরি' : `পানি ${bn(p.w)}/${bn(c.water)}`}">
      <span>${stage}</span><small>${ready ? '🧺 তোলো' : `💧 ${bn(p.w)}/${bn(c.water)}`}</small></button>`;
}

function farmView() {
  const f = st();
  const bd = B();
  const crops = [...CROPS, ...(f.golden > 0 ? [GOLDEN] : [])];
  if (!cropById(f.sel) || (f.sel !== 'golden' && !unlocked(cropById(f.sel))) || (f.sel === 'golden' && f.golden <= 0)) f.sel = 'rice';
  const fests = bd.done.map((c) => {
    const got = claimed(`farm:harvest:${c.id}`);
    return `<div class="ar-fest ${got ? 'got' : ''}"><span>🎉</span><span><b>${esc(c.name)} — নবান্ন উৎসব</b><small>সব টপিক 🥉 ব্রোঞ্জ বা তার বেশি</small></span>
      ${got ? '<small>✓ পাওয়া গেছে</small>' : `<button class="btn btn-primary tap" data-fm-fest="${esc(c.id)}">🎁 ১৫০ 🪙 + 🌟 বীজ</button>`}</div>`;
  }).join('');
  return {
    title: meta.name,
    html: `<div id="arFarm">
      <header class="ar-hero rise"><span class="ar-hero-emoji">🧑‍🌾</span><div><h1>জ্ঞানের খামার</h1>
        <p class="muted small">সঠিক উত্তর → 💧 পানি (প্রতিটা প্রশ্নে দিনে একবার) · নতুন আয়ত্ত → 🌱 বীজ · টপিকে 🥉 ব্রোঞ্জ → নতুন ফসল · 🥈 সিলভার → নতুন জমি</p></div></header>
      <div class="ar-stats">
        <span><b>💧 ${bn(f.water)}</b><small>পানি</small></span>
        <span><b>🌱 ${bn(f.seeds)}</b><small>বীজ</small></span>
        <span><b>🪙 ${bn(A.coins)}</b><small>কয়েন</small></span>
        <span><b>🧺 ${bn(f.harvests)}</b><small>ফসল তোলা</small></span>
      </div>
      <div class="row-btns"><a class="btn btn-primary tap" href="#/arena/farm/work">💧 পানি আনো — ${bn(WORK)}টি প্রশ্ন</a>
        <button class="btn tap" data-fm-seed ${A.coins < SEED_COST ? 'disabled' : ''}>🌱 বীজ কেনো · ${bn(SEED_COST)} 🪙</button></div>
      <section class="block"><div class="block-head"><h2>কী বুনবে?</h2></div>
        <div class="gm-srcs ar-crops">${crops.map((c) => {
          const open = c.id === 'golden' || unlocked(c);
          return `<button class="gm-src tap ${f.sel === c.id ? 'on' : ''}" data-fm-crop="${c.id}" ${open ? '' : 'disabled'}>${open ? c.e : '🔒'} ${esc(c.name)} <small>${open ? `💧${bn(c.water)} · 🪙${bn(c.coins)}` : `${bn(c.need)}টি 🥉 লাগবে`}</small></button>`;
        }).join('')}</div>
        <p class="muted small">তোমার 🥉 ব্রোঞ্জ টপিক: ${bn(bd.bronze)}টি · 🥈 সিলভার: ${bn(bd.silver)}টি ${f.golden ? `· 🌟 সোনালি বীজ: ${bn(f.golden)}টি` : ''}</p></section>
      <section class="block"><div class="block-head"><h2>আমার জমি <small class="muted">(${bn(f.plots.length)}টি)</small></h2></div>
        <div class="ar-field">${f.plots.map(plotHtml).join('')}</div>
        <p class="muted small">খালি জমিতে চাপলে বীজ বোনা হবে, চারায় চাপলে ১ পানি দেবে, পাকা ফসলে চাপলে তুলবে।</p></section>
      ${fests ? `<section class="block"><div class="block-head"><h2>অধ্যায়ের ফসল উৎসব</h2></div>${fests}</section>` : ''}
      <section class="block"><div class="block-head"><h2>খামার সাজাও</h2></div>
        <div class="ar-yard" aria-label="খামারের সাজ">${DECOS.filter((d) => f.deco[d.id]).map((d) => `<span title="${esc(d.name)}">${d.e}</span>`).join('') || '<small class="muted">এখনো কিছু নেই — নিচ থেকে কেনো</small>'}</div>
        <div class="ar-shop">${DECOS.map((d) => f.deco[d.id]
          ? `<span class="ar-shop-item have">${d.e} ${esc(d.name)} <small>✓</small></span>`
          : `<button class="ar-shop-item tap" data-fm-deco="${d.id}" ${A.coins < d.cost ? 'disabled' : ''}>${d.e} ${esc(d.name)} <small>🪙 ${bn(d.cost)}</small></button>`).join('')}</div></section>
      </div>`,
    after: () => document.getElementById('arFarm')?.addEventListener('click', onFarmClick),
  };
}

function onFarmClick(e) {
  const f = st();
  const t = e.target;
  const plot = t.closest('[data-fm-plot]'), crop = t.closest('[data-fm-crop]'), deco = t.closest('[data-fm-deco]'), fest = t.closest('[data-fm-fest]');
  if (crop) { f.sel = crop.dataset.fmCrop; saveA(); return refresh(); }
  if (t.closest('[data-fm-seed]')) { if (spend('coins', SEED_COST)) { f.seeds++; saveA(); sfx.pop(); } return refresh(); }
  if (deco) {
    const d = DECOS.find((x) => x.id === deco.dataset.fmDeco);
    if (d && !f.deco[d.id] && spend('coins', d.cost)) { f.deco[d.id] = 1; saveA(); sfx.up(); }
    return refresh();
  }
  if (fest) {
    const id = fest.dataset.fmFest;
    if (B().done.some((c) => c.id === id) && claim(`farm:harvest:${id}`, { coins: 150 })) { f.golden++; saveA(); sfx.win(); }
    return refresh();
  }
  if (!plot) return;
  const i = Number(plot.dataset.fmPlot);
  const p = f.plots[i];
  if (!p) {
    const c = cropById(f.sel);
    if (f.sel === 'golden') { if (f.golden <= 0) return; f.golden--; }
    else { if (!c || !unlocked(c)) return; if (f.seeds <= 0) { floatText(plot, 'বীজ নেই', 'bad'); return; } f.seeds--; }
    f.plots[i] = { c: c.id, w: 0 };
    sfx.pop();
  } else {
    const c = cropById(p.c);
    if (!c) { f.plots[i] = null; }
    else if (p.w >= c.water) {
      A.coins += c.coins; f.harvests++; f.plots[i] = null;
      sfx.up();
    } else {
      if (f.water <= 0) { floatText(plot, 'পানি নেই', 'bad'); return; }
      f.water--; p.w++;
      sfx.pop();
    }
  }
  saveA();
  refresh();
}

// "Fetch water": a few questions from any topic.
function work(ch, tp, srcParam) {
  if (!ch) {
    return {
      title: 'পানি আনো', back: '#/arena/farm',
      html: `<p class="muted small">যেকোনো অধ্যায়ের প্রশ্নে সঠিক উত্তর দিলে পানি জমবে — নতুন প্রশ্নে বেশি, কারণ একই প্রশ্নে দিনে একবারই পানি মেলে।</p>${chapterList((c) => `#/arena/farm/work/${c.id}`)}`,
    };
  }
  const c = chapterById(ch);
  if (!c) return null;
  if (!tp) return { title: c.name, back: '#/arena/farm/work', html: topicList(ch, (t) => `#/arena/farm/work/${esc(ch)}/${esc(t)}`) };
  if (tp !== 'all' && !topicsOf(ch).some((t) => t.id === tp)) return null;
  const src = validSrc(ch, tp, srcParam);
  return {
    title: 'চাষের কাজ', back: `#/arena/farm/work/${ch}`,
    html: `<p class="eyebrow">🌾 ${esc(c.name)} · ${esc(scopeName(ch, tp))}</p>
      ${srcChips(`#/arena/farm/work/${esc(ch)}/${esc(tp)}`, ch, tp, src)}
      <section class="gm ar-game" id="ar"></section>`,
    after: () => runWork(document.getElementById('ar'), { ch, tp, src }),
  };
}
function runWork(el, o) {
  const pool = poolOf(o.ch, o.tp, o.src);
  if (!pool.length) { el.innerHTML = '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'; return; }
  const start = () => {
    const qs = smartPick(pool, WORK).map((s) => ask(s, pool));
    let i = 0, right = 0, water = 0, seeds = 0;
    const wrong = [];
    const step = () => {
      if (i >= qs.length) return end();
      el.innerHTML = `<div class="gm-hud"><span>💧 +${bn(water)}</span><span class="gm-prog"><i style="width:${(i / qs.length) * 100}%"></i></span><span>🌱 +${bn(seeds)}</span></div><div id="arq"></div>`;
      const q = qs[i];
      const panel = askQuestion(el.querySelector('#arq'), q, {
        label: `প্রশ্ন ${bn(i + 1)}/${bn(qs.length)}`,
        onAnswer: (ok, res) => { if (ok) right++; else wrong.push(q); if (res.gainXp) water++; if (res.nowMastered) seeds++; },
        onNext: () => { panel.destroy(); i++; step(); },
      });
    };
    const end = () => resultScreen(el, {
      emoji: water ? '💧' : '🌾', title: water ? `${bn(water)} বালতি পানি আনা হলো!` : 'আজ এই প্রশ্নগুলোর পানি আগেই নেওয়া হয়েছে',
      score: right * 10, key: `farm/${o.ch}/${o.tp}`, won: right === qs.length, wrong,
      rewards: [water ? `💧 +${bn(water)}` : '', seeds ? `🌱 +${bn(seeds)} বীজ` : ''].filter(Boolean),
      lines: [`${bn(qs.length)}টির মধ্যে ${bn(right)}টি সঠিক`],
      retry: start, back: '#/arena/farm', backLabel: '🌾 খামারে ফেরো',
    });
    step();
  };
  mount(() => {});
  start();
}

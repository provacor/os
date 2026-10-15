// 11. Space Exploration — every subject is a galaxy, every chapter a star system, every topic a
// planet. A planet is explored with ≥70% right in its 8-question mission; the next one opens when
// this one is explored or half mastered. Right answers (the rewarded ones) fill the ship's energy,
// which buys new ships and trails. An explored system calls out its space monster (optional).

import { esc, bn, poolOf, mixedPool, smartPick, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, validSrc, srcChips, scopeName, masteryPct, refresh, sfx, floatText } from './core.js?v=202610150307';
import { gameState, claim, claimed, spend, saveA, A, today } from '../learnstore.js?v=202610150307';
import { battle } from './dragon.js?v=202610150307';

export const meta = { id: 'space', emoji: '🚀', name: 'মহাকাশ অভিযান', desc: 'বিষয় = ছায়াপথ, অধ্যায় = নক্ষত্রমণ্ডল, টপিক = গ্রহ। মিশন জিতে গ্রহ আবিষ্কার করো, শক্তি জমিয়ে মহাকাশযান সাজাও।', need: 60 };
const PLANETS = ['🌍', '🪐', '🌕', '🔴', '🟠', '🟣', '🔵', '🟢', '🌑', '🟡', '🟤', '⚪', '🌎', '🌏'];
const SHIPS = [{ id: 'rocket', e: '🚀', name: 'রকেট', cost: 0 }, { id: 'ufo', e: '🛸', name: 'উড়ন্ত চাকি', cost: 30 }, { id: 'sat', e: '🛰️', name: 'স্যাটেলাইট', cost: 60 }, { id: 'comet', e: '☄️', name: 'ধূমকেতু', cost: 100 }];
const TRAILS = [{ id: '', e: '·', name: 'সাধারণ', cost: 0 }, { id: 'spark', e: '✨', name: 'ঝিলিক', cost: 20 }, { id: 'fire', e: '🔥', name: 'আগুন', cost: 40 }, { id: 'rainbow', e: '🌈', name: 'রংধনু', cost: 80 }];
const MISSION = 8, SECRET = 10, SECRET_NEED = 5;
const st = () => gameState('space', { explored: {}, boss: {}, ships: { rocket: 1 }, ship: 'rocket', trails: { '': 1 }, trail: '' });
const k = (ch, tp) => `${ch}/${tp}`;
const explored = (ch, tp) => !!st().explored[k(ch, tp)];
const openAt = (ch, list, i) => i === 0 || explored(ch, list[i - 1].id) || masteryPct(ch, list[i - 1].id).pct >= 50;
const sysDone = (ch) => topicsOf(ch).every((t) => explored(ch, t.id));
const shipE = () => SHIPS.find((s) => s.id === st().ship)?.e ?? '🚀';
const trailE = () => TRAILS.find((s) => s.id === st().trail && s.id)?.e ?? '';
const exploredCount = () => Object.keys(st().explored).length;

export function chapterInfo(ch) {
  const tps = topicsOf(ch);
  return `গ্রহ ${bn(tps.filter((t) => explored(ch, t.id)).length)}/${bn(tps.length)}${st().boss[ch] ? ' · 👾✓' : ''}`;
}

export function progress() {
  let done = 0, total = 0;
  for (const c of chapters()) {
    const tps = topicsOf(c.id);
    total += tps.length;
    done += tps.filter((t) => explored(c.id, t.id)).length;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function view({ b: ch, c: tp, d: src }) {
  if (!ch) return starMap();
  if (ch === 'hangar') return hangar();
  if (ch === 'secret') return secret();
  if (!chapterById(ch)) return null;
  if (!tp || tp === 'map') return system(ch, src);
  return mission(ch, tp, src);
}

function starMap() {
  const groups = [];
  for (const c of chapters()) {
    let g = groups.find((x) => x.s === c.subject);
    if (!g) groups.push(g = { s: c.subject, list: [] });
    g.list.push(c);
  }
  const secretOpen = exploredCount() >= SECRET_NEED;
  return {
    title: meta.name,
    html: `<header class="ar-hero ar-space-hero rise"><span class="ar-hero-emoji">${shipE()}</span><div><h1>মহাকাশ অভিযান</h1>
        <p class="muted small">⚡ শক্তি: <b>${bn(A.energy)}</b> · আবিষ্কৃত গ্রহ: <b>${bn(exploredCount())}</b> · প্রতিটা নতুন সঠিক উত্তরে +১ শক্তি</p></div></header>
      <div class="row-btns"><a class="btn tap" href="#/arena/space/hangar">🛠️ হ্যাঙ্গার — মহাকাশযান সাজাও</a></div>
      ${groups.map(({ s, list }) => `<section class="block ar-galaxy"><div class="block-head"><h2>🌌 ${esc(s.name)} ছায়াপথ</h2></div>
        <div class="ar-systems">${list.map((c, i) => {
          const tps = topicsOf(c.id);
          const n = tps.filter((t) => explored(c.id, t.id)).length;
          return `<a class="ar-system tap rise" style="--i:${Math.min(i, 10)}" href="#/arena/space/${esc(c.id)}">
            <span class="ar-sun">${sysDone(c.id) ? '🌟' : '☀️'}</span>
            <span class="ar-system-body"><b>${esc(c.name)}</b><small>গ্রহ ${bn(n)}/${bn(tps.length)} ${st().boss[c.id] ? '· 👾✓' : ''}</small>
              <span class="ar-dots">${tps.map((t, j) => `<i class="${explored(c.id, t.id) ? 'on' : ''}">${explored(c.id, t.id) ? PLANETS[j % PLANETS.length] : '·'}</i>`).join('')}</span></span></a>`;
        }).join('')}</div></section>`).join('')}
      <section class="block">${secretOpen
        ? `<a class="ar-boss-card ar-secret tap rise" href="#/arena/space/secret"><span class="ar-boss-face">✨</span><span><b>রহস্যময় ছায়াপথ</b><small>সব অধ্যায় মিলিয়ে ${bn(SECRET)}টি প্রশ্নের মিশন · দিনে একবার ⚡ +১০ ${claimed(`space:secret:${today()}`) ? '· আজ ✓' : ''}</small></span></a>`
        : `<div class="ar-boss-card locked"><span class="ar-boss-face">❔</span><span><b>রহস্যময় ছায়াপথ</b><small>${bn(SECRET_NEED)}টি গ্রহ আবিষ্কার করলে খুলবে (${bn(exploredCount())}/${bn(SECRET_NEED)})</small></span></div>`}</section>`,
  };
}

function system(ch, srcParam) {
  const c = chapterById(ch);
  const src = validSrc(ch, 'all', srcParam);
  const list = topicsOf(ch);
  const R = 42; // % radius of the orbit
  const firstOpen = list.findIndex((t, i) => openAt(ch, list, i) && !explored(ch, t.id));
  const planets = list.map((t, i) => {
    const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + R * Math.cos(a), y = 50 + R * Math.sin(a);
    const open = openAt(ch, list, i), ex = explored(ch, t.id);
    const icon = ex ? PLANETS[i % PLANETS.length] : open ? '🔭' : '🔒';
    const inner = `<span class="ar-planet-e">${icon}${i === firstOpen ? `<i class="ar-ship">${shipE()}</i>` : ''}</span><small>${esc(t.name)}</small>`;
    const style = `left:${x}%;top:${y}%`;
    return open
      ? `<a class="ar-planet tap ${ex ? 'done' : 'open'}" style="${style}" href="#/arena/space/${esc(ch)}/${esc(t.id)}/${src}" aria-label="${esc(t.name)}">${inner}</a>`
      : `<span class="ar-planet locked" style="${style}" aria-label="${esc(t.name)} — বন্ধ">${inner}</span>`;
  }).join('');
  const rows = list.map((t, i) => {
    const open = openAt(ch, list, i), ex = explored(ch, t.id), m = masteryPct(ch, t.id);
    const body = `<span class="gm-topic-no">${ex ? PLANETS[i % PLANETS.length] : open ? '🔭' : '🔒'}</span><span class="gm-topic-body"><b>${esc(t.name)}</b><small>${ex ? 'আবিষ্কৃত' : open ? 'অভিযানের জন্য খোলা' : 'আগের গ্রহ আবিষ্কার করো বা ৫০% আয়ত্তে আনো'} · আয়ত্তে ${bn(m.pct)}%</small></span>`;
    return open ? `<a class="gm-topic tap" href="#/arena/space/${esc(ch)}/${esc(t.id)}/${src}">${body}</a>` : `<span class="gm-topic locked">${body}</span>`;
  }).join('');
  const done = sysDone(ch);
  return {
    title: c.name,
    back: '#/arena/space',
    html: `<header class="ar-hero ar-space-hero rise"><span class="ar-hero-emoji">☀️</span><div><p class="eyebrow">🌌 ${esc(c.subject.name)} ছায়াপথ</p><h1>${esc(c.name)}</h1>
        <p class="muted small">⚡ ${bn(A.energy)} · প্রতিটা গ্রহে ${bn(MISSION)}টি প্রশ্ন — ৭০% সঠিক হলে আবিষ্কার।</p></div></header>
      ${srcChips(`#/arena/space/${esc(ch)}/map`, ch, 'all', src)}
      <div class="ar-orbit" aria-hidden="true"><span class="ar-orbit-ring"></span><span class="ar-orbit-sun">${done ? '🌟' : '☀️'}</span>${planets}</div>
      <section class="block"><div class="gm-topics">${rows}</div></section>
      <section class="block">${done
        ? `<a class="ar-boss-card tap rise ${st().boss[ch] ? 'won' : ''}" href="#/arena/space/${esc(ch)}/boss/${src}"><span class="ar-boss-face">👾</span><span><b>মহাকাশ দানব (ইচ্ছে হলে)</b><small>পুরো অধ্যায়ের প্রশ্ন · HP ১২০ ${st().boss[ch] ? '· ✓ হারানো হয়েছে' : ''}</small></span></a>`
        : '<div class="ar-boss-card locked"><span class="ar-boss-face">👾</span><span><b>মহাকাশ দানব</b><small>সব গ্রহ আবিষ্কার হলে দেখা দেবে</small></span></div>'}</section>`,
  };
}

function mission(ch, tp, srcParam) {
  const c = chapterById(ch);
  const isBoss = tp === 'boss';
  const list = topicsOf(ch);
  const i = list.findIndex((t) => t.id === tp);
  if (!isBoss && i < 0) return null;
  if (isBoss ? !sysDone(ch) : !openAt(ch, list, i)) { location.replace(`#/arena/space/${ch}`); return 'redirect'; }
  const scope = isBoss ? 'all' : tp;
  const src = validSrc(ch, scope, srcParam);
  if (isBoss) {
    return {
      title: 'মহাকাশ দানব', back: `#/arena/space/${ch}`,
      html: `<p class="eyebrow">👾 ${esc(c.name)}</p>${srcChips(`#/arena/space/${esc(ch)}/boss`, ch, 'all', src)}<section class="gm ar-game" id="ar"></section>`,
      after: () => battle(document.getElementById('ar'), {
        ch, scope: 'all', src, theme: 'space', hit: 20, key: `space/${ch}/boss`, back: `#/arena/space/${ch}`,
        enemy: { emoji: '👾', name: 'মহাকাশ দানব', hp: 120 },
        onWin: () => { st().boss[ch] = 1; saveA(); return claim(`space:boss:${ch}`, { coins: 100, gems: 2, energy: 20 }) ? ['👾 দানব জয়', '🪙 +১০০', '💎 +২', '⚡ +২০'] : []; },
      }),
    };
  }
  const name = scopeName(ch, tp);
  return {
    title: name, back: `#/arena/space/${ch}`,
    html: `<p class="eyebrow">🚀 ${esc(c.name)} · ${PLANETS[i % PLANETS.length]} ${esc(name)}</p>${srcChips(`#/arena/space/${esc(ch)}/${esc(tp)}`, ch, tp, src)}<section class="gm ar-game ar-space" id="ar"></section>`,
    after: () => run(document.getElementById('ar'), { pool: poolOf(ch, tp, src), n: MISSION, label: name, key: `space/${k(ch, tp)}`, back: `#/arena/space/${ch}`,
      onEnd: (ratio) => {
        if (ratio < 0.7) return { won: false, rewards: [] };
        st().explored[k(ch, tp)] = 1; saveA();
        return { won: true, rewards: claim(`space:planet:${k(ch, tp)}`, { energy: 10, coins: 20 }) ? ['🪐 নতুন গ্রহ আবিষ্কার', '⚡ +১০', '🪙 +২০'] : [] };
      } }),
  };
}

function secret() {
  if (exploredCount() < SECRET_NEED) { location.replace('#/arena/space'); return 'redirect'; }
  return {
    title: 'রহস্যময় ছায়াপথ', back: '#/arena/space',
    html: '<p class="eyebrow">✨ সব অধ্যায় মিলিয়ে</p><section class="gm ar-game ar-space" id="ar"></section>',
    after: () => run(document.getElementById('ar'), { pool: mixedPool(chapters().map((c) => c.id), 'mcq'), n: SECRET, label: 'রহস্যময় ছায়াপথ', key: 'space/secret', back: '#/arena/space', mixed: true,
      onEnd: (ratio) => ({ won: ratio >= 0.7, rewards: ratio >= 0.7 && claim(`space:secret:${today()}`, { energy: 10 }) ? ['✨ রহস্যভেদ', '⚡ +১০'] : [] }) }),
  };
}

function run(el, o) {
  if (!o.pool.length) { el.innerHTML = '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'; return; }
  const start = () => {
    const qs = smartPick(o.pool, o.n).map((s) => ask(s, o.mixed ? poolOf(s.ch, 'all', validSrc(s.ch, 'all', 'mcq')) : o.pool));
    let i = 0, right = 0, energy = 0;
    const wrong = [];
    const step = () => {
      if (i >= qs.length) return end();
      el.innerHTML = `<div class="gm-hud"><span>${shipE()}${trailE()} ⚡${bn(A.energy)}</span><span class="gm-prog"><i style="width:${(i / qs.length) * 100}%"></i></span><span>✓ ${bn(right)}</span></div><div id="arq"></div>`;
      const q = qs[i];
      const panel = askQuestion(el.querySelector('#arq'), q, {
        label: `${o.mixed ? `${esc(chapterById(q.ch)?.name ?? '')} · ` : ''}সংকেত ${bn(i + 1)}/${bn(qs.length)}`,
        onAnswer: (ok, res) => {
          if (!ok) { wrong.push(q); return; }
          right++;
          if (res.gainXp) { A.energy += 1; energy++; saveA(); floatText(el, '⚡ +১', 'up'); }
        },
        onNext: () => { panel.destroy(); i++; step(); },
      });
    };
    const end = () => {
      const ratio = qs.length ? right / qs.length : 0;
      const { won, rewards } = o.onEnd(ratio);
      resultScreen(el, {
        emoji: won ? '🪐' : '🛰️', title: won ? 'মিশন সফল!' : 'মিশন অসমাপ্ত — আবার চেষ্টা করো',
        score: right * 10, key: o.key, won, wrong, rewards: [...rewards, energy ? `⚡ এই মিশনে +${bn(energy)}` : ''].filter(Boolean),
        lines: [`${bn(qs.length)}টির মধ্যে ${bn(right)}টি সঠিক`, won ? '' : 'আবিষ্কারের জন্য ৭০% সঠিক লাগবে।'],
        retry: start, back: o.back, backLabel: '🌌 নক্ষত্রমণ্ডলে ফেরো',
      });
    };
    step();
  };
  mount(() => {});
  start();
}

function hangar() {
  const s = st();
  const item = (kind, x) => {
    const own = kind === 'ship' ? s.ships[x.id] : s.trails[x.id];
    const on = (kind === 'ship' ? s.ship : s.trail) === x.id;
    return `<div class="ar-skill ${own ? 'have' : A.energy >= x.cost ? 'can' : 'lock'}"><span class="ar-skill-e">${x.e}</span><b>${esc(x.name)}</b>
      ${own ? `<button class="chip-btn tap" data-sp-use="${kind}:${x.id}">${on ? '✓ ব্যবহার হচ্ছে' : 'ব্যবহার করো'}</button>`
        : `<button class="btn btn-primary tap" data-sp-buy="${kind}:${x.id}" ${A.energy >= x.cost ? '' : 'disabled'}>⚡ ${bn(x.cost)}</button>`}</div>`;
  };
  return {
    title: 'হ্যাঙ্গার', back: '#/arena/space',
    html: `<div id="arHangar"><header class="ar-hero ar-space-hero rise"><span class="ar-hero-emoji">${shipE()}${trailE()}</span><div><h1>হ্যাঙ্গার</h1>
        <p class="muted small">⚡ শক্তি: <b>${bn(A.energy)}</b> — নতুন সঠিক উত্তর, গ্রহ আবিষ্কার আর দানব জয়ে শক্তি মেলে।</p></div></header>
      <section class="block"><div class="block-head"><h2>🚀 মহাকাশযান</h2></div><div class="ar-tree">${SHIPS.map((x) => item('ship', x)).join('')}</div></section>
      <section class="block"><div class="block-head"><h2>💫 ধোঁয়ার রেখা</h2></div><div class="ar-tree">${TRAILS.map((x) => item('trail', x)).join('')}</div></section></div>`,
    after: () => document.getElementById('arHangar')?.addEventListener('click', (e) => {
      const buy = e.target.closest('[data-sp-buy]'), use = e.target.closest('[data-sp-use]');
      const [kind, id] = (buy ?? use)?.dataset[buy ? 'spBuy' : 'spUse']?.split(':') ?? [];
      if (!kind) return;
      const list = kind === 'ship' ? SHIPS : TRAILS;
      const x = list.find((y) => y.id === id);
      if (!x) return;
      const own = kind === 'ship' ? s.ships : s.trails;
      if (buy && !own[id] && spend('energy', x.cost)) { own[id] = 1; sfx.up(); }
      if (own[id]) { if (kind === 'ship') s.ship = id; else s.trail = id; }
      saveA();
      refresh();
    }),
  };
}

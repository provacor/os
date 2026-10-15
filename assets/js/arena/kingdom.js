// 1. Chapter Kingdom — every chapter is a kingdom, every topic a region on its map, and the
// chapter's castle is the final stage. A region is won with ≥70% right; stars as in the levels.
// Story lines are decoration only — every question is the chapter's own.

import { esc, bn, poolOf, smartPick, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, masteryPct, validSrc, srcChips, chapterList, scopeName } from './core.js?v=202610150320';
import { gameState, claim, claimed } from '../learnstore.js?v=202610150320';

export const meta = { id: 'kingdom', emoji: '🏰', name: 'অধ্যায় রাজ্য', desc: 'প্রতিটা অধ্যায় একটা রাজ্য, প্রতিটা টপিক একটা অঞ্চল — জয় করে করে দুর্গে পৌঁছাও!', need: 0 };
const st = () => gameState('kingdom', { stars: {}, tried: {} });
const k = (ch, tp) => `${ch}/${tp}`;
const starsAt = (ch, tp) => st().stars[k(ch, tp)] ?? 0;
const cleared = (ch, tp) => starsAt(ch, tp) > 0;
const stagesOf = (ch) => topicsOf(ch);
export const castleOpen = (ch) => stagesOf(ch).every((tp) => cleared(ch, tp.id));
export const castleWon = (ch) => cleared(ch, 'castle');
const unlockedAt = (ch, list, i) => i === 0 || cleared(ch, list[i - 1].id);

// One status line for the chapter's game hub.
export function chapterInfo(ch) {
  const list = stagesOf(ch);
  return `জয় ${bn(list.filter((tp) => cleared(ch, tp.id)).length)}/${bn(list.length)}${castleWon(ch) ? ' · 👑' : ''}`;
}

export function progress() {
  let done = 0, total = 0;
  for (const ch of chapters()) {
    const list = stagesOf(ch.id);
    total += list.length + 1;
    done += list.filter((tp) => cleared(ch.id, tp.id)).length + (castleWon(ch.id) ? 1 : 0);
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function view({ b: ch, c: tp, d: src }) {
  if (!ch) return home();
  if (!chapterById(ch)) return null;
  if (!tp) return mapView(ch, src);
  return play(ch, tp, src);
}

function home() {
  return {
    title: meta.name,
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🏰</span><div><h1>অধ্যায় রাজ্য</h1>
        <p class="muted small">🧙 জ্ঞানী বৃদ্ধ: “প্রতিটা রাজ্যের অঞ্চলগুলো একে একে জয় করো। সব অঞ্চল জয় হলে দুর্গের দরজা খুলবে!”</p></div></header>
      ${chapterList((c) => `#/arena/kingdom/${c.id}`, (c) => {
        const list = stagesOf(c.id);
        return `· জয় ${bn(list.filter((tp) => cleared(c.id, tp.id)).length)}/${bn(list.length)} ${castleWon(c.id) ? '· 👑' : ''}`;
      })}`,
  };
}

function mapView(ch, srcParam) {
  const c = chapterById(ch);
  const src = validSrc(ch, 'all', srcParam);
  const list = stagesOf(ch);
  const H = 120;
  const nodes = [...list.map((tp) => ({ id: tp.id, name: tp.name })), { id: 'castle', name: `${c.name} — দুর্গ` }];
  const pos = nodes.map((n, i) => ({ x: n.id === 'castle' ? 50 : i % 2 ? 72 : 28, y: 60 + i * H }));
  const height = 60 + nodes.length * H;
  const path = pos.map((p) => `${p.x},${p.y}`).join(' ');
  const html = nodes.map((n, i) => {
    const isCastle = n.id === 'castle';
    const open = isCastle ? castleOpen(ch) : unlockedAt(ch, list, i);
    const s = starsAt(ch, n.id);
    const tried = st().tried[k(ch, n.id)];
    const m = isCastle ? masteryPct(ch) : masteryPct(ch, n.id);
    const state = !open ? 'locked' : s ? 'done' : tried ? 'trying' : 'open';
    const icon = isCastle ? (s ? '👑' : open ? '🏰' : '🔒') : { locked: '🔒', open: '⚔️', trying: '⏳', done: '🚩' }[state];
    const reward = s ? (claimed(`kingdom:${k(ch, n.id)}`) ? '🎁✓' : '🎁') : '';
    const inner = `<span class="ar-node-ic">${icon}</span><b>${esc(n.name)}</b>
      <small>${state === 'locked' ? 'বন্ধ — আগের অঞ্চল জয় করো' : `আয়ত্তে ${bn(m.pct)}%`} ${s ? `· ${'★'.repeat(s)}` : ''} ${reward}</small>`;
    const style = `left:${pos[i].x}%;top:${pos[i].y}px`;
    return open
      ? `<a class="ar-node ${state} ${isCastle ? 'castle' : ''} tap" style="${style}" href="#/arena/kingdom/${esc(ch)}/${esc(n.id)}/${src}">${inner}</a>`
      : `<span class="ar-node ${state} ${isCastle ? 'castle' : ''}" style="${style}" aria-disabled="true">${inner}</span>`;
  }).join('');
  return {
    title: c.name,
    back: '#/arena/kingdom',
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">${castleWon(ch) ? '👑' : '🏰'}</span><div><p class="eyebrow">অধ্যায় রাজ্য</p><h1>${esc(c.name)}</h1>
        <p class="muted small">🛡️ রক্ষী: “প্রতিটা অঞ্চলে ৮টি প্রশ্ন — ৭০% সঠিক হলেই জয়। দুর্গে ১২টি!”</p></div></header>
      ${srcChips(`#/arena/kingdom/${esc(ch)}/map`, ch, 'all', src)}
      <div class="ar-map kingdom" style="height:${height}px">
        <svg class="ar-path" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${path}" vector-effect="non-scaling-stroke"/></svg>
        ${html}
      </div>`,
  };
}

function play(ch, tp, srcParam) {
  if (tp === 'map') return mapView(ch, srcParam);
  const c = chapterById(ch);
  const isCastle = tp === 'castle';
  const list = stagesOf(ch);
  const i = list.findIndex((x) => x.id === tp);
  if (!isCastle && i < 0) return null;
  if (isCastle ? !castleOpen(ch) : !unlockedAt(ch, list, i)) { location.replace(`#/arena/kingdom/${ch}`); return 'redirect'; }
  const scope = isCastle ? 'all' : tp;
  const src = validSrc(ch, scope, srcParam);
  const name = isCastle ? `${c.name} — দুর্গ` : scopeName(ch, tp);
  return {
    title: isCastle ? 'দুর্গ' : name,
    back: `#/arena/kingdom/${ch}`,
    html: `<p class="eyebrow">🏰 ${esc(c.name)} · ${esc(name)}</p><section class="gm ar-game" id="ar"></section>`,
    after: () => run(document.getElementById('ar'), { ch, tp, scope, src, name, isCastle }),
  };
}

function run(el, o) {
  const pool = poolOf(o.ch, o.scope, o.src);
  const N = o.isCastle ? 12 : 8;
  const start = () => {
    const qs = smartPick(pool, N).map((s) => ask(s, pool));
    let i = 0, right = 0;
    const wrong = [];
    st().tried[k(o.ch, o.tp)] = 1;
    const step = () => {
      if (i >= qs.length) return end();
      el.innerHTML = `<div class="gm-hud"><span>${o.isCastle ? '🏰' : '⚔️'} ${esc(o.name)}</span><span class="gm-prog"><i style="width:${(i / qs.length) * 100}%"></i></span><span>✓ ${bn(right)}</span></div><div id="arq"></div>`;
      const q = qs[i];
      const panel = askQuestion(el.querySelector('#arq'), q, {
        label: `প্রশ্ন ${bn(i + 1)}/${bn(qs.length)}`,
        onAnswer: (ok) => { if (ok) right++; else wrong.push(q); },
        onNext: () => { panel.destroy(); i++; step(); },
      });
    };
    const end = () => {
      const ratio = qs.length ? right / qs.length : 0;
      const stars = ratio === 1 ? 3 : ratio >= 0.85 ? 2 : ratio >= 0.7 ? 1 : 0;
      const s = st();
      const key = k(o.ch, o.tp);
      if (stars > (s.stars[key] ?? 0)) s.stars[key] = stars;
      const rewards = [];
      if (stars && claim(`kingdom:${key}`, o.isCastle ? { coins: 150, gems: 3 } : { coins: 40, gems: 1 })) {
        rewards.push(o.isCastle ? '👑 দুর্গ জয়ের মুকুট' : '🎁 অঞ্চলের গুপ্তধন', o.isCastle ? '🪙 +১৫০' : '🪙 +৪০', o.isCastle ? '💎 +৩' : '💎 +১');
      }
      resultScreen(el, {
        emoji: stars ? (o.isCastle ? '👑' : '🚩') : '🛡️', title: stars ? (o.isCastle ? 'দুর্গ জয়! রাজ্য তোমার!' : 'অঞ্চল জয়!') : 'আরেকবার চেষ্টা করো',
        score: right * 10, key: `kingdom/${key}`, stars, won: stars > 0, wrong, rewards,
        lines: [`${bn(qs.length)}টির মধ্যে ${bn(right)}টি সঠিক`, stars ? '' : 'জয়ের জন্য ৭০% সঠিক লাগবে।'],
        retry: start, back: `#/arena/kingdom/${o.ch}`, backLabel: '🗺️ রাজ্যের মানচিত্র',
      });
    };
    step();
  };
  if (!pool.length) { el.innerHTML = '<p class="muted">এই অঞ্চলে এখনো প্রশ্ন নেই।</p>'; return; }
  mount(() => {});
  start();
}

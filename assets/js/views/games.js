// Game zone screens: a chapter's hub (#/games/<ch>), one topic's games and level map
// (#/games/<ch>/<topic>), and the play screen (#/play/<ch>/<topic>/<mode>).

import { icon } from '../icons.js?v=202610141433';
import { esc, ring, bar, chapterEyebrow, chapterNo, pad2, emptyState } from '../components.js?v=202610141433';
import { tocOf } from './topic.js?v=202610141433';
import { MODES, mcqsOf, levelsOf, levelKey, levelUnlocked, starsOf, bestOf, isMastered, playerLevel, xp, soundOn, startGame, bn } from '../games.js?v=202610141433';

export const hasGames = (ch) => !!tocOf(ch?.id)?.topics?.some((tp) => mcqsOf(ch.id, tp.id).length);

const stat = (pool) => {
  const done = pool.filter((it) => isMastered(it.id)).length;
  return { done, total: pool.length, pct: pool.length ? Math.round((done / pool.length) * 100) : 0 };
};
const crumbsOf = (ch, extra = []) => [[ch.subject.name, `#/s/${ch.subject.id}`], [chapterNo(ch) != null ? `Ch ${pad2(chapterNo(ch))}` : ch.name, `#/c/${ch.id}`], ['গেম', `#/games/${ch.id}`], ...extra];
const soundBtn = () => `<button class="chip-btn tap" data-g-sound aria-pressed="${soundOn()}">${soundOn() ? '🔊 শব্দ চালু' : '🔇 শব্দ বন্ধ'}</button>`;

const totalsOf = (chs) => chs.reduce((acc, ch) => { const s = stat(mcqsOf(ch.id, 'all')); acc.total += s.total; acc.done += s.done; return acc; }, { total: 0, done: 0 });
const pctOf = (x) => (x.total ? Math.round((x.done / x.total) * 100) : 0);
const bigCard = (href, title, sub, pct, cls = '') => `<a class="gm-home ${cls} rise tap" href="${href}">
    <span class="gm-home-emoji" aria-hidden="true">🎮</span>
    <span class="gm-home-body"><b>${title}</b><small>${sub}</small>${bar(pct, 'bar-thin')}</span>
    <span class="gm-home-go">খেলো ${icon('chevron')}</span>
  </a>`;

// Home page: one big card into the game zone.
export function gamesHomeCard(model) {
  const chs = model.chapters.filter(hasGames);
  if (!chs.length) return '';
  const x = totalsOf(chs);
  return `<section class="block">${bigCard('#/games', 'গেম জোন — খেলে খেলে MCQ শেখো', `${bn(chs.length)}টি অধ্যায় · ৭ রকম গেম · ${bn(x.total)}টি MCQ-এর ${bn(x.done)}টি আয়ত্তে`, pctOf(x))}</section>`;
}

// Chapter page: a banner at the top.
export function gamesBanner(ch) {
  if (!hasGames(ch)) return '';
  const x = totalsOf([ch]);
  return `<section class="block">${bigCard(`#/games/${esc(ch.id)}`, 'গেম জোন — এই অধ্যায়ের MCQ খেলে শেখো', `৭ রকম গেম · ${bn(x.total)}টি MCQ · আয়ত্তে ${bn(pctOf(x))}%`, pctOf(x), 'gm-banner')}</section>`;
}

// #/games: every chapter that has games.
function gamesIndex(model) {
  const chs = model.chapters.filter(hasGames);
  const x = totalsOf(chs);
  const groups = model.subjects.map((s) => ({ s, list: chs.filter((ch) => ch.subject === s) })).filter((g) => g.list.length);
  let i = 0;
  const html = groups.map(({ s, list }) => `<section class="block"><div class="block-head"><h2>${esc(s.name)}</h2></div><div class="gm-topics">${list.map((ch) => {
    const c = totalsOf([ch]), pct = pctOf(c);
    return `<a class="gm-topic tap rise" style="--i:${Math.min(i++, 12)}" href="#/games/${esc(ch.id)}">
        <span class="gm-topic-no">${chapterNo(ch) != null ? bn(pad2(chapterNo(ch))) : '★'}</span>
        <span class="gm-topic-body"><b>${esc(ch.name)}</b><small>${esc(ch.paper.name)} · ${bn(c.total)}টি MCQ · আয়ত্তে ${bn(c.done)}</small>${bar(pct, 'bar-thin')}</span>
        <span class="gm-topic-pct">${pct === 100 ? '🏆' : `${bn(pct)}%`}</span>
      </a>`;
  }).join('')}</div></section>`).join('');
  return {
    nav: 'home',
    title: 'গেম জোন',
    back: '#/',
    crumbs: [['গেম জোন', '#/games']],
    html: `<header class="gm-hero rise">
        <div><p class="eyebrow">সব অধ্যায়</p>
          <h1>🎮 গেম জোন</h1>
          <p class="muted small">${bn(chs.length)}টি অধ্যায়ের ${bn(x.total)}টি MCQ-এর ${bn(x.done)}টি আয়ত্তে</p>
          <div class="chip-row"><span class="chip">🧑‍🚀 খেলোয়াড় লেভেল ${bn(playerLevel())}</span><span class="chip">✨ ${bn(xp())} XP</span>${soundBtn()}</div></div>
        ${ring(pctOf(x), { size: 76, stroke: 6 })}
      </header>
      <p class="muted small gm-help">অধ্যায় বেছে নাও — প্রতিটা টপিকে লেভেল অভিযানসহ ৭ রকম গেম, সবই ওই টপিকের নিজের MCQ দিয়ে।</p>
      ${html || emptyState({ iconName: 'mcq', title: 'এখনো কোনো অধ্যায়ে MCQ নেই', text: 'MCQ যোগ হলে এখানে গেম খেলা যাবে।' })}`,
  };
}

// Chapter hub: every topic that has MCQs.
export function gamesView(model, chId, tpId) {
  if (!chId) return gamesIndex(model);
  const ch = model.byId.get(chId);
  if (ch?.level !== 'chapter') return null;
  if (tpId) return topicGames(ch, tpId);
  const t = tocOf(ch.id);
  const topics = (t?.topics ?? []).map((tp) => ({ tp, pool: mcqsOf(ch.id, tp.id) })).filter((x) => x.pool.length);
  const all = mcqsOf(ch.id, 'all');
  const s = stat(all);
  const rows = topics.map(({ tp, pool }, i) => {
    const st = stat(pool);
    const levels = levelsOf(pool);
    const stars = levels.reduce((n, _, k) => n + starsOf(levelKey(ch.id, tp.id, k + 1)), 0);
    return `<a class="gm-topic tap rise" style="--i:${Math.min(i, 12)}" href="#/games/${esc(ch.id)}/${esc(tp.id)}">
        <span class="gm-topic-no">${bn(pad2(i + 1))}</span>
        <span class="gm-topic-body"><b>${esc(tp.name)}</b><small>${bn(pool.length)}টি MCQ · আয়ত্তে ${bn(st.done)} · ⭐ ${bn(stars)}/${bn(levels.length * 3)}</small>${bar(st.pct, 'bar-thin')}</span>
        <span class="gm-topic-pct">${st.pct === 100 ? '🏆' : `${bn(st.pct)}%`}</span>
      </a>`;
  }).join('');
  return {
    nav: 'study',
    title: 'গেম জোন',
    back: `#/c/${ch.id}`,
    crumbs: crumbsOf(ch),
    accent: ch.subject.accent,
    visit: { chapterId: ch.id },
    html: `<header class="gm-hero rise">
        <div><p class="eyebrow">${esc(ch.subject.name)} · ${esc(chapterEyebrow(ch))}</p>
          <h1>🎮 গেম জোন</h1>
          <p class="muted small">${esc(ch.name)} · ${bn(all.length)}টি MCQ-এর ${bn(s.done)}টি আয়ত্তে</p>
          <div class="chip-row"><span class="chip">🧑‍🚀 খেলোয়াড় লেভেল ${bn(playerLevel())}</span><span class="chip">✨ ${bn(xp())} XP</span>${soundBtn()}</div></div>
        ${ring(s.pct, { size: 76, stroke: 6 })}
      </header>
      <p class="muted small gm-help">প্রতিটা টপিকের নিজের MCQ দিয়ে ৭ রকম গেম। একটা প্রশ্ন পরপর ২ বার সঠিক হলে "আয়ত্তে" ধরা হয়; ভুলগুলো আগে ঘুরে আসে আর রিভিশন তালিকায় যোগ হয়। সব টপিক ১০০% হলে অধ্যায়ের সব MCQ ক্লিয়ার!</p>
      <section class="block"><div class="block-head"><h2>টপিক বেছে নাও</h2></div><div class="gm-topics">${rows}</div></section>
      ${all.length ? `<section class="block"><a class="gm-topic gm-all tap" href="#/games/${esc(ch.id)}/all"><span class="gm-topic-no">★</span><span class="gm-topic-body"><b>পুরো অধ্যায় মিলিয়ে</b><small>সব টপিকের ${bn(all.length)}টি MCQ একসাথে — চূড়ান্ত চ্যালেঞ্জ</small></span><span class="gm-topic-pct">${bn(s.pct)}%</span></a></section>` : ''}`,
  };
}

function topicGames(ch, tpId) {
  const t = tocOf(ch.id);
  const tp = tpId === 'all' ? { id: 'all', name: 'পুরো অধ্যায়' } : t?.topics.find((x) => x.id === tpId);
  if (!tp) return null;
  const pool = mcqsOf(ch.id, tp.id);
  if (!pool.length) {
    return { nav: 'study', title: 'গেম', back: `#/games/${ch.id}`, crumbs: crumbsOf(ch), html: emptyState({ iconName: 'mcq', title: 'এই টপিকে এখনো MCQ নেই', text: 'MCQ যোগ হলে এখানে গেম খেলা যাবে।' }) };
  }
  const s = stat(pool);
  const modes = MODES.map((m, i) => {
    const best = bestOf(`${ch.id}/${tp.id}/${m.id}`);
    return `<a class="gm-mode tap rise" style="--i:${i}" href="#/play/${esc(ch.id)}/${esc(tp.id)}/${m.id}">
        <span class="gm-mode-emoji">${m.emoji}</span>
        <span class="gm-mode-body"><b>${m.name}</b><small>${m.desc}</small>${best ? `<span class="gm-mode-best">🏅 সেরা: ${bn(best)}</span>` : ''}</span>
      </a>`;
  }).join('');
  const levels = tp.id === 'all' ? [] : levelsOf(pool);
  const map = levels.map((lv, k) => {
    const n = k + 1, open = levelUnlocked(ch.id, tp.id, n), st = starsOf(levelKey(ch.id, tp.id, n));
    const cls = `gm-node ${open ? '' : 'locked'} ${st ? 'cleared' : ''} ${open && !st ? 'current' : ''}`;
    const inner = `<span class="gm-node-n">${open ? bn(n) : '🔒'}</span><span class="gm-node-stars">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span><small>${bn(lv.length)}টি প্রশ্ন</small>`;
    return open ? `<a class="${cls} tap" href="#/play/${esc(ch.id)}/${esc(tp.id)}/level-${n}">${inner}</a>` : `<span class="${cls}" aria-disabled="true">${inner}</span>`;
  }).join('');
  const earned = levels.reduce((n, _, k) => n + starsOf(levelKey(ch.id, tp.id, k + 1)), 0);
  return {
    nav: 'study',
    title: tp.name,
    back: `#/games/${ch.id}`,
    crumbs: crumbsOf(ch, [[tp.name, `#/games/${ch.id}/${tp.id}`]]),
    accent: ch.subject.accent,
    visit: { chapterId: ch.id },
    html: `<header class="gm-hero rise">
        <div><p class="eyebrow">🎮 গেম জোন · ${esc(ch.name)}</p>
          <h1 class="bn">${esc(tp.name)}</h1>
          <p class="muted small">${bn(pool.length)}টি MCQ · আয়ত্তে ${bn(s.done)} · এখনো শেখা বাকি ${bn(pool.length - s.done)}</p>
          <div class="chip-row">${soundBtn()}</div></div>
        ${ring(s.pct, { size: 76, stroke: 6 })}
      </header>
      ${levels.length ? `<section class="block"><div class="block-head"><h2>🗺️ লেভেল অভিযান</h2><span class="muted small">⭐ ${bn(earned)}/${bn(levels.length * 3)}</span></div>
        <p class="muted small">টপিকের সব MCQ ${bn(levels.length)}টি লেভেলে ভাগ করা — সবগুলো পার হলে টপিকের প্রতিটা MCQ একবার করে খেলা হয়ে যাবে। ৭০% সঠিক হলে পরের লেভেল খোলে।</p>
        <div class="gm-map">${map}</div></section>` : ''}
      <section class="block"><div class="block-head"><h2>🎲 আরও গেম</h2></div><div class="gm-modes">${modes}</div></section>`,
  };
}

export function playView(model, chId, tpId, mode) {
  const ch = model.byId.get(chId);
  if (ch?.level !== 'chapter' || !mode) return null;
  const tp = tpId === 'all' ? { id: 'all', name: 'পুরো অধ্যায়' } : tocOf(ch.id)?.topics.find((x) => x.id === tpId);
  if (!tp || !mcqsOf(ch.id, tp.id).length) return null;
  const lv = /^level-(\d+)$/.exec(mode);
  const m = MODES.find((x) => x.id === mode);
  if (!lv && !m) return null;
  if (lv && !levelUnlocked(ch.id, tp.id, Number(lv[1]))) { location.replace(`#/games/${ch.id}/${tp.id}`); return 'redirect'; }
  const name = lv ? `লেভেল ${bn(lv[1])}` : `${m.emoji} ${m.name}`;
  return {
    nav: 'study',
    title: name,
    back: `#/games/${ch.id}/${tp.id}`,
    crumbs: crumbsOf(ch, [[tp.name, `#/games/${ch.id}/${tp.id}`], [name, location.hash]]),
    accent: ch.subject.accent,
    visit: { chapterId: ch.id },
    html: `<p class="eyebrow gm-play-head">${esc(tp.name)} · ${esc(name)}</p><section class="gm" id="gm" aria-live="polite"></section>`,
    after: () => startGame(document.getElementById('gm'), { ch: ch.id, tp: tp.id, mode, topicName: tp.name }),
  };
}

// Game zone screens: all chapters (#/games), a chapter's hub (#/games/<ch>), one topic's games
// for a content type (#/games/<ch>/<topic>/<source>), and the play screen (#/play/<ch>/<topic>/<mode>).

import { icon } from '../icons.js?v=202610141937';
import { esc, ring, bar, chapterEyebrow, chapterNo, pad2, emptyState } from '../components.js?v=202610141937';
import { topicsOf, topicName, questionsOf, recallOf, ordersOf, factIds, sourcesOf, hasGameData, SOURCES, sourceMeta } from '../gamedata.js?v=202610141937';
import { MODES, SPECIAL, modeCount, levelsOf, levelKey, levelUnlocked, starsOf, bestOf, isMastered, playerLevel, xp, soundOn, startGame, bn, parseMode, modeKey } from '../games.js?v=202610141937';
import { arenaHomeCard, arenaChapterCard } from './arena.js?v=202610141937';

export const hasGames = (ch) => ch?.level === 'chapter' && hasGameData(ch.id);

const stat = (ids) => {
  const done = ids.filter((id) => isMastered(id)).length;
  return { done, total: ids.length, pct: ids.length ? Math.round((done / ids.length) * 100) : 0 };
};
const crumbsOf = (ch, extra = []) => [[ch.subject.name, `#/s/${ch.subject.id}`], [chapterNo(ch) != null ? `Ch ${pad2(chapterNo(ch))}` : ch.name, `#/c/${ch.id}`], ['গেম', `#/games/${ch.id}`], ...extra];
const soundBtn = () => `<button class="chip-btn tap" data-g-sound aria-pressed="${soundOn()}">${soundOn() ? '🔊 শব্দ চালু' : '🔇 শব্দ বন্ধ'}</button>`;
const srcSuffix = (src) => (src === 'mcq' ? '' : `.${src}`);
const emojis = (chId, tpId) => sourcesOf(chId, tpId).map((s) => s.emoji).join(' ') + (ordersOf(chId, tpId).length ? ' 🔢' : '') + (recallOf(chId, tpId).length ? ' 🧠' : '');

const chStat = (ch) => stat(factIds(ch.id, 'all'));
const bigCard = (href, title, sub, pct, cls = '') => `<a class="gm-home ${cls} rise tap" href="${href}">
    <span class="gm-home-emoji" aria-hidden="true">🎮</span>
    <span class="gm-home-body"><b>${title}</b><small>${sub}</small>${bar(pct, 'bar-thin')}</span>
    <span class="gm-home-go">খেলো ${icon('chevron')}</span>
  </a>`;

// Home page: one big card into the game zone.
export function gamesHomeCard(model) {
  const chs = model.chapters.filter(hasGames);
  if (!chs.length) return '';
  const x = stat(chs.flatMap((ch) => factIds(ch.id, 'all')));
  return `<section class="block">${bigCard('#/games', 'গেম জোন — খেলে খেলে শেখো', `${bn(chs.length)}টি অধ্যায় · MCQ, এক কথায় প্রকাশ, সূত্র, বিক্রিয়া, ধারণা… · ${bn(x.total)}টি প্রশ্নের ${bn(x.done)}টি আয়ত্তে`, x.pct)}</section>`;
}

// Chapter page: a banner at the top.
export function gamesBanner(ch) {
  if (!hasGames(ch)) return '';
  const x = chStat(ch);
  return `<section class="block">${bigCard(`#/games/${esc(ch.id)}`, 'গেম জোন — এই অধ্যায় খেলে শেখো', `${emojis(ch.id, 'all')} · ${bn(x.total)}টি প্রশ্ন · আয়ত্তে ${bn(x.pct)}%`, x.pct, 'gm-banner')}${arenaChapterCard(ch.id)}</section>`;
}

// #/games: every chapter that has games.
function gamesIndex(model) {
  const chs = model.chapters.filter(hasGames);
  const x = stat(chs.flatMap((ch) => factIds(ch.id, 'all')));
  const groups = model.subjects.map((s) => ({ s, list: chs.filter((ch) => ch.subject === s) })).filter((g) => g.list.length);
  let i = 0;
  const html = groups.map(({ s, list }) => `<section class="block"><div class="block-head"><h2>${esc(s.name)}</h2></div><div class="gm-topics">${list.map((ch) => {
    const c = chStat(ch);
    return `<a class="gm-topic tap rise" style="--i:${Math.min(i++, 12)}" href="#/games/${esc(ch.id)}">
        <span class="gm-topic-no">${chapterNo(ch) != null ? bn(pad2(chapterNo(ch))) : '★'}</span>
        <span class="gm-topic-body"><b>${esc(ch.name)}</b><small>${esc(ch.paper.name)} · ${bn(c.total)}টি প্রশ্ন · আয়ত্তে ${bn(c.done)}</small><small class="gm-src-line">${emojis(ch.id, 'all')}</small>${bar(c.pct, 'bar-thin')}</span>
        <span class="gm-topic-pct">${c.pct === 100 ? '🏆' : `${bn(c.pct)}%`}</span>
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
          <p class="muted small">${bn(chs.length)}টি অধ্যায়ের ${bn(x.total)}টি প্রশ্নের ${bn(x.done)}টি আয়ত্তে</p>
          <div class="chip-row"><span class="chip">🧑‍🚀 খেলোয়াড় লেভেল ${bn(playerLevel())}</span><span class="chip">✨ ${bn(xp())} XP</span>${soundBtn()}</div></div>
        ${ring(x.pct, { size: 76, stroke: 6 })}
      </header>
      <p class="muted small gm-help">অধ্যায় বেছে নাও। প্রতিটা টপিকের MCQ, এক কথায় প্রকাশ, জ্ঞানমূলক প্রশ্ন, সূত্র, বিক্রিয়া, শনাক্তকরণ, ধারণা, ভুল-শুদ্ধ, চিত্র আর মাইন্ড ম্যাপ — যেটা যে অধ্যায়ে আছে, সেটা দিয়েই গেম।</p>
      ${arenaHomeCard()}
      ${html || emptyState({ iconName: 'mcq', title: 'এখনো কোনো অধ্যায়ে গেম নেই', text: 'কনটেন্ট যোগ হলে এখানে গেম খেলা যাবে।' })}`,
  };
}

export function gamesView(model, chId, tpId, src) {
  if (!chId) return gamesIndex(model);
  const ch = model.byId.get(chId);
  if (ch?.level !== 'chapter') return null;
  if (tpId) return topicGames(ch, tpId, src);
  const topics = topicsOf(ch.id);
  const s = chStat(ch);
  const rows = topics.map((tp, i) => {
    const st = stat(factIds(ch.id, tp.id));
    return `<a class="gm-topic tap rise" style="--i:${Math.min(i, 12)}" href="#/games/${esc(ch.id)}/${esc(tp.id)}">
        <span class="gm-topic-no">${bn(pad2(i + 1))}</span>
        <span class="gm-topic-body"><b>${esc(tp.name)}</b><small>${bn(st.total)}টি প্রশ্ন · আয়ত্তে ${bn(st.done)}</small><small class="gm-src-line">${emojis(ch.id, tp.id)}</small>${bar(st.pct, 'bar-thin')}</span>
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
          <p class="muted small">${esc(ch.name)} · ${bn(s.total)}টি প্রশ্নের ${bn(s.done)}টি আয়ত্তে</p>
          <div class="chip-row"><span class="chip">🧑‍🚀 খেলোয়াড় লেভেল ${bn(playerLevel())}</span><span class="chip">✨ ${bn(xp())} XP</span>${soundBtn()}</div></div>
        ${ring(s.pct, { size: 76, stroke: 6 })}
      </header>
      <p class="muted small gm-help">এই অধ্যায়ের যা যা আছে — ${emojis(ch.id, 'all')} — সব দিয়ে গেম। একটা প্রশ্ন পরপর ২ বার সঠিক হলে "আয়ত্তে" ধরা হয়; ভুলগুলো আগে ঘুরে আসে। সব টপিক ১০০% হলে পুরো অধ্যায় ক্লিয়ার!</p>
      ${arenaChapterCard(ch.id)}
      ${rows ? `<section class="block"><div class="block-head"><h2>টপিক বেছে নাও</h2></div><div class="gm-topics">${rows}</div></section>` : ''}
      <section class="block"><a class="gm-topic gm-all tap" href="#/games/${esc(ch.id)}/all"><span class="gm-topic-no">★</span><span class="gm-topic-body"><b>পুরো অধ্যায় মিলিয়ে</b><small>সব টপিকের ${bn(s.total)}টি প্রশ্ন একসাথে — চূড়ান্ত চ্যালেঞ্জ</small></span><span class="gm-topic-pct">${bn(s.pct)}%</span></a></section>`,
  };
}

function topicGames(ch, tpId, srcParam) {
  const name = topicName(ch.id, tpId);
  if (!name) return null;
  const srcs = sourcesOf(ch.id, tpId);
  const ids = srcs.map((s) => s.id);
  const src = srcParam && (srcParam === 'all' || ids.includes(srcParam)) ? srcParam : ids[0] ?? 'all';
  const pool = questionsOf(ch.id, tpId, src);
  const orders = ordersOf(ch.id, tpId), cards = recallOf(ch.id, tpId);
  const s = stat(factIds(ch.id, tpId));
  if (!pool.length && !orders.length && !cards.length) {
    return { nav: 'study', title: 'গেম', back: `#/games/${ch.id}`, crumbs: crumbsOf(ch), html: emptyState({ iconName: 'mcq', title: 'এই টপিকে এখনো গেম নেই', text: 'কনটেন্ট যোগ হলে এখানে গেম খেলা যাবে।' }) };
  }
  const base = `#/games/${esc(ch.id)}/${esc(tpId)}`;
  const chips = srcs.length > 1 || src === 'all'
    ? `<div class="gm-srcs" role="tablist">${[...srcs, { ...sourceMeta('all'), count: questionsOf(ch.id, tpId).length }].map((x) => `<a class="gm-src tap ${x.id === src ? 'on' : ''}" role="tab" aria-selected="${x.id === src}" href="${base}/${x.id}">${x.emoji} ${esc(x.name)} <small>${bn(x.count)}</small></a>`).join('')}</div>`
    : '';
  const meta = sourceMeta(src);
  const levels = src === 'all' ? [] : levelsOf(pool);
  const map = levels.map((lv, k) => {
    const n = k + 1, open = levelUnlocked(ch.id, tpId, n, src), st = starsOf(levelKey(ch.id, tpId, n, src));
    const cls = `gm-node ${open ? '' : 'locked'} ${st ? 'cleared' : ''} ${open && !st ? 'current' : ''}`;
    const inner = `<span class="gm-node-n">${open ? bn(n) : '🔒'}</span><span class="gm-node-stars">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span><small>${bn(lv.length)}টি প্রশ্ন</small>`;
    return open ? `<a class="${cls} tap" href="#/play/${esc(ch.id)}/${esc(tpId)}/level-${n}${srcSuffix(src)}">${inner}</a>` : `<span class="${cls}" aria-disabled="true">${inner}</span>`;
  }).join('');
  const earned = levels.reduce((n, _, k) => n + starsOf(levelKey(ch.id, tpId, k + 1, src)), 0);
  const modes = pool.length ? MODES.filter((m) => modeCount(m, pool) >= (m.min ?? 1)).map((m, i) => {
    const best = bestOf(modeKey(ch.id, tpId, m.id, src));
    return `<a class="gm-mode tap rise" style="--i:${i}" href="#/play/${esc(ch.id)}/${esc(tpId)}/${m.id}${srcSuffix(src)}">
        <span class="gm-mode-emoji">${m.emoji}</span>
        <span class="gm-mode-body"><b>${m.name}</b><small>${m.desc}</small>${best ? `<span class="gm-mode-best">🏅 সেরা: ${bn(best)}</span>` : ''}</span>
      </a>`;
  }).join('') : '';
  const special = SPECIAL.filter((m) => (m.id === 'order' ? orders : cards).length).map((m, i) => {
    const n = (m.id === 'order' ? orders : cards).length, best = bestOf(`${ch.id}/${tpId}/${m.id}`);
    return `<a class="gm-mode tap rise" style="--i:${i}" href="#/play/${esc(ch.id)}/${esc(tpId)}/${m.id}">
        <span class="gm-mode-emoji">${m.emoji}</span>
        <span class="gm-mode-body"><b>${m.name} <small class="muted">· ${bn(n)}টি</small></b><small>${m.desc}</small>${best ? `<span class="gm-mode-best">🏅 সেরা: ${bn(best)}</span>` : ''}</span>
      </a>`;
  }).join('');
  return {
    nav: 'study',
    title: name,
    back: `#/games/${ch.id}`,
    crumbs: crumbsOf(ch, [[name, `${base}/${src}`]]),
    accent: ch.subject.accent,
    visit: { chapterId: ch.id },
    html: `<header class="gm-hero rise">
        <div><p class="eyebrow">🎮 গেম জোন · ${esc(ch.name)}</p>
          <h1 class="bn">${esc(name)}</h1>
          <p class="muted small">${bn(s.total)}টি প্রশ্ন · আয়ত্তে ${bn(s.done)} · এখনো শেখা বাকি ${bn(s.total - s.done)}</p>
          <div class="chip-row">${soundBtn()}</div></div>
        ${ring(s.pct, { size: 76, stroke: 6 })}
      </header>
      ${pool.length ? `<section class="block"><div class="block-head"><h2>কী দিয়ে খেলবে?</h2></div>${chips}
        <p class="muted small gm-src-now">এখন: <b>${meta.emoji} ${esc(meta.name)}</b> · ${bn(pool.length)}টি প্রশ্ন</p></section>` : ''}
      ${levels.length ? `<section class="block"><div class="block-head"><h2>🗺️ লেভেল অভিযান</h2><span class="muted small">⭐ ${bn(earned)}/${bn(levels.length * 3)}</span></div>
        <p class="muted small">${esc(meta.name)}-এর সব প্রশ্ন ${bn(levels.length)}টি লেভেলে ভাগ করা — সবগুলো পার হলে প্রতিটা প্রশ্ন একবার করে খেলা হয়ে যাবে। ৭০% সঠিক হলে পরের লেভেল খোলে।</p>
        <div class="gm-map">${map}</div></section>` : ''}
      ${modes ? `<section class="block"><div class="block-head"><h2>🎲 ${esc(meta.name)} দিয়ে আরও গেম</h2></div><div class="gm-modes">${modes}</div></section>` : ''}
      ${special ? `<section class="block"><div class="block-head"><h2>✨ অন্য ধরনের গেম</h2></div><div class="gm-modes">${special}</div></section>` : ''}`,
  };
}

export function playView(model, chId, tpId, mode) {
  const ch = model.byId.get(chId);
  if (ch?.level !== 'chapter' || !mode) return null;
  const name = topicName(ch.id, tpId);
  if (!name) return null;
  const { game, src, level } = parseMode(mode);
  const sp = SPECIAL.find((x) => x.id === game);
  const m = MODES.find((x) => x.id === game);
  if (sp) {
    if (!(game === 'order' ? ordersOf(ch.id, tpId) : recallOf(ch.id, tpId)).length) return null;
  } else {
    if ((!m && !level) || (src !== 'all' && !SOURCES.some((x) => x.id === src)) || !questionsOf(ch.id, tpId, src).length) return null;
    if (level && !levelUnlocked(ch.id, tpId, level, src)) { location.replace(`#/games/${ch.id}/${tpId}/${src}`); return 'redirect'; }
  }
  const title = sp ? `${sp.emoji} ${sp.name}` : level ? `লেভেল ${bn(level)}` : `${m.emoji} ${m.name}`;
  const what = sp ? '' : `${sourceMeta(src).emoji} ${sourceMeta(src).name} · `;
  const back = sp ? `#/games/${ch.id}/${tpId}` : `#/games/${ch.id}/${tpId}/${src}`;
  return {
    nav: 'study',
    title,
    back,
    crumbs: crumbsOf(ch, [[name, back], [title, location.hash]]),
    accent: ch.subject.accent,
    visit: { chapterId: ch.id },
    html: `<p class="eyebrow gm-play-head">${esc(name)} · ${what}${esc(title)}</p><section class="gm" id="gm" aria-live="polite"></section>`,
    after: () => startGame(document.getElementById('gm'), { ch: ch.id, tp: tpId, mode, topicName: name }),
  };
}

// New game zone (#/arena): the hub with the player card and the 12 games, the player profile, the
// mastery dashboard, achievements and settings. Each game lives in ../arena/<id>.js and shares one
// learning store with the first game zone (#/games), so mastery, XP and records are the same.

import { esc, bar, ring, chapterNo, pad2, chapterEyebrow } from '../components.js?v=202610150258';
import { bn, refresh, chapters, topicsOf, masteryPct, badgeOf, BADGE } from '../arena/core.js?v=202610150258';
import { A, S, xp, playerLevel, levelFloor, streak, bestStreak, soundOn, toggleSound, animOn, setAnim } from '../learnstore.js?v=202610150258';
import { ACH, achCount, achClaimed, claimAch, checkAchievements } from '../arena/achievements.js?v=202610150258';
import { avatarHtml, pointsLeft } from '../arena/skills.js?v=202610150258';
import { missionSummary } from '../arena/missions.js?v=202610150258';
import { getProfile } from '../profile.js?v=202610150258';
import * as kingdom from '../arena/kingdom.js?v=202610150258';
import * as dragon from '../arena/dragon.js?v=202610150258';
import * as detective from '../arena/detective.js?v=202610150258';
import * as race from '../arena/race.js?v=202610150258';
import * as farm from '../arena/farm.js?v=202610150258';
import * as skills from '../arena/skills.js?v=202610150258';
import * as treasure from '../arena/treasure.js?v=202610150258';
import * as revision from '../arena/revision.js?v=202610150258';
import * as tournament from '../arena/tournament.js?v=202610150258';
import * as missions from '../arena/missions.js?v=202610150258';
import * as space from '../arena/space.js?v=202610150258';
import * as arcade from '../arena/arcade.js?v=202610150258';

export const GAMES = [kingdom, dragon, detective, race, farm, skills, treasure, revision, tournament, missions, space, arcade];
const HOME = ['🎮 নতুন গেম জোন', '#/arena'];
const isOpen = (g) => A.stats.n >= g.meta.need;
const playerName = () => getProfile().name || 'খেলোয়াড়';

export function arenaView(model, a, b, c, d, e) {
  if (!chapters().length) {
    return { nav: 'home', title: 'নতুন গেম জোন', back: '#/', html: '<p class="muted">এখনো কোনো অধ্যায়ে খেলার মতো প্রশ্ন নেই।</p>' };
  }
  if (!a) return hub();
  if (a === 'chapter') return chapterHub(b);
  if (a === 'profile') return page('প্রোফাইল', profilePage());
  if (a === 'dashboard') return page('আয়ত্ত ড্যাশবোর্ড', dashboard());
  if (a === 'achievements') return page('অর্জন', achievements());
  if (a === 'settings') return page('সেটিংস', settings());
  const g = GAMES.find((x) => x.meta.id === a);
  if (!g) return null;
  if (!isOpen(g)) return page(g.meta.name, lockedPage(g));
  const out = g.view({ b, c, d, e });
  if (!out || out === 'redirect') return out;
  return {
    nav: 'home',
    title: out.title ?? g.meta.name,
    back: out.back ?? '#/arena',
    crumbs: [HOME, [`${g.meta.emoji} ${g.meta.name}`, `#/arena/${g.meta.id}`]],
    html: `<div class="arena">${out.html}</div>`,
    after: out.after,
  };
}

const page = (title, o) => ({ nav: 'home', title, back: '#/arena', crumbs: [HOME, [title, '#']], html: `<div class="arena">${o.html}</div>`, after: o.after });

// ---------- the hub ----------
function playerCard() {
  const lv = playerLevel(), cur = levelFloor(lv), next = levelFloor(lv + 1);
  const pct = Math.max(0, Math.min(100, Math.round(((xp() - cur) / (next - cur)) * 100)));
  return `<a class="ar-player tap rise" href="#/arena/profile">
      ${avatarHtml('lg')}
      <span class="ar-player-body"><b>${esc(playerName())}</b><small>লেভেল ${bn(lv)} · ${bn(xp())} XP · পরের লেভেলে ${bn(Math.max(0, next - xp()))} XP</small>${bar(pct, 'bar-thin')}
        <span class="ar-wallet"><span>🪙 ${bn(A.coins)}</span><span>💎 ${bn(A.gems)}</span><span>⚡ ${bn(A.energy)}</span><span>🔥 ${bn(streak())}</span></span></span></a>`;
}
// opts.href / opts.info: the card as shown on one chapter's game page
function gameCard(g, i, opts = {}) {
  const open = isOpen(g);
  const pct = open ? g.progress() : 0;
  const left = g.meta.need - A.stats.n;
  const href = open && opts.href ? opts.href : `#/arena/${g.meta.id}`;
  const foot = opts.info != null ? `<span class="ar-gcard-info">${esc(opts.info)}</span>` : `<span>${bn(pct)}%</span>`;
  return `<a class="ar-gcard tap rise ${open ? '' : 'locked'} ${opts.info != null ? 'ch' : ''}" style="--i:${Math.min(i, 12)}" href="${href}">
      <span class="ar-gcard-top"><span class="ar-gcard-emoji" aria-hidden="true">${open ? g.meta.emoji : '🔒'}</span><span class="ar-gcard-no">${bn(i + 1)}</span></span>
      <b>${esc(g.meta.name)}</b>
      <small>${esc(g.meta.desc)}</small>
      ${open ? `${opts.info != null ? '' : bar(pct, 'bar-thin')}<span class="ar-gcard-foot">${foot}<span class="ar-play">▶ খেলো</span></span>`
        : `<span class="ar-gcard-foot"><span>🔒 আরও ${bn(left)}টি উত্তর দিলে খুলবে</span></span>`}</a>`;
}
function hub() {
  checkAchievements();
  const ms = missionSummary();
  const claimable = ACH.filter((x) => A.ach[x.id] && !achClaimed(x.id)).length;
  const links = [
    ['👤', 'প্রোফাইল', '#/arena/profile', ''],
    ['📊', 'আয়ত্ত ড্যাশবোর্ড', '#/arena/dashboard', ''],
    ['🏅', 'অর্জন', '#/arena/achievements', claimable ? `${bn(claimable)} নতুন` : `${bn(achCount())}/${bn(ACH.length)}`],
    ['🤖', 'রিভিশন সেন্টার', '#/arena/revision', ''],
    ['🌳', 'চরিত্র ও দক্ষতা', '#/arena/skills', pointsLeft() ? `${bn(pointsLeft())} পয়েন্ট` : ''],
    ['⚙️', 'সেটিংস', '#/arena/settings', ''],
  ];
  return {
    nav: 'home',
    title: 'নতুন গেম জোন',
    back: '#/',
    crumbs: [HOME],
    html: `<div class="arena">
      <header class="ar-hub-head rise"><h1>🎮 নতুন গেম জোন</h1>
        <p class="muted small">১২টি গেম — সব অধ্যায়ের নিজের প্রশ্ন দিয়ে, টপিক ধরে বা পুরো অধ্যায়, MCQ বা অন্য কনটেন্ট (এক কথায় প্রকাশ, সূত্র, বিক্রিয়া, ধারণা, মাইন্ড ম্যাপ…)। আয়ত্ত, XP আর রেকর্ড পুরনো গেম জোনের সাথেই এক।</p></header>
      ${playerCard()}
      <a class="ar-mission-strip tap rise" href="#/arena/missions"><span>🎯</span><span><b>আজকের মিশন: ${bn(ms.done)}/${bn(ms.total)} সম্পন্ন</b><small>${ms.got < ms.done ? `${bn(ms.done - ms.got)}টি পুরস্কার নেওয়া বাকি!` : ms.done === ms.total ? 'সব শেষ — দারুণ!' : 'মিশন শেষ করে XP আর কয়েন নাও'}</small></span><span class="ar-play">▶</span></a>
      <nav class="ar-links" aria-label="নতুন গেম জোনের পাতা">${links.map(([e, t, h, x]) => `<a class="ar-link tap" href="${h}"><span>${e}</span><b>${t}</b>${x ? `<small>${x}</small>` : ''}</a>`).join('')}</nav>
      <section class="block"><div class="block-head"><h2>১২টি গেম</h2></div><div class="ar-cards">${GAMES.map((g, i) => gameCard(g, i)).join('')}</div></section>
      <a class="gm-home rise tap" href="#/games"><span class="gm-home-emoji" aria-hidden="true">🕹️</span><span class="gm-home-body"><b>পুরনো গেম জোন</b><small>লেভেল, সময়ের দৌড়, বেলুন, দানব যুদ্ধ, লাখপতি সিঁড়ি, সত্য-মিথ্যা, জোড়া মেলাও, ধাপ সাজাও, মনে করে দেখো</small></span><span class="gm-home-go">খেলো</span></a>
    </div>`,
  };
}

function lockedPage(g) {
  const left = g.meta.need - A.stats.n;
  return {
    html: `<div class="ar-locked rise"><span class="ar-hero-emoji">🔒</span><h1>${g.meta.emoji} ${esc(g.meta.name)}</h1>
      <p>${esc(g.meta.desc)}</p>
      <p class="muted">এই গেমটা খুলবে মোট ${bn(g.meta.need)}টি প্রশ্নের উত্তর দিলে — আর ${bn(left)}টি বাকি।</p>
      ${bar(Math.round((A.stats.n / g.meta.need) * 100), 'bar-thin')}
      <div class="row-btns"><a class="btn btn-primary tap" href="#/arena/kingdom">🏰 অধ্যায় রাজ্যে খেলো</a><a class="btn tap" href="#/arena">সব গেম</a></div></div>`,
  };
}

// ---------- profile ----------
function profilePage() {
  const lv = playerLevel(), cur = levelFloor(lv), next = levelFloor(lv + 1);
  const pct = Math.max(0, Math.min(100, Math.round(((xp() - cur) / (next - cur)) * 100)));
  const mastered = Object.values(S.m).filter((v) => v >= 2).length;
  const acc = A.stats.n ? Math.round((A.stats.c / A.stats.n) * 100) : 0;
  const me = getProfile();
  const stat = (v, l) => `<span><b>${v}</b><small>${l}</small></span>`;
  return {
    html: `<header class="ar-char rise">${avatarHtml('xl')}<div><h1>${esc(playerName())}</h1>
        <p class="muted small">লেভেল ${bn(lv)} · ${bn(xp())} XP</p>${bar(pct, 'bar-thin')}
        <p class="muted small">পরের লেভেলে ${bn(Math.max(0, next - xp()))} XP বাকি</p>
        <div class="row-btns"><a class="btn tap" href="#/arena/skills">🌳 চরিত্র সাজাও</a><a class="btn tap" href="#/profile">✏️ ${me.name ? 'নাম বদলাও' : 'নাম দাও'}</a></div></div></header>
      <section class="block"><div class="block-head"><h2>সম্পদ</h2></div><div class="ar-stats">${stat(`🪙 ${bn(A.coins)}`, 'কয়েন')}${stat(`💎 ${bn(A.gems)}`, 'রত্ন')}${stat(`⚡ ${bn(A.energy)}`, 'শক্তি')}${stat(`🌟 ${bn(pointsLeft())}`, 'দক্ষতা পয়েন্ট')}</div></section>
      <section class="block"><div class="block-head"><h2>পড়ার হিসাব</h2></div><div class="ar-stats">
        ${stat(bn(A.stats.n), 'মোট উত্তর')}${stat(`${bn(acc)}%`, 'নির্ভুলতা')}${stat(bn(mastered), 'আয়ত্তে')}${stat(bn(A.stats.rec), 'ভুল শোধরানো')}
        ${stat(`🔥 ${bn(streak())}`, 'ধারা')}${stat(`🏅 ${bn(bestStreak())}`, 'সেরা ধারা')}${stat(`${bn(achCount())}/${bn(ACH.length)}`, 'অর্জন')}${stat(bn(Object.keys(S.best).length), 'রেকর্ড আছে')}</div>
        <p class="muted small">XP আর কয়েন খেলার পুরস্কার; “আয়ত্তে” মানে পরপর ২ বার সঠিক — দুটো আলাদা হিসাব। সাহায্য (৫০:৫০/পাস) নিয়ে দেওয়া উত্তরে আয়ত্ত বাড়ে না।</p></section>`,
  };
}

// ---------- mastery dashboard ----------
function dashboard() {
  const groups = [];
  let done = 0, total = 0;
  for (const ch of chapters()) {
    let g = groups.find((x) => x.s === ch.subject);
    if (!g) groups.push(g = { s: ch.subject, list: [] });
    const m = masteryPct(ch.id);
    done += m.done; total += m.total;
    g.list.push({ ch, m });
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  const badges = [0, 0, 0, 0];
  const body = groups.map(({ s, list }) => `<section class="block"><div class="block-head"><h2>${esc(s.name)}</h2></div>${list.map(({ ch, m }) => {
    const rows = topicsOf(ch.id).map((t) => {
      const x = masteryPct(ch.id, t.id);
      const b = badgeOf(x.pct);
      badges[b]++;
      return `<li><span class="ar-dash-name">${esc(t.name)}</span>${bar(x.pct, 'bar-thin')}<span class="ar-dash-pct">${BADGE[b] || ''} ${bn(x.pct)}%</span></li>`;
    }).join('');
    return `<details class="ar-dash"><summary><span class="gm-topic-no">${chapterNo(ch) != null ? bn(pad2(chapterNo(ch))) : '★'}</span><span class="ar-dash-body"><b>${esc(ch.name)}</b><small>${bn(m.done)}/${bn(m.total)} আয়ত্তে</small>${bar(m.pct, 'bar-thin')}</span><span class="gm-topic-pct">${bn(m.pct)}%</span></summary>
      <ul class="ar-dash-list">${rows}</ul>
      <div class="row-btns"><a class="btn tap" href="#/arena/revision/${esc(ch.id)}">🤖 রিভিশন</a><a class="btn tap" href="#/arena/kingdom/${esc(ch.id)}">🏰 রাজ্য</a><a class="btn tap" href="#/games/${esc(ch.id)}">🕹️ পুরনো গেম</a></div></details>`;
  }).join('')}</section>`).join('');
  return {
    html: `<header class="gm-hero rise"><div><p class="eyebrow">সব অধ্যায়</p><h1>📊 আয়ত্ত ড্যাশবোর্ড</h1>
        <p class="muted small">${bn(total)}টি প্রশ্নের ${bn(done)}টি আয়ত্তে (MCQ থাকলে MCQ, না থাকলে অধ্যায়ের অন্য কনটেন্ট)</p>
        <p class="muted small" id="arBadges"></p></div>${ring(pct, { size: 76, stroke: 6 })}</header>
      <p class="muted small">টপিকের ব্যাজ আসল আয়ত্ত থেকে: 🥉 ৩০% · 🥈 ৬০% · 🥇 ৯০%। একটা প্রশ্ন পরপর ২ বার সঠিক হলে আয়ত্তে ধরা হয়।</p>
      ${body}`,
    after: () => {
      const el = document.getElementById('arBadges');
      if (el) el.textContent = `ব্যাজ: 🥇 ${bn(badges[3])} · 🥈 ${bn(badges[2])} · 🥉 ${bn(badges[1])}`;
    },
  };
}

// ---------- achievements ----------
function achievements() {
  checkAchievements();
  const got = ACH.filter((x) => A.ach[x.id]);
  return {
    html: `<div id="arAch"><header class="gm-hero rise"><div><h1>🏅 অর্জন</h1><p class="muted small">${bn(got.length)}/${bn(ACH.length)}টি অর্জন · প্রতিটার পুরস্কার একবারই</p></div>${ring(Math.round((got.length / ACH.length) * 100), { size: 76, stroke: 6 })}</header>
      <div class="ar-achs">${ACH.map((x) => {
        const have = !!A.ach[x.id], taken = achClaimed(x.id);
        return `<div class="ar-ach ${have ? 'have' : ''}"><span class="ar-ach-e">${have ? x.e : '🔒'}</span><span class="ar-ach-body"><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></span>
          ${have ? (taken ? `<small class="ar-got">✓ 🪙 ${bn(x.coins)}</small>` : `<button class="btn btn-primary tap" data-ach="${x.id}">🎁 ${bn(x.coins)} 🪙</button>`) : `<small class="muted">🪙 ${bn(x.coins)}</small>`}</div>`;
      }).join('')}</div></div>`,
    after: () => document.getElementById('arAch')?.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ach]');
      if (!b) return;
      claimAch(b.dataset.ach);
      refresh();
    }),
  };
}

// ---------- settings ----------
function settings() {
  const row = (attr, on, title, desc) => `<button class="ar-set tap" ${attr} aria-pressed="${on}"><span class="ar-set-body"><b>${title}</b><small>${desc}</small></span><span class="ar-toggle ${on ? 'on' : ''}" aria-hidden="true"><i></i></span></button>`;
  return {
    html: `<div id="arSet"><h1 class="ar-h1">⚙️ সেটিংস</h1>
      ${row('data-set-sound', soundOn(), '🔊 শব্দ', 'সঠিক/ভুল উত্তর আর জয়ের আওয়াজ (দুই গেম জোনেই)')}
      ${row('data-set-anim', animOn(), '✨ অ্যানিমেশন', 'বন্ধ করলে কনফেটি, ঝাঁকুনি আর নড়তে থাকা নিশানা থাকবে না')}
      <section class="block"><div class="block-head"><h2>তোমার অগ্রগতি</h2></div>
        <p class="muted small">আয়ত্ত, XP, কয়েন, রেকর্ড, অর্জন আর প্রতিটা গেমের অবস্থা এই ফোনেই সেভ থাকে — ইন্টারনেট ছাড়াও। ফোন বদলালে <a href="#/backup">ব্যাকআপ</a> থেকে সব নিয়ে নিতে পারো।</p></section></div>`,
    after: () => document.getElementById('arSet')?.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-set-sound]')) { toggleSound(); refresh(); }
      if (ev.target.closest('[data-set-anim]')) { setAnim(animOn() ? 'off' : 'on'); refresh(); }
    }),
  };
}

// ---------- one chapter's 12 games (#/arena/chapter/<ch>) ----------
// Where each game opens for one chapter; the farm, skill tree and missions are the same for all chapters.
const CH_HREF = {
  kingdom: (c) => `#/arena/kingdom/${c}`, dragon: (c) => `#/arena/dragon/${c}`, detective: (c) => `#/arena/detective/${c}`,
  race: (c) => `#/arena/race/${c}`, farm: (c) => `#/arena/farm/work/${c}`, skills: () => '#/arena/skills',
  treasure: (c) => `#/arena/treasure/${c}`, revision: (c) => `#/arena/revision/${c}`, tournament: (c) => `#/arena/tournament/custom/${c}`,
  missions: () => '#/arena/missions', space: (c) => `#/arena/space/${c}`, arcade: (c) => `#/arena/arcade/${c}`,
};
const SHARED_INFO = { farm: 'এই অধ্যায়ের প্রশ্নে পানি আনো', skills: 'সব অধ্যায়ের জন্য একটাই', missions: 'সব অধ্যায় মিলিয়ে রোজ ৪টি', tournament: 'এই অধ্যায়ের আজকের সেট' };
function chapterHub(chId) {
  const ch = chapters().find((x) => x.id === chId);
  if (!ch) return null;
  const m = masteryPct(ch.id);
  const id = encodeURIComponent(ch.id);
  const cards = GAMES.map((g, i) => gameCard(g, i, { href: CH_HREF[g.meta.id](id), info: g.chapterInfo?.(ch.id) ?? SHARED_INFO[g.meta.id] ?? '' })).join('');
  return {
    nav: 'study',
    title: '১২টি গেম',
    back: `#/c/${id}`,
    crumbs: [[ch.subject.name, `#/s/${ch.subject.id}`], [chapterNo(ch) != null ? `Ch ${pad2(chapterNo(ch))}` : ch.name, `#/c/${id}`], ['১২টি গেম', '#']],
    html: `<div class="arena">
      <header class="gm-hero rise"><div><p class="eyebrow">${esc(ch.subject.name)} · ${esc(chapterEyebrow(ch))}</p>
          <h1>🎮 ১২টি গেম</h1>
          <p class="muted small">${esc(ch.name)} · ${bn(m.total)}টি প্রশ্নের ${bn(m.done)}টি আয়ত্তে</p></div>
        ${ring(m.pct, { size: 76, stroke: 6 })}</header>
      <p class="muted small">প্রতিটা গেম এই অধ্যায়ের নিজের প্রশ্ন দিয়ে — টপিক ধরে বা পুরো অধ্যায়, MCQ বা অন্য কনটেন্ট।</p>
      ${playerCard()}
      <div class="ar-cards">${cards}</div>
      <a class="ar-mission-strip tap rise" href="#/arena"><span>🎮</span><span><b>সব অধ্যায়ের গেম জোন</b><small>প্রোফাইল, আয়ত্ত ড্যাশবোর্ড, অর্জন, সেটিংস</small></span><span class="ar-play">▶</span></a>
    </div>`,
  };
}

// The game-zone index card (#/games) and the chapter-page card.
export function arenaHomeCard() {
  if (!chapters().length) return '';
  const open = GAMES.filter(isOpen).length;
  return `<section class="block"><a class="gm-home ar-home rise tap" href="#/arena">
      <span class="gm-home-emoji" aria-hidden="true">🎮</span>
      <span class="gm-home-body"><b>নতুন গেম জোন — ১২টি গেম</b><small>অধ্যায় রাজ্য, ড্রাগন যুদ্ধ, রহস্য গোয়েন্দা, রেসিং, খামার, গুপ্তধন, মহাকাশ… · ${bn(open)}টি খোলা · লেভেল ${bn(playerLevel())} · 🔥 ${bn(streak())}</small></span>
      <span class="gm-home-go">খেলো</span></a></section>`;
}
export function arenaChapterCard(chId) {
  if (!chapters().some((c) => c.id === chId)) return '';
  const open = GAMES.filter(isOpen).length;
  return `<a class="gm-home ar-home rise tap" href="#/arena/chapter/${encodeURIComponent(chId)}">
      <span class="gm-home-emoji" aria-hidden="true">🎮</span>
      <span class="gm-home-body"><b>১২টি গেম — এই অধ্যায়ে</b><small>অধ্যায় রাজ্য, ড্রাগন যুদ্ধ, রহস্য গোয়েন্দা, রেসিং, গুপ্তধন, মহাকাশ, আর্কেড… · ${bn(open)}টি খোলা</small></span>
      <span class="gm-home-go">খেলো</span></a>`;
}

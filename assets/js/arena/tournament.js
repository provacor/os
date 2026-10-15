// 9. Tournament — today's, this week's or a chosen topic's question set (the same set for every
// player, picked by a seed), 1–4 players passing one phone. Only the phone's owner (player 1)
// changes mastery; the ranking never does. Records stay on this phone — it is not a global board.

import { esc, bn, poolOf, mixedPool, ask, askQuestion, mount, chapters, topicsOf, chapterById, validSrc, srcChips, chapterList, topicList, scopeName, hashStr, seeded, seededShuffle, sfx, confetti, animOn } from './core.js?v=202610150356';
import { gameState, claim, saveA, today, finishRecord } from '../learnstore.js?v=202610150356';
import { checkAchievements } from './achievements.js?v=202610150356';
import { getProfile } from '../profile.js?v=202610150356';

export const meta = { id: 'tournament', emoji: '🏆', name: 'টুর্নামেন্ট', desc: 'আজকের আর এই সপ্তাহের টুর্নামেন্ট — নিজের রেকর্ড ভাঙো, বা এক ফোনে বন্ধুদের সাথে পালা করে খেলো।', need: 80 };
const st = () => gameState('tournament', { results: [], done: {}, players: 1, names: [] });
const BONUS_SECS = 10, PER_SEC = 5;

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
const allIds = () => chapters().map((c) => c.id);
function category(b, ch, tp, src) {
  if (b === 'daily') return { cat: 'daily', key: `daily:${today()}`, title: '📅 আজকের টুর্নামেন্ট', sub: today(), n: 10, pool: () => mixedPool(allIds(), 'mcq'), back: '#/arena/tournament' };
  if (b === 'weekly') return { cat: 'weekly', key: `weekly:${isoWeek()}`, title: '🗓️ সাপ্তাহিক টুর্নামেন্ট', sub: `সপ্তাহ ${isoWeek()}`, n: 15, pool: () => mixedPool(allIds(), 'mcq'), back: '#/arena/tournament' };
  return { cat: 'custom', key: `custom:${ch}/${tp}/${src}:${today()}`, title: `🎯 ${scopeName(ch, tp)}`, sub: `${chapterById(ch).name} · আজকের সেট`, n: 10, pool: () => poolOf(ch, tp, src), back: `#/arena/tournament/custom/${ch}` };
}
const board = (key) => st().results.filter((r) => r.key === key).sort((a, b) => b.score - a.score || a.ms - b.ms).slice(0, 10);
const ownerBest = (key) => Math.max(0, ...st().results.filter((r) => r.key === key && r.owner).map((r) => r.score));

export function progress() {
  // this week's activity: today's and this week's tournaments played
  const d = st().results.some((r) => r.key === `daily:${today()}` && r.owner) ? 50 : 0;
  const w = st().results.some((r) => r.key === `weekly:${isoWeek()}` && r.owner) ? 50 : 0;
  return d + w;
}

export function view({ b, c: ch, d: tp, e: src }) {
  if (!b) return home();
  if (b === 'daily' || b === 'weekly') return setup(category(b));
  if (b !== 'custom') return null;
  if (!ch) return { title: 'নিজের বাছাই', back: '#/arena/tournament', html: `<p class="muted small">যে অধ্যায়ের টুর্নামেন্ট খেলবে:</p>${chapterList((c) => `#/arena/tournament/custom/${c.id}`)}` };
  if (!chapterById(ch)) return null;
  if (!tp) return { title: chapterById(ch).name, back: '#/arena/tournament/custom', html: topicList(ch, (t) => `#/arena/tournament/custom/${esc(ch)}/${esc(t)}`) };
  if (tp !== 'all' && !topicsOf(ch).some((t) => t.id === tp)) return null;
  const s = validSrc(ch, tp, src);
  return setup(category('custom', ch, tp, s), srcChips(`#/arena/tournament/custom/${esc(ch)}/${esc(tp)}`, ch, tp, s));
}

const boardHtml = (key) => {
  const list = board(key);
  if (!list.length) return '<p class="muted small">এখনো কেউ খেলেনি — প্রথম রেকর্ড তোমার হোক!</p>';
  return `<ol class="ar-board-list">${list.map((r, i) => `<li class="${r.owner ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i] ?? bn(i + 1)}</span><b>${esc(r.name)}</b><small>${bn(r.right)}/${bn(r.n)} · ${bn(Math.round(r.ms / 1000))} সে.</small><em>${bn(r.score)}</em></li>`).join('')}</ol>`;
};

function home() {
  const cats = [category('daily'), category('weekly')];
  return {
    title: meta.name,
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🏆</span><div><h1>টুর্নামেন্ট</h1>
        <p class="muted small">প্রতিটা টুর্নামেন্টে সবার জন্য একই প্রশ্নের সেট। এক ফোনে ১–৪ জন পালা করে খেলতে পারো।</p></div></header>
      <p class="ar-note">📱 এই ফোনের রেকর্ড (লোকাল) — এটা কোনো অনলাইন বা গ্লোবাল র‍্যাঙ্কিং নয়।</p>
      ${cats.map((c) => `<section class="block ar-tcard"><div class="block-head"><h2>${c.title}</h2><small class="muted">${esc(c.sub)} · ${bn(c.n)}টি প্রশ্ন</small></div>
        ${boardHtml(c.key)}
        <a class="btn btn-primary tap" href="#/arena/tournament/${c.cat}">▶ খেলো</a></section>`).join('')}
      <section class="block ar-tcard"><div class="block-head"><h2>🎯 নিজের বাছাই</h2><small class="muted">যেকোনো অধ্যায় বা টপিক · আজকের সেট</small></div>
        <a class="btn tap" href="#/arena/tournament/custom">অধ্যায় বেছে নাও</a></section>`,
  };
}

function setup(cat, chips = '') {
  return {
    title: cat.title.replace(/^\S+\s/, ''),
    back: cat.back,
    html: `<p class="eyebrow">🏆 ${esc(cat.sub)}</p><h1 class="ar-h1">${esc(cat.title)}</h1>${chips}
      <section class="gm ar-game" id="ar"></section>
      <section class="block"><div class="block-head"><h2>📱 এই ফোনের রেকর্ড (লোকাল)</h2></div>${boardHtml(cat.key)}</section>`,
    after: () => lobby(document.getElementById('ar'), cat),
  };
}

function lobby(el, cat) {
  const pool = cat.pool();
  if (!pool.length) { el.innerHTML = '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'; return; }
  mount(() => {});
  const s = st();
  const me = getProfile().name || 'আমি';
  const paint = () => {
    const n = Math.min(4, Math.max(1, s.players));
    el.innerHTML = `<div class="ar-lobby rise">
        <p class="muted small">কতজন খেলবে? (এক ফোনে পালা করে)</p>
        <div class="gm-srcs ar-players">${[1, 2, 3, 4].map((k) => `<button class="gm-src tap ${k === n ? 'on' : ''}" data-tn-n="${k}">${'🧑'.repeat(k)} ${bn(k)}</button>`).join('')}</div>
        <div class="ar-names">${Array.from({ length: n }, (_, i) => `<label>${i === 0 ? '১. তুমি (ফোনের মালিক)' : `${bn(i + 1)}. খেলোয়াড়`}<input class="ar-input" data-tn-name="${i}" maxlength="16" value="${esc(s.names[i] || (i === 0 ? me : `খেলোয়াড় ${bn(i + 1)}`))}"></label>`).join('')}</div>
        <ul class="ar-rules"><li>${bn(cat.n)}টি প্রশ্ন — সবার জন্য একই</li><li>সঠিক উত্তরে ১০০, দ্রুত হলে +${bn(BONUS_SECS * PER_SEC)} পর্যন্ত বোনাস</li>${n > 1 ? '<li>খেলার মাঝে সঠিক উত্তর দেখানো হবে না — শেষে সবাই একসাথে দেখবে</li><li>শুধু ১ নম্বর খেলোয়াড়ের উত্তরে এই ফোনের আয়ত্ত বদলায়</li>' : ''}</ul>
        <button class="btn btn-primary tap ar-go" data-tn-go>🏁 টুর্নামেন্ট শুরু</button></div>`;
  };
  const readNames = () => el.querySelectorAll('[data-tn-name]').forEach((x) => { s.names[Number(x.dataset.tnName)] = x.value.trim().slice(0, 16); });
  el.onclick = (e) => {
    const b = e.target.closest('[data-tn-n]');
    if (b) { readNames(); s.players = Number(b.dataset.tnN); saveA(); return paint(); }
    if (e.target.closest('[data-tn-go]')) {
      readNames(); saveA();
      el.onclick = null;
      play(el, cat, pool);
    }
  };
  paint();
}

function play(el, cat, pool) {
  const s = st();
  const n = Math.min(4, Math.max(1, s.players));
  const names = Array.from({ length: n }, (_, i) => s.names[i] || (i === 0 ? 'আমি' : `খেলোয়াড় ${bn(i + 1)}`));
  const set = seededShuffle(pool, seeded(hashStr(cat.key))).slice(0, cat.n);
  const qs = set.map((x) => ask(x, cat.cat === 'custom' ? pool : poolOf(x.ch, 'all', validSrc(x.ch, 'all', 'mcq'))));
  const sid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const scores = names.map((name, i) => ({ name, owner: i === 0, score: 0, right: 0, ms: 0, picks: [] }));
  let p = 0, timer = null;
  const stop = () => clearInterval(timer);
  mount(stop);
  const handOver = () => {
    if (p >= n) return finish();
    if (n === 1) return round();
    el.innerHTML = `<div class="ar-handover rise"><span class="ar-hero-emoji">📱</span><h2>এবার ফোনটা দাও: ${esc(names[p])}</h2>
        <p class="muted small">${p === 0 ? 'প্রথম পালা' : `${bn(p)} জনের খেলা শেষ`} · ${bn(cat.n)}টি প্রশ্ন</p>
        <button class="btn btn-primary tap" data-tn-start>আমি তৈরি — শুরু করো</button></div>`;
    el.querySelector('[data-tn-start]').onclick = round;
  };
  const round = () => {
    const me = scores[p];
    let i = 0, t0 = 0, panel = null;
    const step = () => {
      if (i >= qs.length) { stop(); p++; return handOver(); }
      el.innerHTML = `<div class="gm-hud"><span>🧑 ${esc(me.name)}</span><span class="gm-prog"><i style="width:${(i / qs.length) * 100}%"></i></span><span id="tnClock">⏱️ ০</span></div>
        <p class="ar-score-line">স্কোর: <b id="tnScore">${bn(me.score)}</b></p><div id="arq"></div>`;
      t0 = Date.now();
      stop();
      timer = setInterval(() => { const c = el.querySelector('#tnClock'); if (c) c.textContent = `⏱️ ${bn(Math.floor((Date.now() - t0) / 1000))}`; }, 500);
      const q = qs[i];
      panel = askQuestion(el.querySelector('#arq'), q, {
        label: `প্রশ্ন ${bn(i + 1)}/${bn(qs.length)}`, assist: false, noRecord: !me.owner, reveal: n === 1, autoNextMs: n === 1 ? 700 : 500,
        onAnswer: (ok, _res, k) => {
          const ms = Date.now() - t0;
          me.ms += ms;
          me.picks.push(k);
          if (ok) { me.right++; me.score += 100 + Math.max(0, BONUS_SECS - Math.floor(ms / 1000)) * PER_SEC; }
          stop();
        },
        onNext: () => { panel.destroy(); i++; step(); },
      });
    };
    step();
  };
  const finish = () => {
    if (s.done[sid]) return; // submitted once
    s.done[sid] = 1;
    const ownerPrev = ownerBest(cat.key);
    for (const r of scores) s.results.push({ key: cat.key, cat: cat.cat, name: r.name, owner: r.owner, score: r.score, right: r.right, n: qs.length, ms: r.ms, at: today(), sid: `${sid}:${r.owner ? 'o' : r.name}` });
    s.results = s.results.slice(-300);
    const doneKeys = Object.keys(s.done);
    if (doneKeys.length > 300) for (const kk of doneKeys.slice(0, doneKeys.length - 300)) delete s.done[kk];
    saveA();
    const owner = scores[0];
    const rec = finishRecord(`tournament/${cat.key.split(':')[0]}`, owner.score);
    const rewards = [];
    if (cat.cat === 'daily' && claim(`tournament:daily:${today()}`, { coins: 20 })) rewards.push('📅 আজকের টুর্নামেন্ট: 🪙 +২০');
    if (cat.cat === 'weekly' && claim(`tournament:weekly:${isoWeek()}`, { coins: 50, gems: 1 })) rewards.push('🗓️ সাপ্তাহিক: 🪙 +৫০ · 💎 +১');
    rewards.push(...checkAchievements().map((a) => `🏅 নতুন অর্জন: ${a.name}`));
    const ranked = [...scores].sort((a, b) => b.score - a.score || a.ms - b.ms);
    const beat = owner.score > ownerPrev;
    (beat || n > 1 ? sfx.win : sfx.up)();
    el.innerHTML = `<div class="gm-end ar-end rise">
        <div class="gm-end-emoji">🏆</div>
        <h2>${n > 1 ? `বিজয়ী: ${esc(ranked[0].name)}!` : 'টুর্নামেন্ট শেষ'}</h2>
        <ol class="ar-board-list">${ranked.map((r, i) => `<li class="${r.owner ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i] ?? bn(i + 1)}</span><b>${esc(r.name)}</b><small>${bn(r.right)}/${bn(qs.length)} · ${bn(Math.round(r.ms / 1000))} সে.</small><em>${bn(r.score)}</em></li>`).join('')}</ol>
        <p class="gm-best">${ownerPrev ? (beat ? `🎉 ${esc(owner.name)}: নিজের রেকর্ড ভাঙলে! ${bn(ownerPrev)} → ${bn(owner.score)}` : `${esc(owner.name)}: তোমার সেরা ${bn(ownerPrev)} · এবার ${bn(owner.score)}`) : `${esc(owner.name)}: প্রথম রেকর্ড ${bn(owner.score)}`}${rec.gainXp ? ` · +${bn(rec.gainXp)} XP` : ''}</p>
        ${rewards.length ? `<div class="ar-rewards">${rewards.map((r) => `<span class="ar-reward rise">${r}</span>`).join('')}</div>` : ''}
        <p class="ar-note">📱 এই ফোনের রেকর্ড (লোকাল) — গ্লোবাল র‍্যাঙ্কিং নয়। র‍্যাঙ্ক আয়ত্তে কোনো প্রভাব ফেলে না।</p>
        <div class="row-btns"><a class="btn btn-primary tap" href="${cat.back}">🏆 টুর্নামেন্টে ফেরো</a></div>
        <details class="gm-review"><summary>সব প্রশ্নের সঠিক উত্তর আর ব্যাখ্যা</summary>
          ${qs.map((q, i) => `<div class="gm-rv"><p class="gm-rv-q">${bn(i + 1)}. ${esc(q.q)}</p><p class="gm-rv-a">✓ ${esc(q.opts[q.right].t)}</p>
            <p class="muted small">${scores.map((r) => `${esc(r.name)}: ${r.picks[i] === q.right ? '✓' : '✗'}`).join(' · ')}</p>${q.exp ? `<p class="gm-rv-e">${esc(q.exp)}</p>` : ''}</div>`).join('')}</details>
      </div>`;
    if (animOn()) confetti(el);
  };
  handOver();
}

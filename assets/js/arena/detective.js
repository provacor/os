// 3. Mystery Detective — every chapter is a case. Each right answer in a topic gives a clue;
// four clues make that topic's evidence. With every piece of evidence on the board, the final
// questioning (the whole chapter) solves the case. The story is only a frame: every question,
// answer and explanation is the chapter's own.

import { esc, bn, poolOf, smartPick, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, validSrc, srcChips, chapterList, scopeName, hashStr } from './core.js?v=202610150258';
import { gameState, claim, claimed, saveA } from '../learnstore.js?v=202610150258';

export const meta = { id: 'detective', emoji: '🕵️', name: 'রহস্য গোয়েন্দা', desc: 'প্রতিটা সঠিক উত্তরে একটা সূত্র, প্রতিটা টপিকে একটা প্রমাণ — সব প্রমাণ জুড়ে রহস্যের সমাধান করো!', need: 40 };
const CLUES = 4;      // clues that make one topic's evidence
const SESSION = 6;    // questions in one investigation
const FINAL = 8;      // questions in the final questioning
const CASES = [
  { title: 'হারানো রত্নের রহস্য', intro: 'শহরের জাদুঘর থেকে ‘জ্ঞানমণি’ উধাও! পাহারাদার কিছুই দেখেনি। প্রতিটা প্রশ্নের সঠিক উত্তরে একটা করে সূত্র মিলবে।', end: 'সব প্রমাণ মিলে গেছে — ‘জ্ঞানমণি’ জাদুঘরেই ফিরে এল!', icon: '💎' },
  { title: 'বন্ধ ল্যাবরেটরির রহস্য', intro: 'রাতে ল্যাবের দরজা ভেতর থেকে বন্ধ, অথচ গবেষণার খাতাটা নেই! সঠিক উত্তরগুলোই তোমার আতশ কাচ।', end: 'খাতাটা পাওয়া গেছে — রহস্যের জট খুলে গেল!', icon: '🧪' },
  { title: 'পুরনো লাইব্রেরির ধাঁধা', intro: 'লাইব্রেরির এক কোণে সাংকেতিক চিঠি — কে লিখল, কেন লিখল? প্রতিটা টপিকের প্রমাণ জোগাড় করো।', end: 'সংকেতের মানে বেরিয়ে এসেছে — ধাঁধার সমাধান তুমিই করলে!', icon: '📜' },
];
const st = () => gameState('detective', { clues: {}, stats: {} });
const k = (ch, tp) => `${ch}/${tp}`;
const caseOf = (ch) => CASES[hashStr(ch) % CASES.length];
const cluesAt = (ch, tp) => Math.min(CLUES, st().clues[k(ch, tp)] ?? 0);
const hasEvidence = (ch, tp) => cluesAt(ch, tp) >= CLUES;
const allEvidence = (ch) => topicsOf(ch).every((t) => hasEvidence(ch, t.id));
const solved = (ch) => claimed(`detective:solved:${ch}`);

export function chapterInfo(ch) {
  const tps = topicsOf(ch);
  return `প্রমাণ ${bn(tps.filter((t) => hasEvidence(ch, t.id)).length)}/${bn(tps.length)}${solved(ch) ? ' · ✅' : ''}`;
}

export function progress() {
  let done = 0, total = 0;
  for (const c of chapters()) {
    const tps = topicsOf(c.id);
    total += tps.length * CLUES + CLUES;
    done += tps.reduce((n, t) => n + cluesAt(c.id, t.id), 0) + (solved(c.id) ? CLUES : 0);
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function view({ b: ch, c: tp, d: src }) {
  if (!ch) return home();
  if (!chapterById(ch)) return null;
  if (!tp || tp === 'board') return board(ch, src);
  return investigate(ch, tp, src);
}

function home() {
  return {
    title: meta.name,
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🕵️</span><div><h1>রহস্য গোয়েন্দা</h1>
        <p class="muted small">প্রতিটা অধ্যায় একটা রহস্য। টপিক ধরে ধরে সূত্র খোঁজো, প্রমাণ বোর্ডে সাজাও, শেষে জেরা করে সমাধান!</p></div></header>
      ${chapterList((c) => `#/arena/detective/${c.id}`, (c) => {
        const tps = topicsOf(c.id);
        return `· প্রমাণ ${bn(tps.filter((t) => hasEvidence(c.id, t.id)).length)}/${bn(tps.length)} ${solved(c.id) ? '· ✅ সমাধান' : ''}`;
      })}`,
  };
}

function board(ch, srcParam) {
  const c = chapterById(ch);
  const cs = caseOf(ch);
  const src = validSrc(ch, 'all', srcParam);
  const tps = topicsOf(ch);
  const s = st().stats[ch] ?? { n: 0, c: 0 };
  const found = tps.filter((t) => hasEvidence(ch, t.id)).length;
  const cards = tps.map((tp, i) => {
    const n = cluesAt(ch, tp.id);
    const done = n >= CLUES;
    return `<a class="ar-evidence tap rise ${done ? 'found' : ''}" style="--i:${Math.min(i, 10)};--tilt:${(i % 3) - 1}deg" href="#/arena/detective/${esc(ch)}/${esc(tp.id)}/${src}">
        <span class="ar-pin" aria-hidden="true">📌</span>
        <b>${done ? '🧾' : '📁'} ${esc(tp.name)}</b>
        <span class="ar-clues" aria-label="${bn(n)}টি সূত্র">${'🔎'.repeat(n)}${'<i>·</i>'.repeat(CLUES - n)}</span>
        <small>${done ? 'প্রমাণ পাওয়া গেছে' : `সূত্র ${bn(n)}/${bn(CLUES)}`}</small></a>`;
  }).join('');
  const ready = allEvidence(ch);
  return {
    title: c.name,
    back: '#/arena/detective',
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">${cs.icon}</span><div><p class="eyebrow">🕵️ ${esc(c.name)}</p><h1>${esc(cs.title)}</h1>
        <p class="muted small">${esc(cs.intro)}</p></div></header>
      <div class="ar-stats">
        <span><b>${bn(found)}/${bn(tps.length)}</b><small>প্রমাণ</small></span>
        <span><b>${bn(s.n ? Math.round((s.c / s.n) * 100) : 0)}%</b><small>নির্ভুলতা</small></span>
        <span><b>${bn(Math.round(((found + (solved(ch) ? 1 : 0)) / (tps.length + 1)) * 100))}%</b><small>সম্পূর্ণ</small></span>
      </div>
      ${srcChips(`#/arena/detective/${esc(ch)}/board`, ch, 'all', src)}
      <section class="block"><div class="block-head"><h2>🗂️ প্রমাণ বোর্ড</h2></div><div class="ar-board">${cards}</div></section>
      <section class="block">${ready
        ? `<a class="ar-boss-card tap rise ${solved(ch) ? 'won' : ''}" href="#/arena/detective/${esc(ch)}/final/${src}"><span class="ar-boss-face">🗝️</span><span><b>চূড়ান্ত জেরা — রহস্যের সমাধান</b><small>পুরো অধ্যায় থেকে ${bn(FINAL)}টি প্রশ্ন · ৭৫% সঠিক হলে সমাধান ${solved(ch) ? '· ✅ সমাধান হয়েছে' : ''}</small></span></a>`
        : `<div class="ar-boss-card locked"><span class="ar-boss-face">🔒</span><span><b>চূড়ান্ত জেরা</b><small>সব টপিকের প্রমাণ (প্রতিটায় ${bn(CLUES)}টি সূত্র) পেলে খুলবে</small></span></div>`}</section>`,
  };
}

function investigate(ch, tp, srcParam) {
  const c = chapterById(ch);
  const isFinal = tp === 'final';
  if (!isFinal && !topicsOf(ch).some((t) => t.id === tp)) return null;
  if (isFinal && !allEvidence(ch)) { location.replace(`#/arena/detective/${ch}`); return 'redirect'; }
  const scope = isFinal ? 'all' : tp;
  const src = validSrc(ch, scope, srcParam);
  const name = isFinal ? 'চূড়ান্ত জেরা' : scopeName(ch, tp);
  return {
    title: name,
    back: `#/arena/detective/${ch}`,
    html: `<p class="eyebrow">🕵️ ${esc(caseOf(ch).title)} · ${esc(name)}</p>
      ${srcChips(`#/arena/detective/${esc(ch)}/${esc(tp)}`, ch, scope, src)}
      <section class="gm ar-game" id="ar"></section>`,
    after: () => run(document.getElementById('ar'), { ch, tp, scope, src, name, isFinal }),
  };
}

function run(el, o) {
  const pool = poolOf(o.ch, o.scope, o.src);
  if (!pool.length) { el.innerHTML = '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'; return; }
  const N = o.isFinal ? FINAL : SESSION;
  const start = () => {
    const qs = smartPick(pool, N).map((s) => ask(s, pool));
    let i = 0, right = 0, gained = 0;
    const wrong = [];
    const step = () => {
      if (i >= qs.length) return end();
      const n = o.isFinal ? 0 : cluesAt(o.ch, o.tp);
      el.innerHTML = `<div class="gm-hud"><span>${o.isFinal ? '🗝️ জেরা' : `🔎 ${bn(n)}/${bn(CLUES)}`}</span><span class="gm-prog"><i style="width:${(i / qs.length) * 100}%"></i></span><span>✓ ${bn(right)}</span></div><div id="arq"></div>`;
      const q = qs[i];
      const panel = askQuestion(el.querySelector('#arq'), q, {
        label: `${o.isFinal ? 'জেরার প্রশ্ন' : 'তদন্তের প্রশ্ন'} ${bn(i + 1)}/${bn(qs.length)}`,
        onAnswer: (ok) => {
          const s = st();
          const stat = s.stats[o.ch] ??= { n: 0, c: 0 };
          stat.n++;
          if (ok) {
            right++; stat.c++;
            if (!o.isFinal && cluesAt(o.ch, o.tp) < CLUES) { s.clues[k(o.ch, o.tp)] = cluesAt(o.ch, o.tp) + 1; gained++; }
          } else wrong.push(q);
          saveA();
        },
        onNext: () => { panel.destroy(); i++; step(); },
      });
    };
    const end = () => {
      const rewards = [];
      let title, emoji, won = false;
      if (o.isFinal) {
        won = right / qs.length >= 0.75;
        if (won && claim(`detective:solved:${o.ch}`, { coins: 150, gems: 2 })) rewards.push('🕵️ রহস্যের সমাধান', '🪙 +১৫০', '💎 +২');
        title = won ? caseOf(o.ch).end : 'জেরায় কিছু ফাঁক রয়ে গেল — আবার চেষ্টা করো';
        emoji = won ? '🗝️' : '🤔';
      } else {
        const found = hasEvidence(o.ch, o.tp);
        if (found && claim(`detective:evidence:${k(o.ch, o.tp)}`, { coins: 25 })) rewards.push('🧾 নতুন প্রমাণ', '🪙 +২৫');
        won = found;
        title = found ? `${o.name} — প্রমাণ পাওয়া গেছে!` : gained ? `${bn(gained)}টি নতুন সূত্র মিলেছে` : 'এবার নতুন সূত্র মেলেনি';
        emoji = found ? '🧾' : '🔎';
      }
      resultScreen(el, {
        emoji, title, score: right * 10, key: `detective/${k(o.ch, o.tp)}`, won, wrong, rewards,
        lines: [`${bn(qs.length)}টির মধ্যে ${bn(right)}টি সঠিক`, o.isFinal && !won ? 'সমাধানের জন্য ৭৫% সঠিক লাগবে।' : ''],
        retry: start, back: `#/arena/detective/${o.ch}`, backLabel: '🗂️ প্রমাণ বোর্ড',
      });
    };
    step();
  };
  mount(() => {});
  start();
}

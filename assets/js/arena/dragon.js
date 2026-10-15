// 2. Dragon Boss Battle — turn-based: a right answer hits the enemy, a wrong one lets it hit you
// (and shows the right answer with its explanation). Topics are small enemies, the chapter is a
// dragon. Difficulty only changes how hard enemies hit — never which answer is right.

import { esc, bn, poolOf, deck, ask, askQuestion, resultScreen, mount, chapters, chapterById, topicsOf, validSrc, srcChips, chapterList, scopeName, floatText, animOn } from './core.js?v=202610150356';
import { gameState, claim, saveA } from '../learnstore.js?v=202610150356';
import { avatarHtml } from './skills.js?v=202610150356';

export const meta = { id: 'dragon', emoji: '🐉', name: 'ড্রাগন যুদ্ধ', desc: 'টার্ন-ভিত্তিক যুদ্ধ — সঠিক উত্তরে আঘাত, ভুলে দানবের পাল্টা আঘাত। প্রতিটা অধ্যায়ের শেষে ড্রাগন!', need: 20 };
const MONSTERS = ['👺', '🦇', '🐺', '🦂', '🐍', '🕷️', '🧟', '👻', '🦖', '🐊', '🦈', '🦅'];
const DIFF = [{ id: 0, name: 'সহজ', hit: 12 }, { id: 1, name: 'মাঝারি', hit: 20 }, { id: 2, name: 'কঠিন', hit: 28 }];
const st = () => gameState('dragon', { defeated: {}, diff: 1 });
const k = (ch, tp) => `${ch}/${tp}`;

export function chapterInfo(ch) {
  const tps = topicsOf(ch);
  return `হারানো ${bn(tps.filter((t) => st().defeated[k(ch, t.id)]).length)}/${bn(tps.length)}${st().defeated[k(ch, 'boss')] ? ' · 🐉✓' : ''}`;
}

export function progress() {
  let done = 0, total = 0;
  for (const c of chapters()) {
    const tps = topicsOf(c.id);
    total += tps.length + 1;
    done += tps.filter((t) => st().defeated[k(c.id, t.id)]).length + (st().defeated[k(c.id, 'boss')] ? 1 : 0);
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function view({ b: ch, c: tp, d: src }) {
  if (!ch) return home();
  if (!chapterById(ch)) return null;
  if (!tp) return lair(ch);
  return fight(ch, tp, src);
}

function home() {
  return {
    title: meta.name,
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🐉</span><div><h1>ড্রাগন যুদ্ধ</h1>
        <p class="muted small">প্রতিটা টপিকে একটা দানব, অধ্যায়ের শেষে একটা ড্রাগন। ঠিক উত্তরই তোমার তলোয়ার!</p></div></header>
      ${chapterList((c) => `#/arena/dragon/${c.id}`, (c) => {
        const tps = topicsOf(c.id);
        const d = tps.filter((t) => st().defeated[k(c.id, t.id)]).length;
        return `· হারানো ${bn(d)}/${bn(tps.length)} ${st().defeated[k(c.id, 'boss')] ? '· 🐉✓' : ''}`;
      })}`,
  };
}

function lair(ch) {
  const c = chapterById(ch);
  const s = st();
  const tps = topicsOf(ch);
  const cards = tps.map((tp, i) => {
    const won = s.defeated[k(ch, tp.id)];
    return `<a class="ar-enemy tap rise ${won ? 'won' : ''}" style="--i:${Math.min(i, 10)}" href="#/arena/dragon/${esc(ch)}/${esc(tp.id)}">
      <span class="ar-enemy-face">${MONSTERS[i % MONSTERS.length]}</span>
      <span><b>${esc(tp.name)}</b><small>${won ? '✓ হারানো হয়েছে' : 'HP ৬০'}</small></span></a>`;
  }).join('');
  const bossWon = s.defeated[k(ch, 'boss')];
  return {
    title: c.name,
    back: '#/arena/dragon',
    html: `<header class="ar-hero rise"><span class="ar-hero-emoji">⚔️</span><div><p class="eyebrow">ড্রাগন যুদ্ধ</p><h1>${esc(c.name)}</h1>
        <p class="muted small">কঠিনতা শুধু দানবের আঘাতের জোর বদলায় — প্রশ্ন আর উত্তর একই থাকে।</p></div></header>
      <div class="gm-srcs ar-diff">${DIFF.map((d) => `<button class="gm-src tap ${s.diff === d.id ? 'on' : ''}" data-ar-diff="${d.id}">${d.name} <small>আঘাত ${bn(d.hit)}</small></button>`).join('')}</div>
      <section class="block"><div class="block-head"><h2>টপিকের দানব</h2></div><div class="ar-enemies">${cards}</div></section>
      <section class="block"><a class="ar-boss-card tap rise ${bossWon ? 'won' : ''}" href="#/arena/dragon/${esc(ch)}/boss">
        <span class="ar-boss-face">🐉</span><span><b>${esc(c.name)}-এর ড্রাগন</b><small>পুরো অধ্যায়ের প্রশ্ন · HP ১৫০ ${bossWon ? '· ✓ হারানো হয়েছে' : ''}</small></span></a></section>`,
    after: () => {
      document.querySelector('.ar-diff')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ar-diff]');
        if (!b) return;
        st().diff = Number(b.dataset.arDiff);
        saveA();
        document.querySelectorAll('[data-ar-diff]').forEach((x) => x.classList.toggle('on', x === b));
      });
    },
  };
}

function fight(ch, tp, srcParam) {
  const c = chapterById(ch);
  const isBoss = tp === 'boss';
  const tps = topicsOf(ch);
  const i = tps.findIndex((x) => x.id === tp);
  if (!isBoss && i < 0) return null;
  const scope = isBoss ? 'all' : tp;
  const src = validSrc(ch, scope, srcParam);
  const enemy = isBoss
    ? { emoji: '🐉', name: `${c.name}-এর ড্রাগন`, hp: 150 }
    : { emoji: MONSTERS[i % MONSTERS.length], name: `${scopeName(ch, tp)}-এর দানব`, hp: 60 };
  return {
    title: isBoss ? 'ড্রাগন যুদ্ধ' : 'দানব যুদ্ধ',
    back: `#/arena/dragon/${ch}`,
    html: `<p class="eyebrow">🐉 ${esc(c.name)} · ${esc(enemy.name)}</p>
      ${srcChips(`#/arena/dragon/${esc(ch)}/${esc(tp)}`, ch, scope, src)}
      <section class="gm ar-game" id="ar"></section>`,
    after: () => battle(document.getElementById('ar'), {
      ch, scope, src, enemy, back: `#/arena/dragon/${ch}`, key: `dragon/${k(ch, tp)}/${st().diff}`,
      hit: DIFF[st().diff]?.hit ?? 20,
      onWin: () => {
        st().defeated[k(ch, tp)] = 1;
        return claim(`dragon:${k(ch, tp)}`, isBoss ? { coins: 120, gems: 2 } : { coins: 30 }) ? (isBoss ? ['🐉 ড্রাগন শিকারি', '🪙 +১২০', '💎 +২'] : ['🪙 +৩০']) : [];
      },
    }),
  };
}

// The battle itself (also used by the space boss). o: { ch, scope, src, enemy:{emoji,name,hp}, hit, key, back, onWin() → rewards[] , theme }
export function battle(el, o) {
  const pool = poolOf(o.ch, o.scope, o.src);
  if (!pool.length) { el.innerHTML = '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'; return; }
  const start = () => {
    const d = deck(pool);
    let hp = 100, ehp = o.enemy.hp, streak = 0, right = 0, n = 0, mastered = 0;
    const wrong = [];
    const paint = () => {
      el.innerHTML = `<div class="ar-arena ${o.theme ?? ''}">
          <div class="ar-fighter me"><div class="ar-face" id="arMe">${avatarHtml('sm')}</div><div class="ar-hpbar"><i style="width:${hp}%"></i></div><small>তুমি · ${bn(hp)}/১০০</small></div>
          <div class="ar-vs">⚔️</div>
          <div class="ar-fighter foe"><div class="ar-face big" id="arFoe">${o.enemy.emoji}</div><div class="ar-hpbar foe"><i style="width:${(ehp / o.enemy.hp) * 100}%"></i></div><small>${esc(o.enemy.name)} · ${bn(Math.max(0, ehp))}/${bn(o.enemy.hp)}</small></div>
        </div>
        ${streak >= 2 ? `<p class="gm-streak">🔥 ${bn(streak)} ধারা — আঘাত বাড়ছে!</p>` : ''}
        <div id="arq"></div>`;
    };
    const turn = () => {
      if (ehp <= 0) return end(true);
      if (hp <= 0) return end(false);
      paint();
      const q = ask(d.next(), pool);
      const panel = askQuestion(el.querySelector('#arq'), q, {
        label: `টার্ন ${bn(n + 1)}`,
        onAnswer: (ok, res) => {
          n++;
          if (res.nowMastered) mastered++;
          const arena = el.querySelector('.ar-arena');
          if (ok) {
            right++; streak++;
            const dmg = Math.min(35, 20 + (streak - 1) * 5);
            ehp -= dmg;
            el.querySelector('#arFoe')?.classList.add('hit');
            floatText(arena, `−${bn(dmg)}`, 'bad');
            const bar = el.querySelector('.ar-hpbar.foe i');
            if (bar) bar.style.width = `${(Math.max(0, ehp) / o.enemy.hp) * 100}%`;
          } else {
            streak = 0; wrong.push(q);
            hp = Math.max(0, hp - o.hit);
            el.querySelector('#arMe')?.classList.add('hit');
            if (animOn()) arena?.classList.add('shake');
            floatText(arena, `−${bn(o.hit)} HP`, 'bad');
            const bar = el.querySelector('.ar-hpbar:not(.foe) i');
            if (bar) bar.style.width = `${hp}%`;
          }
        },
        onNext: () => { panel.destroy(); turn(); },
      });
    };
    const end = (won) => {
      const rewards = won ? o.onWin?.() ?? [] : [];
      resultScreen(el, {
        emoji: won ? '🏆' : o.enemy.emoji, title: won ? `${o.enemy.name} হেরে গেছে!` : `${o.enemy.name} জিতে গেল — আবার চেষ্টা করো`,
        score: won ? right * 20 + hp : right * 10, key: o.key, won, wrong, rewards,
        lines: [`${bn(n)}টি টার্ন · ${bn(right)}টি সঠিক · বাকি HP ${bn(hp)}`, mastered ? `🎓 এই যুদ্ধে ${bn(mastered)}টি প্রশ্ন আয়ত্তে এল` : ''],
        retry: start, back: o.back, backLabel: '⚔️ দানবের তালিকা',
      });
    };
    turn();
  };
  mount(() => {});
  start();
}

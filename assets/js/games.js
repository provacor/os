// Game zone: every game is built from the chapter's own MCQs, topic by topic (content/toc.json),
// so playing clears exactly the MCQs the app has — nothing is made up.
// A question counts as "mastered" after two right answers in a row; wrong ones come back sooner
// and also go to the spaced-review list (learn.js).

import { esc } from './components.js?v=202610141433';
import { itemRef, isMcq, rightIndex, recordAttempt, everWrong } from './learn.js?v=202610141433';
import { tocOf } from './views/topic.js?v=202610141433';
import { motionReduced } from './a11y.js?v=202610141433';

export const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
const KEYS = '১২৩৪';
const LETTER = 'কখগঘঙ';

// ---------- saved game data (localStorage, so the backup carries it) ----------
const KEY = 'hscos:games:v1';
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { S = {}; }
S.m ??= {}; S.best ??= {}; S.stars ??= {}; S.xp ??= 0; S.sound ??= true;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* keeps for this visit */ } };

export const masteryOf = (id) => S.m[id] ?? 0;
export const isMastered = (id) => masteryOf(id) >= 2;
export const bestOf = (k) => S.best[k] ?? 0;
export const starsOf = (k) => S.stars[k] ?? 0;
export const xp = () => S.xp;
export const playerLevel = () => Math.floor(Math.sqrt(S.xp / 40)) + 1;
export const soundOn = () => S.sound;
export function toggleSound() { S.sound = !S.sound; save(); return S.sound; }

function answered(id, ok) {
  S.m[id] = ok ? Math.min(3, masteryOf(id) + 1) : 0;
  save();
  recordAttempt(id, ok);
}
function finish(key, score, stars = null) {
  const prev = bestOf(key);
  if (score > prev) S.best[key] = score;
  if (stars != null && stars > starsOf(key)) S.stars[key] = stars;
  S.xp += Math.max(0, Math.round(score / 10));
  save();
  return { prev, newBest: score > prev && score > 0 };
}

// ---------- questions ----------
export function mcqsOf(chId, tpId) {
  const t = tocOf(chId);
  if (!t) return [];
  const ids = tpId === 'all' ? [...t.topics.flatMap((x) => x.items), ...t.general] : t.topics.find((x) => x.id === tpId)?.items ?? [];
  const seen = new Set();
  return ids
    .filter((id) => !seen.has(id) && seen.add(id))
    .map((id) => itemRef(id)?.it)
    .filter((it) => isMcq(it) && it.options.length >= 2 && rightIndex(it) >= 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
export const LEVEL_SIZE = 8;
export const levelsOf = (pool) => Array.from({ length: Math.ceil(pool.length / LEVEL_SIZE) }, (_, i) => pool.slice(i * LEVEL_SIZE, (i + 1) * LEVEL_SIZE));
export const levelKey = (ch, tp, n) => `${ch}/${tp}/L${n}`;
export const levelUnlocked = (ch, tp, n) => n === 1 || starsOf(levelKey(ch, tp, n - 1)) > 0;

function makeQ(it) {
  const r = rightIndex(it);
  const opts = shuffle(it.options.map((t, k) => ({ t: String(t), ok: k === r })));
  return { id: it.id, it, q: it.question, opts, right: opts.findIndex((o) => o.ok), exp: it.explanation ?? '' };
}
// Not-yet-mastered and once-wrong questions first, then the rest; refills itself when used up.
function deck(pool) {
  let list = [];
  const refill = () => {
    list = shuffle(pool).sort((a, b) => (masteryOf(a.id) - (everWrong(a.id) && !isMastered(a.id) ? 0.5 : 0)) - (masteryOf(b.id) - (everWrong(b.id) && !isMastered(b.id) ? 0.5 : 0)));
  };
  return { next() { if (!list.length) refill(); return makeQ(list.shift()); } };
}

// ---------- sound, buzz, confetti ----------
let ac = null;
function tone(freqs, { dur = 0.11, type = 'sine', gap = 0.085, vol = 0.12 } = {}) {
  if (!S.sound) return;
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    let t = ac.currentTime;
    for (const f of freqs) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
      t += gap;
    }
  } catch { /* no audio */ }
}
const sfx = {
  ok: () => tone([660, 990]),
  bad: () => { tone([220, 160], { type: 'square', vol: 0.07, dur: 0.14 }); navigator.vibrate?.(70); },
  pop: () => tone([880], { dur: 0.06, vol: 0.09 }),
  up: () => tone([523, 659, 784], { gap: 0.07 }),
  win: () => tone([523, 659, 784, 1047, 1319], { gap: 0.1, dur: 0.16 }),
  lose: () => tone([392, 330, 262], { type: 'triangle', gap: 0.14, dur: 0.2 }),
};
function confetti(host) {
  if (motionReduced() || !host) return;
  const box = document.createElement('div');
  box.className = 'gm-confetti';
  const colors = ['var(--blue)', 'var(--amber)', 'var(--green)', 'var(--rose)', 'var(--violet)', 'var(--cyan)'];
  box.innerHTML = Array.from({ length: 46 }, (_, i) =>
    `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.5).toFixed(2)}s;--dx:${Math.round(Math.random() * 120 - 60)}px;--r:${Math.round(Math.random() * 720)}deg"></i>`).join('');
  host.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}
function floatText(host, text, cls = '') {
  if (!host) return;
  const s = document.createElement('span');
  s.className = `gm-float ${cls}`;
  s.textContent = text;
  host.appendChild(s);
  setTimeout(() => s.remove(), 900);
}

// ---------- shared pieces ----------
const hearts = (n, max = 3) => `<span class="gm-hearts" aria-label="${bn(n)}টি জীবন">${'❤️'.repeat(Math.max(0, n))}${'🤍'.repeat(Math.max(0, max - n))}</span>`;
const qBox = (q, label = '') => `<div class="gm-q">${label ? `<p class="gm-qn">${label}</p>` : ''}<p class="gm-qt">${esc(q.q)}</p></div>`;
const optsHtml = (q, hide = []) => `<div class="gm-opts">${q.opts.map((o, k) => `<button class="opt gm-opt tap" data-g-opt="${k}" ${hide.includes(k) ? 'disabled style="visibility:hidden"' : ''}><span class="opt-key">${LETTER[k]}</span><span>${esc(o.t)}</span></button>`).join('')}</div>`;
const expHtml = (q, ok) => `<div class="gm-fb ${ok ? 'ok' : 'bad'}" role="status">
    <b>${ok ? '✓ সঠিক!' : `✗ সঠিক উত্তর: ${esc(q.opts[q.right].t)}`}</b>
    ${q.exp ? `<p>${esc(q.exp)}</p>` : ''}
    <button class="btn btn-primary tap" data-g-next>পরের প্রশ্ন →</button></div>`;
function markOpts(el, q, pick) {
  el.querySelectorAll('[data-g-opt]').forEach((b) => {
    const k = Number(b.dataset.gOpt);
    b.disabled = true;
    if (k === q.right) b.classList.add('right');
    else if (k === pick) b.classList.add('wrong');
  });
  el.querySelector('.gm-opts')?.classList.add('answered');
}

// End screen shared by all games.
function endScreen(el, ctx, r) {
  const res = finish(ctx.key, r.score, r.stars ?? null);
  (r.won ? sfx.win : r.stars === 0 ? sfx.lose : sfx.up)();
  const wrong = r.wrong ?? [];
  el.innerHTML = `<div class="gm-end rise">
      <div class="gm-end-emoji">${r.emoji ?? (r.won ? '🏆' : '🎯')}</div>
      <h2>${esc(r.title)}</h2>
      ${r.stars != null ? `<p class="gm-stars big">${'★'.repeat(r.stars)}<span>${'★'.repeat(3 - r.stars)}</span></p>` : ''}
      <p class="gm-score">${bn(r.score)} <small>পয়েন্ট</small></p>
      ${res.newBest ? '<p class="gm-best">🎉 নতুন রেকর্ড!</p>' : res.prev ? `<p class="muted small">আগের সেরা: ${bn(res.prev)}</p>` : ''}
      ${(r.lines ?? []).map((l) => `<p class="muted small">${l}</p>`).join('')}
      <div class="row-btns">
        <button class="btn btn-primary tap" data-g-again>🔁 আবার খেলো</button>
        ${r.nextHref ? `<a class="btn tap" href="${r.nextHref}">পরের লেভেল →</a>` : ''}
        <a class="btn tap" href="#/games/${esc(ctx.ch)}/${esc(ctx.tp)}">🎮 অন্য গেম</a>
      </div>
      ${wrong.length ? `<details class="gm-review" open><summary>যেগুলো ভুল হয়েছে (${bn(wrong.length)}টি) — এগুলো ঠিক করে নাও</summary>
        ${wrong.map((q) => `<div class="gm-rv"><p class="gm-rv-q">${esc(q.q)}</p><p class="gm-rv-a">✓ ${esc(q.opts[q.right].t)}</p>${q.exp ? `<p class="gm-rv-e">${esc(q.exp)}</p>` : ''}</div>`).join('')}
        <p class="muted small">এই প্রশ্নগুলো রিভিশন তালিকাতেও যোগ হয়েছে।</p></details>` : ''}
    </div>`;
  if (r.won || (r.stars ?? 0) >= 2) confetti(el);
}

// ---------- the games ----------
// Each takes (el, ctx) and returns a stop() function. ctx = { ch, tp, pool, key, level, levelItems, topicName, again() }.

// 1. Level adventure: the topic's MCQs in fixed sets of 8 — finish every level and you've done every MCQ.
function playLevel(el, ctx) {
  const items = shuffle(ctx.levelItems).map(makeQ);
  let i = 0, right = 0, streak = 0;
  const wrong = [];
  const show = () => {
    const q = items[i];
    el.innerHTML = `<div class="gm-hud"><span>লেভেল ${bn(ctx.level)}</span><span class="gm-prog"><i style="width:${(i / items.length) * 100}%"></i></span><span>✓ ${bn(right)}</span></div>
      ${streak >= 3 ? `<p class="gm-streak">🔥 ${bn(streak)}টি পরপর সঠিক!</p>` : ''}
      ${qBox(q, `প্রশ্ন ${bn(i + 1)}/${bn(items.length)}`)}${optsHtml(q)}<div class="gm-fbbox"></div>`;
  };
  const next = () => {
    i++;
    if (i < items.length) return show();
    const ratio = right / items.length;
    const stars = ratio === 1 ? 3 : ratio >= 0.85 ? 2 : ratio >= 0.7 ? 1 : 0;
    const last = ctx.level >= ctx.levelCount;
    endScreen(el, ctx, {
      title: stars ? `লেভেল ${bn(ctx.level)} পার!` : 'আরেকবার চেষ্টা করো',
      emoji: stars === 3 ? '🏆' : stars ? '🎉' : '💪', score: right * 10 + (stars === 3 ? 30 : 0), stars, won: stars > 0, wrong,
      lines: [`${bn(items.length)}টির মধ্যে ${bn(right)}টি সঠিক`, stars ? '' : 'পরের লেভেল খুলতে অন্তত ৭০% সঠিক লাগবে।'].filter(Boolean),
      nextHref: stars && !last ? `#/play/${ctx.ch}/${ctx.tp}/level-${ctx.level + 1}` : '',
    });
  };
  el.onclick = (e) => {
    const b = e.target.closest('[data-g-opt]');
    if (b && !b.disabled) {
      const q = items[i], k = Number(b.dataset.gOpt), ok = k === q.right;
      markOpts(el, q, k);
      answered(q.id, ok);
      if (ok) { right++; streak++; sfx.ok(); floatText(el, streak >= 3 ? `🔥 ${bn(streak)}` : '+১০', 'ok'); setTimeout(next, 750); }
      else { streak = 0; wrong.push(q); sfx.bad(); el.querySelector('.gm-fbbox').innerHTML = expHtml(q, false); }
      return;
    }
    if (e.target.closest('[data-g-next]')) next();
    if (e.target.closest('[data-g-again]')) ctx.again();
  };
  show();
  return () => {};
}

// 2. Time race: 60 seconds, combo multiplier, a wrong answer costs 5 seconds.
function playRush(el, ctx) {
  const d = deck(ctx.pool);
  let q = d.next(), score = 0, streak = 0, best = 0, n = 0, end = Date.now() + 60000, lock = false;
  const wrong = [];
  const mult = () => Math.min(4, 1 + Math.floor(streak / 3));
  const paint = () => {
    el.innerHTML = `<div class="gm-hud"><span class="gm-time">⏱ <b id="gmT">৬০</b></span><span class="gm-prog time"><i id="gmBar"></i></span><span>⭐ ${bn(score)}</span></div>
      <p class="gm-streak">${mult() > 1 ? `🔥 কম্বো ×${bn(mult())}` : 'পরপর ৩টি সঠিক হলে কম্বো!'}</p>
      ${qBox(q)}${optsHtml(q)}`;
    tick();
  };
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const t = el.querySelector('#gmT'), bar = el.querySelector('#gmBar');
    if (t) t.textContent = bn(Math.ceil(left / 1000));
    if (bar) bar.style.width = `${(left / 60000) * 100}%`;
    if (!left) over();
  };
  let timer = setInterval(tick, 200);
  const over = () => {
    clearInterval(timer); timer = null;
    endScreen(el, ctx, { title: 'সময় শেষ!', emoji: '⏱️', score, wrong, won: score >= 150, lines: [`${bn(n)}টি প্রশ্ন · ${bn(n - wrong.length)}টি সঠিক · সর্বোচ্চ ধারা ${bn(best)}`] });
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-g-again]')) return ctx.again();
    const b = e.target.closest('[data-g-opt]');
    if (!b || lock || !timer) return;
    lock = true; n++;
    const k = Number(b.dataset.gOpt), ok = k === q.right;
    markOpts(el, q, k);
    answered(q.id, ok);
    if (ok) { streak++; best = Math.max(best, streak); score += 10 * mult(); sfx.ok(); floatText(el, `+${bn(10 * mult())}`, 'ok'); }
    else { streak = 0; end -= 5000; wrong.push(q); sfx.bad(); floatText(el, '−৫ সেকেন্ড', 'bad'); }
    setTimeout(() => { lock = false; if (!timer) return; q = d.next(); paint(); }, ok ? 380 : 1100);
  };
  paint();
  return () => clearInterval(timer);
}

// 3. True or false: one question with one answer shown — is it the right one? 45 seconds, 3 lives.
function playTrueFalse(el, ctx) {
  const d = deck(ctx.pool);
  let score = 0, streak = 0, lives = 3, n = 0, end = Date.now() + 45000, cur = null, lock = false, touchX = null;
  const wrong = [];
  const deal = () => {
    const q = d.next();
    const truth = Math.random() < 0.5;
    const wrongs = q.opts.map((_, k) => k).filter((k) => k !== q.right);
    const shown = truth ? q.right : wrongs[Math.floor(Math.random() * wrongs.length)];
    cur = { q, truth, shown };
  };
  const paint = () => {
    const { q, shown } = cur;
    el.innerHTML = `<div class="gm-hud"><span class="gm-time">⏱ <b id="gmT"></b></span>${hearts(lives)}<span>⭐ ${bn(score)}</span></div>
      <div class="gm-tf-card" id="gmCard">${qBox(q)}<p class="gm-tf-ans">উত্তর: <b>${esc(q.opts[shown].t)}</b></p></div>
      <p class="muted small center">ঠিক হলে ডানে, ভুল হলে বামে সোয়াইপ করো — বা বোতাম চাপো</p>
      <div class="gm-tf-btns"><button class="btn tap gm-no" data-g-tf="0">✗ মিথ্যা</button><button class="btn tap gm-yes" data-g-tf="1">✓ সত্য</button></div>`;
    tick();
  };
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const t = el.querySelector('#gmT');
    if (t) t.textContent = bn(Math.ceil(left / 1000));
    if (!left) over('সময় শেষ!');
  };
  let timer = setInterval(tick, 250);
  const over = (title) => {
    clearInterval(timer); timer = null;
    endScreen(el, ctx, { title, emoji: lives ? '⏱️' : '💔', score, wrong, won: score >= 120, lines: [`${bn(n)}টি উত্তর যাচাই করেছ · ${bn(n - wrong.length)}টি ঠিক`] });
  };
  const judge = (sayTrue) => {
    if (lock || !timer) return;
    lock = true; n++;
    const { q, truth } = cur, ok = sayTrue === truth;
    const card = el.querySelector('#gmCard');
    card?.classList.add(ok ? 'ok' : 'bad', sayTrue ? 'fly-r' : 'fly-l');
    if (truth || !ok) answered(q.id, ok);
    if (ok) { streak++; score += 10 + Math.min(20, streak * 2); sfx.ok(); }
    else {
      streak = 0; lives--; wrong.push(q); sfx.bad();
      card?.insertAdjacentHTML('beforeend', `<p class="gm-tf-fix">✓ সঠিক উত্তর: ${esc(q.opts[q.right].t)}</p>`);
    }
    setTimeout(() => { lock = false; if (!timer) return; if (!lives) return over('জীবন শেষ!'); deal(); paint(); }, ok ? 420 : 1500);
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-g-again]')) return ctx.again();
    const b = e.target.closest('[data-g-tf]');
    if (b) judge(b.dataset.gTf === '1');
  };
  el.ontouchstart = (e) => { if (e.target.closest('#gmCard')) touchX = e.touches[0].clientX; };
  el.ontouchend = (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) judge(dx > 0);
  };
  deal(); paint();
  return () => clearInterval(timer);
}

// 4. Balloon pop: the answers float up — pop the right one before it flies away. Faster every level.
function playBalloon(el, ctx) {
  const d = deck(ctx.pool);
  let score = 0, lives = 3, popped = 0, level = 1, raf = 0, q = null, balloons = [], last = 0, busy = false;
  const wrong = [];
  const speed = () => 38 + (level - 1) * 9; // px per second
  const colors = ['#7ea6ff', '#f7c35c', '#6ee7a0', '#fb8fb0', '#b09cff'];
  const round = () => {
    q = d.next();
    busy = false;
    el.innerHTML = `<div class="gm-hud"><span>লেভেল ${bn(level)}</span>${hearts(lives)}<span>🎈 ${bn(score)}</span></div>
      ${qBox(q)}<div class="gm-sky" id="gmSky"></div>`;
    const sky = el.querySelector('#gmSky');
    const H = sky.clientHeight;
    balloons = q.opts.map((o, k) => {
      const b = document.createElement('button');
      b.className = 'gm-balloon tap';
      b.dataset.gBal = k;
      b.style.setProperty('--c', colors[(k + popped) % colors.length]);
      b.innerHTML = `<span>${esc(o.t)}</span>`;
      sky.appendChild(b);
      const col = k % 2, row = Math.floor(k / 2);
      b.style.left = col ? '51%' : '2%';
      return { b, k, y: H + 10 + row * 120 + col * 55 + Math.random() * 20 };
    });
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  };
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const bl of balloons) {
      if (bl.gone) continue;
      bl.y -= speed() * dt;
      bl.b.style.transform = `translateY(${bl.y}px) rotate(${Math.sin(now / 600 + bl.k) * 3}deg)`;
    }
    const target = balloons.find((bl) => bl.k === q.right);
    if (!busy && target && target.y + target.b.offsetHeight < 0) miss(null);
    if (!busy) raf = requestAnimationFrame(step);
  };
  const miss = (bl) => {
    busy = true;
    cancelAnimationFrame(raf);
    lives--; wrong.push(q); sfx.bad();
    answered(q.id, false);
    if (bl) bl.b.classList.add('burst-bad');
    const sky = el.querySelector('#gmSky');
    sky?.insertAdjacentHTML('beforeend', `<p class="gm-sky-msg bad">${bl ? '✗ ভুল বেলুন!' : '🎈 উড়ে গেল!'}<br>✓ ${esc(q.opts[q.right].t)}</p>`);
    setTimeout(() => (lives ? round() : over()), 1700);
  };
  const over = () => {
    cancelAnimationFrame(raf);
    endScreen(el, ctx, { title: 'খেলা শেষ!', emoji: '🎈', score, wrong, won: popped >= 10, lines: [`${bn(popped)}টি সঠিক বেলুন ফাটিয়েছ · লেভেল ${bn(level)} পর্যন্ত`] });
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-g-again]')) return ctx.again();
    const btn = e.target.closest('[data-g-bal]');
    if (!btn || busy) return;
    const bl = balloons.find((x) => x.b === btn);
    if (bl.k !== q.right) return miss(bl);
    busy = true;
    cancelAnimationFrame(raf);
    bl.b.classList.add('burst');
    popped++; score += 10 * level; sfx.pop(); sfx.ok();
    answered(q.id, true);
    floatText(el.querySelector('#gmSky'), `+${bn(10 * level)}`, 'ok');
    if (popped % 4 === 0) { level++; setTimeout(() => { sfx.up(); floatText(el.querySelector('#gmSky'), `লেভেল ${bn(level)}! ⚡`, 'up'); }, 200); }
    setTimeout(round, 650);
  };
  round();
  return () => cancelAnimationFrame(raf);
}

// 5. Match pairs: four questions, four answers — join each question to its answer. Three rounds.
const BAD_PAIR = /^\s*(i{1,3}v?|iv|[কখগঘ])\s*(,|ও|এবং|\s)\s*(i{1,3}v?|iv|[কখগঘ])|সবগুলো|উপরের|কোনোটিই|কোনটিই/i;
function playMatch(el, ctx) {
  const usable = ctx.pool.filter((it) => {
    const a = String(it.options[rightIndex(it)]).trim();
    return a.length <= 70 && !BAD_PAIR.test(a);
  });
  if (usable.length < 4) {
    el.innerHTML = `<div class="gm-end"><div class="gm-end-emoji">🧩</div><h2>এই টপিকে জোড়া মেলানোর মতো যথেষ্ট প্রশ্ন নেই</h2><a class="btn tap" href="#/games/${esc(ctx.ch)}/${esc(ctx.tp)}">অন্য গেম খেলো</a></div>`;
    return () => {};
  }
  const d = deck(usable);
  let round = 0, score = 0, mistakes = 0, pairs = [], sel = null, t0 = Date.now();
  const missed = new Set();
  const wrong = [];
  const ROUNDS = 3;
  const deal = () => {
    round++;
    pairs = [];
    // four different questions whose answers are all different, so every pair is unambiguous
    for (let tries = 0; pairs.length < 4 && tries < 60; tries++) {
      const q = d.next();
      const a = q.opts[q.right].t.trim();
      if (!pairs.some((p) => p.q.id === q.id || p.a === a)) pairs.push({ q, a, done: false });
    }
    const right = shuffle(pairs.map((p, i) => i));
    el.innerHTML = `<div class="gm-hud"><span>রাউন্ড ${bn(round)}/${bn(ROUNDS)}</span><span>❌ ${bn(mistakes)}</span><span>⭐ ${bn(score)}</span></div>
      <p class="muted small center">একটা প্রশ্ন চাপো, তারপর তার উত্তর চাপো</p>
      <div class="gm-match">
        <div class="gm-col">${pairs.map((p, i) => `<button class="gm-card tap" data-g-mq="${i}">${esc(p.q.q)}</button>`).join('')}</div>
        <div class="gm-col">${right.map((i) => `<button class="gm-card ans tap" data-g-ma="${i}">${esc(pairs[i].a)}</button>`).join('')}</div>
      </div>`;
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-g-again]')) return ctx.again();
    const qb = e.target.closest('[data-g-mq]'), ab = e.target.closest('[data-g-ma]');
    if (qb && !qb.disabled) {
      el.querySelectorAll('[data-g-mq]').forEach((x) => x.classList.toggle('sel', x === qb));
      sel = Number(qb.dataset.gMq);
      return;
    }
    if (!ab || ab.disabled) return;
    if (sel == null) { ab.classList.add('nudge'); setTimeout(() => ab.classList.remove('nudge'), 400); return; }
    const qbtn = el.querySelector(`[data-g-mq="${sel}"]`);
    const p = pairs[sel];
    if (Number(ab.dataset.gMa) === sel) {
      p.done = true;
      score += missed.has(p.q.id) ? 10 : 25;
      answered(p.q.id, !missed.has(p.q.id));
      for (const x of [qbtn, ab]) { x.classList.add('matched'); x.disabled = true; }
      sfx.ok();
      sel = null;
      if (pairs.every((x) => x.done)) {
        sfx.up();
        setTimeout(() => {
          if (round < ROUNDS) return deal();
          const secs = Math.round((Date.now() - t0) / 1000);
          const bonus = Math.max(0, 120 - secs);
          score += bonus;
          endScreen(el, ctx, { title: 'সব জোড়া মিলেছে!', emoji: '🧩', score, won: mistakes <= 2, wrong, lines: [`সময় ${bn(secs)} সেকেন্ড · ভুল ${bn(mistakes)}টি · সময়ের বোনাস ${bn(bonus)}`] });
        }, 500);
      }
    } else {
      mistakes++;
      score = Math.max(0, score - 5);
      sfx.bad();
      if (!missed.has(p.q.id)) { missed.add(p.q.id); wrong.push(p.q); }
      for (const x of [qbtn, ab]) { x.classList.add('shake'); setTimeout(() => x.classList.remove('shake'), 400); }
    }
  };
  deal();
  return () => {};
}

// 6. Boss battle: every right answer hits the topic's monster; a wrong or slow answer costs a life.
function playBoss(el, ctx) {
  const d = deck(ctx.pool);
  const MAX = 100, PER_Q = 20000;
  let hp = MAX, lives = 3, streak = 0, n = 0, q = null, deadline = 0, timer = null, lock = false, hits = 0;
  const wrong = [];
  const face = () => (hp <= 0 ? '😵' : hp < 35 ? '😱' : hp < 70 ? '😠' : '👾');
  const paint = () => {
    el.innerHTML = `<div class="gm-boss">
        <div class="gm-boss-face" id="gmBoss">${face()}</div>
        <div class="gm-boss-info"><b>${esc(ctx.topicName)} দানব</b><span class="gm-hp"><i style="width:${(hp / MAX) * 100}%"></i></span><small>${bn(Math.max(0, hp))}/${bn(MAX)}</small></div>
      </div>
      <div class="gm-hud"><span>${hearts(lives)}</span><span class="gm-prog time"><i id="gmBar"></i></span><span>⚔️ ${bn(hits)}</span></div>
      ${streak >= 2 ? `<p class="gm-streak">🔥 ${bn(streak)} ধারা — আঘাত বাড়ছে!</p>` : ''}
      ${qBox(q)}${optsHtml(q)}<div class="gm-fbbox"></div>`;
  };
  const tick = () => {
    const left = Math.max(0, deadline - Date.now());
    const bar = el.querySelector('#gmBar');
    if (bar) bar.style.width = `${(left / PER_Q) * 100}%`;
    if (!left && !lock) hurt(null);
  };
  const ask = () => { q = d.next(); lock = false; deadline = Date.now() + PER_Q; paint(); };
  const hurt = (pick) => {
    lock = true; n++; streak = 0; lives--; wrong.push(q);
    answered(q.id, false);
    markOpts(el, q, pick);
    sfx.bad();
    el.classList.add('gm-hit'); setTimeout(() => el.classList.remove('gm-hit'), 400);
    el.querySelector('.gm-fbbox').innerHTML = expHtml(q, false).replace('পরের প্রশ্ন →', lives ? 'আবার আক্রমণ করো →' : 'ফলাফল দেখো');
  };
  const over = (won) => {
    clearInterval(timer); timer = null;
    endScreen(el, ctx, { title: won ? 'দানবকে হারিয়েছ!' : 'দানব জিতে গেল!', emoji: won ? '🏆' : '👾', won, score: hits * 15 + (won ? 100 + lives * 30 : 0), wrong, lines: [`${bn(n)}টি প্রশ্ন · ${bn(hits)}টি আঘাত · বাকি জীবন ${bn(lives)}`] });
  };
  el.onclick = (e) => {
    if (e.target.closest('[data-g-again]')) return ctx.again();
    if (e.target.closest('[data-g-next]')) { if (!lives) return over(false); return ask(); }
    const b = e.target.closest('[data-g-opt]');
    if (!b || lock || !timer) return;
    const k = Number(b.dataset.gOpt);
    if (k !== q.right) return hurt(k);
    lock = true; n++; hits++; streak++;
    answered(q.id, true);
    markOpts(el, q, k);
    const dmg = Math.min(35, 15 + (streak - 1) * 5);
    hp -= dmg;
    sfx.ok();
    const boss = el.querySelector('#gmBoss');
    boss?.classList.add('hit');
    floatText(el.querySelector('.gm-boss'), `−${bn(dmg)}`, 'bad');
    setTimeout(() => (hp <= 0 ? over(true) : ask()), 700);
  };
  ask();
  timer = setInterval(tick, 200);
  return () => clearInterval(timer);
}

// 7. Quiz ladder: 12 questions up a prize ladder, with three lifelines; a wrong answer drops you to the last safe step.
const LADDER = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 100000];
const SAFE = [3, 7];
function playLadder(el, ctx) {
  const d = deck(ctx.pool);
  let step = 0, q = d.next(), hide = [], used = { half: false, skip: false, two: false }, twoArmed = false, lock = false;
  const wrong = [];
  const safeScore = () => { const s = SAFE.filter((i) => i < step).pop(); return s == null ? 0 : LADDER[s]; };
  const paint = () => {
    el.innerHTML = `<div class="gm-ladder">${LADDER.map((v, i) => `<span class="${i === step ? 'now' : i < step ? 'done' : ''} ${SAFE.includes(i) ? 'safe' : ''}">${bn(v.toLocaleString('en-IN'))}</span>`).reverse().join('')}</div>
      <div class="gm-life">
        <button class="btn tap" data-g-life="half" ${used.half ? 'disabled' : ''}>৫০:৫০</button>
        <button class="btn tap" data-g-life="skip" ${used.skip ? 'disabled' : ''}>⏭ পাস</button>
        <button class="btn tap ${twoArmed ? 'on' : ''}" data-g-life="two" ${used.two && !twoArmed ? 'disabled' : ''}>✌️ দুই সুযোগ</button>
      </div>
      ${qBox(q, `প্রশ্ন ${bn(step + 1)}/${bn(LADDER.length)} · ${bn(LADDER[step].toLocaleString('en-IN'))} পয়েন্টের জন্য`)}${optsHtml(q, hide)}
      <div class="gm-fbbox">${step ? `<button class="btn tap gm-walk" data-g-walk>✋ এখানে থামো (${bn(LADDER[step - 1].toLocaleString('en-IN'))} নিয়ে)</button>` : ''}</div>`;
  };
  const end = (score, won, title) => endScreen(el, ctx, { title, emoji: won ? '👑' : step >= 4 ? '🥈' : '🎯', score, won, wrong, lines: [`${bn(step)}টি ধাপ পার হয়েছ`] });
  el.onclick = (e) => {
    if (e.target.closest('[data-g-again]')) return ctx.again();
    const life = e.target.closest('[data-g-life]');
    if (life && !life.disabled && !lock) {
      const k = life.dataset.gLife;
      if (k === 'half') { used.half = true; hide = shuffle(q.opts.map((_, i) => i).filter((i) => i !== q.right)).slice(0, Math.max(0, q.opts.length - 2)); }
      if (k === 'skip') { used.skip = true; q = d.next(); hide = []; }
      if (k === 'two' && !used.two) { used.two = true; twoArmed = true; }
      sfx.pop();
      return paint();
    }
    if (e.target.closest('[data-g-walk]')) return end(LADDER[step - 1], false, 'বুদ্ধিমানের মতো থেমেছ!');
    if (e.target.closest('[data-g-next]')) return end(safeScore(), false, 'খেলা শেষ');
    const b = e.target.closest('[data-g-opt]');
    if (!b || lock || b.disabled) return;
    const k = Number(b.dataset.gOpt);
    if (k !== q.right && twoArmed) {
      twoArmed = false;
      b.classList.add('wrong'); b.disabled = true;
      sfx.bad();
      floatText(el, 'আরেকটা সুযোগ!', 'up');
      return;
    }
    lock = true;
    markOpts(el, q, k);
    const ok = k === q.right;
    answered(q.id, ok);
    if (!ok) {
      wrong.push(q); sfx.bad();
      el.querySelector('.gm-fbbox').innerHTML = expHtml(q, false).replace('পরের প্রশ্ন →', `ফলাফল দেখো (${bn(safeScore().toLocaleString('en-IN'))})`);
      return;
    }
    sfx.ok();
    twoArmed = false;
    step++;
    if (step >= LADDER.length) return setTimeout(() => end(LADDER[LADDER.length - 1], true, 'সব ধাপ জয়!'), 600);
    if (SAFE.includes(step - 1)) floatText(el, '🛡 নিরাপদ ধাপ!', 'up');
    setTimeout(() => { q = d.next(); hide = []; lock = false; paint(); }, 750);
  };
  paint();
  return () => {};
}

export const MODES = [
  { id: 'rush', emoji: '⏱️', name: 'সময়ের দৌড়', desc: '৬০ সেকেন্ডে যত বেশি পারো — পরপর সঠিক হলে কম্বো ×২, ×৩, ×৪!', play: playRush },
  { id: 'balloon', emoji: '🎈', name: 'বেলুন ফাটাও', desc: 'উত্তরগুলো বেলুন হয়ে উড়ছে — সঠিকটা উড়ে যাওয়ার আগে ফাটাও। লেভেল বাড়লে গতি বাড়ে।', play: playBalloon },
  { id: 'boss', emoji: '👾', name: 'দানব যুদ্ধ', desc: 'প্রতিটা সঠিক উত্তরে টপিকের দানবকে আঘাত করো। ২০ সেকেন্ডে উত্তর না দিলে দানব আঘাত করবে!', play: playBoss },
  { id: 'ladder', emoji: '👑', name: 'লাখপতি সিঁড়ি', desc: '১২ ধাপে ১,০০,০০০ পয়েন্ট — ৫০:৫০, পাস আর দুই সুযোগ লাইফলাইন নিয়ে।', play: playLadder },
  { id: 'truefalse', emoji: '✅', name: 'সত্য না মিথ্যা', desc: 'দেখানো উত্তরটা ঠিক না ভুল? সোয়াইপ করে দ্রুত বলো — ৪৫ সেকেন্ড, ৩টি জীবন।', play: playTrueFalse },
  { id: 'match', emoji: '🧩', name: 'জোড়া মেলাও', desc: 'প্রশ্নের সাথে তার সঠিক উত্তর জোড়া লাগাও — ৩ রাউন্ড, যত দ্রুত তত বোনাস।', play: playMatch },
];

// ---------- running a game ----------
let stopCurrent = null;
export function stopGame() {
  stopCurrent?.();
  stopCurrent = null;
}
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/play/')) stopGame(); });
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-g-sound]');
  if (!b) return;
  const on = toggleSound();
  document.querySelectorAll('[data-g-sound]').forEach((x) => { x.textContent = on ? '🔊 শব্দ চালু' : '🔇 শব্দ বন্ধ'; x.setAttribute('aria-pressed', on); });
  if (on) sfx.ok();
});

export function startGame(el, { ch, tp, mode, topicName }) {
  stopGame();
  if (!el) return;
  const pool = mcqsOf(ch, tp);
  const run = () => {
    stopGame();
    el.onclick = el.ontouchstart = el.ontouchend = null;
    const lv = /^level-(\d+)$/.exec(mode);
    const base = { ch, tp, pool, topicName, again: run };
    if (lv) {
      const levels = levelsOf(pool);
      const n = Number(lv[1]);
      if (!levels[n - 1]) return;
      stopCurrent = playLevel(el, { ...base, key: levelKey(ch, tp, n), level: n, levelCount: levels.length, levelItems: levels[n - 1] });
    } else {
      const m = MODES.find((x) => x.id === mode);
      if (!m) return;
      stopCurrent = m.play(el, { ...base, key: `${ch}/${tp}/${mode}` });
    }
    el.scrollIntoView?.({ block: 'start' });
  };
  run();
}

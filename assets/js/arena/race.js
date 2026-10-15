// 4. MCQ Racing — every right answer drives the car forward, three in a row light the nitro,
// a wrong one slows it down (and shows the explanation, with the clock paused). A 90-second race
// or an untimed practice run, for one topic or the whole chapter, with personal bests.

import { esc, bn, poolOf, deck, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, validSrc, srcChips, chapterList, topicList, scopeName, floatText } from './core.js?v=202610150339';
import { gameState, bestOf, saveA } from '../learnstore.js?v=202610150339';

export const meta = { id: 'race', emoji: '🏎️', name: 'MCQ রেসিং', desc: 'সঠিক উত্তরে গাড়ি ছোটে, পরপর ৩টায় নাইট্রো! ভুলে গতি কমে। ৯০ সেকেন্ডের রেস বা সময় ছাড়া অনুশীলন।', need: 0 };
const TRACK = 1000, STEP = 100, NITRO_STEP = 200, SLOW = 50, TIME = 90;
const MODES = [{ id: 'timed', name: `⏱️ ${bn(TIME)} সেকেন্ড` }, { id: 'free', name: '🧘 সময় ছাড়া' }];
const st = () => gameState('race', { mode: 'timed', raced: {} });
const keyOf = (ch, tp, src, mode) => `race/${ch}/${tp}/${src}/${mode}`;

export function chapterInfo(ch) {
  const tps = topicsOf(ch);
  return `ট্র্যাক ${bn(tps.filter((t) => st().raced[`${ch}/${t.id}`]).length)}/${bn(tps.length)}`;
}

export function progress() {
  let done = 0, total = 0;
  for (const c of chapters()) {
    const tps = topicsOf(c.id);
    total += tps.length;
    done += tps.filter((t) => st().raced[`${c.id}/${t.id}`]).length;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function view({ b: ch, c: tp, d: src }) {
  if (!ch) {
    return {
      title: meta.name,
      html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🏎️</span><div><h1>MCQ রেসিং</h1>
          <p class="muted small">অধ্যায় বেছে নাও, তারপর টপিক বা পুরো অধ্যায়ের রেস।</p></div></header>
        ${chapterList((c) => `#/arena/race/${c.id}`)}`,
    };
  }
  const c = chapterById(ch);
  if (!c) return null;
  if (!tp) {
    return {
      title: c.name,
      back: '#/arena/race',
      html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🏁</span><div><p class="eyebrow">MCQ রেসিং</p><h1>${esc(c.name)}</h1>
          <p class="muted small">কোন ট্র্যাকে রেস দেবে? প্রতিটা টপিক একটা ট্র্যাক, পুরো অধ্যায় হলো গ্র্যান্ড প্রিক্স।</p></div></header>
        ${topicList(ch, (t) => `#/arena/race/${esc(ch)}/${esc(t)}`, (t) => {
          const b = bestOf(keyOf(ch, t, validSrc(ch, t, null), 'timed'));
          return b ? `· 🏅 ${bn(b)}` : '';
        })}`,
    };
  }
  if (tp !== 'all' && !topicsOf(ch).some((t) => t.id === tp)) return null;
  src = validSrc(ch, tp, src);
  return {
    title: scopeName(ch, tp),
    back: `#/arena/race/${ch}`,
    html: `<p class="eyebrow">🏎️ ${esc(c.name)} · ${esc(scopeName(ch, tp))}</p>
      ${srcChips(`#/arena/race/${esc(ch)}/${esc(tp)}`, ch, tp, src)}
      <section class="gm ar-game" id="ar"></section>`,
    after: () => lobby(document.getElementById('ar'), { ch, tp, src }),
  };
}

function lobby(el, o) {
  const pool = poolOf(o.ch, o.tp, o.src);
  if (!pool.length) { el.innerHTML = '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'; return; }
  mount(() => {});
  const paint = () => {
    const mode = st().mode;
    el.innerHTML = `<div class="ar-lobby rise">
        <div class="ar-track demo" aria-hidden="true"><span class="ar-car">🏎️</span><span class="ar-flag">🏁</span></div>
        <div class="gm-srcs ar-modes">${MODES.map((m) => `<button class="gm-src tap ${m.id === mode ? 'on' : ''}" data-ar-mode="${m.id}">${m.name}</button>`).join('')}</div>
        <ul class="ar-rules">
          <li>✓ সঠিক উত্তর: +${bn(STEP)} মিটার</li>
          <li>🔥 পরপর ৩টি সঠিক: নাইট্রো — পরের ২টিতে +${bn(NITRO_STEP)} মিটার</li>
          <li>✗ ভুল: −${bn(SLOW)} মিটার, নাইট্রো বন্ধ (ব্যাখ্যা পড়ার সময় ঘড়ি থামে)</li>
          <li>${mode === 'timed' ? `${bn(TIME)} সেকেন্ডে যত দূর — আগে শেষ করলে বাকি সময়ের বোনাস` : `${bn(TRACK)} মিটার শেষ করো — নির্ভুলতাই স্কোর`}</li>
        </ul>
        <p class="gm-best">🏅 সেরা: ${bn(bestOf(keyOf(o.ch, o.tp, o.src, mode)))}</p>
        <button class="btn btn-primary tap ar-go" data-ar-go>🏁 রেস শুরু</button></div>`;
  };
  el.onclick = (e) => {
    const m = e.target.closest('[data-ar-mode]');
    if (m) { st().mode = m.dataset.arMode; saveA(); return paint(); }
    if (e.target.closest('[data-ar-go]')) { el.onclick = null; race(el, o, pool); }
  };
  paint();
}

function race(el, o, pool) {
  const mode = st().mode === 'free' ? 'free' : 'timed';
  const d = deck(pool);
  let dist = 0, streak = 0, nitro = 0, right = 0, n = 0, left = TIME * 1000, paused = false, done = false, timer = null, panel = null, last = Date.now();
  const wrong = [];
  st().raced[`${o.ch}/${o.tp}`] = 1;
  const stop = () => { clearInterval(timer); timer = null; panel?.destroy(); };
  mount(stop);
  el.innerHTML = `<div class="gm-hud"><span id="arDist">📏 ০/${bn(TRACK)} মি.</span><span id="arClock">${mode === 'timed' ? `⏱️ ${bn(TIME)}` : '🧘'}</span><span id="arNitro"></span></div>
    <div class="ar-track" id="arTrack"><span class="ar-car" id="arCar" style="left:0%">🏎️</span><span class="ar-flag">🏁</span></div>
    <div id="arq"></div>`;
  const car = el.querySelector('#arCar'), track = el.querySelector('#arTrack');
  const hud = () => {
    el.querySelector('#arDist').textContent = `📏 ${bn(dist)}/${bn(TRACK)} মি.`;
    el.querySelector('#arNitro').textContent = nitro ? `🔥 নাইট্রো ×${bn(nitro)}` : streak ? `⚡ ${bn(streak)}` : '';
    car.style.left = `${Math.min(100, (dist / TRACK) * 100)}%`;
    car.classList.toggle('nitro', nitro > 0);
    if (mode === 'timed') el.querySelector('#arClock').textContent = `⏱️ ${bn(Math.ceil(left / 1000))}`;
  };
  if (mode === 'timed') {
    timer = setInterval(() => {
      const now = Date.now();
      if (!paused) left -= now - last;
      last = now;
      if (left <= 0) { left = 0; finish(); return; }
      hud();
    }, 200);
  }
  const ask1 = () => {
    if (done) return;
    if (dist >= TRACK) return finish();
    const q = ask(d.next(), pool);
    panel = askQuestion(el.querySelector('#arq'), q, {
      label: `প্রশ্ন ${bn(n + 1)}`, autoNextMs: 450,
      onAnswer: (ok) => {
        n++;
        if (ok) {
          right++; streak++;
          const step = nitro > 0 ? NITRO_STEP : STEP;
          if (nitro > 0) nitro--;
          dist = Math.min(TRACK, dist + step);
          if (streak % 3 === 0) { nitro = 2; floatText(track, '🔥 নাইট্রো!', 'up'); }
          else floatText(track, `+${bn(step)} মি.`, 'up');
        } else {
          streak = 0; nitro = 0; wrong.push(q);
          dist = Math.max(0, dist - SLOW);
          floatText(track, `−${bn(SLOW)} মি.`, 'bad');
          car.classList.add('slow'); setTimeout(() => car.classList.remove('slow'), 600);
          paused = true; // reading the explanation does not cost time
        }
        hud();
      },
      onNext: () => { paused = false; last = Date.now(); panel.destroy(); ask1(); },
    });
  };
  const finish = () => {
    if (done) return;
    done = true;
    stop();
    const finished = dist >= TRACK;
    const secsLeft = Math.ceil(left / 1000);
    const score = mode === 'timed' ? dist + (finished ? secsLeft * 10 : 0) : (n ? Math.round((right / n) * 1000) : 0);
    resultScreen(el, {
      emoji: finished ? '🏆' : '🏎️', title: finished ? 'রেস শেষ — ফিনিশ লাইন পার!' : 'সময় শেষ!',
      score, key: keyOf(o.ch, o.tp, o.src, mode), won: finished, wrong,
      lines: [`${bn(dist)} মিটার · ${bn(n)}টির মধ্যে ${bn(right)}টি সঠিক`, mode === 'timed' && finished ? `বাকি ${bn(secsLeft)} সেকেন্ড → বোনাস ${bn(secsLeft * 10)}` : '', mode === 'free' ? `নির্ভুলতা ${bn(n ? Math.round((right / n) * 100) : 0)}%` : ''],
      retry: () => race(el, o, pool), back: `#/arena/race/${o.ch}`, backLabel: '🏁 ট্র্যাক বদলাও',
    });
  };
  hud();
  ask1();
}

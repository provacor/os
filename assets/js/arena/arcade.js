// 12. Arcade Challenge — seven short challenges on any topic, the whole chapter, or all chapters:
// a 7-second clock, moving targets, a sudden-death combo, an accuracy grade, a sprint against the
// stopwatch, a round of only the questions once answered wrong, and a mixed-chapter round.

import { esc, bn, poolOf, mixedPool, smartPick, deck, rank, ask, askQuestion, resultScreen, mount, chapters, topicsOf, chapterById, validSrc, srcChips, chapterList, topicList, scopeName, floatText, animOn } from './core.js?v=202610150224';
import { gameState, bestOf, saveA, S } from '../learnstore.js?v=202610150224';

export const meta = { id: 'arcade', emoji: '🕹️', name: 'আর্কেড চ্যালেঞ্জ', desc: '৭ সেকেন্ডের দ্রুত উত্তর, নড়তে থাকা নিশানা, কম্বো চেইন, নির্ভুলতা, স্প্রিন্ট, ভুল শোধরানো আর মিশ্র অধ্যায় — ৭টি চ্যালেঞ্জ।', need: 0 };
const CHALLENGES = [
  { id: 'quick', e: '⚡', name: 'দ্রুত উত্তর', desc: 'প্রতিটা প্রশ্নে মাত্র ৭ সেকেন্ড — ১০টি প্রশ্ন। যত দ্রুত, তত বোনাস।' },
  { id: 'target', e: '🎯', name: 'সঠিক অপশনে নিশানা', desc: 'অপশনগুলো নিশানার মতো নড়ছে — ঠিকটায় চাপো। ১০টি প্রশ্ন, পরপর সঠিকে বোনাস।' },
  { id: 'combo', e: '🔗', name: 'কম্বো চেইন', desc: 'একটা ভুলেই খেলা শেষ — কত লম্বা চেইন বানাতে পারো? প্রতিটা ধাপে পয়েন্ট বাড়ে।' },
  { id: 'accuracy', e: '💯', name: 'নির্ভুলতা চ্যালেঞ্জ', desc: '১৫টি প্রশ্ন, কোনো ঘড়ি নেই — শেষে S / A / B / C গ্রেড।' },
  { id: 'sprint', e: '🏃', name: 'টপিক স্প্রিন্ট', desc: '১০টি প্রশ্ন যত দ্রুত সম্ভব — প্রতিটা ভুলে ৫ সেকেন্ড জরিমানা।' },
  { id: 'recovery', e: '🩹', name: 'ভুল শোধরানো', desc: 'শুধু আগে ভুল হওয়া আর এখনো আয়ত্তে না আসা প্রশ্ন — প্রতিটার ব্যাখ্যাসহ।' },
  { id: 'mixed', e: '🌐', name: 'মিশ্র অধ্যায়', desc: 'সব অধ্যায় থেকে ১২টি প্রশ্ন — কোনটা কতটা মনে আছে, দেখে নাও।' },
];
const QUICK_SECS = 7, PENALTY = 5;
const st = () => gameState('arcade', { perfect: 0, played: {}, times: {} });
const recKey = (o, id) => (id === 'mixed' ? 'arcade/mixed' : `arcade/${o.ch}/${o.tp}/${o.src}/${id}`);

export function chapterInfo(ch) {
  const played = new Set(Object.keys(S.best).filter((k) => k.startsWith(`arcade/${ch}/`)).map((k) => k.split('/').pop()));
  return `রেকর্ড ${bn(played.size)}/৬টি চ্যালেঞ্জে`;
}

export function progress() {
  return Math.round((CHALLENGES.filter((c) => st().played[c.id]).length / CHALLENGES.length) * 100);
}

export function view({ b: ch, c: tp, d: src }) {
  if (!ch) {
    return {
      title: meta.name,
      html: `<header class="ar-hero rise"><span class="ar-hero-emoji">🕹️</span><div><h1>আর্কেড চ্যালেঞ্জ</h1>
          <p class="muted small">অধ্যায় আর টপিক বেছে নাও — তারপর ৬টি চ্যালেঞ্জের যেকোনোটা। সব অধ্যায় মিলিয়ে খেলতে “মিশ্র অধ্যায়”।</p></div></header>
        <a class="ar-boss-card tap rise" href="#/arena/arcade/mixed"><span class="ar-boss-face">🌐</span><span><b>মিশ্র অধ্যায়</b><small>সব অধ্যায় থেকে ১২টি প্রশ্ন ${bestOf('arcade/mixed') ? `· 🏅 ${bn(bestOf('arcade/mixed'))}` : ''}</small></span></a>
        ${chapterList((c) => `#/arena/arcade/${c.id}`)}`,
    };
  }
  if (ch === 'mixed') {
    return {
      title: 'মিশ্র অধ্যায়', back: '#/arena/arcade',
      html: '<p class="eyebrow">🕹️ আর্কেড · সব অধ্যায়</p><section class="gm ar-game" id="ar"></section>',
      after: () => menu(document.getElementById('ar'), { mixed: true }),
    };
  }
  const c = chapterById(ch);
  if (!c) return null;
  if (!tp) return { title: c.name, back: '#/arena/arcade', html: `<p class="eyebrow">🕹️ আর্কেড · ${esc(c.name)}</p>${topicList(ch, (t) => `#/arena/arcade/${esc(ch)}/${esc(t)}`)}` };
  if (tp !== 'all' && !topicsOf(ch).some((t) => t.id === tp)) return null;
  src = validSrc(ch, tp, src);
  return {
    title: scopeName(ch, tp), back: `#/arena/arcade/${ch}`,
    html: `<p class="eyebrow">🕹️ ${esc(c.name)} · ${esc(scopeName(ch, tp))}</p>${srcChips(`#/arena/arcade/${esc(ch)}/${esc(tp)}`, ch, tp, src)}<section class="gm ar-game" id="ar"></section>`,
    after: () => menu(document.getElementById('ar'), { ch, tp, src }),
  };
}

function menu(el, o) {
  mount(() => {});
  const pool = o.mixed ? mixedPool(chapters().map((c) => c.id), 'mcq') : poolOf(o.ch, o.tp, o.src);
  if (!pool.length) { el.innerHTML = '<p class="muted">এখানে এখনো প্রশ্ন নেই।</p>'; return; }
  const list = o.mixed ? CHALLENGES.filter((c) => c.id === 'mixed') : CHALLENGES.filter((c) => c.id !== 'mixed');
  const waiting = o.mixed ? 0 : pool.filter((s) => rank(s) === 0).length;
  el.innerHTML = `<div class="ar-arcade">${list.map((c, i) => {
    const best = bestOf(recKey(o, c.id));
    const t = st().times[recKey(o, c.id)];
    const extra = c.id === 'recovery' ? ` · অপেক্ষায় ${bn(waiting)}টি` : '';
    return `<button class="gm-mode tap rise" style="--i:${i}" data-ac="${c.id}" ${c.id === 'recovery' && !waiting ? 'disabled' : ''}>
        <span class="gm-mode-emoji">${c.e}</span>
        <span class="gm-mode-body"><b>${c.name}</b><small>${c.desc}${extra}</small>${best ? `<span class="gm-mode-best">🏅 সেরা: ${bn(best)}${t ? ` · ⏱️ ${bn((t / 1000).toFixed(1))} সে.` : ''}</span>` : ''}</span></button>`;
  }).join('')}</div>${!o.mixed && !waiting ? '<p class="muted small">🩹 এখানে কোনো ভুল জমে নেই — দারুণ!</p>' : ''}`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-ac]');
    if (!b || b.disabled) return;
    el.onclick = null;
    play(el, o, pool, b.dataset.ac);
  };
}

function play(el, o, poolAll, id) {
  const c = CHALLENGES.find((x) => x.id === id);
  const near = (s) => (o.mixed ? poolOf(s.ch, 'all', validSrc(s.ch, 'all', 'mcq')) : poolAll);
  let pool = poolAll;
  if (id === 'recovery') pool = poolAll.filter((s) => rank(s) === 0);
  const N = { quick: 10, target: 10, accuracy: 15, sprint: 10, recovery: 10, mixed: 12 }[id] ?? 10;
  const endless = id === 'combo';
  const d = deck(pool);
  const fixed = endless ? [] : smartPick(pool, N);
  const total = endless ? 50 : fixed.length;
  let i = 0, right = 0, score = 0, streak = 0, timer = null, panel = null, t0 = Date.now(), paused = 0, pauseAt = 0, penalty = 0;
  const wrong = [];
  const stop = () => { clearInterval(timer); timer = null; panel?.destroy(); };
  mount(stop);
  st().played[id] = 1; saveA();
  const elapsed = () => Date.now() - t0 - paused + penalty * 1000;
  const step = () => {
    if (i >= total) return end();
    const spec = endless ? d.next() : fixed[i];
    const q = ask(spec, near(spec));
    const head = id === 'sprint' ? `<span id="acClock">⏱️ ${bn((elapsed() / 1000).toFixed(1))}</span>` : id === 'quick' ? `<span id="acClock">⏳ ${bn(QUICK_SECS)}</span>` : id === 'combo' ? `<span>🔗 ${bn(streak)}</span>` : `<span>✓ ${bn(right)}</span>`;
    el.innerHTML = `<div class="gm-hud"><span>${c.e} ${endless ? `চেইন ${bn(i + 1)}` : `${bn(i + 1)}/${bn(total)}`}</span><span class="gm-prog"><i style="width:${endless ? Math.min(100, streak * 2) : (i / total) * 100}%"></i></span>${head}</div>
      ${id === 'quick' ? `<div class="ar-fuse"><i id="acFuse" style="animation-duration:${QUICK_SECS}s"></i></div>` : ''}
      <p class="ar-score-line">স্কোর: <b>${bn(score)}</b></p><div id="arq"></div>`;
    const qStart = Date.now();
    clearInterval(timer);
    if (id === 'quick') {
      timer = setInterval(() => {
        const left = QUICK_SECS * 1000 - (Date.now() - qStart);
        const x = el.querySelector('#acClock');
        if (x) x.textContent = `⏳ ${bn(Math.max(0, Math.ceil(left / 1000)))}`;
        if (left <= 0) { clearInterval(timer); panel?.answer(-1); }
      }, 100);
    } else if (id === 'sprint') {
      timer = setInterval(() => { const x = el.querySelector('#acClock'); if (x && !pauseAt) x.textContent = `⏱️ ${bn((elapsed() / 1000).toFixed(1))}`; }, 100);
    }
    panel = askQuestion(el.querySelector('#arq'), q, {
      label: id === 'recovery' ? '🩹 আগে ভুল হয়েছিল' : o.mixed ? esc(chapterById(q.ch)?.name ?? '') : '',
      showExp: id === 'recovery' ? 'always' : 'wrong', autoNextMs: id === 'quick' || id === 'sprint' ? 400 : 650,
      optsClass: id === 'target' && animOn() ? 'targets' : '',
      onAnswer: (ok) => {
        clearInterval(timer);
        el.querySelector('#acFuse')?.classList.add('stop');
        const secs = (Date.now() - qStart) / 1000;
        if (ok) {
          right++; streak++;
          if (id === 'quick') score += 100 + Math.max(0, Math.round((QUICK_SECS - secs) * 10));
          else if (id === 'target') score += 100 + Math.min(5, streak - 1) * 20;
          else if (id === 'combo') score += 10 * streak;
          else score += 100;
          if (streak >= 3 && id !== 'combo') floatText(el, `🔥 ${bn(streak)}`, 'up');
        } else {
          streak = 0; wrong.push(q);
          if (id === 'sprint') { penalty += PENALTY; floatText(el, `+${bn(PENALTY)} সে.`, 'bad'); }
        }
        if (id === 'sprint' && !ok) pauseAt = Date.now(); // reading the explanation is not timed
      },
      onNext: () => {
        if (pauseAt) { paused += Date.now() - pauseAt; pauseAt = 0; }
        panel.destroy(); i++;
        if (endless && wrong.length) return end();
        step();
      },
    });
  };
  const end = () => {
    stop();
    const n = endless ? i : total;
    let title = 'চ্যালেঞ্জ শেষ', lines = [`${bn(n)}টির মধ্যে ${bn(right)}টি সঠিক`], won = right === n && n > 0, emoji = c.e;
    if (id === 'combo') { title = wrong.length ? `চেইন: ${bn(right)}` : 'অবিশ্বাস্য — ৫০ ধাপের চেইন!'; won = right >= 10; lines = [`সবচেয়ে লম্বা চেইন ${bn(right)}`]; }
    if (id === 'accuracy') {
      const pct = n ? (right / n) * 100 : 0;
      const grade = pct === 100 ? 'S' : pct >= 90 ? 'A' : pct >= 75 ? 'B' : 'C';
      title = `গ্রেড ${grade}`; emoji = { S: '🌟', A: '🥇', B: '🥈', C: '🥉' }[grade];
      lines.push(`নির্ভুলতা ${bn(Math.round(pct))}%`);
      if (grade === 'S' && n >= 10) { st().perfect = 1; saveA(); }
    }
    if (id === 'sprint') {
      const ms = elapsed();
      score = Math.max(0, 3000 - Math.round(ms / 100)) + right * 50;
      const k = recKey(o, id), prev = st().times[k];
      if (right === n && (!prev || ms < prev)) { st().times[k] = ms; saveA(); }
      lines.push(`সময় ${bn((ms / 1000).toFixed(1))} সেকেন্ড (জরিমানা ${bn(penalty)} সে.)${prev ? ` · সেরা সময় ${bn((Math.min(prev, right === n ? ms : prev) / 1000).toFixed(1))} সে.` : ''}`);
      if (right < n) lines.push('সেরা সময় গোনা হয় সব সঠিক হলে।');
    }
    if (id === 'recovery') { title = right ? `${bn(right)}টি ভুল শোধরানো হলো` : 'আবার চেষ্টা করো'; lines.push('একটা প্রশ্ন পরপর ২ বার সঠিক হলে আয়ত্তে আসে।'); }
    resultScreen(el, {
      emoji, title, score, key: recKey(o, id), won, wrong, lines,
      retry: () => (id === 'recovery' && !poolAll.some((s) => rank(s) === 0) ? menu(el, o) : play(el, o, poolAll, id)),
      back: o.mixed ? '#/arena/arcade' : `#/arena/arcade/${o.ch}/${o.tp}/${o.src}`, backLabel: '🕹️ চ্যালেঞ্জের তালিকা',
    });
  };
  if (!pool.length) { el.innerHTML = '<p class="muted">🩹 এখানে কোনো ভুল জমে নেই — দারুণ!</p>'; return; }
  step();
}

// Hands-free study: drive a section with Bluetooth earbuds (QCY MeloBuds Pro or any
// headset), a Bluetooth remote/keyboard, the phone's lock-screen media controls or voice.
//
// How it works: browsers send headset button presses (play/pause, next, previous) to the
// page that is playing media, through the Media Session API. While hands-free mode is on
// we keep a silent looping audio track playing so this page owns those buttons, then map
// them to study actions: read the question, reveal the answer, go to the next/previous item.
// Questions and answers are read aloud with the phone's text-to-speech; MCQs can be
// answered by saying "ক/খ/গ/ঘ" into the earbud microphone.

import { speak, stopSpeaking } from './a11y.js?v=202610100130';
import { isItemDone, toggleItemDone } from './progress.js?v=202610100130';
import { recordDone } from './activity.js?v=202610100130';

const KEY = 'hscos:handsfree:v1';
const DEFAULTS = { autoAnswer: false, autoNext: false, voiceAnswer: true, markDone: false, readOptions: true, gap: 4 };
const LETTERS = 'কখগঘ';
const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasMediaSession = 'mediaSession' in navigator;

let model = null;
let prefs = readPrefs();
const st = { on: false, test: false, sec: null, i: 0, phase: 'q', speaking: false, paused: false, startedAt: 0, timer: 0, rec: null, audio: null };

function readPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...DEFAULTS }; }
}
export const hfPrefs = () => prefs;
function setPrefs(patch) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* keeps for this visit */ }
}
export const hfSupport = () => ({ media: hasMediaSession, speech: 'speechSynthesis' in window, listen: !!Recognition });
export const hfActive = () => st.on;

// ---------- small helpers ----------

function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `<span>${text.replace(/[<>&]/g, '')}</span>`;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

function say(text, then) {
  st.speaking = true;
  syncBar();
  const ok = speak(text, null, () => {
    st.speaking = false;
    syncBar();
    then?.();
  });
  if (!ok) {
    st.speaking = false;
    syncBar();
    setTimeout(() => then?.(), 400);
  }
}

function clearPending() {
  clearTimeout(st.timer);
  st.timer = 0;
  if (st.rec) {
    try { st.rec.abort(); } catch { /* already stopped */ }
    st.rec = null;
  }
}
function later(fn, sec = prefs.gap) {
  clearTimeout(st.timer);
  st.timer = setTimeout(fn, sec * 1000);
}

// A short silent WAV, looped: lets this page receive headset buttons (Media Session).
function silentUrl() {
  const rate = 8000, secs = 10, n = rate * secs;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function startAudio() {
  if (!st.audio) {
    st.audio = new Audio(silentUrl());
    st.audio.loop = true;
    // The OS may pause us when speech or a call takes audio focus; take the buttons back.
    st.audio.addEventListener('pause', () => {
      if (st.on || st.test) setTimeout(() => { if ((st.on || st.test) && st.audio.paused) st.audio.play().catch(() => {}); }, 700);
    });
  }
  return st.audio.play().catch(() => {});
}
function stopAudio() {
  st.audio?.pause();
}

const ACTIONS = ['play', 'pause', 'nexttrack', 'previoustrack', 'seekforward', 'seekbackward', 'stop'];
function bindMedia(handler) {
  if (!hasMediaSession) return;
  for (const a of ACTIONS) {
    try { navigator.mediaSession.setActionHandler(a, handler ? () => handler(a) : null); } catch { /* action not supported here */ }
  }
  navigator.mediaSession.playbackState = handler ? 'playing' : 'none';
}
function setMeta(title, artist) {
  if (!hasMediaSession || !window.MediaMetadata) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Provacor', artwork: [{ src: 'assets/img/avatar.jpg', type: 'image/jpeg' }] });
}

// ---------- item → spoken text ----------

const clip = (s, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);
const rightIndex = (it) => {
  const ans = String(it.correctAnswer ?? '').trim();
  return (it.options ?? []).findIndex((o, i) => ans === String(i) || ans === String(o).trim());
};
function kindOf(it) {
  if (it.question && it.options) return 'mcq';
  if (it.parts) return 'cq';
  if (it.question && it.answer) return 'qa';
  if (it.formulas) return 'formula';
  if (it.steps) return 'steps';
  if (it.format === 'pdf' || it.format === 'html') return 'file';
  return 'text';
}
function questionText(it, n) {
  const no = `${bn(n)} নম্বর। `;
  switch (kindOf(it)) {
    case 'mcq':
      return `${no}${it.question}। ${prefs.readOptions ? it.options.map((o, k) => `${LETTERS[k]}: ${o}।`).join(' ') : ''}`;
    case 'cq':
      return `${no}${it.title ?? ''}। ${it.stem ? `উদ্দীপক: ${it.stem}।` : ''} ${it.parts.map((p) => `${p.label}: ${p.q}`).join('। ')}`;
    case 'qa':
      return `${no}${it.question}`;
    case 'formula':
    case 'steps':
      return `${no}${it.title ?? ''}`;
    case 'file':
      return `${no}${it.title ?? ''}। এটা ${it.format === 'pdf' ? 'পিডিএফ ফাইল' : 'ইন্টারঅ্যাকটিভ সিমুলেশন'}, স্ক্রিনে খুলে দেখো।`;
    default:
      return `${no}${it.topic ? `${it.topic}। ` : ''}${it.title ?? ''}`;
  }
}
function answerText(it) {
  switch (kindOf(it)) {
    case 'mcq': {
      const r = rightIndex(it);
      return `সঠিক উত্তর ${r >= 0 ? `${LETTERS[r]}: ${it.options[r]}` : it.correctAnswer}। ${it.explanation ?? ''}`;
    }
    case 'cq': {
      const ans = it.parts.filter((p) => p.a).map((p) => `${p.label} এর উত্তর: ${p.a}`);
      return ans.length ? ans.join('। ') : `এই প্রশ্নের উত্তর দেওয়া নেই। ${it.note ?? ''}`;
    }
    case 'qa': return `উত্তর: ${it.answer}`;
    case 'formula': return `${it.formulas.join('। ')}। ${it.note ?? ''}`;
    case 'steps': return `${it.steps.join('। ')}। ফলাফল: ${it.result ?? ''}। ${it.note ?? ''}`;
    case 'file': return '';
    default: return `${it.body ?? ''} ${it.note ?? ''}`;
  }
}
const hasAnswer = (it) => kindOf(it) !== 'file' && answerText(it).trim().length > 0;

// ---------- screen ----------

const cards = () => [...document.querySelectorAll('#view .items > .item-card')];
function highlight(scroll = true) {
  const list = cards();
  list.forEach((c, k) => c.classList.toggle('hf-current', st.on && k === st.i));
  const c = list[st.i];
  if (c && scroll) c.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function showAnswerOnScreen(it) {
  const c = cards()[st.i];
  if (!c) return;
  if (kindOf(it) === 'mcq' && !c.classList.contains('answered')) {
    const r = rightIndex(it);
    c.classList.add('answered');
    c.querySelectorAll('.opt').forEach((o, k) => k === r && o.classList.add('right'));
    c.querySelector('.mcq-exp')?.removeAttribute('hidden');
  }
  c.querySelectorAll('details.ans').forEach((d) => { d.open = true; });
}
function markDone(it) {
  if (isItemDone(it.id)) return;
  toggleItemDone(it.id);
  recordDone(true);
  const b = document.querySelector(`.btn-done[data-item="${CSS.escape(it.id)}"]`);
  if (b) {
    b.classList.add('on', 'pop');
    b.setAttribute('aria-pressed', 'true');
    const label = b.querySelector('span:last-child');
    if (label) label.textContent = 'Done';
    b.closest('.item-card')?.classList.add('is-done');
  }
}

let bar = null;
function ensureBar() {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.className = 'hf-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'হ্যান্ডস-ফ্রি নিয়ন্ত্রণ');
  bar.innerHTML = `<span class="hf-dot" aria-hidden="true">🎧</span><span class="hf-label" aria-live="polite"></span>
    <button data-hf="prev" aria-label="আগেরটা / আবার শোনো">⏮</button>
    <button data-hf="toggle" class="hf-main" aria-label="চালাও / থামাও / উত্তর">⏯</button>
    <button data-hf="next" aria-label="পরেরটা">⏭</button>
    <button data-hf="mic" aria-label="মুখে উত্তর বলো">🎙</button>
    <button data-hf="stop" aria-label="হ্যান্ডস-ফ্রি বন্ধ">✕</button>`;
  document.body.appendChild(bar);
  return bar;
}
function syncBar() {
  document.querySelectorAll('[data-hf-start]').forEach((b) => {
    b.classList.toggle('on', st.on);
    const l = b.querySelector('span');
    if (l) l.textContent = st.on ? 'হ্যান্ডস-ফ্রি বন্ধ করো' : 'ইয়ারবাডে শুনে শুনে পড়ো (হ্যান্ডস-ফ্রি)';
  });
  if (!bar) return;
  const show = st.on || st.test;
  bar.hidden = !show;
  document.body.classList.toggle('hf-on', show);
  if (!show) return;
  const lab = bar.querySelector('.hf-label');
  bar.querySelector('[data-hf="mic"]').hidden = !st.on || !Recognition;
  ['prev', 'next'].forEach((k) => { bar.querySelector(`[data-hf="${k}"]`).hidden = !st.on; });
  bar.querySelector('[data-hf="toggle"]').hidden = !st.on;
  if (st.test) { lab.textContent = 'বোতাম পরীক্ষা: ইয়ারবাডে ট্যাপ করো'; return; }
  const n = st.sec?.items.length ?? 0;
  const state = st.rec ? 'শুনছি… বলো' : st.paused ? 'থামানো' : st.speaking ? (st.phase === 'q' ? 'প্রশ্ন পড়ছি' : 'উত্তর পড়ছি') : st.phase === 'q' ? 'ট্যাপ = উত্তর' : 'ট্যাপ = পরেরটা';
  lab.textContent = `${bn(st.i + 1)}/${bn(n)} · ${state}`;
  bar.querySelector('.hf-main').textContent = st.speaking ? '⏸' : '▶';
}

// ---------- flow ----------

function current() { return st.sec?.items[st.i]; }

function go(i) {
  if (!st.on) return;
  clearPending();
  st.i = i;
  st.phase = 'q';
  st.paused = false;
  st.startedAt = Date.now();
  const it = current();
  highlight();
  setMeta(clip(it.question ?? it.title ?? it.stem ?? `আইটেম ${bn(i + 1)}`), `${st.sec.label} · ${st.sec.chapter.name} · ${bn(i + 1)}/${bn(st.sec.items.length)}`);
  say(questionText(it, i + 1), afterQuestion);
}
function afterQuestion() {
  const it = current();
  if (!hasAnswer(it)) {
    st.phase = 'a';
    syncBar();
    if (prefs.autoNext) later(next);
    return;
  }
  if (prefs.voiceAnswer && Recognition && !st.noMic && kindOf(it) === 'mcq') return listenAnswer();
  if (prefs.autoAnswer) later(reveal);
}
function reveal() {
  if (!st.on) return;
  clearPending();
  const it = current();
  st.phase = 'a';
  st.paused = false;
  showAnswerOnScreen(it);
  say(answerText(it), afterAnswer);
}
function afterAnswer() {
  const it = current();
  if (prefs.markDone) markDone(it);
  if (prefs.autoNext) later(next);
}
function next() {
  if (!st.on) return;
  if (st.i + 1 < st.sec.items.length) return go(st.i + 1);
  clearPending();
  st.phase = 'a';
  say('এই সেকশন শেষ। আবার শুরু করতে আগের বোতাম চাপো, বন্ধ করতে ক্রস চাপো।');
}
function prev() {
  if (!st.on) return;
  if (Date.now() - st.startedAt < 4000 && st.i > 0) return go(st.i - 1);
  go(st.i);
}
function toggle() {
  if (!st.on) return;
  if (st.rec) { clearPending(); return reveal(); }
  if (st.speaking) {
    clearPending();
    stopSpeaking();
    st.speaking = false;
    st.paused = true;
    syncBar();
    return;
  }
  if (st.paused) {
    st.paused = false;
    return st.phase === 'q' ? go(st.i) : reveal();
  }
  if (st.phase === 'q' && hasAnswer(current())) return reveal();
  next();
}

// ---------- voice ----------

const COMMANDS = [
  [/উত্তর|answer|জানি না|পারি না|স্কিপ|skip|পাস/i, () => reveal()],
  [/পরের|পরে|নেক্সট|next|সামনে/i, () => next()],
  [/আগের|আগে|পিছন|previous|back/i, () => go(Math.max(0, st.i - 1))],
  [/আবার|রিপিট|repeat/i, () => go(st.i)],
  [/থামো|থামাও|বন্ধ|stop|exit/i, () => stopHandsfree(true)],
  [/হয়েছে|হয়ে গেছে|ডান|done|কমপ্লিট/i, () => { markDone(current()); say('ঠিক আছে, শেষ হিসেবে চিহ্নিত করলাম।'); }],
];
const OPTION_WORDS = [
  /^(ক|কা|কো|কে|এ|a|এক|১|1|প্রথম|ফার্স্ট|one)\b/i,
  /^(খ|খা|খো|বি|b|দুই|২|2|দ্বিতীয়|সেকেন্ড|two)\b/i,
  /^(গ|গা|গো|সি|c|তিন|৩|3|তৃতীয়|থার্ড|three)\b/i,
  /^(ঘ|ঘা|ঘো|ডি|d|চার|৪|4|চতুর্থ|ফোর্থ|four)\b/i,
];
const norm = (s) => String(s).toLowerCase().replace(/[\s.,।?!()\-–—]/g, '');
function pickOption(heard, it) {
  for (const raw of heard) {
    const t = raw.trim().replace(/^(অপশন|option|উত্তর|answer)\s*/i, '');
    const k = OPTION_WORDS.findIndex((re) => re.test(t) || re.test(`${t} `));
    if (k >= 0 && k < it.options.length) return k;
    const byText = it.options.findIndex((o) => norm(o) && (norm(t).includes(norm(o)) || norm(o).includes(norm(t))) && norm(t).length > 1);
    if (byText >= 0) return byText;
  }
  return -1;
}

function listenAnswer(manual = false) {
  if (!Recognition || !st.on) return;
  if (manual) st.noMic = false;
  clearPending();
  const it = current();
  const rec = new Recognition();
  rec.lang = 'bn-BD';
  rec.interimResults = false;
  rec.maxAlternatives = 4;
  st.rec = rec;
  syncBar();
  let handled = false;
  rec.onresult = (e) => {
    handled = true;
    const heard = [...e.results[0]].map((a) => a.transcript.trim());
    st.rec = null;
    syncBar();
    for (const [re, fn] of COMMANDS) if (heard.some((h) => re.test(h))) return fn();
    if (kindOf(it) === 'mcq') {
      const k = pickOption(heard, it);
      if (k >= 0) return judge(it, k);
    }
    say(`বুঝিনি, শুনেছি: ${heard[0]}। আবার বলতে মাইক চাপো, উত্তর শুনতে ইয়ারবাডে ট্যাপ করো।`);
  };
  rec.onerror = (e) => {
    handled = true;
    st.rec = null;
    syncBar();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      st.noMic = true; // don't ask again on every question; the 🎙 button still tries
      toast('মাইক্রোফোনের অনুমতি দাও, তারপর 🎙 চাপো');
    }
    else if (manual) toast('কিছু শোনা যায়নি');
    if (prefs.autoAnswer && st.phase === 'q') later(reveal);
  };
  rec.onend = () => {
    if (st.rec === rec) st.rec = null;
    syncBar();
    if (!handled && prefs.autoAnswer && st.phase === 'q') later(reveal);
  };
  try { rec.start(); } catch { st.rec = null; syncBar(); }
}

function judge(it, k) {
  const r = rightIndex(it);
  const c = cards()[st.i];
  const btn = c?.querySelectorAll('.opt')[k];
  // Reuse the screen's own MCQ handling, so a wrong answer lands in the mistake book.
  if (btn && !c.classList.contains('answered')) btn.click();
  st.phase = 'a';
  const verdict = k === r ? `সঠিক! ${LETTERS[k]}: ${it.options[k]}।` : `ভুল হয়েছে। তুমি বলেছ ${LETTERS[k]}। ${answerText(it)}`;
  say(k === r ? `${verdict} ${it.explanation ?? ''}` : verdict, afterAnswer);
}

// ---------- start / stop ----------

function onMedia(action) {
  if (st.test) {
    const names = { play: 'প্লে (এক ট্যাপ)', pause: 'পজ (এক ট্যাপ)', nexttrack: 'পরের ট্র্যাক', previoustrack: 'আগের ট্র্যাক', seekforward: 'সামনে টানো', seekbackward: 'পিছনে টানো', stop: 'স্টপ' };
    toast(`পেয়েছি: ${names[action] ?? action}`);
    speak(names[action] ?? action);
    return;
  }
  if (action === 'play' || action === 'pause') toggle();
  else if (action === 'nexttrack' || action === 'seekforward') next();
  else if (action === 'previoustrack' || action === 'seekbackward') prev();
  else if (action === 'stop') stopHandsfree(true);
  if (st.audio?.paused) st.audio.play().catch(() => {});
  if (hasMediaSession) navigator.mediaSession.playbackState = 'playing';
}

export function startHandsfree(sec, from = null) {
  if (!sec?.items?.length) return toast('এই সেকশনে এখনো কিছু নেই');
  if (st.test) stopTest();
  st.on = true;
  st.sec = sec;
  ensureBar();
  startAudio();
  bindMedia(onMedia);
  const first = from ?? Math.max(0, sec.items.findIndex((it) => !isItemDone(it.id)));
  if (!speak('হ্যান্ডস-ফ্রি চালু। ইয়ারবাডে এক ট্যাপে উত্তর, পরের ট্র্যাকে পরের প্রশ্ন।', null, () => go(first))) go(first);
  st.i = first;
  syncBar();
  highlight();
}

export function stopHandsfree(announce = false) {
  if (!st.on) return;
  clearPending();
  st.on = false;
  st.speaking = false;
  stopSpeaking();
  stopAudio();
  bindMedia(null);
  highlight(false);
  syncBar();
  if (announce) { speak('হ্যান্ডস-ফ্রি বন্ধ।'); toast('হ্যান্ডস-ফ্রি বন্ধ'); }
}

function startTest() {
  if (st.on) stopHandsfree();
  st.test = true;
  ensureBar();
  startAudio();
  bindMedia(onMedia);
  setMeta('বোতাম পরীক্ষা', 'Provacor হ্যান্ডস-ফ্রি');
  syncBar();
  speak('ইয়ারবাডে এক ট্যাপ, দুই ট্যাপ, তিন ট্যাপ বা লম্বা চাপ দিয়ে দেখো। প্রতিটা চাপ আমি নাম ধরে বলব।');
  clearTimeout(st.timer);
  st.timer = setTimeout(stopTest, 90000);
}
function stopTest() {
  if (!st.test) return;
  st.test = false;
  clearTimeout(st.timer);
  stopAudio();
  bindMedia(null);
  syncBar();
}

// Called after every render: leave hands-free when the user opens another page,
// and keep the highlight when the same section is redrawn.
export function hfAfterRender() {
  if (!st.on) return;
  if (location.hash !== `#/x/${st.sec.id}`) return stopHandsfree();
  highlight(false);
}

// ---------- wiring ----------

function onKey(e) {
  if (!st.on) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const k = e.key;
  const act = {
    MediaPlayPause: toggle, MediaPlay: toggle, MediaPause: toggle, ' ': toggle, Enter: e.target.closest?.('button, a') ? null : toggle,
    MediaTrackNext: next, ArrowRight: next, PageDown: next, n: next,
    MediaTrackPrevious: prev, ArrowLeft: prev, PageUp: prev, p: prev,
    MediaStop: () => stopHandsfree(true), Escape: () => stopHandsfree(true), m: () => listenAnswer(true),
  }[k];
  if (!act) return;
  e.preventDefault();
  act();
}

function onClick(e) {
  const t = e.target;
  const startBtn = t.closest('[data-hf-start]');
  if (startBtn) {
    const sec = model?.byId.get(startBtn.dataset.hfStart);
    if (st.on && st.sec === sec) stopHandsfree(true);
    else startHandsfree(sec);
    return;
  }
  if (t.closest('[data-hf-test]')) return st.test ? stopTest() : startTest();
  const gap = t.closest('[data-hf-gap]');
  if (gap) {
    setPrefs({ gap: Number(gap.dataset.hfGap) });
    document.querySelectorAll('[data-hf-gap]').forEach((b) => b.classList.toggle('on', b === gap));
    return;
  }
  const b = t.closest('[data-hf]');
  if (b) {
    const k = b.dataset.hf;
    if (k === 'stop') return st.test ? stopTest() : stopHandsfree(true);
    if (k === 'toggle') return toggle();
    if (k === 'next') return next();
    if (k === 'prev') return prev();
    if (k === 'mic') return listenAnswer(true);
    return;
  }
  // Tap a card while hands-free is on: continue from that card.
  if (st.on && !t.closest('button, a, details, summary, input, label')) {
    const c = t.closest('#view .items > .item-card');
    const k = c ? cards().indexOf(c) : -1;
    if (k >= 0 && k !== st.i) go(k);
  }
}

function onChange(e) {
  const p = e.target.dataset?.hfPref;
  if (!p) return;
  setPrefs({ [p]: e.target.checked });
  toast('সেভ হয়েছে');
}

export function initHandsfree(m) {
  model = m;
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  // Speech in the background stops on many phones; pause cleanly and resume on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && st.on && st.audio?.paused) st.audio.play().catch(() => {});
  });
}

// Voice command entry ("শোনাও", "হ্যান্ডস ফ্রি") from the top-bar microphone.
export function startFromRoute() {
  const m = location.hash.match(/^#\/x\/(.+)$/);
  const sec = m && model?.byId.get(decodeURIComponent(m[1]));
  if (sec?.level === 'section' && sec.items.length) return startHandsfree(sec), true;
  return false;
}

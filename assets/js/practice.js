// Event handling for the practice tools (exam, review, flashcards, bookmarks & notes,
// board filter, AI marking, daily goal & reminders, offline chapters).

import { icon } from './icons.js?v=202610100204';
import {
  indexItems, itemRef, rightIndex, recordAttempt, srsReview, srsDue, srsAdd, saveExam, toggleBookmark,
  noteOf, setNote, goalState, setGoal, todayStr, offlineOf, setOffline, isMcq,
} from './learn.js?v=202610100204';
import { recordMcqMistake } from './mistakes.js?v=202610100204';
import { addTask, todayKey } from './mission.js?v=202610100204';
import { gradeCq, shrinkImage, AiError, ERRORS } from './ai.js?v=202610100204';
import { exam, filterPool, poolFor, deck, savedState, grading, bn } from './views/practice.js?v=202610100204';
import { setBoardFilter } from './views/section.js?v=202610100204';
import { DATA_FILES } from './model.js?v=202610100204';
import { tocOf } from './views/topic.js?v=202610100204';

let model;
let ui; // { rerender, toast }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- exam ----------
function startExam(ids, label, minutes) {
  const now = Date.now();
  exam.run = { ids, ans: {}, start: now, end: now + minutes * 60000, label };
  exam.result = null;
  location.hash = '#/exam/run';
}
function startFromSetup() {
  const s = exam.setup;
  const ch = model.byId.get(s.chapterId);
  const tp = s.topicId ? tocOf(s.chapterId)?.topics.find((t) => t.id === s.topicId) : null;
  const pool = shuffle(filterPool(poolFor(model, s.chapterId, s.topicId), s.mode));
  const ids = pool.slice(0, s.count);
  if (!ids.length) return ui.toast('এই বাছাইয়ে কোনো প্রশ্ন নেই');
  startExam(ids, `${ch.name}${tp ? ` · ${tp.name}` : ''}`, ids.length < s.count ? ids.length : s.minutes);
}
function submitExam(force = false) {
  const r = exam.run;
  if (!r) return;
  const left = r.ids.length - Object.keys(r.ans).length;
  if (!force && left && !confirm(`${bn(left)}টি প্রশ্নের উত্তর দাওনি। তবুও জমা দেবে?`)) return;
  const items = r.ids.map((id, i) => {
    const { it, sec } = itemRef(id);
    const right = rightIndex(it);
    const chosen = r.ans[i] ?? null;
    if (chosen != null) {
      recordAttempt(id, chosen === right);
      if (chosen !== right) {
        recordMcqMistake({ itemId: id, sectionId: sec.id, chapterId: sec.chapter.id, question: it.question, options: it.options, chosen, correct: it.options[right] ?? it.correctAnswer, explanation: it.explanation ?? '' });
      }
    } else srsAdd(id);
    return { id, n: i + 1, chosen, right };
  });
  const right = items.filter((q) => q.chosen === q.right).length;
  const skipped = items.filter((q) => q.chosen == null).length;
  const secs = Math.round((Math.min(Date.now(), r.end) - r.start) / 1000);
  exam.result = { items, right, wrong: items.length - right - skipped, skipped, total: items.length, secs, label: r.label };
  saveExam({ at: Date.now(), label: r.label, total: items.length, right, secs });
  exam.run = null;
  location.hash = '#/exam/result';
}
function tick() {
  const r = exam.run;
  const el = document.getElementById('exClock');
  if (!r || !el) return;
  const left = Math.max(0, Math.round((r.end - Date.now()) / 1000));
  el.textContent = `${bn(Math.floor(left / 60))}:${bn(String(left % 60).padStart(2, '0'))}`;
  el.classList.toggle('low', left <= 60);
  if (!left) { ui.toast('সময় শেষ — পরীক্ষা জমা হয়েছে'); submitExam(true); }
}

// ---------- reminders ----------
function checkReminder() {
  const g = goalState();
  if (!g.remind || g.notified === todayStr() || g.count >= g.mcq) return;
  const [h, m] = g.time.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  setGoal({ notified: todayStr() });
  const body = `আজ এখনো ${bn(g.mcq - g.count)}টি MCQ বাকি। চলো শুরু করি!`;
  if ('Notification' in window && Notification.permission === 'granted') {
    const opts = { body, icon: 'assets/img/avatar.jpg', tag: 'provacor-goal' };
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((reg) => reg.showNotification('📚 পড়ার সময়', opts));
    else new Notification('📚 পড়ার সময়', opts);
  }
  ui.toast(body);
}
function downloadIcs() {
  const g = goalState();
  const [h, m] = g.time.split(':');
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const start = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(h)}${p(m)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Provacor//Study reminder//BN', 'BEGIN:VEVENT', `UID:provacor-daily-${Date.now()}@provacor`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT30M', 'RRULE:FREQ=DAILY',
    `SUMMARY:Provacor — আজকের পড়া (${g.mcq}টি MCQ)`, 'DESCRIPTION:Provacor খুলে আজকের রিভিশন আর MCQ শেষ করো।', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:পড়ার সময়', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'provacor-reminder.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  ui.toast('ফাইলটা খুলে ক্যালেন্ডারে যোগ করো');
}

// ---------- offline ----------
const OFFLINE_CACHE = 'hscos-offline-v1';
async function saveOffline(chapterId, btn) {
  if (!('caches' in window)) return ui.toast('এই ব্রাউজারে অফলাইন সাপোর্ট নেই');
  const ch = model.byId.get(chapterId);
  const urls = new Set(['./', 'index.html', 'sw.js', 'content/index.json', 'content/toc.json', 'content/mindmaps/index.json', 'data/concepts.json', ...Object.values(DATA_FILES)]);
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name);
    if (u.origin === location.origin) urls.add(u.pathname.replace(/^\//, '') + u.search);
  }
  for (const [sid, reg] of Object.entries(model.contentIndex)) if (sid.startsWith(`${chapterId}_`)) urls.add(reg.file);
  for (const s of ch.sections) for (const it of s.items) if (it.file) urls.add(encodeURI(it.file));
  urls.add(`content/mindmaps/${chapterId}.json`);
  const list = [...urls];
  const cache = await caches.open(OFFLINE_CACHE);
  let bytes = 0, ok = 0;
  btn.disabled = true;
  const label = btn.querySelector('span');
  for (const [i, u] of list.entries()) {
    if (label) label.textContent = `জমা হচ্ছে… ${bn(i + 1)}/${bn(list.length)}`;
    try {
      const res = await fetch(u, { cache: 'no-cache' });
      if (!res.ok) continue;
      bytes += (await res.clone().blob()).size;
      await cache.put(new URL(u, location.href).href, res);
      ok++;
    } catch { /* skip what can't be fetched */ }
  }
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  setOffline(chapterId, { at: Date.now(), bytes, files: list.filter((u) => !u.startsWith('assets/') && !['./', 'index.html', 'sw.js'].includes(u)) });
  ui.toast(`${bn(ok)}টি ফাইল অফলাইনে জমা হয়েছে`);
  ui.rerender();
}
async function removeOffline(chapterId) {
  const info = offlineOf(chapterId);
  if (info && 'caches' in window) {
    const cache = await caches.open(OFFLINE_CACHE);
    await Promise.all((info.files ?? []).map((u) => cache.delete(new URL(u, location.href).href)));
  }
  setOffline(chapterId, null);
  ui.toast('অফলাইন কপি মুছে ফেলা হয়েছে');
  ui.rerender();
}

// ---------- notes editor ----------
function openNoteEditor(id, btn) {
  const card = btn.closest('.item-card');
  const foot = btn.closest('.item-foot');
  if (!card || card.querySelector('.note-editor')) return;
  const box = document.createElement('div');
  box.className = 'note-editor';
  box.innerHTML = `<textarea rows="3" placeholder="নিজের নোট লেখো…">${esc(noteOf(id))}</textarea>
    <div class="row-btns"><button class="btn btn-primary tap" data-note-save="${esc(id)}">সেভ</button><button class="btn tap" data-note-cancel>বাতিল</button></div>`;
  foot.before(box);
  box.querySelector('textarea').focus();
}

// ---------- events ----------
function onClick(e) {
  const t = e.target;
  const d = (sel) => t.closest(sel);
  let el;
  if ((el = d('[data-ex-start]'))) return startFromSetup();
  if ((el = d('[data-ex-mode]'))) { exam.setup.mode = el.dataset.exMode; return ui.rerender(); }
  if ((el = d('[data-ex-count]'))) { exam.setup.count = Number(el.dataset.exCount); exam.setup.minutes = Number(el.dataset.exMin); return ui.rerender(); }
  if ((el = d('[data-ex-q]'))) {
    const i = Number(el.dataset.exQ), k = Number(el.dataset.k);
    exam.run.ans[i] = k;
    el.closest('.opts').querySelectorAll('.opt').forEach((o, j) => o.classList.toggle('picked', j === k));
    const c = document.getElementById('exCount');
    if (c) c.textContent = `${bn(Object.keys(exam.run.ans).length)}/${bn(exam.run.ids.length)} উত্তর`;
    return;
  }
  if (d('[data-ex-submit]')) return submitExam();
  if (d('[data-ex-retry]')) {
    const x = exam.result;
    const ids = x.items.filter((q) => q.chosen !== q.right).map((q) => q.id);
    return startExam(shuffle(ids), `${x.label} · ভুলগুলো আবার`, Math.max(1, ids.length));
  }
  if ((el = d('[data-ex-quick]'))) {
    const [chapterId, topicId] = el.dataset.exQuick.split('/');
    Object.assign(exam.setup, { chapterId, topicId: topicId ?? '', mode: 'all' });
    location.hash = '#/exam';
    return;
  }
  if ((el = d('[data-mission-add]'))) {
    addTask(todayKey(), el.dataset.missionAdd);
    return ui.toast('আজকের মিশনে যোগ হয়েছে');
  }
  if ((el = d('[data-rv]'))) {
    const out = srsReview(el.dataset.rv, el.dataset.ok === '1');
    el.closest('.rv-wrap')?.remove();
    const left = document.getElementById('rvLeft');
    if (left) left.textContent = bn(srsDue().length);
    ui.toast(out === 'mastered' ? 'পুরো মুখস্থ! রিভিশন থেকে বাদ' : out === 'later' ? 'ভালো! পরে আবার আসবে' : 'কাল আবার আসবে');
    if (!document.querySelector('.rv-wrap')) ui.rerender();
    return;
  }
  if ((el = d('[data-fc]'))) return flashcard(el.dataset.fc);
  if ((el = d('[data-saved-tab]'))) { savedState.tab = el.dataset.savedTab; return ui.rerender(); }
  if ((el = d('[data-bm]'))) {
    const on = toggleBookmark(el.dataset.bm);
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', on);
    return ui.toast(on ? '⭐ বুকমার্ক হয়েছে' : 'বুকমার্ক সরানো হয়েছে');
  }
  if ((el = d('[data-note-edit]'))) return openNoteEditor(el.dataset.noteEdit, el);
  if ((el = d('[data-note-save]'))) {
    const id = el.dataset.noteSave;
    setNote(id, el.closest('.note-editor').querySelector('textarea').value);
    ui.toast(noteOf(id) ? '📝 নোট সেভ হয়েছে' : 'নোট মুছে ফেলা হয়েছে');
    return ui.rerender();
  }
  if ((el = d('[data-note-cancel]'))) return el.closest('.note-editor').remove();
  if ((el = d('[data-gr-go]'))) return runGrade(el.dataset.grGo);
  if ((el = d('[data-goal-mcq]'))) { setGoal({ mcq: Number(el.dataset.goalMcq) }); return ui.rerender(); }
  if (d('[data-goal-ics]')) return downloadIcs();
  if ((el = d('[data-offline-save]'))) return saveOffline(el.dataset.offlineSave, el);
  if ((el = d('[data-offline-del]'))) return removeOffline(el.dataset.offlineDel);
  if ((el = d('[data-bf-clear]'))) { setBoardFilter(el.dataset.bfClear, null); return ui.rerender(); }
  if ((el = d('[data-bf-often]'))) { setBoardFilter(el.dataset.bfOften, { often: el.getAttribute('aria-pressed') !== 'true' }); return ui.rerender(); }
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.exSet) { exam.setup[t.dataset.exSet] = t.value; if (t.dataset.exSet === 'chapterId') exam.setup.topicId = ''; return ui.rerender(); }
  if (t.matches('[data-goal-time]')) { setGoal({ time: t.value, notified: '' }); return ui.toast('সময় সেভ হয়েছে'); }
  if (t.matches('[data-goal-remind]')) {
    setGoal({ remind: t.checked, notified: '' });
    if (t.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    return ui.toast(t.checked ? 'রিমাইন্ডার চালু' : 'রিমাইন্ডার বন্ধ');
  }
  if (t.dataset.bf) { setBoardFilter(t.dataset.bfSec, { [t.dataset.bf]: t.value || null }); return ui.rerender(); }
  if (t.dataset.grPhoto) {
    const g = grading.get(t.dataset.grPhoto);
    const files = [...(t.files ?? [])].slice(0, Math.max(0, 4 - g.images.length));
    t.value = '';
    Promise.all(files.map((f) => shrinkImage(f, 1800, 0.85))).then((imgs) => { g.images.push(...imgs); ui.rerender(); }).catch(() => ui.toast('ছবিটা খোলা গেল না'));
  }
}

function onInput(e) {
  const t = e.target;
  if (t.dataset.grAns) {
    const id = location.hash.split('/')[2];
    const g = grading.get(decodeURIComponent(id ?? ''));
    if (g) g.answers[t.dataset.grAns] = t.value;
  }
}

async function runGrade(itemId) {
  const g = grading.get(itemId);
  const { it, sec } = itemRef(itemId);
  if (!Object.values(g.answers).some((v) => v?.trim()) && !g.images.length) return ui.toast('আগে উত্তর লেখো বা খাতার ছবি দাও');
  g.busy = true;
  g.error = '';
  ui.rerender();
  try {
    g.result = await gradeCq({ chapterName: sec.chapter.name, stem: it.stem ?? '', parts: it.parts, answers: g.answers, images: g.images });
  } catch (err) {
    g.error = err instanceof AiError ? ERRORS[err.kind] ?? ERRORS.api : ERRORS.api;
  } finally {
    g.busy = false;
    if (location.hash === `#/grade/${encodeURIComponent(itemId)}` || location.hash === `#/grade/${itemId}`) ui.rerender();
  }
}

function flashcard(act) {
  if (act === 'flip') {
    deck.flipped = !deck.flipped;
    document.getElementById('fcCard')?.classList.toggle('flipped', deck.flipped);
    return;
  }
  if (act === 'restart') { deck.key = ''; return ui.rerender(); }
  const id = deck.ids[deck.i];
  if (!id) return;
  if (act === 'yes') { deck.known++; srsAdd(id); srsReview(id, true); }
  if (act === 'no') { deck.unknown++; srsAdd(id); srsReview(id, false); }
  deck.i++;
  deck.flipped = false;
  ui.rerender();
}

let touchX = null;
function onTouchStart(e) { touchX = e.target.closest?.('#fcCard') ? e.touches[0].clientX : null; }
function onTouchEnd(e) {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 70) flashcard(dx > 0 ? 'yes' : 'no');
}
function onKey(e) {
  if (!location.hash.startsWith('#/cards/') || e.target.closest?.('input, textarea, select')) return;
  const act = { ' ': 'flip', Enter: 'flip', ArrowRight: 'yes', ArrowLeft: 'no' }[e.key];
  if (act) { e.preventDefault(); flashcard(act); }
}

// Called by the app shell when an MCQ is answered on any page.
export function noteMcqAnswer(itemId, correct) {
  const ref = itemRef(itemId);
  if (ref && isMcq(ref.it)) recordAttempt(itemId, correct);
}

export function initPractice(m, hooks) {
  model = m;
  ui = hooks;
  indexItems(m);
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  setInterval(tick, 1000);
  setInterval(checkReminder, 60000);
  setTimeout(checkReminder, 4000);
}

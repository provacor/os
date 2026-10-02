// App shell: boot, routing, page transitions and interactions. Views live in ./views.

import { DATA_FILES, buildModel, attachContent } from './model.js?v=202610021409';
import { toggleItemDone, progressOf, resetProgress } from './progress.js?v=202610021409';
import { buildIndex } from './search.js?v=202610021409';
import { recordVisit, recordDone, addSearch, clearSearches, resetActivity } from './activity.js?v=202610021409';
import { applyTheme, setTheme, toggleTheme } from './theme.js?v=202610021409';
import { icon } from './icons.js?v=202610021409';
import { crumbs, emptyState } from './components.js?v=202610021409';
import { homeView } from './views/home.js?v=202610021409';
import { subjectView, chapterView, studyMap } from './views/study.js?v=202610021409';
import { sectionView } from './views/section.js?v=202610021409';
import { searchView, resultsHtml, searchState } from './views/search.js?v=202610021409';
import { progressView } from './views/progress.js?v=202610021409';
import { moreView } from './views/more.js?v=202610021409';
import { missionView, missionState } from './views/mission.js?v=202610021409';
import { addTask, toggleTask, deleteTask, moveTask, setNote } from './mission.js?v=202610021409';
import { startAlarms, addAlarm, removeAlarm, stopAlarm, restartAlarm, setKeepAwake, MAX_MINUTES } from './alarms.js?v=202610021409';
import { profileView } from './views/profile.js?v=202610021409';
import { startLeaderboard } from './leaderboard.js?v=202610021409';
import { addVideo, deleteVideo } from './videos.js?v=202610021409';
import { aiView, aiState, messageHtml, pendingHtml } from './views/ai.js?v=202610021409';
import { ask, saveSettings, clearChat, shrinkImage, AiError, ERRORS } from './ai.js?v=202610021409';
import { renderMarkdown, typesetMath } from './markdown.js?v=202610021409';
import { getProfile, updateProfile, imageToAvatar, startUsage } from './profile.js?v=202610021409';

const $view = document.getElementById('view');
const $crumbs = document.getElementById('crumbs');
const NAV = ['home', 'search', 'study', 'mission', 'progress', 'more'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let model;
let index;
let lastRoute = null;

// ---------- boot ----------

async function boot() {
  applyTheme();
  const started = performance.now();
  try {
    const entries = await Promise.all(
      Object.entries(DATA_FILES).map(async ([k, url]) => {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return [k, await res.json()];
      }),
    );
    model = buildModel(Object.fromEntries(entries));
    const files = await Promise.all(
      Object.values(model.contentIndex).map(async ({ file }) => {
        const res = await fetch(file, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
        return res.json();
      }),
    );
    files.forEach((f) => attachContent(model, f));
    index = buildIndex(model);
  } catch (err) {
    hideSplash();
    $view.innerHTML = emptyState({
      iconName: 'warn', hue: 'red', title: 'Could not load study data', text: err.message,
      extra: '<p class="readonly">Open the app through a web server (for example <code>node tools/serve.mjs</code>), not as a file:// page.</p>',
    });
    return;
  }
  window.addEventListener('hashchange', () => render());
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey);
  document.addEventListener('submit', onSubmit);
  document.getElementById('themeBtn').addEventListener('click', () => toggleTheme());
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-alarm-awake]')) setKeepAwake(e.target.checked);
    if (e.target.matches('[data-ai-pick]')) {
      const files = [...(e.target.files ?? [])].slice(0, Math.max(0, 4 - aiState.images.length));
      e.target.value = '';
      Promise.all(files.map((f) => shrinkImage(f)))
        .then((imgs) => {
          aiState.images.push(...imgs);
          document.getElementById('aiPends').innerHTML = pendingHtml();
          document.getElementById('aiInput')?.focus();
        })
        .catch(() => toast('<span>ছবিটা খোলা গেল না</span>'));
      if (!files.length) toast('<span>একবারে সর্বোচ্চ ৪টা ছবি</span>');
    }
    if (e.target.matches('[data-profile-photo]')) {
      imageToAvatar(e.target.files?.[0])
        .then((photo) => {
          if (!updateProfile({ photo })) throw new Error('storage');
          toast(`${icon('check')}<span>ছবি সেভ হয়েছে</span>`);
          rerender();
        })
        .catch(() => toast('<span>ছবিটা সেভ করা গেল না, অন্য ছবি চেষ্টা করো</span>'));
    }
  });
  render();
  // An alarm that just went off: refresh the Study tab unless the user is typing a new one.
  startUsage();
  startLeaderboard();
  startAlarms(() => {
    if (route().kind === 'study' && !document.activeElement?.closest('[data-alarm-form]')) rerender();
  });
  // Keep the entrance short: the splash leaves ~0.65s after start, or at once if loading took longer.
  setTimeout(hideSplash, Math.max(0, 650 - (performance.now() - started)));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function hideSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  s.classList.add('out');
  setTimeout(() => s.remove(), 400);
}

// ---------- routing ----------

function route() {
  const [, kind = '', a, b] = location.hash.replace(/^#/, '').split('/');
  return { kind, a: a && decodeURIComponent(a), b: b && decodeURIComponent(b) };
}

function resolve(r) {
  const get = (id) => model.byId.get(id);
  switch (r.kind) {
    case 's': return subjectView(model, get(r.a));
    case 'p': {
      if (r.b) { location.replace(`#/c/${r.b}`); return 'redirect'; } // old #/p/paper/chapter links
      const p = get(r.a);
      return p?.level === 'paper' ? subjectView(model, p.subject, p.id) : null;
    }
    case 'c': return chapterView(model, get(r.a));
    case 'x': return sectionView(model, get(r.a));
    case 'search': return searchView();
    case 'study':
    case 'syllabus': return studyMap(model);
    case 'progress': return progressView(model);
    case 'more': return moreView(model);
    case 'profile': return profileView();
    case 'ai': return aiView(model, r.a);
    case 'mission': return missionView();
    case '': return homeView(model);
    default: return null;
  }
}

const notFound = () => ({
  nav: 'home', title: 'Not found', back: '#/',
  html: emptyState({ iconName: 'map', title: 'Not found', text: 'This page does not exist in the study structure.', extra: '<a class="btn btn-primary" href="#/">Go home</a>' }),
});

function render({ keepScroll = false } = {}) {
  const out = resolve(route()) ?? notFound();
  if (out === 'redirect') return;

  const newRoute = location.hash !== lastRoute;
  lastRoute = location.hash;
  if (out.visit && newRoute) recordVisit(out.visit.chapterId, out.visit.sectionId);

  // top bar: brand on top-level screens, back + title on deeper ones
  document.getElementById('tbLeft').innerHTML = out.back
    ? `<a class="icon-btn back" href="${out.back}" aria-label="Back">${icon('back')}</a>`
    : `<a class="brand" href="#/"><img class="avatar sm" src="assets/img/avatar.jpg" alt="" width="34" height="34"><span>Provacor</span></a>`;
  document.getElementById('tbTitle').textContent = out.back ? out.title ?? '' : '';
  $crumbs.innerHTML = crumbs(out.crumbs ?? []);
  $crumbs.hidden = !out.crumbs?.length;

  $view.innerHTML = out.html;
  if (newRoute && !reduced.matches) {
    $view.classList.remove('page-enter');
    void $view.offsetWidth; // restart the enter animation
    $view.classList.add('page-enter');
  }

  const nav = out.nav ?? 'home';
  const nb = document.getElementById('bottomNav');
  nb.style.setProperty('--idx', NAV.indexOf(nav));
  nb.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.nav === nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const fab = document.getElementById('aiFab');
  if (fab) {
    fab.hidden = route().kind === 'ai';
    fab.href = out.visit?.chapterId ? `#/ai/${encodeURIComponent(out.visit.chapterId)}` : '#/ai';
  }

  if (newRoute && !keepScroll) window.scrollTo(0, 0);
  if (out.isSearch) mountSearch();
  out.after?.();
}

// ---------- search ----------

let searchTimer;
function mountSearch() {
  paintResults();
  if (!searchState.q) document.getElementById('q')?.focus({ preventScroll: true });
}

function paintResults() {
  const box = document.getElementById('results');
  if (box) box.innerHTML = resultsHtml(index);
  const clear = document.querySelector('.clear-q');
  if (clear) clear.hidden = !searchState.q;
}

function setQuery(v, { save = false } = {}) {
  searchState.q = v;
  searchState.filter = 'all';
  const q = document.getElementById('q');
  if (q && q.value !== v) q.value = v;
  if (save) addSearch(v);
  paintResults();
}

let noteTimer;
function onInput(e) {
  if (e.target.id === 'aiInput') {
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    return;
  }
  const note = e.target.dataset?.missionNote;
  if (note) {
    clearTimeout(noteTimer);
    const v = e.target.value;
    noteTimer = setTimeout(() => setNote(note, v), 300);
    return;
  }
  if (e.target.id !== 'q') return;
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => setQuery(v), 90);
}

function onKey(e) {
  if (e.target.id === 'q' && e.key === 'Enter') {
    clearTimeout(searchTimer);
    setQuery(e.target.value, { save: true });
    e.target.blur();
  }
}

// ---------- mission planner ----------

function onSubmit(e) {
  if (e.target.matches('[data-ai-settings]')) {
    e.preventDefault();
    const f = e.target;
    saveSettings({ claudeKey: f.claudeKey.value, claudeModel: f.claudeModel.value });
    toast(`${icon('check')}<span>AI সেটিংস সেভ হয়েছে</span>`);
    rerender();
    return;
  }
  if (e.target.matches('[data-ai-form]')) {
    e.preventDefault();
    sendAi();
    return;
  }
  if (e.target.matches('[data-video-form]')) {
    e.preventDefault();
    const f = e.target;
    const res = addVideo(f.dataset.chapter, { url: f.url.value, topic: f.topic.value, title: f.title.value });
    const msg = {
      ok: `${icon('check')}<span>লিংক সেভ হয়েছে</span>`,
      'bad-url': '<span>লিংকটা ঠিক নেই, আবার দেখো</span>',
      duplicate: '<span>এই লিংক এই টপিকে আগেই আছে</span>',
      storage: '<span>ফোনে জায়গা নেই, সেভ করা গেল না</span>',
    }[res];
    toast(msg);
    if (res === 'ok') rerender();
    return;
  }
  if (e.target.matches('[data-profile-form]')) {
    e.preventDefault();
    updateProfile({ name: document.getElementById('pfName').value });
    toast(`${icon('check')}<span>নাম সেভ হয়েছে</span>`);
    rerender();
    return;
  }
  if (e.target.matches('[data-alarm-form]')) {
    e.preventDefault();
    const m = Number(document.getElementById('alarmH').value) * 60 + Number(document.getElementById('alarmM').value);
    if (m < 1) return toast('<span>সময় বেছে নাও (কমপক্ষে ৫ মিনিট)</span>');
    if (m > MAX_MINUTES) return toast('<span>সর্বোচ্চ ৩ ঘণ্টা পর্যন্ত দেওয়া যায়</span>');
    if (addAlarm(m, document.getElementById('alarmNote').value)) {
      toast(`${icon('check')}<span>অ্যালার্ম চালু হয়েছে</span>`);
      rerender();
    }
    return;
  }
  if (!e.target.matches('[data-task-form]')) return;
  e.preventDefault();
  const input = document.getElementById('taskInput');
  if (!addTask(missionState.day, input.value)) return input.focus();
  rerender();
  document.getElementById('taskInput')?.focus({ preventScroll: true });
}

function rerender() {
  const y = window.scrollY;
  render({ keepScroll: true });
  window.scrollTo(0, y);
}

function onVideoClick(t) {
  const play = t.closest('[data-video-play]');
  if (play) {
    const start = Number(play.dataset.start) || 0;
    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(play.dataset.videoPlay)}?autoplay=1&rel=0&playsinline=1${start ? `&start=${start}` : ''}`;
    play.outerHTML = `<div class="vd-frame"><iframe src="${src}" title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    return true;
  }
  const del = t.closest('[data-video-del]');
  if (del) {
    if (confirm('এই লিংকটা মুছে ফেলবে?')) {
      deleteVideo(del.dataset.chapter, del.dataset.videoDel);
      rerender();
    }
    return true;
  }
  const add = t.closest('[data-video-topic]');
  if (add) {
    const f = document.querySelector('[data-video-form]');
    f.topic.value = add.dataset.videoTopic;
    f.url.focus();
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }
  return false;
}

async function sendAi() {
  if (aiState.busy) return;
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  const images = aiState.images.slice();
  if (!text && !images.length) return toast(`<span>${ERRORS.empty}</span>`);
  const chat = document.getElementById('aiChat');
  chat.querySelector('.ai-empty')?.remove();
  chat.insertAdjacentHTML('beforeend', messageHtml({ role: 'user', text, thumbs: images }));
  chat.insertAdjacentHTML('beforeend', `<div class="ai-msg ai-bot"><span class="ai-av">${icon('sparkle')}</span><div class="ai-bubble md ai-typing"><span></span><span></span><span></span></div></div>`);
  const bubble = chat.lastElementChild.querySelector('.ai-bubble');
  bubble.scrollIntoView({ block: 'end', behavior: 'smooth' });
  input.value = '';
  input.style.height = '';
  aiState.images = [];
  document.getElementById('aiPends').innerHTML = '';
  aiState.busy = true;
  document.querySelector('.ai-send')?.setAttribute('disabled', '');
  let frame = 0;
  try {
    const answer = await ask({ text, images, context: aiState.context }, (soFar) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        bubble.classList.remove('ai-typing');
        bubble.innerHTML = renderMarkdown(soFar);
      });
    });
    cancelAnimationFrame(frame);
    bubble.classList.remove('ai-typing');
    bubble.innerHTML = renderMarkdown(answer);
    typesetMath(bubble);
  } catch (err) {
    cancelAnimationFrame(frame);
    const kind = err instanceof AiError ? err.kind : 'api';
    bubble.classList.remove('ai-typing');
    bubble.classList.add('ai-error');
    bubble.innerHTML = `<p>${ERRORS[kind] ?? ERRORS.api}</p>${kind === 'api' && err.message ? `<p class="small muted">${err.message.replace(/[<>&]/g, '')}</p>` : ''}`;
    if (kind === 'no-key' || kind === 'bad-key' || kind === 'bad-model' || kind === 'credit') document.querySelector('.ai-settings')?.setAttribute('open', '');
  } finally {
    aiState.busy = false;
    document.querySelector('.ai-send')?.removeAttribute('disabled');
  }
}

function onAiClick(t) {
  const un = t.closest('[data-ai-unpick]');
  if (un) {
    aiState.images.splice(Number(un.dataset.aiUnpick), 1);
    document.getElementById('aiPends').innerHTML = pendingHtml();
    return true;
  }
  const sug = t.closest('[data-ai-suggest]');
  if (sug) {
    document.getElementById('aiInput').value = sug.dataset.aiSuggest;
    sendAi();
    return true;
  }
  if (t.closest('[data-ai-clear]')) {
    if (confirm('আগের সব প্রশ্ন-উত্তর মুছে নতুন চ্যাট শুরু করবে?')) {
      clearChat();
      rerender();
    }
    return true;
  }
  return false;
}

function onProfileClick(t) {
  const mode = t.closest('[data-profile-mode]')?.dataset.profileMode;
  if (mode) {
    updateProfile(mode === 'off' ? { leaderboard: false } : { leaderboard: true, anonymous: mode === 'anon' });
    rerender();
    return true;
  }
  if (t.closest('[data-profile-photo-remove]')) {
    updateProfile({ photo: '' });
    rerender();
    return true;
  }
  return false;
}

function onAlarmClick(t) {
  const quick = t.closest('[data-alarm-quick]');
  if (quick) {
    const m = Number(quick.dataset.alarmQuick);
    document.getElementById('alarmH').value = String(Math.floor(m / 60));
    document.getElementById('alarmM').value = String(m % 60);
    document.querySelectorAll('[data-alarm-quick]').forEach((c) => c.classList.toggle('on', c === quick));
    return true;
  }
  const el = t.closest('[data-alarm-del],[data-alarm-stop],[data-alarm-restart]');
  if (!el) return false;
  const { alarmDel, alarmStop, alarmRestart } = el.dataset;
  if (alarmDel) removeAlarm(alarmDel);
  else if (alarmStop) stopAlarm(alarmStop);
  else restartAlarm(alarmRestart);
  if (route().kind === 'study') rerender();
  return true;
}

function onMissionClick(t) {
  const weekBtn = t.closest('[data-mission-week]');
  if (weekBtn) {
    missionState.week += Number(weekBtn.dataset.missionWeek);
    missionState.day = null;
    rerender();
    return true;
  }
  const dayBtn = t.closest('[data-mission-day]');
  if (dayBtn) {
    missionState.day = dayBtn.dataset.missionDay;
    rerender();
    return true;
  }
  const btn = t.closest('[data-action^="task-"]');
  if (!btn) return false;
  const id = btn.dataset.task;
  const from = btn.dataset.from ?? missionState.day;
  const act = btn.dataset.action;
  if (act === 'task-toggle') toggleTask(from, id);
  else if (act === 'task-del') deleteTask(from, id);
  else if (act === 'task-move') {
    moveTask(from, id, missionState.day);
    toast(`${icon('check')}<span>আজকের মিশনে আনা হয়েছে</span>`);
  }
  rerender();
  return true;
}

// ---------- interactions ----------

function onClick(e) {
  const t = e.target;
  if (onMissionClick(t) || onAlarmClick(t) || onProfileClick(t) || onVideoClick(t) || onAiClick(t)) return;

  const foldHead = t.closest('[data-fold]');
  if (foldHead) {
    const f = foldHead.parentElement;
    const open = !f.classList.contains('open');
    f.classList.toggle('open', open);
    foldHead.setAttribute('aria-expanded', open);
    return;
  }

  const done = t.closest('[data-action="toggle-done"]');
  if (done) {
    const id = done.dataset.item;
    const nowDone = toggleItemDone(id);
    recordDone(nowDone);
    const sec = model.byId.get(id.replace(/_\d{4}$/, ''));
    toast(nowDone ? `${icon('check')}<span>Marked as done · section ${sec ? progressOf(sec) : 0}%</span>` : '<span>Marked as not done</span>');
    const y = window.scrollY;
    render({ keepScroll: true });
    window.scrollTo(0, y);
    if (nowDone) document.querySelector(`.btn-done[data-item="${CSS.escape(id)}"]`)?.classList.add('pop');
    return;
  }

  const opt = t.closest('[data-action="mcq"]');
  if (opt) {
    const card = opt.closest('.mcq');
    if (card.classList.contains('answered')) return;
    const ans = String(card.dataset.answer).trim();
    const k = Number(opt.dataset.k);
    const isRight = (o, i) => ans === String(i) || ans === o.querySelector('span:last-child').textContent.trim();
    const correct = isRight(opt, k);
    card.classList.add('answered', correct ? 'right' : 'wrong');
    opt.classList.add(correct ? 'right' : 'wrong');
    card.querySelectorAll('.opt').forEach((o, i) => isRight(o, i) && o.classList.add('right'));
    card.querySelector('.mcq-exp')?.removeAttribute('hidden');
    return;
  }

  const filter = t.closest('[data-filter]');
  if (filter) {
    searchState.filter = filter.dataset.filter;
    paintResults();
    return;
  }
  const chipQ = t.closest('[data-q]');
  if (chipQ) {
    setQuery(chipQ.dataset.q, { save: true });
    return;
  }
  if (t.closest('[data-result]')) {
    addSearch(searchState.q);
    return;
  }

  const act = t.closest('[data-action]')?.dataset.action;
  if (act === 'clear-q') {
    setQuery('');
    document.getElementById('q')?.focus();
    return;
  }
  if (act === 'clear-searches') {
    clearSearches();
    paintResults();
    return;
  }
  if (act === 'reset') {
    if (confirm('Reset all progress, study history and recent searches on this device?')) {
      resetProgress();
      resetActivity();
      clearSearches();
      toast('<span>Progress reset</span>');
      render({ keepScroll: true });
    }
    return;
  }
  const themeSet = t.closest('[data-theme-set]');
  if (themeSet) {
    setTheme(themeSet.dataset.themeSet);
    render({ keepScroll: true });
  }
}

let toastTimer;
function toast(html) {
  const el = document.getElementById('toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

boot();

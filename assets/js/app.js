// App shell: boot, routing, page transitions and interactions. Views live in ./views.

import { DATA_FILES, buildModel, attachContent } from './model.js';
import { toggleItemDone, progressOf, resetProgress } from './progress.js';
import { buildIndex } from './search.js';
import { recordVisit, recordDone, addSearch, clearSearches, resetActivity } from './activity.js';
import { applyTheme, setTheme, toggleTheme } from './theme.js';
import { icon } from './icons.js';
import { crumbs, emptyState } from './components.js';
import { homeView } from './views/home.js';
import { subjectView, chapterView, studyMap } from './views/study.js';
import { sectionView } from './views/section.js';
import { searchView, resultsHtml, searchState } from './views/search.js';
import { progressView } from './views/progress.js';
import { moreView } from './views/more.js';

const $view = document.getElementById('view');
const $crumbs = document.getElementById('crumbs');
const NAV = ['home', 'search', 'study', 'progress', 'more'];
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
  document.getElementById('themeBtn').addEventListener('click', () => toggleTheme());
  render();
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
    : `<a class="brand" href="#/"><span class="brand-mark sm">${icon('study')}</span><span>Provacor</span></a>`;
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

function onInput(e) {
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

// ---------- interactions ----------

function onClick(e) {
  const t = e.target;

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

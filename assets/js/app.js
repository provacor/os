import { DATA_FILES, buildModel, attachContent, contentCount, chapterCount, chapterTitle } from './model.js';
import { progressOf, isItemDone, toggleItemDone } from './progress.js';
import { buildIndex, search } from './search.js';

const $view = document.getElementById('view');
const $crumbs = document.getElementById('crumbs');
let model;
let index;
let lastQuery = '';

const plural = (n, word) => `${n} ${word.toLowerCase()}${n === 1 ? '' : 's'}`;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- boot ----------

async function boot() {
  initTheme();
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
    $view.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h2>Could not load study data</h2>
      <p class="muted">${esc(err.message)}</p>
      <p class="muted small">Open the app through a web server (e.g. <code>node tools/serve.mjs</code>), not as a file:// page.</p></div>`;
    return;
  }
  window.addEventListener('hashchange', render);
  document.addEventListener('click', onClick);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ---------- theme ----------

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('hscos:theme'); } catch { /* ignore */ }
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('hscos:theme', next); } catch { /* ignore */ }
  });
}

// ---------- routing ----------

function route() {
  const [, kind = '', a, b] = location.hash.replace(/^#/, '').split('/');
  return { kind, a: a && decodeURIComponent(a), b: b && decodeURIComponent(b) };
}

function render() {
  const r = route();
  let out;
  switch (r.kind) {
    case 's': out = subjectView(model.byId.get(r.a)); break;
    case 'p': out = paperView(model.byId.get(r.a), r.b); break;
    case 'x': out = sectionView(model.byId.get(r.a)); break;
    case 'search': out = searchView(); break;
    case 'progress': out = progressView(); break;
    case 'syllabus': out = syllabusView(); break;
    default: out = homeView();
  }
  $crumbs.innerHTML = crumbs(out.crumbs ?? []);
  $view.innerHTML = out.html;
  document.querySelectorAll('.bottom-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === (out.nav ?? 'home'));
  });
  out.after?.();
  if (!out.keepScroll) window.scrollTo(0, 0);
}

function crumbs(list) {
  if (!list.length) return '';
  return `<ol>${[['Home', '#/'], ...list]
    .map(([t, href], i, arr) => (i === arr.length - 1 ? `<li aria-current="page">${esc(t)}</li>` : `<li><a href="${href}">${esc(t)}</a></li>`))
    .join('')}</ol>`;
}

const notFound = () => ({
  html: `<div class="empty"><div class="empty-icon">🧭</div><h2>Not found</h2><p class="muted">This item does not exist in the structure.</p><a class="btn" href="#/">Go home</a></div>`,
});

// ---------- small components ----------

function bar(pct) {
  return `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
}

function ring(pct) {
  return `<span class="ring" style="--p:${pct}" aria-label="${pct}% complete"><span>${pct}%</span></span>`;
}

function verifyBadge(ch) {
  return ch.verification === 'verified' ? '' : `<span class="badge warn" title="Not yet confirmed against the syllabus image">VERIFY FROM SOURCE</span>`;
}

function chapterNo(ch, i) {
  return ch.number != null ? String(ch.number).padStart(2, '0') : String(i + 1).padStart(2, '0');
}

// ---------- views ----------

function homeView() {
  const cards = model.subjects
    .map((s) => {
      const chs = chapterCount(s);
      const pct = progressOf(s);
      return `<a class="card subject-card accent-${esc(s.accent)}" href="#/s/${esc(s.id)}">
        <div class="subject-head"><span class="subject-icon" aria-hidden="true">${s.icon}</span>
          <div><h2>${esc(s.name)}</h2><p class="muted small">${s.papers.map((p) => esc(p.name)).join(' · ')}</p></div>
          ${ring(pct)}</div>
        <dl class="stats">
          <div><dt>Papers</dt><dd>${s.papers.length}</dd></div>
          <div><dt>${s.id === 'english' ? 'Topics' : 'Chapters'}</dt><dd>${chs || '—'}</dd></div>
          <div><dt>Content</dt><dd>${contentCount(s)}</dd></div>
          <div><dt>Done</dt><dd>${pct}%</dd></div>
        </dl>
        ${chs === 0 ? '<p class="note small">Chapter list pending syllabus source</p>' : ''}
      </a>`;
    })
    .join('');
  const pending = model.papers.filter((p) => p.sourceStatus !== 'verified').length;
  return {
    nav: 'home',
    html: `<section class="hero">
        <h1>HSC SCIENCE STUDY OS</h1>
        <p class="muted">Subject → Paper → Chapter → Section</p>
        <a class="search-entry" href="#/search"><span aria-hidden="true">🔍</span> Search subject, chapter, section…</a>
      </section>
      ${pending ? `<a class="banner" href="#/syllabus"><strong>${pending} of ${model.papers.length} papers</strong> have chapters that need checking against the syllabus images. Tap to see which.</a>` : ''}
      <div class="grid subjects">${cards}</div>`,
  };
}

function subjectView(subj) {
  if (!subj || subj.level !== 'subject') return notFound();
  const cards = subj.papers
    .map((p) => {
      const pct = progressOf(p);
      const n = chapterCount(p);
      return `<a class="card paper-card accent-${esc(subj.accent)}" href="#/p/${esc(p.id)}">
          <div class="paper-head"><div><h2>${esc(p.name)}${p.subtitle ? ` <span class="muted small">(${esc(p.subtitle)})</span>` : ''}</h2>
            <p class="muted small">${n ? plural(n, esc(p.unitLabel)) : `${esc(p.unitLabel)} list pending syllabus source`} · ${contentCount(p)} content</p></div>
            ${ring(pct)}</div>
        </a>`;
    })
    .join('');
  return {
    nav: 'home',
    crumbs: [[subj.name, `#/s/${subj.id}`]],
    html: `<header class="page-head"><span class="subject-icon" aria-hidden="true">${subj.icon}</span>
        <div><h1>${esc(subj.name)}</h1><p class="muted small">${plural(subj.papers.length, 'Paper')} · ${progressOf(subj)}% done</p></div></header>
      <div class="stack">${cards}</div>`,
  };
}

function paperView(paper, openChapterId) {
  if (!paper || paper.level !== 'paper') return notFound();
  const subj = paper.subject;
  const tabs = subj.papers
    .map((p) => `<a role="tab" aria-selected="${p === paper}" class="tab ${p === paper ? 'active' : ''}" href="#/p/${esc(p.id)}">${esc(p.name)}</a>`)
    .join('');

  let body;
  if (!paper.chapters.length) {
    body = `<div class="empty"><div class="empty-icon">📄</div>
      <h2>Chapter list not added yet</h2>
      <p class="muted">Chapters for <strong>${esc(subj.name)} ${esc(paper.name)}</strong> will be added exactly as written in the syllabus image.</p>
      <p class="muted small">Status: <span class="badge warn">NEEDS VERIFICATION</span> — no syllabus image received yet.</p>
      <a class="btn ghost" href="#/syllabus">View syllabus audit</a></div>`;
  } else {
    const groups = paper.groups.length ? paper.groups : [{ id: null, name: null }];
    body = groups
      .map((g) => {
        const list = paper.chapters.filter((c) => (g.id ? c.groupId === g.id : true));
        return `${g.name ? `<h2 class="group-title">${esc(g.name)} <span class="muted small">${plural(list.length, esc(paper.unitLabel))}</span></h2>` : ''}
          <div class="accordion">${list.map((c, i) => chapterItem(c, i, c.id === openChapterId)).join('')}</div>`;
      })
      .join('');
  }

  return {
    nav: 'home',
    crumbs: [[subj.name, `#/s/${subj.id}`], [paper.name, `#/p/${paper.id}`]],
    html: `<header class="page-head"><span class="subject-icon" aria-hidden="true">${subj.icon}</span>
        <div><h1>${esc(subj.name)} — ${esc(paper.name)}${paper.subtitle ? ` <span class="muted small">(${esc(paper.subtitle)})</span>` : ''}</h1><p class="muted small">${plural(chapterCount(paper), esc(paper.unitLabel))} · ${contentCount(paper)} content · ${progressOf(paper)}% done</p></div></header>
      <nav class="tabs" role="tablist">${tabs}</nav>
      ${body}`,
    after: () => {
      if (openChapterId) document.getElementById(`ch-${openChapterId}`)?.scrollIntoView({ block: 'start' });
    },
  };
}

function chapterItem(ch, i, open) {
  const pct = progressOf(ch);
  const note = ch.note ? `<p class="note small">⚠️ ${esc(ch.note)}</p>` : '';
  const topics = ch.topics?.length
    ? `<details class="topics"><summary>Topics (${ch.topics.length})</summary><ul>${ch.topics.map((t) => `<li>${esc(typeof t === 'string' ? t : t.name)}</li>`).join('')}</ul></details>`
    : '';
  const sections = ch.sections
    .map(
      (s) => `<a class="section-tile" href="#/x/${esc(s.id)}">
        <span class="tile-icon" aria-hidden="true">${s.icon}</span>
        <span class="tile-label">${esc(s.label)}</span>
        <span class="tile-meta">${s.computed ? `${pct}%` : s.contentCount ? plural(s.contentCount, 'item') : 'Empty'}</span></a>`,
    )
    .join('');
  return `<article class="acc-item ${open ? 'open' : ''}" id="ch-${esc(ch.id)}">
      <button class="acc-head" aria-expanded="${open}" data-chapter="${esc(ch.id)}">
        <span class="ch-no">${chapterNo(ch, i)}</span>
        <span class="ch-title">${esc(ch.name)} ${verifyBadge(ch)}</span>
        <span class="ch-pct">${pct}%</span>
        <span class="chev" aria-hidden="true">▸</span>
      </button>
      <div class="acc-body"><div class="acc-inner">
        ${bar(pct)}
        ${note}
        ${topics}
        <div class="section-grid">${sections}</div>
      </div></div>
    </article>`;
}

function sectionView(sec) {
  if (!sec || sec.level !== 'section') return notFound();
  const ch = sec.chapter;
  const siblings = ch.sections
    .map((s) => `<a class="chip ${s === sec ? 'on' : ''}" href="#/x/${esc(s.id)}">${s.icon} ${esc(s.label)}</a>`)
    .join('');

  let body;
  if (sec.computed) {
    body = `<div class="card">${ch.sections
      .filter((s) => s.trackable)
      .map((s) => `<div class="prog-row"><a href="#/x/${esc(s.id)}">${s.icon} ${esc(s.label)}</a><span>${progressOf(s)}%</span></div>${bar(progressOf(s))}`)
      .join('')}
      <div class="prog-row total"><strong>Overall</strong><strong>${progressOf(ch)}%</strong></div>${bar(progressOf(ch))}</div>`;
  } else if (sec.items.length) {
    const count = (kind) => sec.items.filter((it) => it.kind === kind).length;
    const kinds = sec.contentKinds.length
      ? `<h2 class="sub-title">Categories</h2><ul class="chips">${sec.contentKinds
          .map((k) => `<li class="chip ${count(k.id) ? 'on' : ''}">${esc(k.label)} · ${count(k.id)}</li>`)
          .join('')}</ul>`
      : '';
    body = `<div class="card"><div class="prog-row"><strong>Section progress</strong><strong id="sec-pct">${progressOf(sec)}%</strong></div>${bar(progressOf(sec))}</div>
      ${kinds}
      <h2 class="sub-title">${plural(sec.items.length, 'item')}</h2>
      <div class="stack">${sec.items.map((it) => itemCard(it, sec)).join('')}</div>
      <p class="muted small id-line">Section ID: <code>${esc(sec.id)}</code></p>`;
  } else {
    const kinds = sec.contentKinds.length
      ? `<h2 class="sub-title">Categories</h2><div class="kind-list">${sec.contentKinds
          .map((k) => `<div class="kind"><span>${esc(k.label)}</span><span class="muted small">0</span></div>`)
          .join('')}</div>`
      : '';
    const fields = sec.itemFields.length
      ? `<details class="fields"><summary>Planned item fields</summary><ul class="chips">${sec.itemFields.map((f) => `<li class="chip">${esc(f)}</li>`).join('')}</ul></details>`
      : '';
    body = `<div class="empty card">
        <div class="empty-icon" aria-hidden="true">${sec.icon}</div>
        <h2>Content not added yet</h2>
        <p class="muted">${esc(sec.emptyText)}</p>
        <button class="btn" data-action="add-content" data-section="${esc(sec.id)}">+ Add Content</button>
      </div>
      ${kinds}${fields}
      <p class="muted small id-line">Section ID: <code>${esc(sec.id)}</code></p>`;
  }

  return {
    nav: 'home',
    crumbs: [
      [sec.subject.name, `#/s/${sec.subject.id}`],
      [sec.paper.name, `#/p/${sec.paper.id}`],
      [ch.number != null ? `Ch ${ch.number}` : ch.name, `#/p/${sec.paper.id}/${ch.id}`],
      [sec.label, `#/x/${sec.id}`],
    ],
    html: `<header class="page-head"><span class="subject-icon" aria-hidden="true">${sec.icon}</span>
        <div><h1>${esc(sec.screenTitle)}</h1><p class="muted small">${esc(chapterTitle(ch))} ${verifyBadge(ch)}</p></div></header>
      <nav class="chip-row" aria-label="Sections of this chapter">${siblings}</nav>
      ${body}`,
    after: () => document.querySelector('.chip-row .chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }),
  };
}

function itemCard(it, sec) {
  const kind = sec.contentKinds.find((k) => k.id === it.kind)?.label;
  const doneNow = isItemDone(it.id);
  const meta = [kind, it.format?.toUpperCase(), it.pages ? `${it.pages} pages` : null].filter(Boolean).join(' · ');
  return `<article class="card item-card">
      <h3>${it.format === 'pdf' ? '📄 ' : ''}${esc(it.title ?? it.id)}</h3>
      <p class="muted small">${esc(meta)}</p>
      ${it.source ? `<p class="muted small">${esc(it.source)}</p>` : ''}
      <div class="item-actions">
        ${it.file ? `<a class="btn" href="${esc(encodeURI(it.file))}" target="_blank" rel="noopener">Open ${it.format === 'pdf' ? 'PDF' : 'file'}</a>` : ''}
        <button class="btn ghost" data-action="toggle-done" data-item="${esc(it.id)}" aria-pressed="${doneNow}">${doneNow ? '✓ Done' : 'Mark as done'}</button>
      </div>
    </article>`;
}

function searchView() {
  return {
    nav: 'search',
    crumbs: [['Search', '#/search']],
    html: `<h1 class="page-title">Search</h1>
      <input id="q" class="search-input" type="search" placeholder="e.g. physics 1st notes, preposition, reaction" autocomplete="off" value="${esc(lastQuery)}" aria-label="Search the study structure">
      <p class="muted small">Searches subjects, papers, chapters, topics, sections and added content.</p>
      <div id="results"></div>`,
    after: () => {
      const q = document.getElementById('q');
      const run = () => {
        lastQuery = q.value;
        document.getElementById('results').innerHTML = resultsHtml(search(index, q.value));
      };
      q.addEventListener('input', run);
      q.focus();
      run();
    },
  };
}

function resultsHtml(results) {
  if (!lastQuery.trim()) return '';
  if (!results.length) return `<div class="empty"><p class="muted">No match for “${esc(lastQuery)}”.</p></div>`;
  return `<ul class="results">${results
    .map((r) => {
      const n = r.node;
      const href = n.level === 'subject' ? `#/s/${n.id}` : n.level === 'paper' ? `#/p/${n.id}` : n.level === 'chapter' ? `#/p/${n.paper.id}/${n.id}` : `#/x/${n.id}`;
      return `<li><a href="${href}"><span class="badge">${r.level}</span> <strong>${esc(r.title)}</strong><span class="muted small path">${esc(r.path.join(' › '))}</span></a></li>`;
    })
    .join('')}</ul>`;
}

function progressView() {
  const html = model.subjects
    .map(
      (s) => `<section class="card">
        <div class="prog-row"><a href="#/s/${esc(s.id)}"><strong>${s.icon} ${esc(s.name)}</strong></a><strong>${progressOf(s)}%</strong></div>${bar(progressOf(s))}
        ${s.papers
          .map((p) => `<div class="prog-row indent"><a href="#/p/${esc(p.id)}">${esc(p.name)}</a><span class="muted small">${plural(chapterCount(p), esc(p.unitLabel))} · ${progressOf(p)}%</span></div>${bar(progressOf(p))}`)
          .join('')}
      </section>`,
    )
    .join('');
  return { nav: 'progress', crumbs: [['Progress', '#/progress']], html: `<h1 class="page-title">Progress</h1><div class="stack">${html}</div>` };
}

function syllabusView() {
  const rows = model.papers
    .map((p) => {
      const unverified = p.chapters.filter((c) => c.verification !== 'verified').length;
      return `<tr><td>${p.subject.icon} ${esc(p.subject.name)}</td><td>${esc(p.name)}</td><td>${p.chapters.length}</td>
        <td>${p.sourceStatus === 'verified' && !unverified ? '<span class="badge ok">Verified</span>' : '<span class="badge warn">Needs verification</span>'}</td></tr>`;
    })
    .join('');
  return {
    nav: 'syllabus',
    crumbs: [['Syllabus', '#/syllabus']],
    html: `<h1 class="page-title">Syllabus source status</h1>
      <p class="muted">Chapter names are taken only from the uploaded syllabus images. Nothing is guessed. Items not yet read from a source are marked <span class="badge warn">VERIFY FROM SOURCE</span>. Full detail: <code>SYLLABUS_STRUCTURE_AUDIT.md</code>.</p>
      <div class="table-wrap card"><table><thead><tr><th>Subject</th><th>Paper</th><th>Chapters</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  };
}

// ---------- interactions ----------

function onClick(e) {
  const head = e.target.closest('.acc-head');
  if (head) {
    const item = head.parentElement;
    const willOpen = !item.classList.contains('open');
    // One chapter open at a time keeps the list uncluttered.
    item.parentElement.querySelectorAll('.acc-item.open').forEach((el) => {
      el.classList.remove('open');
      el.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
    });
    if (willOpen) {
      item.classList.add('open');
      head.setAttribute('aria-expanded', 'true');
    }
    const { a } = route();
    history.replaceState(null, '', willOpen ? `#/p/${a}/${head.dataset.chapter}` : `#/p/${a}`);
    return;
  }
  const toggle = e.target.closest('[data-action="toggle-done"]');
  if (toggle) {
    toggleItemDone(toggle.dataset.item);
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    return;
  }
  const add = e.target.closest('[data-action="add-content"]');
  if (add) toast(`Content ingestion comes in the next phase. Target: ${add.dataset.section}`);
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

boot();

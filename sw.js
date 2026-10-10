// Offline support.
// - On install, everything the app needs to start is downloaded up front: the app shell
//   (SHELL, kept up to date by tools/bump-version.mjs) plus every study-data file listed in
//   content/index.json, the mind maps and the simulation labs. So the app works offline
//   right after it is installed, even if it was opened only once.
// - Requests are network-first so updates show up immediately; every network request
//   revalidates with the server (cache: 'no-cache'), so the browser's HTTP cache can never
//   serve a stale page, stylesheet or script after an update.
// - When the network fails — or hangs for a few seconds on a weak connection — the cached
//   copy is served instead.
const CACHE = 'hscos-202610101347';
const FONTS = 'hscos-fonts';

// prettier-ignore
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'assets/css/app.css?v=202610101347',
  'assets/js/a11y.js?v=202610101347',
  'assets/js/activity.js?v=202610101347',
  'assets/js/ai.js?v=202610101347',
  'assets/js/alarms.js?v=202610101347',
  'assets/js/app.js?v=202610101347',
  'assets/js/backup.js?v=202610101347',
  'assets/js/components.js?v=202610101347',
  'assets/js/concepts.js?v=202610101347',
  'assets/js/firebase-config.js?v=202610101347',
  'assets/js/focus.js?v=202610101347',
  'assets/js/handsfree.js?v=202610101347',
  'assets/js/icons.js?v=202610101347',
  'assets/js/leaderboard.js?v=202610101347',
  'assets/js/learn.js?v=202610101347',
  'assets/js/markdown.js?v=202610101347',
  'assets/js/mindmap.js?v=202610101347',
  'assets/js/mission.js?v=202610101347',
  'assets/js/mistakes.js?v=202610101347',
  'assets/js/model.js?v=202610101347',
  'assets/js/planner.js?v=202610101347',
  'assets/js/practice.js?v=202610101347',
  'assets/js/profile.js?v=202610101347',
  'assets/js/progress.js?v=202610101347',
  'assets/js/search.js?v=202610101347',
  'assets/js/theme.js?v=202610101347',
  'assets/js/videos.js?v=202610101347',
  'assets/js/views/a11y.js?v=202610101347',
  'assets/js/views/ai.js?v=202610101347',
  'assets/js/views/alarms.js?v=202610101347',
  'assets/js/views/backup.js?v=202610101347',
  'assets/js/views/focus.js?v=202610101347',
  'assets/js/views/graph.js?v=202610101347',
  'assets/js/views/home.js?v=202610101347',
  'assets/js/views/mindmap.js?v=202610101347',
  'assets/js/views/mission.js?v=202610101347',
  'assets/js/views/mistakes.js?v=202610101347',
  'assets/js/views/more.js?v=202610101347',
  'assets/js/views/planner.js?v=202610101347',
  'assets/js/views/practice.js?v=202610101347',
  'assets/js/views/profile.js?v=202610101347',
  'assets/js/views/progress.js?v=202610101347',
  'assets/js/views/search.js?v=202610101347',
  'assets/js/views/section.js?v=202610101347',
  'assets/js/views/shared.js?v=202610101347',
  'assets/js/views/study.js?v=202610101347',
  'assets/js/views/topic.js?v=202610101347',
  'assets/js/views/videos.js?v=202610101347',
  'assets/img/avatar.jpg',
  'assets/img/subject-biology.jpg',
  'assets/img/subject-chemistry.jpg',
  'assets/img/subject-physics.jpg',
  'assets/img/tab-study.jpg',
];

const DATA = [
  'data/subjects.json', 'data/papers.json', 'data/chapters.json', 'data/section-types.json',
  'data/section-templates.json', 'data/concepts.json', 'content/index.json', 'content/toc.json',
  'content/mindmaps/index.json',
];
const WAIT_MS = 4000;
const abs = (u) => new URL(u, self.registration.scope).href;

async function precache() {
  const cache = await caches.open(CACHE);
  const get = async (u) => {
    try {
      const res = await fetch(abs(u), { cache: 'no-cache' });
      if (!res.ok) return null;
      await cache.put(abs(u), res.clone());
      return res;
    } catch {
      return null; // one missing file must not stop the rest
    }
  };
  const all = async (list) => {
    const out = [];
    for (let i = 0; i < list.length; i += 8) out.push(...(await Promise.all(list.slice(i, i + 8).map(get))));
    return out;
  };
  const [, data] = await Promise.all([all(SHELL), all(DATA)]);
  const json = async (res) => { try { return await res?.json(); } catch { return null; } };
  const index = await json(data[DATA.indexOf('content/index.json')]);
  const maps = await json(data[DATA.indexOf('content/mindmaps/index.json')]);
  const files = Object.values(index?.sections ?? {}).map((s) => s.file);
  const sections = await all(files);
  // Simulation labs are small: keep them too. (PDFs stay per chapter: "অফলাইনে রাখো".)
  const labs = [];
  for (const res of sections) for (const it of (await json(res))?.items ?? []) if (it.format === 'html' && it.file) labs.push(encodeURI(it.file));
  await all([...Object.values(maps?.maps ?? {}), ...labs]);
}

self.addEventListener('install', (e) => e.waitUntil(precache().finally(() => self.skipWaiting())));
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS && !k.startsWith('hscos-offline')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

async function fromCache(req) {
  return (await caches.match(req)) ??
    (await caches.match(req, { ignoreSearch: true })) ??
    (req.mode === 'navigate' ? (await caches.match(abs('./'), { ignoreSearch: true })) ?? (await caches.match(abs('index.html'), { ignoreSearch: true })) : undefined);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Web fonts: cache-first, so Bengali text keeps its font offline.
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(async (c) => (await c.match(req)) ?? fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      })),
    );
    return;
  }
  if (url.origin !== location.origin) return;

  // A navigation request can't be re-fetched with options, so fetch its URL instead.
  const net = (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }))
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    });
  net.catch(() => {}); // a failure is handled below; don't report it twice
  e.respondWith((async () => {
    // On a weak connection the network can hang without failing: after a few seconds,
    // answer from the cache if we can (the network copy still refreshes the cache).
    const slow = new Promise((resolve) => setTimeout(resolve, WAIT_MS)).then(() => fromCache(req));
    try {
      return await Promise.race([net, slow.then((r) => r ?? net)]);
    } catch {
      return (await fromCache(req)) ?? Response.error();
    }
  })());
});

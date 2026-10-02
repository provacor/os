// Personal video links per chapter (mostly YouTube), grouped by topic.
// Stored only in this browser: { [chapterId]: [{ id, url, vid, title, topic, added }] }.

const KEY = 'hscos:videos:v1';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
let store = read();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

// YouTube video id from any common link form, or null.
export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/) || [])[1] || null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// Start time in seconds from ?t=90 / ?t=1m30s / &start=90, or 0.
export function startTime(url) {
  try {
    const u = new URL(url);
    const t = u.searchParams.get('t') || u.searchParams.get('start') || '';
    if (/^\d+$/.test(t)) return Number(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  } catch {
    return 0;
  }
}

export function normalizeUrl(raw) {
  let s = String(raw ?? '').trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    const okHost = /^[\w-]+(\.[\w-]+)+$/.test(u.hostname);
    return (u.protocol === 'https:' || u.protocol === 'http:') && okHost ? u.href : null;
  } catch {
    return null;
  }
}

export const videosOf = (chapterId) => store[chapterId] ?? [];
export const videoCount = (chapterId) => videosOf(chapterId).length;

export function addVideo(chapterId, { url, title, topic }) {
  const href = normalizeUrl(url);
  if (!href) return 'bad-url';
  const list = (store[chapterId] ??= []);
  if (list.some((v) => v.url === href && v.topic === (topic ?? '').trim())) return 'duplicate';
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    url: href,
    vid: youtubeId(href),
    title: String(title ?? '').trim().slice(0, 120),
    topic: String(topic ?? '').trim().slice(0, 120),
    added: Date.now(),
  });
  return save() ? 'ok' : 'storage';
}

export function deleteVideo(chapterId, id) {
  store[chapterId] = videosOf(chapterId).filter((v) => v.id !== id);
  if (!store[chapterId].length) delete store[chapterId];
  save();
}

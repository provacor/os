// Progress framework. Each trackable section stores a 0–100 value;
// chapter / paper / subject progress is the average of what sits below it.
// Values live in this device's localStorage (personal app, single user).

const KEY = 'hscos:progress:v1';
const DONE_KEY = 'hscos:done:v1';
let state = read(KEY);
let done = read(DONE_KEY);

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch {
    return {};
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(DONE_KEY, JSON.stringify(done));
  } catch {
    /* storage unavailable: progress stays in memory for this visit */
  }
}

// Content items can be marked done; a section with content is then
// (done items / all items) complete.
export function isItemDone(itemId) {
  return !!done[itemId];
}

export function toggleItemDone(itemId) {
  if (done[itemId]) delete done[itemId];
  else done[itemId] = 1;
  write();
  return !!done[itemId];
}

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));

export function setSectionProgress(sectionId, value) {
  state[sectionId] = clamp(value);
  write();
}

export function progressOf(node) {
  switch (node.level) {
    case 'section':
      if (node.items?.length) {
        return Math.round((node.items.filter((it) => done[it.id]).length / node.items.length) * 100);
      }
      return clamp(state[node.id]);
    case 'chapter':
      return avg(node.sections.filter((s) => s.trackable).map(progressOf));
    case 'paper':
      return avg(node.chapters.map(progressOf));
    case 'subject':
      return avg(node.papers.flatMap((p) => p.chapters).map(progressOf));
    default:
      return 0;
  }
}

// Wipe all completion state on this device (More → Reset progress).
export function resetProgress() {
  state = {};
  done = {};
  write();
}

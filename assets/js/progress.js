// Progress framework. Each trackable section stores a 0–100 value;
// chapter / paper / subject progress is the average of what sits below it.
// Values live in this device's localStorage (personal app, single user).

const KEY = 'hscos:progress:v1';
let state = read();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: progress stays in memory for this visit */
  }
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

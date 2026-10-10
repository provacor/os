// Accessibility: text size, dyslexia-friendly reading, high contrast, motion,
// captions, read-aloud (speech synthesis) and voice commands (speech recognition).
// Settings live in this browser and are applied to <html> as data attributes;
// index.html applies them before first paint so nothing flashes.

const KEY = 'hscos:a11y:v1';
export const FONT_STEPS = [[0.9, 'ছোট'], [1, 'সাধারণ'], [1.15, 'বড়'], [1.3, 'আরও বড়'], [1.5, 'সবচেয়ে বড়']];
const DEFAULTS = { font: 1, dyslexia: false, contrast: false, motion: 'system', captions: true, rate: 1, bright: 100 };

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}
let prefs = read();

export const a11y = () => prefs;
export function setA11y(patch) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* settings stay for this visit */
  }
  applyA11y();
}

// App brightness (50–130%): below 100 a black veil dims the screen, above 100 the content is brightened.
export function applyBrightness(v) {
  const b = Math.min(130, Math.max(50, Number(v) || 100));
  const h = document.documentElement;
  h.style.setProperty('--dim', String(b < 100 ? (100 - b) / 100 : 0));
  h.style.setProperty('--boost', String(b > 100 ? b / 100 : 1));
  h.dataset.bright = b === 100 ? 'normal' : b < 100 ? 'dim' : 'boost';
}

let lexend = false;
export function applyA11y() {
  const h = document.documentElement;
  h.style.setProperty('--fs', String(prefs.font));
  h.dataset.dyslexia = prefs.dyslexia ? 'on' : 'off';
  h.dataset.contrast = prefs.contrast ? 'high' : 'normal';
  h.dataset.motion = prefs.motion;
  applyBrightness(prefs.bright);
  if (prefs.dyslexia && !lexend) {
    lexend = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }
}

const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
export const motionReduced = () => prefs.motion === 'reduce' || (prefs.motion === 'system' && systemReduced.matches);

// ---------- read aloud ----------

export const canSpeak = () => 'speechSynthesis' in window;
const hasBengali = (t) => /[ঀ-৿]/.test(t);

function pickVoice(lang) {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang)) ?? null;
}

let speakingEl = null;
let speakToken = 0;
// onEnd runs once the whole text has been spoken, never when it was cut off by another speak()/stopSpeaking().
export function speak(text, el = null, onEnd = null) {
  if (!canSpeak()) return false;
  const token = ++speakToken;
  speechSynthesis.cancel();
  speakingEl?.classList.remove('speaking');
  const clean = String(text).replace(/\$+([^$]+)\$+/g, '$1').replace(/[#*_`>|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return false;
  const lang = hasBengali(clean) ? 'bn' : 'en';
  // long text is split into sentences; some engines stop after ~200 characters
  const parts = clean.match(/[^।.!?\n]+[।.!?]?/g) ?? [clean];
  speakingEl = el;
  el?.classList.add('speaking');
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p.trim());
    u.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = prefs.rate;
    if (i === parts.length - 1) {
      u.onend = u.onerror = () => {
        el?.classList.remove('speaking');
        if (speakingEl === el) speakingEl = null;
        if (token === speakToken) onEnd?.();
      };
    }
    speechSynthesis.speak(u);
  });
  return true;
}
export function stopSpeaking() {
  speakToken++;
  if (canSpeak()) speechSynthesis.cancel();
  speakingEl?.classList.remove('speaking');
  speakingEl = null;
}
export const isSpeaking = (el) => !!el && speakingEl === el;

// ---------- voice input ----------

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => !!Recognition;

// Listen once; resolves with what was heard (Bengali first, English understood too).
export function listen() {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('unsupported'));
    const r = new Recognition();
    r.lang = 'bn-BD';
    r.interimResults = false;
    r.maxAlternatives = 3;
    let done = false;
    r.onresult = (e) => {
      done = true;
      resolve([...e.results[0]].map((a) => a.transcript.trim()));
    };
    r.onerror = (e) => { done = true; reject(new Error(e.error || 'error')); };
    r.onend = () => { if (!done) reject(new Error('no-speech')); };
    r.start();
  });
}

// Map what was heard to an app action. Returns { hash } | { back: true } | { theme } | { search } | null.
const SUBJECTS = [
  [/পদার্থ|ফিজিক্স|physics/i, 'physics'],
  [/রসায়ন|কেমিস্ট্রি|chemistry/i, 'chemistry'],
  [/জীব|বায়োলজি|biology/i, 'biology'],
  [/গণিত|ম্যাথ|math/i, 'higher_math'],
  [/ইংরেজি|ইংলিশ|english|গ্রামার|grammar/i, 'english'],
];
const PAGES = [
  [/হোম|home|শুরু/i, '#/'],
  [/মিশন|mission|প্ল্যান|plan/i, '#/mission'],
  [/প্রগ্রেস|progress|অগ্রগতি/i, '#/progress'],
  [/প্রোফাইল|profile/i, '#/profile'],
  [/অ্যাক্সেস|access|সহজ ব্যবহার/i, '#/a11y'],
  [/এআই|এ আই|\bai\b|শিক্ষক|tutor/i, '#/ai'],
  [/স্টাডি|study|সিলেবাস|syllabus|ম্যাপ|অ্যালার্ম|alarm/i, '#/study'],
  [/আরো|আরও|more|সেটিং|setting/i, '#/more'],
  [/সার্চ|search|খোঁজ/i, '#/search'],
];
export function voiceCommand(heard) {
  for (const raw of heard) {
    const t = raw.toLowerCase();
    const q = t.match(/^(?:খোঁজো|খুঁজো|খোঁজ|সার্চ করো|সার্চ|search(?: for)?|find)\s+(.+)$/i) || t.match(/^(.+?)\s+(?:খোঁজো|খুঁজো|সার্চ করো)$/);
    if (q) return { search: q[1].trim() };
    if (/হ্যান্ডস|হ্যান্ড ফ্রি|শোনাও|শুনাও|পড়ে শোনাও|ইয়ারবাড|হেডফোন|hands ?free/i.test(t)) return { handsfree: true };
    if (/পিছনে|পেছনে|ফিরে|back/.test(t)) return { back: true };
    if (/ডার্ক|অন্ধকার|dark/.test(t)) return { theme: 'dark' };
    if (/লাইট|আলো|light/.test(t)) return { theme: 'light' };
    for (const [re, id] of SUBJECTS) if (re.test(t)) return { hash: `#/s/${id}` };
    for (const [re, hash] of PAGES) if (re.test(t)) return { hash };
  }
  return heard[0] ? { search: heard[0] } : null;
}

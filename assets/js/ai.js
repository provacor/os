// AI tutor on Google Gemini, called straight from the browser with the person's own
// API key (free from Google AI Studio). The key and the chat stay in this browser;
// nothing goes through a Provacor server, so no shared key can leak from the site.

const SETTINGS = 'hscos:ai:v1';
const CHAT = 'hscos:ai-chat:v1';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_MODEL = 'gemini-2.5-flash';
const KEEP = 40; // messages kept on the device
const CONTEXT = 12; // recent messages sent with each question

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// A Gemini model id like "gemini-2.5-flash". Anything else (an autofilled email,
// a pasted key, extra text) falls back to the default instead of breaking requests.
export function cleanModel(m) {
  const id = String(m ?? '').trim().replace(/^models\//, '').toLowerCase();
  return /^gemini-[a-z0-9][a-z0-9.-]*$/.test(id) ? id : DEFAULT_MODEL;
}

let settings = { key: '', model: DEFAULT_MODEL, ...read(SETTINGS, {}) };
settings.model = cleanModel(settings.model);
let chat = read(CHAT, []);

export const aiSettings = () => settings;
export const hasKey = () => !!settings.key;
export function saveSettings(patch) {
  settings = { ...settings, ...patch };
  settings.key = String(settings.key ?? '').trim();
  settings.model = cleanModel(settings.model);
  write(SETTINGS, settings);
}

export const chatHistory = () => chat;
export function clearChat() {
  chat = [];
  write(CHAT, chat);
}
function remember(msg) {
  chat.push(msg);
  chat = chat.slice(-KEEP);
  // if storage is full, drop the oldest thumbnails first
  while (!write(CHAT, chat) && chat.some((m) => m.thumbs?.length)) {
    const m = chat.find((x) => x.thumbs?.length);
    m.thumbs = [];
  }
}

const SYSTEM = `তুমি "Provacor AI", বাংলাদেশের HSC বিজ্ঞান বিভাগের (NCTB সিলেবাস) একজন ধৈর্যশীল শিক্ষক।
- উত্তর বাংলায় দাও; বৈজ্ঞানিক পরিভাষা, সূত্র ও একক ইংরেজিতে রাখা যাবে। প্রশ্ন ইংরেজিতে হলে বা ইংরেজি চাইলে ইংরেজিতে দাও।
- অঙ্ক/গাণিতিক সমস্যা ধাপে ধাপে সমাধান করো: প্রদত্ত তথ্য → সূত্র → মান বসানো → উত্তর (একক সহ)।
- গণিতের সব রাশি LaTeX-এ লেখো: লাইনের ভেতরে $...$, আলাদা লাইনে $$...$$।
- MCQ হলে প্রথমে সঠিক অপশন বলো, তারপর ছোট ব্যাখ্যা দাও।
- সৃজনশীল প্রশ্ন (CQ) হলে ক, খ, গ, ঘ আলাদা করে বোর্ড পরীক্ষার মতো উত্তর দাও।
- ছবি দিলে আগে ছবির প্রশ্নটা ঠিকমতো পড়ো; অস্পষ্ট হলে কোন অংশ বোঝা যাচ্ছে না তা বলো, অনুমান করে বানিয়ে উত্তর দিও না।
- নিশ্চিত না হলে সেটা স্পষ্ট করে বলো। পড়াশোনার বাইরের ক্ষতিকর বা অনুপযুক্ত অনুরোধ ভদ্রভাবে এড়িয়ে যাও।
- উত্তর গোছানো ও সংক্ষিপ্ত রাখো; দরকার হলে শিরোনাম ও তালিকা ব্যবহার করো।`;

// Resize a photo to at most `max` px on the long side, as a JPEG data URL.
export function shrinkImage(file, max = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('not an image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
    img.src = url;
  });
}

const thumbOf = (dataUrl) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 240 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });

export class AiError extends Error {
  constructor(kind, detail) {
    super(detail || kind);
    this.kind = kind;
  }
}

// Ask a question (text and/or photos). Calls onText(fullTextSoFar) while the answer streams.
export async function ask({ text, images = [], context = '' }, onText) {
  if (!settings.key) throw new AiError('no-key');
  const parts = [];
  if (text) parts.push({ text });
  for (const d of images) parts.push({ inline_data: { mime_type: 'image/jpeg', data: d.split(',')[1] } });
  if (!parts.length) throw new AiError('empty');

  const prior = chat.slice(-CONTEXT).map((m) => ({
    role: m.role === 'ai' ? 'model' : 'user',
    parts: [{ text: m.text || (m.thumbs?.length ? '[ছবি পাঠানো হয়েছিল]' : '…') }],
  }));
  const thumbs = await Promise.all(images.map(thumbOf));

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM + (context ? `\n\nশিক্ষার্থী এখন পড়ছে: ${context}` : '') }] },
    contents: [...prior, { role: 'user', parts }],
    generationConfig: { temperature: 0.4 },
  };

  const call = (model) =>
    fetch(`${API}/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.key },
      body: JSON.stringify(body),
    });
  const failure = async (r) => {
    let msg = '';
    try { msg = (await r.json()).error?.message ?? ''; } catch { /* ignore */ }
    if (r.status === 400 && /api key/i.test(msg)) return new AiError('bad-key', msg);
    if (r.status === 401 || r.status === 403) return new AiError('bad-key', msg);
    if (r.status === 404 || (r.status === 400 && /model/i.test(msg))) return new AiError('bad-model', msg);
    if (r.status === 429) return new AiError('quota', msg);
    return new AiError('api', msg || `HTTP ${r.status}`);
  };

  // Ask Google which models this key can use and pick the newest "flash" one.
  const discover = async () => {
    try {
      const r = await fetch(`${API}?pageSize=200`, { headers: { 'x-goog-api-key': settings.key } });
      if (!r.ok) return null;
      const ids = ((await r.json()).models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((id) => /^gemini-[\d.]+-flash$/.test(id));
      ids.sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
      return ids[0] ?? null;
    } catch {
      return null;
    }
  };

  let res;
  try {
    res = await call(settings.model);
    if (!res.ok) {
      let err = await failure(res);
      // an unknown or retired model: retry once with the default and keep it if it works
      for (const next of err.kind === 'bad-model' ? [DEFAULT_MODEL, 'discover'] : []) {
        const model = next === 'discover' ? await discover() : next;
        if (!model || model === settings.model) continue;
        res = await call(model);
        if (res.ok) { saveSettings({ model }); break; }
        err = await failure(res);
        if (err.kind !== 'bad-model') break;
      }
      if (!res.ok) throw err;
    }
  } catch (e) {
    throw e instanceof AiError ? e : new AiError('network');
  }

  let out = '';
  let blocked = '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const j = JSON.parse(line.slice(5));
        const c = j.candidates?.[0];
        const t = c?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        if (t) { out += t; onText?.(out); }
        if (c?.finishReason === 'SAFETY' || j.promptFeedback?.blockReason) blocked = 'safety';
      } catch {
        /* partial line */
      }
    }
  }
  if (!out) throw new AiError(blocked || 'empty-answer');
  // keep the question only together with its answer, so failed tries don't pile up
  remember({ role: 'user', text, thumbs, at: Date.now() });
  remember({ role: 'ai', text: out, at: Date.now() });
  return out;
}

export const ERRORS = {
  'no-key': 'আগে নিচের সেটিংসে তোমার Gemini API key বসাও।',
  'bad-key': 'API key ঠিক নেই। Google AI Studio থেকে নতুন key কপি করে আবার বসাও।',
  'bad-model': 'এই মডেলের নাম পাওয়া যায়নি। সেটিংসে মডেলের নাম ঠিক করো।',
  quota: 'আজকের ফ্রি লিমিট শেষ বা খুব দ্রুত প্রশ্ন করা হচ্ছে। একটু পরে আবার চেষ্টা করো।',
  network: 'ইন্টারনেট সংযোগ নেই।',
  safety: 'এই প্রশ্নের উত্তর দেওয়া যায়নি।',
  empty: 'কিছু লেখো বা ছবি দাও।',
  'empty-answer': 'কোনো উত্তর আসেনি, আবার চেষ্টা করো।',
  api: 'AI থেকে সমস্যা হয়েছে।',
};

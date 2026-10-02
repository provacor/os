// AI tutor on Anthropic Claude, called straight from the browser with the person's own
// API key from the Claude Console. The key and the chat stay in this browser; nothing
// goes through a Provacor server, so no shared key can leak from the site.

const SETTINGS = 'hscos:ai:v1';
const CHAT = 'hscos:ai-chat:v1';
export const CLAUDE_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 — সবচেয়ে ভালো'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — দ্রুত, কম খরচ'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5 — সবচেয়ে কম খরচ'],
];
const CLAUDE_DEFAULT = CLAUDE_MODELS[0][0];
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

const cleanClaude = (m) => (CLAUDE_MODELS.some(([id]) => id === m) ? m : CLAUDE_DEFAULT);

let settings = { claudeKey: '', claudeModel: CLAUDE_DEFAULT, ...read(SETTINGS, {}) };
// an older Gemini setup may still be stored; drop it
delete settings.key;
delete settings.model;
delete settings.provider;
settings.claudeModel = cleanClaude(settings.claudeModel);
let chat = read(CHAT, []);

export const aiSettings = () => settings;
export const hasKey = () => !!settings.claudeKey;
export function saveSettings(patch) {
  settings = { ...settings, ...patch };
  settings.claudeKey = String(settings.claudeKey ?? '').trim();
  settings.claudeModel = cleanClaude(settings.claudeModel);
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
  if (!hasKey()) throw new AiError('no-key');
  if (!text && !images.length) throw new AiError('empty');
  const system = SYSTEM + (context ? `\n\nশিক্ষার্থী এখন পড়ছে: ${context}` : '');
  const prior = chat.slice(-CONTEXT).map((m) => ({
    role: m.role === 'ai' ? 'ai' : 'user',
    text: m.text || (m.thumbs?.length ? '[ছবি পাঠানো হয়েছিল]' : '…'),
  }));
  const thumbs = await Promise.all(images.map(thumbOf));
  const out = await askClaude({ text, images, system, prior }, onText);
  // keep the question only together with its answer, so failed tries don't pile up
  remember({ role: 'user', text, thumbs, at: Date.now() });
  remember({ role: 'ai', text: out, at: Date.now() });
  return out;
}

// Claude through the official Anthropic SDK (bundled in assets/vendor, loaded on first use).
// Claude Opus 5.5 / Sonnet 5.5 take server-side refusal fallbacks and an explicit effort level.
const CLAUDE_FALLBACKS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);
let sdk = null;
async function askClaude({ text, images, system, prior }, onText) {
  sdk ??= import('../vendor/anthropic-sdk.js').catch((e) => { sdk = null; throw e; });
  let Anthropic;
  try {
    Anthropic = (await sdk).default;
  } catch {
    throw new AiError('network');
  }
  const client = new Anthropic({ apiKey: settings.claudeKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const model = settings.claudeModel;
  const content = [
    ...images.map((d) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d.split(',')[1] } })),
    ...(text ? [{ type: 'text', text }] : [{ type: 'text', text: 'ছবির প্রশ্নটার উত্তর দাও।' }]),
  ];
  const params = {
    model,
    max_tokens: 16000,
    system,
    messages: [...prior.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })), { role: 'user', content }],
  };
  if (model !== 'claude-haiku-4-5') params.output_config = { effort: 'medium' };
  if (CLAUDE_FALLBACKS.has(model)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  try {
    const stream = client.beta.messages.stream(params);
    stream.on('text', (_delta, snapshot) => onText?.(snapshot));
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new AiError('safety');
    const out = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!out) throw new AiError('empty-answer');
    if (msg.stop_reason === 'max_tokens') return `${out}\n\n…(উত্তর অনেক বড়, এখানে কেটে গেছে)`;
    return out;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError('bad-key', e.message);
    if (e instanceof Anthropic.NotFoundError) throw new AiError('bad-model', e.message);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('quota', e.message);
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) throw new AiError('credit', e.message);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('network');
    if (e instanceof Anthropic.APIError) throw new AiError('api', e.message);
    throw new AiError('api', e?.message);
  }
}

// Classify one mistake into a kind with a short Bengali reason (structured JSON output).
export async function classifyMistake(m, chapterName = '') {
  if (!hasKey()) throw new AiError('no-key');
  sdk ??= import('../vendor/anthropic-sdk.js').catch((e) => { sdk = null; throw e; });
  let Anthropic;
  try {
    Anthropic = (await sdk).default;
  } catch {
    throw new AiError('network');
  }
  const client = new Anthropic({ apiKey: settings.claudeKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const lines = [
    chapterName && `অধ্যায়: ${chapterName}`,
    `প্রশ্ন: ${m.question}`,
    m.options?.length && `অপশন: ${m.options.map((o, i) => `${'কখগঘ'[i] ?? i + 1}) ${o}`).join(' | ')}`,
    m.source === 'mcq' ? `শিক্ষার্থীর উত্তর: ${m.options?.[m.chosen] ?? m.chosen}` : m.myAnswer && `শিক্ষার্থীর উত্তর: ${m.myAnswer}`,
    m.source === 'mcq' ? `সঠিক উত্তর: ${m.correct}` : m.rightAnswer && `সঠিক উত্তর: ${m.rightAnswer}`,
    m.explanation && `ব্যাখ্যা: ${m.explanation}`,
  ].filter(Boolean).join('\n');
  const params = {
    model: settings.claudeModel,
    max_tokens: 4000,
    system: 'তুমি HSC বিজ্ঞানের শিক্ষক। শিক্ষার্থীর একটা ভুল দেখে ঠিক করো ভুলটা কোন ধরনের: concept (ধারণা বোঝেনি), formula (ভুল সূত্র বা সূত্র মনে নেই), calculation (সূত্র ঠিক কিন্তু হিসাবে ভুল), reading (প্রশ্ন ভুল পড়েছে বা বুঝেছে), careless (জানে কিন্তু অসাবধানতায় ভুল)। reason-এ বাংলায় এক-দুই বাক্যে কেন এই ধরন, আর tip-এ পরের বার এড়ানোর একটা ছোট পরামর্শ দাও।',
    messages: [{ role: 'user', content: lines }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['concept', 'formula', 'calculation', 'reading', 'careless'] },
            reason: { type: 'string' },
            tip: { type: 'string' },
          },
          required: ['kind', 'reason', 'tip'],
          additionalProperties: false,
        },
      },
    },
  };
  if (settings.claudeModel !== 'claude-haiku-4-5') params.output_config.effort = 'low';
  try {
    const msg = await client.messages.create(params);
    if (msg.stop_reason === 'refusal') throw new AiError('safety');
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const out = JSON.parse(text);
    return { kind: out.kind, reason: `${out.reason}${out.tip ? ` — ${out.tip}` : ''}` };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('empty-answer');
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError('bad-key', e.message);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('quota', e.message);
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) throw new AiError('credit', e.message);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('network');
    throw new AiError('api', e?.message);
  }
}

export const ERRORS = {
  'no-key': 'আগে উপরের AI সেটিংসে তোমার API key বসাও।',
  'bad-key': 'API key ঠিক নেই। নতুন key কপি করে আবার বসাও।',
  credit: 'Claude অ্যাকাউন্টে টাকা (credit) নেই। Claude Console-এ Billing থেকে credit যোগ করো।',
  'bad-model': 'এই মডেল পাওয়া যায়নি। সেটিংসে অন্য মডেল বেছে নাও।',
  quota: 'আজকের ফ্রি লিমিট শেষ বা খুব দ্রুত প্রশ্ন করা হচ্ছে। একটু পরে আবার চেষ্টা করো।',
  network: 'ইন্টারনেট সংযোগ নেই।',
  safety: 'এই প্রশ্নের উত্তর দেওয়া যায়নি।',
  empty: 'কিছু লেখো বা ছবি দাও।',
  'empty-answer': 'কোনো উত্তর আসেনি, আবার চেষ্টা করো।',
  api: 'AI থেকে সমস্যা হয়েছে।',
};

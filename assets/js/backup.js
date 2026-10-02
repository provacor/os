// Privacy-first backup: everything the app keeps on this device is put in one file,
// encrypted on the phone with a password (PBKDF2-SHA-256 → AES-256-GCM, Web Crypto).
// Without the password the file is unreadable, so it is safe to keep in Google Drive,
// email or Telegram. Restoring on another phone brings everything back.

const PREFIX = 'hscos:';
const LAST = 'hscos:backup-at';
const AI_KEY = 'hscos:ai:v1';
const ITER = 310000;

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const lastBackupAt = () => Number(localStorage.getItem(LAST)) || 0;

export function snapshot({ includeAiKey = false } = {}) {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX) || k === LAST) continue;
    let v = localStorage.getItem(k);
    if (k === AI_KEY && !includeAiKey) {
      try { const o = JSON.parse(v); delete o.claudeKey; v = JSON.stringify(o); } catch { continue; }
    }
    data[k] = v;
  }
  return data;
}

export async function makeBackup(password, opts) {
  if (!crypto?.subtle) throw new Error('nocrypto');
  const plain = JSON.stringify({ app: 'provacor', v: 1, at: Date.now(), data: snapshot(opts) });
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const file = JSON.stringify({ format: 'provacor-backup', v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: b64(salt) }, cipher: { name: 'AES-GCM', iv: b64(iv) }, data: b64(ct) });
  const d = new Date();
  const name = `provacor-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.provacor`;
  localStorage.setItem(LAST, String(Date.now()));
  return { blob: new Blob([file], { type: 'application/octet-stream' }), name, keys: Object.keys(JSON.parse(plain).data).length };
}

export async function readBackup(file, password) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { throw new Error('notbackup'); }
  if (obj?.format !== 'provacor-backup') throw new Error('notbackup');
  const key = await keyFrom(password, unb64(obj.kdf.salt));
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.cipher.iv) }, key, unb64(obj.data));
  } catch {
    throw new Error('badpassword');
  }
  const payload = JSON.parse(new TextDecoder().decode(plain));
  if (payload?.app !== 'provacor' || typeof payload.data !== 'object') throw new Error('notbackup');
  return payload;
}

// Replace this device's data with the backup's. Keeps this phone's AI key if the backup has none.
export function restore(payload) {
  const keepAi = (() => { try { return JSON.parse(localStorage.getItem(AI_KEY))?.claudeKey; } catch { return null; } })();
  const old = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) old.push(k); }
  old.forEach((k) => localStorage.removeItem(k));
  for (const [k, v] of Object.entries(payload.data)) if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
  if (keepAi) {
    try {
      const o = JSON.parse(localStorage.getItem(AI_KEY) ?? '{}');
      if (!o.claudeKey) { o.claudeKey = keepAi; localStorage.setItem(AI_KEY, JSON.stringify(o)); }
    } catch { /* ignore */ }
  }
  localStorage.setItem(LAST, String(Date.now()));
}

export async function saveOrShare({ blob, name }) {
  const file = new File([blob], name, { type: 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Provacor backup' });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return 'downloaded';
}

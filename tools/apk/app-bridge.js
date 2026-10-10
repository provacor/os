// Injected by the Android app after each page load: fills the gaps of Android's WebView
// (read-aloud, notifications, file downloads) using the ProvacorAndroid bridge.
(() => {
  const A = window.ProvacorAndroid;
  if (!A || window.__provacorApp) return;
  window.__provacorApp = true;

  // ---------- read aloud: speechSynthesis on top of Android TextToSpeech ----------
  const queue = new Map();
  let next = 0;
  window.__ttsDone = (id, ok) => {
    const u = queue.get(id);
    if (!u) return;
    queue.delete(id);
    synth.speaking = queue.size > 0;
    const fn = ok ? u.onend : u.onerror ?? u.onend;
    try { fn?.call(u, { type: ok ? 'end' : 'error', utterance: u }); } catch { /* page error */ }
  };
  function Utterance(text) {
    Object.assign(this, { text: text ?? '', lang: '', rate: 1, pitch: 1, volume: 1, voice: null, onend: null, onerror: null, onstart: null });
  }
  const voices = [
    { name: 'Android বাংলা', lang: 'bn-BD', default: true, localService: true, voiceURI: 'android-bn' },
    { name: 'Android English', lang: 'en-US', default: false, localService: true, voiceURI: 'android-en' },
  ];
  const synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: () => voices,
    speak(u) {
      const id = ++next;
      queue.set(id, u);
      synth.speaking = true;
      A.speak(id, String(u.text), u.lang || u.voice?.lang || 'bn-BD', Number(u.rate) || 1);
    },
    cancel() {
      A.stopSpeaking();
      const old = [...queue.values()];
      queue.clear();
      synth.speaking = false;
      old.forEach((u) => { try { u.onerror?.call(u, { type: 'error', error: 'interrupted', utterance: u }); } catch { /* ignore */ } });
    },
    pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
  };
  try {
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true, writable: true });
  } catch { /* keep the WebView's own */ }

  // ---------- notifications ----------
  function Note(title, opts = {}) { A.notify(String(title), String(opts.body ?? '')); }
  Object.defineProperty(Note, 'permission', { get: () => A.notifyPermission() });
  Note.requestPermission = () => { A.requestNotify(); return new Promise((r) => setTimeout(() => r(A.notifyPermission()), 4000)); };
  try { Object.defineProperty(window, 'Notification', { value: Note, configurable: true, writable: true }); } catch { /* ignore */ }

  // ---------- downloads (<a download> with a blob: or data: link) → Downloads folder ----------
  async function save(a) {
    try {
      const blob = await (await fetch(a.href)).blob();
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      A.saveFile(a.download || 'provacor-file', blob.type || 'application/octet-stream', b64);
    } catch { /* nothing to save */ }
  }
  const isDownload = (a) => a && a.hasAttribute('download') && /^(blob|data):/.test(a.href);
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isDownload(this)) return void save(this);
    return click.call(this);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a');
    if (isDownload(a)) { e.preventDefault(); save(a); }
  }, true);
})();

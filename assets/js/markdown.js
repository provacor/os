// Small, safe Markdown renderer for AI answers. Escapes all HTML first, keeps
// LaTeX ($…$, $$…$$, \(…\), \[…\]) untouched for KaTeX, then renders typesetting.

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

export function renderMarkdown(src) {
  const keep = [];
  const stash = (s) => `\u0000${keep.push(s) - 1}\u0000`;
  let s = String(src ?? '');
  s = s.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, code) => stash(`<pre><code>${esc(code)}</code></pre>`));
  s = s.replace(/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g, (m) => stash(esc(m)));
  s = esc(s);

  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of s.split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { close(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { close(); const n = Math.min(4, m[1].length + 2); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) { if (list !== 'ol') { close(); out.push(`<ol start="${m[1]}">`); list = 'ol'; } out.push(`<li>${inline(m[2])}</li>`); continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { close(); out.push('<hr>'); continue; }
    close();
    out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}

// KaTeX from cdnjs, loaded the first time an answer has math.
let katex = null;
function loadKatex() {
  if (katex) return katex;
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = `${base}/katex.min.css`;
  document.head.appendChild(css);
  const script = (src) => new Promise((ok, fail) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = ok;
    el.onerror = fail;
    document.head.appendChild(el);
  });
  katex = script(`${base}/katex.min.js`).then(() => script(`${base}/contrib/auto-render.min.js`)).catch(() => { katex = null; });
  return katex;
}

export function typesetMath(el) {
  if (!el || !/\$|\\\(|\\\[/.test(el.textContent)) return;
  loadKatex()?.then(() => {
    window.renderMathInElement?.(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  });
}

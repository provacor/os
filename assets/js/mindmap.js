// Mind map engine: measures and wraps labels, lays the tree out left → right
// (tidy tree: every branch gets the height of its subtree), and draws it as SVG
// with curved links, branch colours, collapsible branches and study ticks on leaves.
// Pan with a finger / mouse, pinch or wheel to zoom.

const NS = 'http://www.w3.org/2000/svg';
const HUES = ['blue', 'violet', 'teal', 'amber', 'rose', 'green', 'cyan', 'red'];
const GAP_X = 46;
const GAP_Y = 12;
const PAD_X = 14;
const PAD_Y = 9;

let ctx2d = null;
function measure(text, font) {
  ctx2d ??= document.createElement('canvas').getContext('2d');
  ctx2d.font = font;
  return ctx2d.measureText(text).width;
}
function wrap(text, font, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (line && measure(t, font) > max) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function leaves(n) {
  return n.children?.length ? n.children.flatMap(leaves) : [n];
}
export function walk(n, fn, depth = 0, parent = null) {
  fn(n, depth, parent);
  (n.children ?? []).forEach((c) => walk(c, fn, depth + 1, n));
}

export class MindMap {
  constructor(host, root, { done = new Set(), onToggleDone, family = 'Inter, "Noto Sans Bengali", sans-serif', compact = false } = {}) {
    this.host = host;
    this.root = root;
    this.done = done;
    this.onToggleDone = onToggleDone;
    this.family = family;
    this.compact = compact;
    this.view = { x: 20, y: 0, k: 1 };
    // first view: the chapter and its main topics; tap a topic to open it
    walk(root, (n, d) => { n.open = d < 1; n.hue = null; });
    root.children?.forEach((c, i) => walk(c, (n) => { n.hue = HUES[i % HUES.length]; }));
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('mm-svg');
    this.svg.innerHTML = '<defs><linearGradient id="mmRootGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--violet)"/><stop offset="1" style="stop-color:var(--brand)"/></linearGradient></defs>';
    this.g = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.g);
    host.appendChild(this.svg);
    this.bindGestures();
    this.render();
    this.fit();
  }

  fonts(depth) {
    const s = this.compact ? 0.92 : 1;
    if (depth === 0) return { font: `700 ${17 * s}px ${this.family}`, size: 17 * s, lh: 23 * s, max: 190 * s };
    if (depth === 1) return { font: `650 ${14.5 * s}px ${this.family}`, size: 14.5 * s, lh: 20 * s, max: 190 * s };
    return { font: `500 ${13 * s}px ${this.family}`, size: 13 * s, lh: 18 * s, max: 210 * s };
  }

  layout() {
    const hintFont = `500 ${11.5}px ui-monospace, "Noto Sans Bengali", monospace`;
    const size = (n, depth) => {
      const f = this.fonts(depth);
      n.depth = depth;
      n.lines = wrap(n.text, f.font, f.max);
      n.hintLines = n.hint ? wrap(n.hint, hintFont, f.max + 20) : [];
      const tw = Math.max(...n.lines.map((l) => measure(l, f.font)), ...n.hintLines.map((l) => measure(l, hintFont)), 20);
      const isLeaf = !n.children?.length;
      // canvas measuring can run a little short for Bengali shaping, so allow ~6% extra
      n.w = Math.ceil(tw * 1.08 + PAD_X * 2 + (isLeaf && depth > 0 ? 22 : 0) + (!isLeaf && depth > 0 ? 18 : 0));
      n.h = Math.ceil(n.lines.length * f.lh + n.hintLines.length * 16 + PAD_Y * 2);
      n.f = f;
      const kids = n.open ? n.children ?? [] : [];
      kids.forEach((c) => size(c, depth + 1));
      n.sub = kids.length ? Math.max(n.h, kids.reduce((s, c) => s + c.sub, 0) + GAP_Y * (kids.length - 1)) : n.h;
    };
    const place = (n, x, top) => {
      n.x = x;
      n.y = top + n.sub / 2 - n.h / 2;
      const kids = n.open ? n.children ?? [] : [];
      const total = kids.reduce((s, c) => s + c.sub, 0) + GAP_Y * Math.max(0, kids.length - 1);
      let y = top + (n.sub - total) / 2;
      for (const c of kids) { place(c, x + n.w + GAP_X, y); y += c.sub + GAP_Y; }
    };
    size(this.root, 0);
    place(this.root, 0, 0);
  }

  render() {
    this.layout();
    const links = [];
    const nodes = [];
    const visit = (n) => {
      const kids = n.open ? n.children ?? [] : [];
      for (const c of kids) {
        const x1 = n.x + n.w;
        const y1 = n.y + n.h / 2;
        const x2 = c.x;
        const y2 = c.y + c.h / 2;
        const mx = (x1 + x2) / 2;
        links.push(`<path class="mm-link hue-${c.hue}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`);
        visit(c);
      }
      nodes.push(this.nodeSvg(n));
    };
    visit(this.root);
    this.g.innerHTML = `<g class="mm-links">${links.join('')}</g>${nodes.join('')}`;
    this.apply();
  }

  nodeSvg(n) {
    const isLeaf = !n.children?.length;
    const done = isLeaf && this.done.has(n.id);
    const f = n.f;
    const lx = n.x + PAD_X + (isLeaf && n.depth > 0 ? 22 : 0);
    let y = n.y + PAD_Y + f.size;
    const text = n.lines.map((l, i) => `<text class="mm-t" x="${lx}" y="${y + i * f.lh}" style="font:${f.font}">${esc(l)}</text>`).join('');
    y += n.lines.length * f.lh;
    const hint = n.hintLines.map((l, i) => `<text class="mm-hint" x="${lx}" y="${y - 2 + i * 16}">${esc(l)}</text>`).join('');
    const cls = ['mm-node', `d${Math.min(n.depth, 3)}`, n.hue ? `hue-${n.hue}` : 'root', isLeaf ? 'leaf' : 'branch', done ? 'done' : '', n.open ? 'open' : 'shut'].join(' ');
    const count = !isLeaf && !n.open ? leaves(n).length : 0;
    const toggle = !isLeaf && n.depth > 0
      ? `<g class="mm-tog"><circle cx="${n.x + n.w}" cy="${n.y + n.h / 2}" r="10"/><text x="${n.x + n.w}" y="${n.y + n.h / 2 + 4}">${n.open ? '−' : count > 99 ? '99+' : count}</text></g>`
      : '';
    const check = isLeaf && n.depth > 0
      ? `<g class="mm-check"><circle cx="${n.x + PAD_X + 7}" cy="${n.y + n.h / 2}" r="8"/>${done ? `<path d="M${n.x + PAD_X + 3},${n.y + n.h / 2} l3,3 l6,-6"/>` : ''}</g>`
      : '';
    return `<g class="${cls}" data-mm="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(n.text)}${isLeaf ? (done ? ', পড়া হয়েছে' : ', পড়া বাকি') : n.open ? ', খোলা' : ', বন্ধ'}">
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.depth === 0 ? 16 : 12}"/>${check}${text}${hint}${toggle}</g>`;
  }

  find(id) {
    let hit = null;
    walk(this.root, (n) => { if (n.id === id) hit = n; });
    return hit;
  }

  // Tap: branches open/close (keeping the tapped node still on screen), leaves get ticked.
  activate(id) {
    const n = this.find(id);
    if (!n) return;
    if (n.children?.length) {
      if (n.depth === 0) return this.fit();
      const sx = n.x * this.view.k + this.view.x;
      const sy = (n.y + n.h / 2) * this.view.k + this.view.y;
      n.open = !n.open;
      this.render();
      this.view.y = sy - (n.y + n.h / 2) * this.view.k;
      // opening: slide the branch towards the left so its new topics come into view
      const r = this.host.getBoundingClientRect();
      this.view.x = n.open && sx > r.width * 0.3 ? 16 - n.x * this.view.k : sx - n.x * this.view.k;
      this.apply();
    } else {
      if (this.done.has(n.id)) this.done.delete(n.id); else this.done.add(n.id);
      this.onToggleDone?.(this.done);
      this.render();
    }
  }

  setAll(open) {
    walk(this.root, (n, d) => { n.open = d === 0 || open; });
    this.render();
    this.fit();
  }

  apply() {
    this.g.setAttribute('transform', `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`);
  }

  fit() {
    const r = this.host.getBoundingClientRect();
    if (!r.width) return;
    let maxX = 0;
    walk(this.root, (n) => { if (n.x != null && (n === this.root || this.visible(n))) maxX = Math.max(maxX, n.x + n.w); });
    const h = this.root.sub;
    // keep labels readable: never shrink below 55%; if it is still too big, pan instead
    const k = Math.min(1.1, Math.max(0.55, Math.min((r.width - 40) / (maxX + 20), (r.height - 60) / h)));
    const rootMid = this.root.y + this.root.h / 2;
    const y = h * k <= r.height - 40 ? (r.height - h * k) / 2 : r.height / 2 - rootMid * k;
    this.view = { k, x: 16, y };
    this.apply();
  }

  visible(n) {
    let ok = false;
    const go = (x) => { if (x === n) ok = true; else if (x.open) (x.children ?? []).forEach(go); };
    go(this.root);
    return ok;
  }

  zoom(f, cx, cy) {
    const r = this.host.getBoundingClientRect();
    cx ??= r.width / 2;
    cy ??= r.height / 2;
    const k = Math.min(2.5, Math.max(0.25, this.view.k * f));
    this.view.x = cx - ((cx - this.view.x) * k) / this.view.k;
    this.view.y = cy - ((cy - this.view.y) * k) / this.view.k;
    this.view.k = k;
    this.apply();
  }

  bindGestures() {
    const pts = new Map();
    let moved = false;
    let start = null;
    let pinch = null;
    const host = this.host;
    host.addEventListener('pointerdown', (e) => {
      host.parentElement?.classList.add('touched');
      host.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      start = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, target: e.target.closest('[data-mm]')?.dataset.mm ?? null };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.view.k };
      }
    });
    host.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const r = host.getBoundingClientRect();
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoom((pinch.k * d) / pinch.d / this.view.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        moved = true;
        return;
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) {
        this.view.x = start.vx + dx;
        this.view.y = start.vy + dy;
        this.apply();
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!moved && pts.size === 0 && start?.target) this.activate(start.target);
    };
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null; });
    host.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = host.getBoundingClientRect();
      this.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    host.addEventListener('keydown', (e) => {
      const id = e.target.closest?.('[data-mm]')?.dataset.mm;
      if (id && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.activate(id); }
    });
  }
}

// Cache-busting: stamp one version on the stylesheet, the entry script and every
// module import, so a phone can never mix new HTML with old cached CSS/JS.
// Run after changing anything in assets/:  node tools/bump-version.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const v = process.argv[2] ?? `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}

const edits = [];
const html = join(root, 'index.html');
let s = readFileSync(html, 'utf8');
s = s.replace(/(assets\/(?:css\/app\.css|js\/app\.js))(\?v=[\w-]*)?/g, `$1?v=${v}`);
writeFileSync(html, s);
edits.push('index.html');

for (const file of walk(join(root, 'assets/js'))) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(/(from\s+'\.{1,2}\/[^'?]+\.js)(\?v=[\w-]*)?'/g, `$1?v=${v}'`);
  if (out !== src) {
    writeFileSync(file, out);
    edits.push(file.slice(root.length + 1));
  }
}

// The service worker cache name follows the same version, so old caches are dropped, and
// its SHELL list (what is downloaded on install for offline use) is regenerated from assets/.
const rel = (f) => f.slice(root.length + 1).split('\\').join('/');
const files = (dir, ext) => readdirSync(join(root, dir)).filter((f) => ext.test(f)).map((f) => `${dir}/${f}`);
const shell = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', `assets/css/app.css?v=${v}`,
  ...walk(join(root, 'assets/js')).map((f) => `${rel(f)}?v=${v}`).sort(),
  ...files('assets/img', /\.(jpe?g|png|webp|svg)$/),
];
const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8')
  .replace(/const CACHE = '[^']*';/, `const CACHE = 'hscos-${v}';`)
  .replace(/const SHELL = \[[^\]]*\];/, `const SHELL = [\n${shell.map((u) => `  '${u}',`).join('\n')}\n];`);
writeFileSync(swPath, sw);
edits.push('sw.js');

console.log(`version ${v}:\n  ${edits.join('\n  ')}`);

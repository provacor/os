// Theme: dark by default, with light and follow-system options and a smooth switch.

const KEY = 'hscos:theme';
const media = matchMedia('(prefers-color-scheme: light)');

export function themePref() {
  try {
    return localStorage.getItem(KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

export function resolvedTheme(pref = themePref()) {
  return pref === 'system' ? (media.matches ? 'light' : 'dark') : pref;
}

export function applyTheme(animate = false) {
  const root = document.documentElement;
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-anim');
    setTimeout(() => root.classList.remove('theme-anim'), 400);
  }
  const t = resolvedTheme();
  root.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f4f6fa' : '#0a0c11');
}

export function setTheme(pref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(true);
}

export function toggleTheme() {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
}

media.addEventListener?.('change', () => themePref() === 'system' && applyTheme(true));

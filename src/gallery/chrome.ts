// What every gallery page shares and none of them should each rewrite: the search opener, ⌘K, and the
// reading-surface theme. Injected into the home page, the gallery page AND the shipped reader by
// scripts/lib/vite-gallery-surface.mjs, so it is small, touches no reader module, and loads the palette only on use.
import { applyStatic, onLocale } from '../locale.ts';

// ── the reading theme (paper) ────────────────────────────────────────────
// 'auto' follows the system, 'dark' keeps the navy, 'paper' forces the paper. Only .paperable regions use it.
export type ReadTheme = 'auto' | 'dark' | 'paper';
const KEY = 'ydh.read';
export function readTheme(): ReadTheme {
  try { const v = localStorage.getItem(KEY); if (v === 'dark' || v === 'paper') return v; } catch { /* blocked storage: follow the system */ }
  return 'auto';
}
export function setReadTheme(v: ReadTheme) {
  document.documentElement.dataset.read = v;
  try { localStorage.setItem(KEY, v); } catch { /* nothing to do */ }
  document.dispatchEvent(new CustomEvent('gx:read', { detail: v }));
}
document.documentElement.dataset.read = readTheme();

// ── search ────────────────────────────────────────────────────────────────
let palette: Promise<typeof import('./search.ts')> | null = null;
export function openSearch(initial = '') {
  palette ??= import('./search.ts');
  void palette.then((m) => m.openSearch(initial));
}
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-gx-search]');
  if (el) { e.preventDefault(); openSearch(); }
});
document.addEventListener('gx:search', () => openSearch());
document.addEventListener('keydown', (e) => {
  const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openSearch(); }
});

// the bar's own words follow the language (data-en / data-zh); the pages re-apply theirs
const nav = document.querySelector('.sitenav');
if (nav) { applyStatic(nav); onLocale(() => applyStatic(nav)); }
const bar = document.querySelector('.tabbar');
if (bar) { applyStatic(bar); onLocale(() => applyStatic(bar)); }

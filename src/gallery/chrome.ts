// What every gallery page shares and none of them should each rewrite: the search opener, ⌘K, and the
// reading-surface theme. Injected into the home page, the gallery page AND the shipped reader by
// scripts/lib/vite-gallery-surface.mjs, so it is small, touches no reader module, and loads the palette only on use.
import { applyStatic, onLocale } from '../locale.ts';

// ── the reading theme (paper) ────────────────────────────────────────────
// One setting for the whole site, kept in the reader's own preference record ('yr.prefs.v1', field `theme`) so the
// picture page's passage, the Bible page and the home page's switch always agree. 'auto' follows the system, 'dark'
// keeps the navy, 'light' and 'paper' are the reader's two light grounds. Only the reading surfaces use it: the home
// page and the gallery stay dark because the plates were drawn to sit on dark. html[data-read] mirrors it for CSS.
export type ReadTheme = 'auto' | 'dark' | 'light' | 'paper';
const PREFS = 'yr.prefs.v1';
const THEMES: readonly ReadTheme[] = ['auto', 'dark', 'light', 'paper'];
export function readTheme(): ReadTheme {
  try {
    const v = (JSON.parse(localStorage.getItem(PREFS) ?? '{}') as { theme?: string }).theme;
    if (THEMES.includes(v as ReadTheme)) return v as ReadTheme;
  } catch { /* blocked storage or a damaged record: follow the system */ }
  return 'auto';
}
/** `save` false = the reader module has already saved it (its own record is the one source). */
export function setReadTheme(v: ReadTheme, save = true) {
  document.documentElement.dataset.read = v;
  if (save) {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Record<string, unknown>;
      localStorage.setItem(PREFS, JSON.stringify({ ...p, theme: v }));
    } catch { /* nothing to do */ }
  }
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

// ── the installable app (docs/gallery-pwa.md) ─────────────────────────────────────────────────────────────
// Chromium offers its install prompt once, early; it is kept here (and its own banner held back) so the home page's "Install" entry
// (install.ts) can use it whenever the reader asks. The worker and the update notice load after the page has finished.
export interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export const install: { event: InstallEvent | null } = { event: null };
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  install.event = e as InstallEvent;
  document.dispatchEvent(new CustomEvent('gx:installable'));
});
window.addEventListener('appinstalled', () => { install.event = null; document.dispatchEvent(new CustomEvent('gx:installed')); });
if (import.meta.env.PROD && import.meta.env.VITE_TARGET !== 'shell' && 'serviceWorker' in navigator) {
  const go = () => void import('./pwa.ts').then((m) => m.start());
  const idle = () => ('requestIdleCallback' in window ? window.requestIdleCallback(go, { timeout: 4000 }) : setTimeout(go, 1500));
  if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
}

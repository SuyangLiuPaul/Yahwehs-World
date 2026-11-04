// What every gallery page shares and none of them should each rewrite: the search opener, ⌘K, and the
// reading-surface theme. Injected into the home page, the gallery page AND the shipped reader by
// scripts/lib/vite-gallery-surface.mjs, so it is small, touches no reader module, and loads the palette only on use.
import { applyStatic, onLocale } from '../locale.ts';
import { mountLangMenu } from './lang.ts';

// ── the reading surface ──────────────────────────────────────────────────
// One setting for the whole site, kept in the reader's own preference record ('yr.prefs.v1', field `theme`) so the
// picture page's passage, the Bible page and the home page's switch always agree. 'auto' follows the system, 'dark'
// keeps the navy, 'light' and 'paper' are the two light grounds.
//
// IT NOW PAINTS EVERY SURFACE, not only the reading column. The release shipped with "home and gallery stay dark
// because the plates were drawn to sit on dark" (Fable, 2026-11-03), which left the control in the home footer doing
// nothing at all on the page it lives on — the owner pressed Paper and the page did not move (P0-6). A control that
// appears to do nothing is worse than no control. The plates keep their look: a picture is never recoloured, it is
// given a thin neutral matte on the light grounds so it sits on the page instead of floating (--plate-mat, chrome.css).
//
// TWO ATTRIBUTES, because 'auto' is a preference and not a colour:
//   html[data-read]  what the reader CHOSE: auto | dark | light | paper. The switch's aria-pressed reads this.
//   html[data-surf]  what that RESOLVES to right now: dark | light | paper. Every stylesheet reads this, and the
//                    system listener below rewrites it live, so System really does follow the system.
// 'auto' resolves to paper rather than light on a light system, which is what the reader module's own resolveTheme
// has always done (src/reader/chrome.ts): one answer, or the chapter and the page around it disagree.
export type ReadTheme = 'auto' | 'dark' | 'light' | 'paper';
export type Surface = 'dark' | 'light' | 'paper';
const PREFS = 'yr.prefs.v1';
const THEMES: readonly ReadTheme[] = ['auto', 'dark', 'light', 'paper'];
const SYSTEM_DARK = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function readTheme(): ReadTheme {
  try {
    const v = (JSON.parse(localStorage.getItem(PREFS) ?? '{}') as { theme?: string }).theme;
    if (THEMES.includes(v as ReadTheme)) return v as ReadTheme;
  } catch { /* blocked storage or a damaged record: follow the system */ }
  return 'auto';
}

export const resolveSurface = (v: ReadTheme): Surface => (v !== 'auto' ? v : SYSTEM_DARK?.matches === false ? 'paper' : 'dark');

/** The address bar / status bar colour of the surface in use. The manifests cannot change per theme (one static file
 *  each), so they stay on the brand navy; this meta is what a browser actually paints while the page is open. */
const THEME_COLOR: Record<Surface, string> = { dark: '#0e2b4b', light: '#f8f9fb', paper: '#f4efe4' };

function paintSurface(v: ReadTheme) {
  const d = document.documentElement;
  const s = resolveSurface(v);
  d.dataset.read = v;
  d.dataset.surf = s;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR[s];
}

/** `save` false = the reader module has already saved it (its own record is the one source). */
export function setReadTheme(v: ReadTheme, save = true) {
  paintSurface(v);
  if (save) {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Record<string, unknown>;
      localStorage.setItem(PREFS, JSON.stringify({ ...p, theme: v }));
    } catch { /* nothing to do */ }
  }
  document.dispatchEvent(new CustomEvent('gx:read', { detail: v }));
}
paintSurface(readTheme());
// System, live: rotating the phone into dark mode repaints the page under the reader's hands.
SYSTEM_DARK?.addEventListener?.('change', () => { if (readTheme() === 'auto') paintSurface('auto'); });

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
// the globe menu: one 44 px control for the four readings, wired here so all three pages get the same one
mountLangMenu(nav?.querySelector<HTMLElement>('.lang-menu') ?? null);
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

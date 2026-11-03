// The installable app, page side: register the worker, tell the reader when a new version is ready, save what the first visit
// loaded before the worker could see it, ask for durable storage politely, and keep the home-screen label in the reader's language.
// Loaded once, after the page has finished loading (src/gallery/chrome.ts), and only in a production build. docs/gallery-pwa.md.
import { onLocale, t } from '../locale.ts';
import { shouldOfferUpdate } from '../pwa/core.ts';
import { ask } from './pwa-bridge.ts';

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
const pageBuild = meta('ydh-build')?.content ?? '';
const day = () => Math.floor(Date.now() / 864e5);
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };

let reloading = false;
let lastCheck = Date.now();

export async function start(): Promise<void> {
  const sw = navigator.serviceWorker;
  const wasControlled = !!sw.controller;
  let reg: ServiceWorkerRegistration;
  try { reg = await sw.register('/sw.js', { scope: '/', updateViaCache: 'none' }); } catch { return; }
  if (!reg) return; // a browser that blocks workers (a test, a privacy setting) can answer with nothing

  sw.addEventListener('controllerchange', () => {
    if (reloading) { location.reload(); return; }
    if (!wasControlled) void adopt(); // the first visit: the worker has just taken over this page
  });
  if (!wasControlled && sw.controller) void adopt();

  const check = () => { if (reg.waiting && sw.controller) void offer(reg.waiting); };
  check();
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => { if (w.state === 'installed') check(); });
  });
  // a deploy is noticed while the app stays open: on return to the tab, and once an hour
  const refresh = () => { lastCheck = Date.now(); void reg.update().catch(() => {}); };
  if (wasControlled) refresh();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 30 * 60e3) refresh(); });
  setInterval(refresh, 3600e3);

  persistPolitely();
  labels();
  onLocale(labels);
  matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => {
    if (e.matches) document.documentElement.dataset.display = 'standalone'; else delete document.documentElement.dataset.display;
  });
}

// ── the first visit ───────────────────────────────────────────────────────────────────────────────────────────────
/** What this page fetched before the worker controlled it (its pictures, its Bible data) is handed over to be saved, so "open it once, then it works offline" holds for the first visit too. */
async function adopt() {
  const urls = [...new Set(performance.getEntriesByType('resource').map((r) => r.name))]
    .filter((u) => u.startsWith(location.origin + '/pictures/') || u.startsWith(location.origin + '/data/') || u.startsWith('https://fonts.gstatic.com/'))
    .slice(-60);
  if (urls.length) navigator.serviceWorker.controller?.postMessage({ type: 'adopt', urls });
}

// ── update ready ──────────────────────────────────────────────────────────────────────────────────────────────────
async function offer(w: ServiceWorker) {
  const r = await ask<{ build: string }>(w, { type: 'get-build' });
  if (r?.build && r.build === pageBuild) {
    // this page already is the new build (it came from the network after the deploy): the worker can take over now, unless another tab
    // is still running the old build, which needs its own scripts from the old worker
    w.postMessage({ type: 'activate-if-alone' });
    return;
  }
  if (!shouldOfferUpdate(pageBuild, r?.build ?? null)) return;
  if (document.querySelector('.gx-update')) return;
  const bar = document.createElement('div');
  bar.className = 'gx-update';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.innerHTML = '<span class="u-t"></span><button type="button" class="gx-btn primary sm u-go"></button><button type="button" class="gx-iconbtn u-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
  const words = () => {
    bar.querySelector('.u-t')!.textContent = t('A new version is ready.', '新版本已准备好。', 'Доступна новая версия.');
    bar.querySelector('.u-go')!.textContent = t('Reload', '刷新', 'Обновить');
    bar.querySelector('.u-x')!.setAttribute('aria-label', t('Not now', '稍后', 'Позже'));
  };
  words();
  onLocale(words);
  bar.querySelector('.u-go')!.addEventListener('click', () => {
    reloading = true;
    w.postMessage({ type: 'skip-waiting' });
    setTimeout(() => location.reload(), 3000); // if the swap is slow, reloading still lands on the new version
  });
  bar.querySelector('.u-x')!.addEventListener('click', () => bar.remove());
  document.body.append(bar);
}

// ── durable storage, asked for once, late, and only of someone who keeps coming back ──────────────────────────
function persistPolitely() {
  const s = navigator.storage;
  if (!s?.persist) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  let seen: number[] = [];
  try { seen = JSON.parse(get('ydh.pwa.days') ?? '[]') as number[]; } catch { /* reset */ }
  if (!seen.includes(day())) { seen = [...seen, day()].slice(-30); set('ydh.pwa.days', JSON.stringify(seen)); }
  const last = Number(get('ydh.pwa.persist') ?? 0);
  if (last && day() - last < 14) return;                 // asked recently: not again
  if (!standalone && seen.length < 3) return;            // not yet someone who comes back
  void s.persisted().then((p) => p || s.persist()).then(() => set('ydh.pwa.persist', String(day()))).catch(() => {});
}

// ── the label under the icon follows the language (iOS reads it when the page is added) ───────────────────────
function labels() {
  const m = meta('apple-mobile-web-app-title');
  if (m) m.content = t("Yahweh's World", '雅偉之界', 'Мир Яхве');
  const l = document.documentElement.lang;
  const link = document.getElementById('pwa-manifest') as HTMLLinkElement | null;
  if (link) link.href = l === 'zh-Hans' || l === 'zh-Hant' || l === 'ru' ? `/manifest.${l}.webmanifest` : '/manifest.webmanifest';
}

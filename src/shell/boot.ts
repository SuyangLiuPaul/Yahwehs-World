// The native shell's start-up, added to the three pages only by the shell build (scripts/lib/vite-shell-target.mjs).
// It is the one file that knows the page is inside an app; the pages themselves ask the platform layer (src/platform/) for
// anything that differs between the web and a shell, and a feature never imports this file.
//
//   1. tells the CSS what it is running in:  <html data-shell="ios|android|macos|windows|linux" data-channel="store|direct">
//   2. switches the web-font stylesheet on (the site's inline onload handler is not allowed by the app's content-security policy)
//   3. opens links the OS hands to the app (src/shell/deeplink.ts)
//   4. starts the offline-pack manager, so a full picture that is stored on the device is shown from the device (media.ts localFull)
//   5. adds the "Offline pictures" entry (a feature module: src/features/packs; STUB UI, see docs/gallery-shells.md)
//   6. on a direct-download build only (never a store build: a store app must not offer a download elsewhere) checks for a newer release
import { getPlatform } from '../platform/index.ts';
import { createPackManager, parseManifest, type PackManager } from '../core/packs.ts';
import { localFull } from '../gallery/media.ts';
import { channelOf } from '../config/site.ts';
import { routeForDeepLink } from './deeplink.ts';
import { toast } from '../gallery/sheet.ts';
import { onLocale, t } from '../locale.ts';
import type { Platform } from '../platform/types.ts';

let manager: PackManager | null = null;

async function openPacks(platform: Platform) {
  const { packsFeature } = await import('../features/packs/index.ts');
  const mod = await packsFeature.load();
  mod.mount(null, { platform, locale: () => document.documentElement.lang || 'en' });
}

function follow(raw: string, platform: Platform) {
  const target = routeForDeepLink(raw);
  if (!target) return;
  if (target.kind === 'packs') { void openPacks(platform); return; }
  location.assign(target.href);
}

function addPacksEntry(platform: Platform) {
  const nav = document.querySelector('.sitenav');
  const host = nav?.querySelector('.lang-switch');
  if (!nav || !host || nav.querySelector('[data-shell-packs]')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gx-iconbtn';
  b.dataset.shellPacks = '';
  b.setAttribute('aria-haspopup', 'dialog');
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/></svg>';
  const label = () => t('Offline pictures', '离线图片', 'Офлайн-картины');
  b.setAttribute('aria-label', label());
  b.title = label();
  b.addEventListener('click', () => void openPacks(platform));
  host.before(b);
  onLocale(() => { b.setAttribute('aria-label', label()); b.title = label(); });
}

async function startPacks(platform: Platform) {
  try {
    const res = await fetch('/data/packs.json');
    if (!res.ok) throw new Error(`packs.json ${res.status}`);
    manager = createPackManager({ platform, manifest: parseManifest(await res.json()) });
    await manager.refresh();
    localFull.url = (id) => manager?.localFullUrl(id) ?? null;
  } catch (e) {
    // A missing pack manifest must never stop the app: every picture still loads from the site.
    console.warn('[shell] offline packs unavailable', e);
  }
}

async function boot() {
  document.querySelectorAll<HTMLLinkElement>('link[data-late-font]').forEach((l) => { l.media = 'all'; });
  const platform = await getPlatform();
  const root = document.documentElement;
  root.dataset.shell = platform.info.os;
  root.dataset.channel = channelOf(import.meta.env);

  platform.deepLinks.onOpen((url) => follow(url, platform));
  void platform.deepLinks.current().then((url) => { if (url) follow(url, platform); }).catch(() => {});

  addPacksEntry(platform);
  void startPacks(platform);

  if (platform.capabilities.updates && channelOf(import.meta.env) === 'direct') {
    void platform.updates.check().then((u) => {
      if (!u) return;
      root.dataset.updateAvailable = u.version;
      // STUB wording (reader-visible; needs the Opus medium review)
      toast(t(`Version ${u.version} is available`, `有新版本 ${u.version}`, `Доступна версия ${u.version}`));
    }).catch(() => {});
  }
}

void boot();

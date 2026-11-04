// The native shell's start-up, added to the three pages only by the shell build (scripts/lib/vite-shell-target.mjs).
// It is the one file that knows the page is inside an app; the pages themselves ask the platform layer (src/platform/) for
// anything that differs between the web and a shell, and a feature never imports this file.
//
//   1. tells the CSS what it is running in:  <html data-shell="ios|android|macos|windows|linux" data-channel="store|direct">
//   2. switches the web-font stylesheet on (the site's inline onload handler is not allowed by the app's content-security policy)
//   3. opens links the OS hands to the app (src/shell/deeplink.ts)
//   4. starts the offline-pack manager, so a full picture that is stored on the device is shown from the device (media.ts localFull)
//   5. on a direct-download build only (never a store build: a store app must not offer a download elsewhere) checks for a newer release
import { getPlatform } from '../platform/index.ts';
import { createPackManager, parseManifest, type PackManager } from '../core/packs.ts';
import { localFull } from '../gallery/media.ts';
import { channelOf } from '../config/site.ts';
import { routeForDeepLink } from './deeplink.ts';
import { toast } from '../gallery/sheet.ts';
import { t } from '../locale.ts';
import type { Platform } from '../platform/types.ts';

let manager: PackManager | null = null;

// THE "OFFLINE PICTURES" SHEET IS NOT HERE ANY MORE, on purpose.
//
// It was a button in the top bar opening an unstyled stub: label and value on separate lines at body size, the
// "download all" line as a bare indented text run with no button, a 150 px gold close ring out of scale with every
// other control, and "0.0 MiB / capacity unknown" where storage.estimate() had failed. No progress, no cancel, no
// "may be cleared by the system" line (P1-5). The owner's standard for this version is that nothing ships as a stub,
// and the feature needs a mock-up reviewed before it is built (the premium bar), so the ENTRY is gone until it is real.
//
// What stays is src/core/packs.ts, the pack manager, because it is not a stub: it reads the manifest, finds the
// pictures already stored on the device and makes media.ts serve those from the device instead of the network.
function follow(raw: string, platform: Platform) {
  void platform;
  const target = routeForDeepLink(raw);
  if (!target) return;
  location.assign(target.href);
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

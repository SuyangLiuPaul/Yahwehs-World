import type { OsName, Platform } from './types.ts';
import { abortCheck, downloadBytes, externalUrl, relativePath, shareWith } from './web.ts';
import type { ShareWeb } from './web.ts';

type SettingsStore = Pick<import('@tauri-apps/plugin-store').Store, 'get' | 'set' | 'delete' | 'save'>;
export interface TauriDeps {
  core?: Pick<typeof import('@tauri-apps/api/core'), 'convertFileSrc'>;
  path?: Pick<typeof import('@tauri-apps/api/path'), 'appLocalDataDir' | 'join'>;
  fs?: Pick<typeof import('@tauri-apps/plugin-fs'), 'writeFile' | 'readDir' | 'exists' | 'remove' | 'mkdir' | 'stat'> & Partial<Pick<typeof import('@tauri-apps/plugin-fs'), 'readFile'>>;
  store?: { load(file: string): Promise<SettingsStore> };
  opener?: Pick<typeof import('@tauri-apps/plugin-opener'), 'openUrl'>;
  os?: { platform(): string; version(): string; arch(): string; locale(): Promise<string | null> };
  app?: Pick<typeof import('@tauri-apps/api/app'), 'getVersion'>;
  deepLink?: Pick<typeof import('@tauri-apps/plugin-deep-link'), 'onOpenUrl' | 'getCurrent'>;
  fetch?: typeof fetch;
  shareWeb?: ShareWeb;
  channel?: 'store' | 'direct';
  releasesApi?: string;
  isTablet?: boolean;
}

export async function createTauriPlatform(deps: TauriDeps = {}): Promise<Platform> {
  const [core, path, fs, storeModule, opener, os, app, deepLink] = await Promise.all([
    deps.core ?? import('@tauri-apps/api/core'), deps.path ?? import('@tauri-apps/api/path'),
    deps.fs ?? import('@tauri-apps/plugin-fs'), deps.store ?? import('@tauri-apps/plugin-store'),
    deps.opener ?? import('@tauri-apps/plugin-opener'), deps.os ?? import('@tauri-apps/plugin-os'),
    deps.app ?? import('@tauri-apps/api/app'), deps.deepLink ?? import('@tauri-apps/plugin-deep-link'),
  ]);
  const [root, store, appVersion, locale] = await Promise.all([path.appLocalDataDir(), storeModule.load('yw-settings.json'), app.getVersion(), os.locale()]);
  const fetcher = deps.fetch ?? globalThis.fetch;
  const shareWeb = deps.shareWeb ?? globalThis.navigator ?? {};
  const channel = deps.channel ?? 'direct';
  const rawIndex = await store.get<Record<string, number>>('files.index');
  const index: Record<string, number> = Object.create(null);
  const absolute = new Map<string, string>();
  async function filePath(dest: string) {
    relativePath(dest);
    const result = await path.join(root, ...dest.split('/'));
    absolute.set(dest, result);
    return result;
  }
  for (const [dest, size] of Object.entries(rawIndex ?? {})) {
    try { await filePath(dest); if (Number.isFinite(size) && size >= 0) index[dest] = size; } catch { /* Ignore malformed persisted entries. */ }
  }
  // Serialise index snapshots: parallel downloads must not save stale copies over each other.
  let queue: Promise<unknown> = Promise.resolve();
  function mutateIndex(change: () => void): Promise<void> {
    const operation = queue.then(async () => {
      const previous = { ...index };
      change();
      try { await store.set('files.index', { ...index }); await store.save(); }
      catch (error) {
        for (const key of Object.keys(index)) delete index[key];
        Object.assign(index, previous);
        throw error;
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }
  const bytesUsed = async () => { await queue; return Object.values(index).reduce((a, b) => a + b, 0); };
  const osValue = os.platform();
  const osName: OsName = ['ios', 'android', 'macos', 'windows', 'linux'].includes(osValue) ? osValue as OsName : 'linux';
  const mobile = osName === 'ios' || osName === 'android';
  return {
    kind: 'tauri',
    info: { kind: 'tauri', os: osName, osVersion: os.version(), arch: os.arch(), appVersion, locale: locale ?? 'en', channel, formFactor: mobile ? deps.isTablet ? 'tablet' : 'phone' : 'desktop' },
    capabilities: { files: true, share: !!(shareWeb.share || shareWeb.clipboard), notifications: false, deepLinks: true, updates: channel === 'direct', persistentStorage: true },
    storage: {
      async get(key) { return await store.get<string>(key) ?? null; },
      async set(key, value) { await store.set(key, value); await store.save(); },
      async remove(key) { await store.delete(key); await store.save(); },
    },
    files: {
      async download(url, dest, progress, signal) {
        const target = await filePath(dest);
        const { data } = await downloadBytes(fetcher, url, progress, signal);
        abortCheck(signal);
        const parent = await path.join(root, ...dest.split('/').slice(0, -1));
        await fs.mkdir(parent, { recursive: true });
        abortCheck(signal);
        try {
          await fs.writeFile(target, data);
          abortCheck(signal);
          await mutateIndex(() => { index[dest] = data.byteLength; });
          abortCheck(signal);
        } catch (error) {
          // A failed write may leave bytes on disk; it must never be offered as a complete file.
          if (await fs.exists(target)) await fs.remove(target);
          await mutateIndex(() => { delete index[dest]; });
          throw error;
        }
        return { bytes: data.byteLength };
      },
      async exists(dest) { await queue; return Object.hasOwn(index, relativePath(dest)) && await fs.exists(await filePath(dest)); },
      async remove(dest) {
        const target = await filePath(dest);
        if (await fs.exists(target)) await fs.remove(target);
        await mutateIndex(() => { delete index[dest]; });
      },
      async list(dir) {
        const target = await filePath(dir);
        if (!await fs.exists(target)) return [];
        // only files this adapter wrote and indexed: a half-written file from a crashed run is not "stored"
        return (await fs.readDir(target)).filter(e => e.isFile && Object.hasOwn(index, `${dir}/${e.name}`)).map(e => e.name);
      },
      bytesUsed,
      async estimate() { return { usage: await bytesUsed(), quota: null }; },
      url(dest) { return Object.hasOwn(index, dest) && absolute.has(dest) ? core.convertFileSrc(absolute.get(dest)!) : null; },
      async read(dest) {
        if (!fs.readFile) throw new Error('File readback unavailable');
        const data = await fs.readFile(await filePath(dest));
        return data.slice().buffer as ArrayBuffer;
      },
    },
    // No native share plugin exists yet; use Web Share or the webview clipboard.
    share: p => shareWith(shareWeb, p),
    async openExternal(url) { await opener.openUrl(externalUrl(url)); },
    deepLinks: {
      onOpen(cb) {
        let active = true; let unlisten: (() => void) | undefined;
        void deepLink.onOpenUrl(urls => { if (active) urls.forEach(cb); }).then(fn => { if (active) unlisten = fn; else fn(); }).catch(() => { /* Unsupported plugin registration has no active listener. */ });
        return () => { active = false; unlisten?.(); unlisten = undefined; };
      },
      async current() { return (await deepLink.getCurrent())?.[0] ?? null; },
    },
    updates: {
      async check() {
        if (channel === 'store') return null;
        try {
          const r = await fetcher(deps.releasesApi ?? 'https://api.github.com/repos/SuyangLiuPaul/Yahwehs-World/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
          if (!r.ok) return null;
          const release = await r.json();
          if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') return null;
          const version = release.tag_name.replace(/^v/, '');
          const triplet = (v: string) => /^\d+\.\d+\.\d+/.exec(v)?.[0].split('.').map(Number);
          const latest = triplet(version); const current = triplet(appVersion);
          if (!latest || !current) return null;
          for (let i = 0; i < 3; i++) {
            if (latest[i]! > current[i]!) return { version, url: externalUrl(release.html_url) };
            if (latest[i]! < current[i]!) return null;
          }
          return null;
        } catch { return null; }
      },
      async apply(info) { await opener.openUrl(externalUrl(info.url)); },
    },
  };
}

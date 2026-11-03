import type { Platform } from './types.ts';

let memo: Promise<Platform> | null = null;
let override: Platform | null = null;

/** The platform of the page that is running: the Tauri adapter inside a native shell, the web adapter anywhere else. */
export function getPlatform(): Promise<Platform> {
  if (override) return Promise.resolve(override);
  if (!memo) {
    const pending = (async () => {
      const { isTauri } = await import('@tauri-apps/api/core');
      if (isTauri()) {
        const [{ createTauriPlatform }, { channelOf }, http] = await Promise.all([import('./tauri.ts'), import('../config/site.ts'), import('@tauri-apps/plugin-http')]);
        const channel = channelOf(import.meta.env);
        return createTauriPlatform({
          // Downloads go through the HTTP plugin: made from Rust, so the site needs no CORS header for the app's origin.
          // (capabilities/default.json limits it to SITE_HOST and the releases API.)
          fetch: http.fetch as typeof fetch,
          channel: channel === 'store' ? 'store' : 'direct',
          isTablet: Math.min(screen.width, screen.height) >= 600,
        });
      }
      return (await import('./web.ts')).createWebPlatform();
    })();
    memo = pending;
    void pending.catch(() => { if (memo === pending) memo = null; });
  }
  return memo;
}
export function setPlatformForTests(p: Platform | null): void { override = p; memo = null; }

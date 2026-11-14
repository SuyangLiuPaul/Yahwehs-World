import type { WalkHome } from './specs-lite.ts';

interface WalkMeasuresOptions {
  walk: WalkHome;
  dialog: HTMLDialogElement;
  openers: (Element | null)[];
  beforeOpen?: () => void;
  fallbackIds?: readonly string[];
}

/**
 * Defers downloading panel.ts, specs.ts, and all 3D structure builders until a
 * reader opens the Measures dialog or arrives on `#measures=...`. Keeps every
 * walk's first-view JS bundle slim.
 */
export function installWalkMeasures({
  walk,
  dialog,
  openers,
  beforeOpen,
  fallbackIds,
}: WalkMeasuresOptions): void {
  let installed: Promise<{ open: (id?: string) => void }> | null = null;
  let loaded = false;

  const ensureInstalled = () => {
    if (!installed) {
      installed = Promise.all([
        import('./panel.ts'),
        import('./specs.ts'),
      ]).then(([{ installMeasures }, { STRUCTURES, structuresFor }]) => {
        const direct = structuresFor(walk);
        const cards = direct.length || !fallbackIds?.length
          ? direct
          : STRUCTURES.filter((s) => fallbackIds.includes(s.id));
        const api = installMeasures({
          cards,
          dialog,
          openers: [],
          beforeOpen,
        });
        loaded = true;
        return api;
      });
    }
    return installed;
  };

  const openLazy = (id?: string) => {
    beforeOpen?.();
    const alreadyLoaded = loaded;
    void ensureInstalled().then((api) => {
      if (alreadyLoaded || !/^#measures(?:=|$)/.test(location.hash)) {
        api.open(id);
      }
    });
  };

  for (const el of openers) {
    el?.addEventListener('click', () => openLazy());
  }

  const checkHash = () => {
    const m = /^#measures(?:=(.+))?$/.exec(location.hash);
    if (!m) return;
    if (!loaded) openLazy(m[1] || undefined);
  };

  checkHash();
  addEventListener('hashchange', checkHash);
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Baked in by tools/release_web.sh; carries a dev-build suffix
   *  (".<commits since last tag>") on a dev deploy, absent on a release.
   *  Display-only — see src/updates.ts. */
  readonly VITE_DISPLAY_VERSION?: string;
  /** 'gallery' builds the picture-gallery surface (home, scenes, reader); anything else the full site. See vite.config.ts. */
  readonly VITE_SURFACE?: 'gallery' | 'full';
  /** Where the pictures are served from; empty = this site's own /pictures/. */
  readonly VITE_SCENES_HOST?: string;
  /** 'shell' builds the content of the native apps (scripts/shell-dist.mjs): thumbnails bundled, full pictures and /api from the site. */
  readonly VITE_TARGET?: 'web' | 'shell';
  /** How a shell build reaches the reader: 'store' (the store updates it) or 'direct' (GitHub release / DMG / installer). */
  readonly VITE_SHELL_CHANNEL?: 'store' | 'direct';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

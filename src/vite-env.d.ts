/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Baked in by tools/release_web.sh; carries a dev-build suffix
   *  (".<commits since last tag>") on a dev deploy, absent on a release.
   *  Display-only — see src/updates.ts. */
  readonly VITE_DISPLAY_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

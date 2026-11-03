// The native shells' build target: `VITE_TARGET=shell` (with VITE_SURFACE=gallery). One flag, three differences from the website build:
//
//   PICTURES   public/pictures/full (204 MiB) is not copied into the bundle. The shells carry the thumbnails, the pages and the Bible
//              data; every full picture is fetched from SITE_HOST (src/config/site.ts) or read from the offline pack.
//   BOOT       src/shell/boot.ts is added to the three pages: platform detection, deep links, the offline-pack entry, the update check
//              of a direct-download build.
//   FONTS      the website loads its web-font stylesheet with an inline onload handler; the app's content-security policy forbids
//              inline handlers, so the link is marked and boot.ts switches it on. Offline the stylesheet simply never arrives and the
//              system faces show (self-hosted fonts are on the follow-up list, docs/gallery-shells.md).
//
// Everything else the website build does is left alone; scripts/shell-dist.mjs then removes what only a website needs (sitemap,
// share stubs, redirects, service worker) and writes data/packs.json.
export const TARGET = process.env.VITE_TARGET === 'shell' ? 'shell' : 'web';
export const OUT_DIR = process.env.VITE_OUT_DIR || 'dist';

/** Relative paths inside public/ that the shell bundle does not carry (a name matches itself and everything below it). */
export const SHELL_EXCLUDE = ['pictures/full'];
export const isShellExcluded = (rel) => TARGET === 'shell' && SHELL_EXCLUDE.some((x) => rel === x || rel.startsWith(`${x}/`));

export const FONT_ONLOAD = `onload="this.media='all'"`;

export function shellHtml(html) {
  html = html.replaceAll(FONT_ONLOAD, 'data-late-font');
  // the <noscript> twin of the font link: the app always has scripts
  html = html.replace(/\s*<noscript><link href="https:\/\/fonts\.googleapis\.com[^>]*><\/noscript>/g, '');
  if (!html.includes('/src/shell/boot.ts')) html = html.replace('</body>', '  <script type="module" src="/src/shell/boot.ts"></script>\n</body>');
  html = html.replace(/<html([^>]*)>/, (m, a) => (a.includes('data-target') ? m : `<html${a} data-target="shell">`));
  return html;
}

/** vite plugins for the shell target; [] on the website build so nothing else changes. */
export function shellTarget() {
  if (TARGET !== 'shell') return [];
  return [{
    name: 'shell-target',
    transformIndexHtml: { order: 'pre', handler: (html) => shellHtml(html) },
  }];
}

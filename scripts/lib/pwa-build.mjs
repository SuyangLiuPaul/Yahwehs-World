// Makes the gallery installable: after `vite build` has written dist/, this adds
//
//   dist/sw.js                        the service worker (src/pwa/sw.ts bundled by esbuild, which Vite already depends on)
//   dist/offline.html                 the page a navigation gets when the network is down and nothing is saved for it
//   dist/manifest.webmanifest         the web app manifest in English, and manifest.zh-Hans / zh-Hant / ru.webmanifest
//   <meta name="ydh-build">           in the three pages: the id the page tells the worker apart from (__YDH_BUILD__ -> the id)
//
// It also decides the precache (the pages, /assets/*, the brand images, the three small data files) and the build id, the
// hash of every byte in it plus the worker's own source, so any change to the shell is a new worker and nothing else is.
// Called from scripts/lib/vite-gallery-surface.mjs at the end of a gallery build, and from scripts/build-pwa.mjs on any dist
// directory (scripts/verify-pwa.mjs uses that to simulate a deploy). Design: docs/gallery-pwa.md.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

export const NAME_FULL = "雅偉之界 / Yahweh's World";
export const THEME_COLOR = '#0e2b4b';      // the bar: dark in every reading theme (only the reader's text surface turns light or paper)
export const BACKGROUND_COLOR = '#0a1e36'; // the page ground, the colour the opening screen paints
export const BUILD_PLACEHOLDER = '__YDH_BUILD__';
export const PAGES = ['/index.html', '/scenes.html', '/bible.html'];
export const SHELL_MAX = 4 * 1024 * 1024;  // keep in step with src/pwa/core.ts

/** One entry per reading. The official name stays 雅偉之界 in every manifest; the short name (the label under the icon) follows the language. */
export const LANGS = {
  en: {
    file: 'manifest.webmanifest', lang: 'en', short: "Yahweh's World",
    description: '1,443 scenes of the Bible, each one drawn and opening onto the verses it comes from. Pages you have opened work offline.',
    shortcuts: [['Home', '/'], ['Scenes', '/scenes.html'], ['Bible', '/bible.html']],
  },
  'zh-Hans': {
    file: 'manifest.zh-Hans.webmanifest', lang: 'zh-Hans', short: '雅偉之界',
    description: '圣经里的 1,443 个时刻，每一幕都画了出来，并打开它所出自的经文。看过的页面可离线阅读。',
    shortcuts: [['首页', '/'], ['画卷', '/scenes.html'], ['圣经', '/bible.html']],
  },
  'zh-Hant': {
    file: 'manifest.zh-Hant.webmanifest', lang: 'zh-Hant', short: '雅偉之界',
    description: '聖經裡的 1,443 個時刻，每一幕都畫了出來，並打開它所出自的經文。看過的頁面可離線閱讀。',
    shortcuts: [['首頁', '/'], ['畫卷', '/scenes.html'], ['聖經', '/bible.html']],
  },
  ru: {
    file: 'manifest.ru.webmanifest', lang: 'ru', short: 'Мир Яхве',
    description: '1 443 сцены Библии: каждая нарисована и открывает стихи, из которых она взята. Открытые страницы работают без сети.',
    shortcuts: [['Главная', '/'], ['Сцены', '/scenes.html'], ['Библия', '/bible.html']],
  },
};

export const ICONS = [
  { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  { src: '/pwa/monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
];

export function manifestFor(key) {
  const L = LANGS[key];
  return {
    id: '/',
    name: NAME_FULL,
    short_name: L.short,
    description: L.description,
    lang: L.lang,
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    categories: ['books', 'education', 'lifestyle'],
    prefer_related_applications: false,
    icons: ICONS,
    shortcuts: L.shortcuts.map(([name, url]) => ({ name, short_name: name, url, icons: [{ src: '/pwa/shortcut-96.png', sizes: '96x96', type: 'image/png' }] })),
  };
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** [[path, revision], ...]: what the worker saves at install. Sorted, so the same dist gives the same list. */
export function collectPrecache(dist) {
  const paths = [...PAGES, '/offline.html', '/brand-logo.webp', '/favicon.png', '/icon-sm.svg', '/apple-touch-icon.png',
    '/data/gallery/index.json', '/data/gallery/summaries.json', '/data/reader/catalogue.json'];
  const assets = join(dist, 'assets');
  if (existsSync(assets)) for (const f of readdirSync(assets)) if (/\.(js|css)$/.test(f)) paths.push(`/assets/${f}`);
  // The fonts are ours now. The stylesheet and every Latin/Cyrillic/Hebrew/symbol subset go in the shell precache
  // (about 230 KB all together), so an offline first paint uses our faces and not the device's. The two CJK files
  // are ~1.3 and ~1.8 MB each and would not fit the 4 MiB shell budget beside the pages and the code: those are
  // cached on first use by the worker's byte-budgeted font cache (src/pwa/core.ts).
  const fonts = join(dist, 'fonts');
  if (existsSync(fonts)) {
    for (const f of readdirSync(fonts)) {
      if (f === 'fonts.css') paths.push('/fonts/fonts.css');
      else if (f.endsWith('.woff2') && !/^Noto(Sans|Serif)(SC|TC)-/.test(f)) paths.push(`/fonts/${f}`);
    }
  }
  const out = [];
  let bytes = 0;
  for (const p of [...new Set(paths)].sort()) {
    const f = join(dist, p);
    if (!existsSync(f)) {
      if (p.startsWith('/data/reader/')) continue; // a build without the reader data (the build already warns)
      throw new Error(`pwa: ${p} is in the precache list but not in ${dist}`);
    }
    const buf = readFileSync(f);
    bytes += buf.length;
    out.push([p, sha(buf).slice(0, 12)]);
  }
  if (bytes > SHELL_MAX) throw new Error(`pwa: the precache is ${(bytes / 1048576).toFixed(2)} MiB, over the ${SHELL_MAX / 1048576} MiB limit (docs/gallery-pwa.md)`);
  return { list: out, bytes };
}

export function buildId(root, list) {
  const h = createHash('sha256');
  h.update(JSON.stringify(list));
  for (const f of ['src/pwa/sw.ts', 'src/pwa/core.ts']) h.update(readFileSync(join(root, f)));
  return h.digest('hex').slice(0, 12);
}

/** Writes everything listed at the top of this file into `dist`. Returns what it decided. */
export async function buildPwa({ root, dist, log = console.log }) {
  // pages: the placeholder stays while the revisions are computed, so the id does not depend on itself (a page built before
  // carries an id; it is put back to the placeholder first, so this can run again on the same dist)
  for (const p of PAGES) {
    const f = join(dist, p);
    const html = readFileSync(f, 'utf8');
    const norm = html.replace(/(<meta name="ydh-build" content=")[^"]*(")/, `$1${BUILD_PLACEHOLDER}$2`);
    if (norm !== html) writeFileSync(f, norm);
  }
  const offlineSrc = readFileSync(join(root, 'src/pwa/offline.html'));
  writeFileSync(join(dist, 'offline.html'), offlineSrc);
  for (const key of Object.keys(LANGS)) writeFileSync(join(dist, LANGS[key].file), JSON.stringify(manifestFor(key), null, 2) + '\n');
  const { list, bytes } = collectPrecache(dist);
  const id = buildId(root, list);
  for (const p of PAGES) {
    const f = join(dist, p);
    const html = readFileSync(f, 'utf8');
    writeFileSync(f, html.split(BUILD_PLACEHOLDER).join(id));
  }
  const out = await build({
    entryPoints: [join(root, 'src/pwa/sw.ts')],
    bundle: true, write: false, format: 'iife', target: 'es2020', minify: true, legalComments: 'none', platform: 'browser',
    define: { __PWA_BUILD__: JSON.stringify(id), __PWA_PRECACHE__: JSON.stringify(list) },
  });
  const js = out.outputFiles[0].text;
  writeFileSync(join(dist, 'sw.js'), `/* ydh service worker, build ${id}. docs/gallery-pwa.md */\n${js}`);
  log(`[pwa] sw.js (${statSync(join(dist, 'sw.js')).size} B), build ${id}, precache ${list.length} files ${(bytes / 1024).toFixed(0)} KiB, ${Object.keys(LANGS).length} manifests, offline.html`);
  return { id, list, bytes };
}

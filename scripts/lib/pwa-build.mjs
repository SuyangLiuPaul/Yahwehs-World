// Makes the gallery installable: after `vite build` has written dist/, this adds
//
//   dist/sw.js                        the service worker (src/pwa/sw.ts bundled by esbuild, which Vite already depends on)
//   dist/offline.html                 the page a navigation gets when the network is down and nothing is saved for it
//   dist/manifest.webmanifest         the web app manifest in English, and manifest.zh-Hans / zh-Hant / ru.webmanifest
//   <meta name="ydh-build">           in the three pages: the id the page tells the worker apart from (__YDH_BUILD__ -> the id)
//
//   dist/404.html, dist/privacy.html  the two other pages that carry no bundle (src/pwa/*.html + static-page.css)
//
// It also decides the precache (the pages, /assets/*, the brand images, the three small data files) and the build id, the
// hash of every byte in it plus the worker's own source, so any change to the shell is a new worker and nothing else is.
// Called from scripts/lib/vite-gallery-surface.mjs at the end of a gallery build, and from scripts/build-pwa.mjs on any dist
// directory (scripts/verify-pwa.mjs uses that to simulate a deploy). Design: docs/gallery-pwa.md.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { PRODUCT_NAMES } from './product-name.mjs';

// The names, read from src/config/site.ts so a manifest can never list a name the app does not use.
// `name` is the STORE title of that locale, `short_name` the SHORT label under the icon (owner, 2026-11-04).
// "雅偉之界 / Yahweh's World" used to be `name` in all four: 20 characters of two scripts for a reader who reads one.
export const { wordmark: NAME_WORDMARK, short: NAME_SHORT, store: NAME_STORE } = PRODUCT_NAMES;
export const THEME_COLOR = '#0e2b4b';      // the bar: dark in every reading theme (only the reader's text surface turns light or paper)
export const BACKGROUND_COLOR = '#0a1e36'; // the page ground, the colour the opening screen paints
export const BUILD_PLACEHOLDER = '__YDH_BUILD__';
export const PAGES = ['/index.html', '/scenes.html', '/bible.html'];
export const SHELL_MAX = 4 * 1024 * 1024;  // keep in step with src/pwa/core.ts

/** One entry per reading: the store title as `name`, the icon label as `short_name`, and localised shortcuts. */
export const LANGS = {
  en: {
    file: 'manifest.webmanifest', lang: 'en', short: NAME_SHORT.en, name: NAME_STORE['en-US'],
    description: '1,443 scenes of the Bible, each one drawn and opening onto the verses it comes from. Pages you have opened work offline.',
    shortcuts: [['Home', '/'], ['Bible', '/bible.html'], ['Scenes', '/scenes.html']],
  },
  'zh-Hans': {
    file: 'manifest.zh-Hans.webmanifest', lang: 'zh-Hans', short: NAME_SHORT['zh-Hans'], name: NAME_STORE['zh-Hans'],
    description: '圣经里的 1,443 个时刻，每一幕都画了出来，并打开它所出自的经文。看过的页面可离线阅读。',
    shortcuts: [['首页', '/'], ['圣经', '/bible.html'], ['画卷', '/scenes.html']],
  },
  'zh-Hant': {
    file: 'manifest.zh-Hant.webmanifest', lang: 'zh-Hant', short: NAME_SHORT['zh-Hant'], name: NAME_STORE['zh-Hant'],
    description: '聖經裡的 1,443 個時刻，每一幕都畫了出來，並打開它所出自的經文。看過的頁面可離線閱讀。',
    shortcuts: [['首頁', '/'], ['聖經', '/bible.html'], ['畫卷', '/scenes.html']],
  },
  ru: {
    file: 'manifest.ru.webmanifest', lang: 'ru', short: NAME_SHORT.ru, name: NAME_STORE.ru,
    description: '1 443 сцены Библии: каждая нарисована и открывает стихи, из которых она взята. Открытые страницы работают без сети.',
    shortcuts: [['Главная', '/'], ['Библия', '/bible.html'], ['Сцены', '/scenes.html']],
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
    name: L.name,
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

/** The pages that carry no bundle, built from src/pwa/<name> with the shared style and first-paint script inlined.
 *  404.html closes P0-4 (Netlify's stock page); privacy.html closes P1-10. offline.html is older and still literal. */
export const STATIC_PAGES = { '404.html': '404.html', 'privacy.html': 'privacy.html' };

/** Picks the reading, exactly as the app's own first-paint script does, and the resolved reading surface with it.
 *  These pages have no module to do it later, and a 404 in navy handed to a reader who reads on paper is a 404 that
 *  looks like someone else's site. */
const FIRST_PAINT = '(function(){var d=document.documentElement;try{var l=localStorage.getItem("ydh.locale");'
  + 'if(l!=="en"&&l!=="zh-Hans"&&l!=="zh-Hant"&&l!=="ru"){l="en";'
  + 'var t=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||""];'
  + 'for(var i=0;i<t.length;i++){var g=(t[i]||"").toLowerCase();'
  + 'if(g==="zh"||g.indexOf("zh-")===0){l=/hant|tw|hk|mo/.test(g)?"zh-Hant":"zh-Hans";break}'
  + 'if(g==="en"||g.indexOf("en-")===0){l="en";break}'
  + 'if(g==="ru"||g.indexOf("ru-")===0){l="ru";break}}}d.lang=l}catch(e){d.lang="en"}'
  // The TITLE in the reader's language, from the <title>'s own four readings. These pages have no module, so the tab,
  // the history entry and anything that unfurls the page used to read "Privacy · Yahweh's World" to a 简体 reader; the
  // product name inside it follows the language like every other place it appears (owner, 2026-11-04).
  + 'try{var T=document.querySelector("title"),k={en:"en","zh-Hans":"hans","zh-Hant":"hant",ru:"ru"}[d.lang];'
  + 'if(T&&k&&T.dataset[k])T.textContent=T.dataset[k]}catch(e){}'
  + 'try{var p=JSON.parse(localStorage.getItem("yr.prefs.v1")||"{}").theme;'
  + 'if(["dark","light","paper"].indexOf(p)<0)p=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"paper";'
  + 'd.dataset.surf=p;var m=document.querySelector(\'meta[name="theme-color"]\');'
  + 'if(m)m.content={dark:"#0e2b4b",light:"#f8f9fb",paper:"#f4efe4"}[p]}catch(e){}})()';

export function staticPage(root, name) {
  const css = readFileSync(join(root, 'src/pwa/static-page.css'), 'utf8');
  const html = readFileSync(join(root, 'src/pwa', name), 'utf8');
  const out = html
    .replace('<style>/* static-page.css */</style>', `<style>\n${css}</style>`)
    .replace('<script>/* first-paint: language and reading surface */</script>', `<script>\n${FIRST_PAINT}\n</script>`);
  if (out === html) throw new Error(`pwa: src/pwa/${name} has no style or script placeholder to fill`);
  return out;
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** [[path, revision], ...]: what the worker saves at install. Sorted, so the same dist gives the same list. */
export function collectPrecache(dist) {
  const paths = [...PAGES, '/offline.html', '/404.html', '/privacy.html', '/brand-logo.webp', '/favicon.png', '/icon-sm.svg', '/apple-touch-icon.png',
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
  writeFileSync(join(dist, 'offline.html'), readFileSync(join(root, 'src/pwa/offline.html')));
  for (const [src, out] of Object.entries(STATIC_PAGES)) writeFileSync(join(dist, out), staticPage(root, src));
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
  log(`[pwa] sw.js (${statSync(join(dist, 'sw.js')).size} B), build ${id}, precache ${list.length} files ${(bytes / 1024).toFixed(0)} KiB, ${Object.keys(LANGS).length} manifests, offline.html, ${Object.values(STATIC_PAGES).join(', ')}`);
  return { id, list, bytes };
}

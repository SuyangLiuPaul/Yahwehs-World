// The gallery surface: one build flag, three pages.
//
//   VITE_SURFACE=gallery npm run build      home + gallery + picture page + reader; nothing else is built
//   npm run build                           the full surface, as before (the globe is the home page)
//
// handoff/fable-gallery-release-2026-11-03.md §1.2-1.3. Nothing hidden is deleted: the globe, the walks,
// the figures, the panorama and the labs stay in the repo, stay under `npm run dev` and stay built by the
// full surface. This file is the whole boundary, so the diff shows it in one place:
//
//   INPUT       index.html (the globe) is replaced by home.html, written out as /index.html; scenes.html is
//               replaced by gallery-scenes.html, written out as /scenes.html; gallery-bible.html (the reader module's chapter view, src/reader)
//               is written out as /bible.html.
//   NAV         the shell block of every page becomes the three-item gallery shell (首页 · 画卷 · 圣经);
//               the head block, loading-screen guard and font link are the ones scripts/build-shell.mjs owns.
//   PUBLISH     models, figures, materials, film, the geo files and the like are not copied into dist/.
//   URLS        dist/_redirects: 302 (not 301: they come back) for every hidden page; /gallery and /pictures
//               301 to /scenes.html. dist/p/<id>/index.html: one small page per picture, so a shared picture
//               link unfurls with its own title and image and then opens /scenes.html#p=<id>.
//   CRAWL       dist/sitemap.xml and dist/robots.txt list the three pages and the 1,443 /p/<id> pages.
//
// The hash links the globe used to take (/#ref=, /#event=, /#journey=) cannot be redirected by a server;
// home.html carries the forwarder that does it before first paint (tested by scripts/verify-redirects.mjs).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { START, END, HEAD, HEAD_END, GUARD, FONTS } from '../build-shell.mjs';

export const SURFACE = process.env.VITE_SURFACE === 'gallery' ? 'gallery' : 'full';
export const ORIGIN = 'https://world.yahwehword.com';

/** Source page -> the file name it is published under. */
export const RENAME = { 'home.html': 'index.html', 'gallery-scenes.html': 'scenes.html', 'gallery-bible.html': 'bible.html' };

/** The pages a reader of the gallery build can reach, by input name. */
export const galleryInput = (root) => ({
  main: join(root, 'home.html'),
  scenes: join(root, 'gallery-scenes.html'),
  bible: join(root, 'gallery-bible.html'),
});

/** Inside `public/`, relative paths NOT copied into the gallery dist (a name matches itself and everything below it). */
export const PUBLISH_EXCLUDE = [
  'models',                 // glb: the globe, the walks, the figures (56 MB)
  'figures', 'materials', 'film', 'scenes', 'studies', 'cutouts-webp',
  'loading-globe.svg', 'loading-globe-sm.svg',
  'data/ne_110m_land.geojson', 'data/ne_50m_coastline.geojson', 'data/ne_50m_lakes.geojson',
  'data/ne_50m_land.geojson', 'data/ne_50m_rivers_lake_centerlines.geojson', 'data/terrain-color.webp',
  'data/places.json', 'data/journeys.json', 'data/inventory.json', 'data/scenes.json',
  'data/events.json',       // the gallery reads data/gallery/*.json
  'data/bible',             // the globe's own Bible data (11 MB + split): the reader module reads data/reader/ (editions, headings)
];
export const isExcluded = (rel) => PUBLISH_EXCLUDE.some((x) => rel === x || rel.startsWith(`${x}/`));

/** Hidden pages: what a visitor with an old link lands on. */
const HIDDEN = [
  '/tabernacle.html', '/temple.html', '/ark.html', '/figures.html', '/figures-springs.html', '/plan.html',
  '/video.html', '/scene-assembly.html', '/elephant-preview.html', '/previews/*',
];

const ICON = {
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
  scenes: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  bible: '<path d="M4 5.5c2.7-1.2 5.3-1.2 8 .5 2.7-1.7 5.3-1.7 8-.5V19c-2.7-1.2-5.3-1.2-8 .5-2.7-1.7-5.3-1.7-8-.5z"/><path d="M12 6v13.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
};
const svg = (name, cls = 'tb-i', size = 24) =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

const TABS = [
  { key: 'home', href: '/', icon: 'home', en: 'Home', zh: '首页', ru: 'Главная' },
  { key: 'scenes', href: '/scenes.html', icon: 'scenes', en: 'Scenes', zh: '画卷', ru: 'Сцены' },
  { key: 'bible', href: '/bible.html', icon: 'bible', en: 'Bible', zh: '圣经', ru: 'Библия' },
];

/** The page a source file stands for, and what its loading screen says. */
const PAGES = {
  'home.html': { key: 'home', pg: ['The scenes', '画卷', 'Сцены'], load: ['Opening the scenes…', '正在展开画卷…', '正在展開畫卷…', 'Открываем сцены…'] },
  'gallery-scenes.html': { key: 'scenes', pg: ['Scenes', '画卷', 'Сцены'], load: ['Opening the 1,443 scenes…', '正在展开 1,443 幅画卷…', '正在展開 1,443 幅畫卷…', 'Открываем 1 443 сцены…'] },
  'gallery-bible.html': { key: 'bible', pg: ['Bible', '圣经', 'Библия'], load: ['Opening the Bible…', '正在展开圣经…', '正在展開聖經…', 'Открываем Библию…'] },
};

export function galleryShell(file) {
  const page = PAGES[file];
  const tab = (t) => `      <li><a class="tab" href="${t.href}"${t.key === page.key ? ' aria-current="page"' : ''} data-en="${t.en}" data-zh="${t.zh}" data-ru="${t.ru}">${t.en}</a></li>`;
  const tb = (t) => `    <a class="tb" href="${t.href}"${t.key === page.key ? ' aria-current="page"' : ''}>${svg(t.icon)}<span data-en="${t.en}" data-zh="${t.zh}" data-ru="${t.ru}">${t.en}</span></a>`;
  return `${START}
  <!-- Gallery surface (scripts/lib/vite-gallery-surface.mjs): the same loading screen and the same bar as the
       full site, with three destinations instead of eight. -->
  <div id="loading" role="status" aria-live="polite" aria-busy="true">
    <i id="loading-bar" aria-hidden="true"></i>
    <div class="ld-cards" aria-hidden="true">${'<i class="ld-sk ld-card"></i>'.repeat(3)}</div>
    <p id="loading-title" class="tri" aria-hidden="true"><i class="l-en">Yahweh's World</i><i class="l-hans">雅伟之界</i><i class="l-hant">雅偉之界</i></p>
    <p id="loading-text" class="tri"><i class="l-en">${page.load[0]}</i><i class="l-hans">${page.load[1]}</i><i class="l-hant">${page.load[2]}</i><i class="l-ru">${page.load[3]}</i></p>
    <div id="loading-error" role="alert">
      <p class="tri" style="margin:0"><i class="l-en">Loading did not finish. Check your connection and try again.</i><i class="l-hans">加载没有完成。请检查网络后重试。</i><i class="l-hant">載入沒有完成。請檢查網路後重試。</i><i class="l-ru">Загрузка не завершилась. Проверьте соединение и попробуйте снова.</i></p>
      <button type="button" id="loading-retry" class="tri"><i class="l-en">Try again</i><i class="l-hans">重试</i><i class="l-hant">重試</i><i class="l-ru">Повторить</i></button>
    </div>
  </div>
  <script>${GUARD}</script>
  <noscript><style>#loading{display:none}</style></noscript>

  <nav class="sitenav" aria-label="Yahweh's World" data-aria-en="Yahweh's World" data-aria-zh="雅伟之界" data-aria-ru="Мир Яхве">
    <a class="brand" href="/">
      <img class="brand-logo" src="/brand-logo.webp" alt="" width="34" height="34">
      <span class="brand-words">
        <span class="zh" data-zh-text="雅伟之界">雅伟之界</span>
        <span class="en">Yahweh's World</span>
        <span class="pg" data-en="${page.pg[0]}" data-zh="${page.pg[1]}" data-ru="${page.pg[2]}">${page.pg[0]}</span>
      </span>
    </a>
    <ol>
${TABS.map(tab).join('\n')}
    </ol>
    <span class="spacer"></span>
    <button type="button" class="gx-search" data-gx-search aria-haspopup="dialog">${svg('search', 'gx-i', 18)}<span class="gx-search-t" data-en="Book, reference, caption" data-zh="搜书卷、出处、画名" data-ru="Книга, место, название">Book, reference, caption</span><kbd aria-hidden="true">⌘K</kbd></button>
    <div class="lang-switch" role="group" aria-label="Language / 语言" data-aria-en="Language" data-aria-zh="语言" data-aria-ru="Язык">
      <button type="button" data-locale="en" lang="en">EN</button>
      <button type="button" data-locale="zh-Hans" lang="zh-Hans">简</button>
      <button type="button" data-locale="zh-Hant" lang="zh-Hant">繁</button>
      <button type="button" data-locale="ru" lang="ru">РУ</button>
    </div>
  </nav>
  <nav class="tabbar" aria-label="Sections" data-aria-en="Sections" data-aria-zh="栏目" data-aria-ru="Разделы">
${TABS.map(tb).join('\n')}
  </nav>
${END}`;
}

/** The full surface's head block, taught Russian: its first-paint language script accepts and detects "ru", and the
 *  loading screen's three-way line gets a fourth reading. (The full pages keep the original block.) */
const GALLERY_HEAD = HEAD
  .replace('var l=localStorage.getItem("ydh.locale");', 'var l=localStorage.getItem("ydh.locale");var hm=/(?:^|[#&])lang=(en|zh-Hans|zh-Hant|ru)(?:&|$)/.exec(location.hash);if(hm)l=hm[1];')
  .replace('if(l!=="en"&&l!=="zh-Hans"&&l!=="zh-Hant"){', 'if(l!=="en"&&l!=="zh-Hans"&&l!=="zh-Hant"&&l!=="ru"){')
  .replace('if(g==="en"||g.indexOf("en-")===0){l="en";break}', 'if(g==="en"||g.indexOf("en-")===0){l="en";break}if(g==="ru"||g.indexOf("ru-")===0){l="ru";break}')
  .replace('</style>', 'html[lang="ru"] .tri .l-ru{display:inline}</style>');

/** The head block, the shell block, the surface mark and the two assets every gallery page shares. */
export function transformGalleryHtml(html, file) {
  if (!PAGES[file]) return html;
  // head: pages written for this surface carry a placeholder; the shipped reader already has the block
  if (html.includes('<!-- gallery-head -->')) html = html.replace('<!-- gallery-head -->', GALLERY_HEAD).replace('<!-- gallery-fonts -->', FONTS);
  html = html.replace('<!-- gallery-fonts -->', FONTS);
  // shell
  const a = html.indexOf(START);
  if (a >= 0) {
    const b = html.indexOf(END, a);
    if (b < 0) throw new Error(`${file}: shell:start without shell:end`);
    html = html.slice(0, a) + galleryShell(file) + html.slice(b + END.length);
  } else if (html.includes('<!-- gallery-shell -->')) {
    html = html.replace('<!-- gallery-shell -->', galleryShell(file));
  } else throw new Error(`${file}: no shell block and no <!-- gallery-shell --> placeholder`);
  // the shipped reader (and any page that already carries the full block) gets the Russian-aware one
  if (html.includes('<!-- shell:head -->')) {
    const h0 = html.indexOf('<!-- shell:head -->'), h1 = html.indexOf(HEAD_END, h0);
    if (h1 > h0) html = html.slice(0, html.lastIndexOf('\n', h0) + 1) + GALLERY_HEAD + html.slice(h1 + HEAD_END.length);
  }
  html = html.replace(/<html([^>]*)>/, (m, attrs) => (attrs.includes('data-surface') ? m : `<html${attrs} data-surface="gallery">`));
  html = html.replace('</head>', '  <link rel="stylesheet" href="/src/gallery/chrome.css">\n</head>');
  html = html.replace('</body>', '  <script type="module" src="/src/gallery/chrome.ts"></script>\n</body>');
  return html;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Genesis 15:1–21", "Genesis 15:1–16:5", "Psalm 23" from canonical keys. */
function refEn(books, b, s, e) {
  const sc = Math.floor((s % 1e6) / 1e3), sv = s % 1e3, ec = Math.floor((e % 1e6) / 1e3), ev = e % 1e3;
  const name = books[b - 1].en;
  if (sc === ec) return sv === ev ? `${name} ${sc}:${sv}` : `${name} ${sc}:${sv}–${ev}`;
  return `${name} ${sc}:${sv}–${ec}:${ev}`;
}

function writeExtras(root, dist) {
  const idx = JSON.parse(readFileSync(join(root, 'public/data/gallery/index.json'), 'utf8'));
  const sums = JSON.parse(readFileSync(join(root, 'public/data/gallery/summaries.json'), 'utf8'));
  const books = JSON.parse(readFileSync(join(root, 'scripts/books.json'), 'utf8'));

  writeFileSync(join(dist, '_redirects'), [
    '# Gallery surface: the pages that are not in this release come back, so 302 and never 301.',
    ...HIDDEN.map((p) => `${p.padEnd(26)} /   302!`),
    '# Short links for sharing.',
    '/gallery                   /scenes.html   301!',
    '/pictures                  /scenes.html   301!',
    '',
  ].join('\n'));

  const urls = ['/', '/scenes.html', '/bible.html'];
  idx.ev.forEach((row, i) => {
    const [id, b, s, e, zh, en, , served] = row;
    urls.push(`/p/${id}`);
    const ref = refEn(books, b, s, e);
    const desc = sums.en[i] || sums.zh[i] || ref;
    const image = served ? `${ORIGIN}/pictures/full/${id}.webp` : `${ORIGIN}/logo.png`;
    const title = `${en} · ${zh} | Yahweh's World`;
    const to = `/scenes.html#p=${id}`;
    const dir = join(dist, 'p', id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(`${ref}. ${desc}`)}">
<link rel="canonical" href="${ORIGIN}/p/${id}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Yahweh's World · 雅伟之界">
<meta property="og:title" content="${esc(`${en} · ${zh}`)}"><meta property="og:description" content="${esc(`${ref}. ${desc}`)}">
<meta property="og:url" content="${ORIGIN}/p/${id}"><meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${to}">
<script>location.replace(${JSON.stringify(to)}+(location.hash?"&"+location.hash.slice(1):""))</script>
</head><body><p><a href="${to}">${esc(en)} · ${esc(zh)} — ${esc(ref)}</a></p></body></html>
`);
  });
  writeFileSync(join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${ORIGIN}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  return urls.length;
}

/** vite plugins for the gallery surface. Returns [] on the full surface so nothing else changes. */
export function gallerySurface({ root }) {
  if (SURFACE !== 'gallery') return [];
  let outDir = join(root, 'dist');
  return [{
    name: 'gallery-surface',
    enforce: 'pre',
    configResolved(cfg) { outDir = join(cfg.root, cfg.build.outDir); },
    configureServer(server) {
      // dev: `/` is the home page, `/scenes.html` the gallery, `/p/<id>` forwards to the picture page
      server.middlewares.use((req, _res, next) => {
        const u = (req.url ?? '').split('?');
        if (u[0] === '/' || u[0] === '/index.html') req.url = `/home.html${u[1] ? `?${u[1]}` : ''}`;
        else if (u[0] === '/scenes.html') req.url = `/gallery-scenes.html${u[1] ? `?${u[1]}` : ''}`;
        else if (u[0] === '/bible.html') req.url = `/gallery-bible.html${u[1] ? `?${u[1]}` : ''}`;
        next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) { return transformGalleryHtml(html, basename(ctx.filename ?? ctx.path)); },
    },
  }, {
    name: 'gallery-surface-publish',
    enforce: 'post',
    apply: 'build',
    generateBundle(_o, bundle) {
      for (const [from, to] of Object.entries(RENAME)) {
        const item = bundle[from];
        if (!item) continue;
        item.fileName = to;
        bundle[to] = item;
        delete bundle[from];
      }
    },
    // After stage-public has copied public/ into dist/.
    closeBundle: {
      order: 'post',
      handler() {
        if (!existsSync(join(outDir, 'index.html'))) return;
        const reader = existsSync(join(root, 'public/data/reader/catalogue.json'));
        if (!reader) {
          const msg = 'gallery build: public/data/reader is missing (run npm run reader:data; it needs the Words checkout)';
          if (process.env.NETLIFY || process.env.GALLERY_REQUIRE_PICTURES) throw new Error(msg);
          console.warn(`\n[gallery-surface] WARNING ${msg}\n`);
        }
        const have = existsSync(join(root, 'public/pictures/full')) ? readdirSync(join(root, 'public/pictures/full')).length : 0;
        if (have < 1443) {
          const msg = `gallery build: public/pictures/full has ${have} of 1443 files (run node scripts/build-pictures.mjs; it needs the T7 drive)`;
          if (process.env.NETLIFY || process.env.GALLERY_REQUIRE_PICTURES) throw new Error(msg);
          console.warn(`\n[gallery-surface] WARNING ${msg}\n`);
        }
        const n = writeExtras(root, outDir);
        console.log(`[gallery-surface] wrote _redirects, robots.txt, sitemap.xml (${n} urls), ${n - 3} /p/<id> pages`);
      },
    },
  }];
}

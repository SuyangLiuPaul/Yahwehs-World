// The shell every page opens with: the loading screen and the nav.
//
// Why a generator. There are six entry HTML files and the nav was copied into
// all six by hand; they agreed only because nobody had yet made a mistake. The
// loading screen existed on ONE of them, so five pages painted their text and
// their empty canvas and invited a reader to click a scene that was not there
// — which is exactly what the owner did, and photographed. One source, written
// into all six, is the only arrangement where that cannot drift.
//
// It rewrites the region between the two markers. Everything outside them is
// each page's own.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAME_HANS, NAME_HANT, PRODUCT_NAMES, wordmarkLockup } from './lib/product-name.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The pages, in the order they stand in the nav.
 *
 *  The loading line is carried in all THREE readings, written out literally.
 *  Everywhere else in this codebase 繁體 comes from public/data/zh-hant.json
 *  at run time — but this line has to be correct in the FIRST PAINT, before
 *  any module, any fetch and any table exists, so it cannot come from there.
 *  A 简体 reader watched the whole of a load in English and said so. */
const PAGES = [
  { file: 'index.html', href: '/', en: 'Globe', narrowEn: 'Globe', zh: '圣经世界', narrowZh: '地球',
    loadEn: 'Drawing the world…', loadHans: '正在绘制世界…', loadHant: '正在繪製世界…' },
  { file: 'bible.html', sk: 'lines', href: '/bible.html', en: 'Illustrated Bible', narrowEn: 'Bible', zh: '画卷圣经', narrowZh: '圣经',
    loadEn: 'Opening the Illustrated CUV-Yahweh Bible…', loadHans: '正在展开《和合本雅伟版 · 画卷圣经》…', loadHant: '正在展開《和合本雅偉版 · 畫卷聖經》…' },
  { file: 'scenes.html', sk: 'cards', href: '/scenes.html', en: 'Scenes', narrowEn: 'Scenes', zh: '圣经画卷', narrowZh: '画卷',
    loadEn: 'Opening the 1,443 scenes…', loadHans: '正在展开 1,443 幅圣经画卷…', loadHant: '正在展開 1,443 幅聖經畫卷…' },
  { file: 'tabernacle.html', href: '/tabernacle.html', en: 'Tabernacle', narrowEn: 'Tent', zh: '走进会幕', narrowZh: '会幕',
    walk: true, inEn: 'The tabernacle (1:1 Walk)', inZh: '摩西会幕（第一人称漫游）', ofEn: 'Exodus 26–27 · Measured 3D', ofZh: '出埃及记 26–27 · 实尺建造',
    loadEn: 'Raising the tabernacle…', loadHans: '正在支搭会幕…', loadHant: '正在支搭會幕…' },
  { file: 'temple.html', href: '/temple.html', en: 'Temple', narrowEn: 'Temple', zh: '走进圣殿', narrowZh: '圣殿',
    walk: true, inEn: "Solomon's temple (1:1 Walk)", inZh: '所罗门圣殿（第一人称漫游）', ofEn: '1 Kings 6–7 · Measured 3D', ofZh: '列王纪上 6–7 · 实尺建造',
    loadEn: 'Building the house…', loadHans: '正在建造圣殿…', loadHant: '正在建造聖殿…' },
  { file: 'ark.html', href: '/ark.html', en: 'Ark', narrowEn: 'Ark', zh: '走进方舟', narrowZh: '方舟',
    walk: true, inEn: "Noah's ark (1:1 Walk)", inZh: '挪亚方舟（第一人称漫游）', ofEn: 'Genesis 6–8 · Measured 3D', ofZh: '创世记 6–8 · 实尺建造',
    loadEn: 'Building the ark…', loadHans: '正在造方舟…', loadHant: '正在造方舟…' },
  { file: 'figures.html', sk: 'cards', href: '/figures.html', en: 'Figures', narrowEn: 'Figures', zh: '人物与活物', narrowZh: '人物',
    loadEn: 'Standing the figures up…', loadHans: '正在把人物立起来…', loadHant: '正在把人物立起來…' },
  { file: 'plan.html', sk: 'lines', href: '/plan.html', en: 'Panorama', narrowEn: 'Plan', zh: '圣经全景', narrowZh: '全景',
    loadEn: 'Laying out the plan…', loadHans: '正在整理全部计划…', loadHant: '正在整理全部計劃…' },
];

const EXTRA_WALKS = [
  { href: '/scene-assembly.html', inEn: "Noah's Ark Boarding Diorama", inZh: '方舟登船 3D 沙盘', ofEn: 'Genesis 7 · Animated 3D Cutouts', ofZh: '创世记 7 · 动态 3D 模型场景' },
  { href: '/previews/noahs-ark-v01/index.html', inEn: "Noah's Ark 3-Deck Cutaway", inZh: '挪亚方舟三层剖面 3D', ofEn: 'Genesis 6–8 · 3-Deck Diorama', ofZh: '创世记 6–8 · 三层甲板动态展示' },
  { href: '/previews/moses-tabernacle-v04/index.html', inEn: 'Tabernacle Wilderness Camp 3D', inZh: '摩西会幕旷野营地 3D', ofEn: 'Exodus 40 · Camp & Court 3D', ofZh: '出埃及记 40 · 营地与院落 3D' },
  { href: '/previews/solomon-temple-v02/index.html', inEn: "Solomon's Temple Courtyard 3D", inZh: '所罗门圣殿献殿 3D', ofEn: '2 Chronicles 2–7 · Temple 3D', ofZh: '历代志下 2–7 · 圣殿建造与献殿' },
];

export const START = '  <!-- shell:start — written by scripts/build-shell.mjs. Edit that, not this. -->';
export const END = '  <!-- shell:end -->';

// The fonts are OURS: subset woff2 in public/fonts, built by tools/subset-fonts.sh and listed in
// public/fonts/OFL.txt. Nothing is fetched from fonts.googleapis.com or fonts.gstatic.com any more.
//
// They used to come from Google at runtime, which meant that on a first launch, offline, or on a slow
// network the apps fell back to system faces — the "字体还是很差" the owner reported. Bundled, the
// Latin, Cyrillic and both CJK scripts are on the device before the first paint.
//
// fonts.css is 2.7 KB brotli, so it is a plain blocking stylesheet: the media="print" dance existed only
// to dodge a third-party round trip and now just causes a flash of fallback text. The two preloads are the
// critical Latin faces, which every page needs (the loading screen itself is trilingual). `crossorigin` is
// required on a font preload even same-origin, or the file is fetched twice. The CJK files are far too big
// to preload; font-display: swap carries them.
export const FONT_CSS = '/fonts/fonts.css';
export const FONT_PRELOAD = ['/fonts/Inter-400-600-latin.woff2', '/fonts/Spectral-500-latin.woff2'];

export const FONTS = FONT_PRELOAD.map((f) => `  <link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')
  + `\n  <link rel="stylesheet" href="${FONT_CSS}">`;

export const HEAD_END = '<!-- /shell:head -->';
// The opening screen's CSS lives HERE, inline, and nowhere else. The page's
// own stylesheet (src/nav.css) is a render-blocking request that arrives with
// the bundle; before this rule moved into the head the first paint was a plain
// dark page, and the screen below only appeared once that file had come down.
// Inline, the placeholder is on screen with the HTML itself.
export const CRITICAL = [
  '#loading{position:fixed;inset:0;z-index:50;display:grid;place-content:center;justify-items:center;gap:clamp(12px,2.2vmin,28px);padding:0 20px;box-sizing:border-box;background:radial-gradient(circle at 50% 42%,#18426e 0,#0a1e36 72%);text-align:center;transition:opacity .6s ease,visibility 0s linear .6s}',
  '#loading.done{opacity:0;visibility:hidden;pointer-events:none}',
  '#loading-bar{position:fixed;left:0;top:0;height:2px;width:0;background:linear-gradient(90deg,#3ba3f8,#f8d66d);transition:width .35s ease;z-index:51}',
  // THE FOUR READINGS, CHOSEN BEFORE FIRST PAINT. A .tri element carries one <i> per reading and html[lang] — which
  // the first-paint script above has already set from the stored language — shows exactly one. The loading line was
  // the first thing written this way; the WORDMARK is written this way too (scripts/lib/product-name.mjs), because a
  // name set by a module arrives after the paint and an English reader saw one frame of 雅偉之界.
  '.tri i{font-style:normal;display:none}',
  'html[lang="en"] .tri .l-en,html[lang="zh-Hans"] .tri .l-hans,html[lang="zh-Hant"] .tri .l-hant,html[lang="ru"] .tri .l-ru{display:inline}',
  // The shapes. .ld-sk is any block that stands where content will be.
  '.ld-sk{position:relative;overflow:hidden;background:rgba(198,216,236,.09)}',
  '.ld-sk::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(248,214,109,.16) 50%,transparent 70%);transform:translateX(-100%);animation:ld-sh 2.2s ease-in-out infinite}',
  '@keyframes ld-sh{to{transform:translateX(100%)}}',
  '.ld-art{position:relative;width:min(46vw,34vh,240px);aspect-ratio:1}',
  '.ld-sphere{position:absolute;inset:6%;border-radius:50%;background:radial-gradient(circle at 36% 30%,#2b6199,#144070 52%,#0b2745);box-shadow:0 12px 28px rgba(0,0,0,.45),inset -10px -14px 28px rgba(4,14,28,.5),0 0 0 1px rgba(248,214,109,.28);transition:opacity .5s ease}',
  '.ld-art.ready .ld-sphere{opacity:0}',
  '#loading-globe{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .5s ease;filter:drop-shadow(0 12px 28px rgba(0,0,0,.45))}',
  '.ld-art.ready #loading-globe{opacity:1}',
  '.ld-cards{display:grid;grid-template-columns:repeat(3,minmax(0,150px));gap:12px;width:min(88vw,490px)}',
  '.ld-card{border-radius:12px;aspect-ratio:16/9}',
  '.ld-card:nth-child(n+4){display:none}',
  '@media(max-width:520px){.ld-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.ld-card:nth-child(3){display:none}}',
  '.ld-lines{display:grid;gap:10px;width:min(80vw,380px)}',
  '.ld-line{height:12px;border-radius:6px}',
  '.ld-line:nth-child(1){width:55%;height:18px}.ld-line:nth-child(3){width:92%}.ld-line:nth-child(5){width:70%}',
  '#loading-title{margin:0;font:600 clamp(18px,4.6vw,26px)/1.2 Spectral,Georgia,"Songti SC","Noto Serif SC",serif;color:#f8d66d;letter-spacing:.06em}',
  '#loading-text{margin:0;font:500 clamp(15px,3.8vw,21px)/1.4 Inter,system-ui,-apple-system,"PingFang SC","Noto Sans SC",sans-serif;letter-spacing:.04em;color:#c6d8ec}',
  // The failure state: the same screen, the shapes stop, a sentence and a button appear.
  '#loading-error{display:none;gap:14px;justify-items:center;max-width:min(88vw,420px);margin:0;font:500 clamp(15px,3.8vw,18px)/1.5 Inter,system-ui,-apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#c6d8ec}',
  '#loading.failed #loading-error{display:grid}',
  '#loading.failed #loading-text{display:none}',
  '#loading.failed .ld-sk::after{animation:none}',
  '#loading-retry{font:inherit;min-height:44px;padding:10px 28px;border:0;border-radius:999px;background:#f8d66d;color:#0a1e36;cursor:pointer}',
  '#loading-retry:focus-visible{outline:2px solid #fff;outline-offset:3px}',
  '@media(prefers-reduced-motion:reduce){.ld-sk::after{animation:none}#loading,#loading-bar,.ld-sphere,#loading-globe{transition-duration:.01s}}',
  // The opening screen follows the reader's chosen surface too. Without this a reader in Light or Paper got a
  // full-screen flash of navy on every navigation — a door of the wrong colour onto a page of the right one.
  // html[data-surf] is written by the first-paint script of the gallery surface; the full surface never sets it.
  'html[data-surf="light"] #loading{background:radial-gradient(circle at 50% 42%,#ffffff 0,#f8f9fb 72%)}',
  'html[data-surf="paper"] #loading{background:radial-gradient(circle at 50% 42%,#fbf8f1 0,#f4efe4 72%)}',
  'html[data-surf="light"] #loading-title,html[data-surf="paper"] #loading-title{color:#7c5409}',
  'html[data-surf="light"] #loading-text,html[data-surf="light"] #loading-error{color:#34455a}',
  'html[data-surf="paper"] #loading-text,html[data-surf="paper"] #loading-error{color:#3a4a5e}',
  'html[data-surf="light"] .ld-sk,html[data-surf="paper"] .ld-sk{background:rgba(21,33,47,.07)}',
  'html[data-surf="light"] .ld-sk::after,html[data-surf="paper"] .ld-sk::after{background:linear-gradient(105deg,transparent 30%,rgba(21,33,47,.08) 50%,transparent 70%)}',
  'html[data-surf="light"] #loading-retry,html[data-surf="paper"] #loading-retry{background:#8a5d0c;color:#fffaf0}',
].join('');

export const HEAD = `  <!-- shell:head --><meta name="theme-color" content="#0e2b4b"><link rel="icon" type="image/png" href="/favicon.png"><style>:root{color-scheme:dark}html,body{background:#0a1e36;margin:0}${CRITICAL}</style>` +
  `<script>(function(){try{var l=localStorage.getItem("ydh.locale");` +
  `if(l!=="en"&&l!=="zh-Hans"&&l!=="zh-Hant"){l="en";` +
  `var t=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||""];` +
  `for(var i=0;i<t.length;i++){var g=(t[i]||"").toLowerCase();` +
  `if(g==="zh"||g.indexOf("zh-")===0){l=/hant|tw|hk|mo/.test(g)?"zh-Hant":"zh-Hans";break}` +
  `if(g==="en"||g.indexOf("en-")===0){l="en";break}}}` +
  `document.documentElement.lang=l}catch(e){document.documentElement.lang="en"}})()<\/script>` + HEAD_END;

const tab = (p, self) =>
  `      <li><a class="tab" href="${p.href}"${p.file === self ? ' aria-current="page"' : ''}` +
  ` data-en="${p.en}" data-en-narrow="${p.narrowEn}" data-zh="${p.zh}" data-zh-narrow="${p.narrowZh}">${p.en}</a></li>`;

const walkItems = (self) => [
  ...PAGES.filter((p) => p.walk).map((p) =>
    `        <a href="${p.href}"${p.file === self ? ' aria-current="page"' : ''}>` +
    `<span class="dd-name" data-en="${p.inEn}" data-zh="${p.inZh}">${p.inEn}</span>` +
    `<span class="dd-of" data-en="${p.ofEn}" data-zh="${p.ofZh}">${p.ofEn}</span></a>`
  ),
  ...EXTRA_WALKS.map((w) =>
    `        <a href="${w.href}">` +
    `<span class="dd-name" data-en="${w.inEn}" data-zh="${w.inZh}">${w.inEn}</span>` +
    `<span class="dd-of" data-en="${w.ofEn}" data-zh="${w.ofZh}">${w.ofEn}</span></a>`
  ),
].join('\n');

const tabs = (self) => {
  const walks = PAGES.filter((p) => p.walk);
  const here = walks.some((p) => p.file === self);
  const out = [];
  for (const p of PAGES) {
    if (p.walk) {
      if (p.file !== walks[0].file) continue;
      out.push(`      <li class="tab-group">
        <button type="button" class="tab" id="walk-open" aria-expanded="false" aria-controls="walkmenu"${here ? ' aria-current="page"' : ''}>
          <b data-en="3D Spaces" data-zh="走进 3D">3D Spaces</b><i class="chev" aria-hidden="true">▾</i></button>
        <div class="dd" id="walkmenu" hidden>
${walkItems(self)}
        </div>
      </li>`);
      continue;
    }
    out.push(tab(p, self));
  }
  return out.join('\n');
};

// Runs the moment the loading block exists, before any module. It lives in the
// HTML on purpose: if the bundle itself fails to download there is no other
// code that could notice. Three jobs: tell assistive tech the page is no
// longer busy once the screen lifts (aria-busy), show the retry state when a
// script fails to load / a start-up promise rejects / 90 s pass, and take the
// retry state away again if the page does finish after all.
export const GUARD = '(function(){var L=document.getElementById("loading");if(!L)return;var t=setTimeout(fail,90000);'
  + 'function fail(){if(L.classList.contains("done"))return;L.classList.add("failed");L.setAttribute("aria-busy","false")}'
  + 'var o=new MutationObserver(function(){if(L.classList.contains("done")){o.disconnect();L.classList.remove("failed");L.setAttribute("aria-busy","false");clearTimeout(t)}});o.observe(L,{attributes:true,attributeFilter:["class"]});'
  + 'addEventListener("error",function(e){var n=e.target;if(n&&n.tagName==="SCRIPT")fail()},true);addEventListener("unhandledrejection",fail);'
  + 'document.getElementById("loading-retry").onclick=function(){location.reload()}})()';

/** The shape of what is coming: a globe where there is a globe, a card grid
 *  where there is a grid of scenes, lines of text where there is reading. */
const skeleton = (kind) => {
  if (kind === 'cards') {
    return '    <div class="ld-cards" aria-hidden="true">' + '<i class="ld-sk ld-card"></i>'.repeat(3) + '</div>';
  }
  if (kind === 'lines') {
    return '    <div class="ld-lines" aria-hidden="true">' + '<i class="ld-sk ld-line"></i>'.repeat(5) + '</div>';
  }
  return `    <div class="ld-art" aria-hidden="true">
      <i class="ld-sk ld-sphere"></i>
      <img id="loading-globe" src="/loading-globe-sm.svg" alt="" width="180" height="180" decoding="async" fetchpriority="low" onload="this.parentNode.classList.add('ready')">
    </div>`;
};


// PHONE NAVIGATION (Fable ruling 3). Under 768 px the top strip showed a fragment of one tab beside "Routes",
// so the destinations move to a bottom tab bar: visible, five slots, labelled (tab-bars.md). Globe, Bible and
// Scenes are pages; 3D Spaces and All open the menus the bar already has. Figures, Panorama, Routes and the
// language switch live inside All. Tablet and desktop never see it (CSS). The icons are monochrome line glyphs
// and the current tab is gold AND heavier, not colour alone.
const ICON = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  bible: '<path d="M4 5.5c2.7-1.2 5.3-1.2 8 .5 2.7-1.7 5.3-1.7 8-.5V19c-2.7-1.2-5.3-1.2-8 .5-2.7-1.7-5.3-1.7-8-.5z"/><path d="M12 6v13.5"/>',
  scenes: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  space: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  all: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
};
const svg = (name) => `<svg class="tb-i" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
const tabbar = (page) => {
  const inWalks = !!page.walk;
  const inAll = page.file === 'figures.html' || page.file === 'plan.html';
  const link = (file, href, icon, en, zh) =>
    `    <a class="tb" href="${href}"${page.file === file ? ' aria-current="page"' : ''}>${svg(icon)}<span data-en="${en}" data-zh="${zh}">${en}</span></a>`;
  const opener = (opens, icon, en, zh, here) =>
    `    <button type="button" class="tb" data-opens="${opens}" aria-haspopup="true" aria-expanded="false" aria-controls="${opens}"${here ? ' aria-current="page"' : ''}>${svg(icon)}<span data-en="${en}" data-zh="${zh}">${en}</span></button>`;
  return `  <nav class="tabbar" aria-label="Sections">
${link('index.html', '/', 'globe', 'Globe', '地球')}
${link('bible.html', '/bible.html', 'bible', 'Bible', '圣经')}
${link('scenes.html', '/scenes.html', 'scenes', 'Scenes', '画卷')}
${opener('walkmenu', 'space', '3D Spaces', '走进 3D', inWalks)}
${opener('allmenu', 'all', 'All', '全部', inAll)}
  </nav>`;
};

const shell = (page) => `${START}
  <!-- The opening screen. It is markup rather than something the page's own
       script draws, because the whole point of it is to be on screen BEFORE
       that script has run. The globe is a standalone SVG turning on its own
       CSS, so it costs no WebGL context and no module. -->
  <div id="loading" role="status" aria-live="polite" aria-busy="true">
    <i id="loading-bar" aria-hidden="true"></i>
${skeleton(page.sk)}
    <p id="loading-title" class="tri" aria-hidden="true"><i class="l-en">${PRODUCT_NAMES.wordmark}</i><i class="l-hans">${NAME_HANS}</i><i class="l-hant">${NAME_HANT}</i><i class="l-ru">${PRODUCT_NAMES.wordmark}</i></p>
    <p id="loading-text" class="tri"><i class="l-en">${page.loadEn}</i><i class="l-hans">${page.loadHans}</i><i class="l-hant">${page.loadHant}</i></p>
    <div id="loading-error" role="alert">
      <p class="tri" style="margin:0"><i class="l-en">Loading did not finish. Check your connection and try again.</i><i class="l-hans">加载没有完成。请检查网络后重试。</i><i class="l-hant">載入沒有完成。請檢查網路後重試。</i></p>
      <button type="button" id="loading-retry" class="tri"><i class="l-en">Try again</i><i class="l-hans">重试</i><i class="l-hant">重試</i></button>
    </div>
  </div>
  <script>${GUARD}</script>
  <noscript><style>#loading{display:none}</style></noscript>

  <nav class="sitenav">
    <a class="brand" href="/">
      <img class="brand-logo" src="/brand-logo.webp" alt="" width="34" height="34">
      <span class="brand-words">
        ${wordmarkLockup()}
        <span class="en">${PRODUCT_NAMES.wordmark}</span>
        <span class="pg" data-en="${page.en}" data-zh="${page.zh}">${page.en}</span>
      </span>
    </a>
    <!-- Everything there is, and everything there is going to be. The bar can
         hold six destinations and the plan has fifty-six units; a bar is the
         wrong shape for a growing app, so the bar keeps what is built and this
         button opens the whole index. On a phone the bar drops the tabs and
         this is the only way through — which is why it is not an afterthought
         at the end of the row. -->
    <button type="button" id="all-open" aria-expanded="false" aria-controls="allmenu">
      <span aria-hidden="true">☰</span> <b data-en="All" data-zh="全部">All</b></button>
    <!-- THE JOURNEYS, ON EVERY PAGE.
         They used to be a pill at the bottom-left corner of the globe and
         nowhere else at all: on the tabernacle, the temple, the ark and the
         plan there was no way to reach a journey, and on the globe itself it
         was furniture floating over the map rather than a way through the
         app. It is a destination, so it stands with the destinations.
         OUTSIDE the <ol> on purpose — that row is dropped below 980px, and
         routes must not disappear with it, the same reason 全部 is out here. -->
    <div class="tab-group" id="routes-group">
      <button type="button" id="routes-open" aria-expanded="false" aria-controls="routemenu">
        <b data-en="Routes" data-zh="路线">Routes</b><i class="chev" aria-hidden="true">▾</i></button>
      <div class="dd" id="routemenu" hidden></div>
    </div>
    <ol>
${tabs(page.file)}
    </ol>
    <span class="spacer"></span>
    <div class="lang-switch" role="group" aria-label="Language / 语言">
      <button type="button" data-locale="en" lang="en">EN</button>
      <button type="button" data-locale="zh-Hans" lang="zh-Hans">简</button>
      <button type="button" data-locale="zh-Hant" lang="zh-Hant">繁</button>
    </div>
  </nav>
${tabbar(page)}
  <!-- Filled by src/site-shell.ts from the same plan the Plan page reads. -->
  <div id="allmenu" hidden></div>
${END}`;

// The gallery surface (scripts/lib/vite-gallery-surface.mjs) takes the head block, the loading-screen script and the
// font link from here, so the two surfaces cannot drift. Importing this file must not rewrite the pages.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

let changed = 0;
for (const page of isMain ? PAGES : []) {
  const path = join(ROOT, page.file);
  let html = readFileSync(path, 'utf8');
  const block = shell(page);
  const a = html.indexOf(START);
  if (a >= 0) {
    const b = html.indexOf(END, a);
    if (b < 0) throw new Error(`${page.file}: shell:start without shell:end`);
    html = html.slice(0, a) + block + html.slice(b + END.length);
  } else {
    // First run on a page written by hand: take out what it has and put the
    // canonical block in, right after <body> so the loading screen is the
    // first thing in the document.
    html = html.replace(/[ \t]*<div id="loading">[\s\S]*?<\/div>\n/, '');
    html = html.replace(/[ \t]*<nav class="sitenav">[\s\S]*?<\/nav>\n/, '');
    const body = html.indexOf('<body>');
    if (body < 0) throw new Error(`${page.file}: no <body>`);
    const at = body + '<body>'.length;
    html = html.slice(0, at) + '\n' + block + '\n' + html.slice(at);
  }
  // …the font links, which are the same on every page. The pages used to carry a preconnect pair and a
  // Google stylesheet link; both go, and nothing replaces the preconnects because the files are ours.
  // Written to be idempotent: it rewrites whichever form the page is carrying.
  html = html.replace(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\n?/g, '');
  html = html.replace(/[ \t]*<link rel="preload" href="\/fonts\/[^>]*>\n?/g, '');
  html = html.replace(
    /[ \t]*(?:<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>(?:\s*<noscript>[\s\S]*?<\/noscript>)?|<link rel="stylesheet" href="\/fonts\/fonts\.css">)/,
    FONTS,
  );

  // …the tab icon (a 7 KB stand-in for the 297 KB icon.svg; scripts/build-small-brand.py)…
  html = html.replace('<link rel="icon" href="/icon.svg" type="image/svg+xml">', '<link rel="icon" href="/icon-sm.svg" type="image/svg+xml">');

  // …and the anti-flash rule in the head, BETWEEN TWO MARKERS.
  //
  // It used to be found by a pattern that ended at </style>, which matched
  // only the first half of what it had written. Every run therefore left the
  // old <script> in place and appended a new one: by the time this was caught
  // the pages carried twenty copies of it, all doing the same thing. A block
  // that is rewritten needs a mark at BOTH ends.
  const headAt = html.indexOf('<!-- shell:head -->');
  if (headAt < 0) {
    html = html.replace('</head>', `${HEAD}\n</head>`);
  } else {
    const headEnd = html.indexOf(HEAD_END, headAt);
    const from = html.lastIndexOf('\n', headAt) + 1;
    html = headEnd < 0
      // A page written by the broken version: take everything it left behind.
      ? html.slice(0, from) + HEAD + '\n' + html.slice(html.indexOf('</head>', headAt))
      : html.slice(0, from) + HEAD + html.slice(headEnd + HEAD_END.length);
  }

  const before = readFileSync(path, 'utf8');
  if (before !== html) { writeFileSync(path, html); changed++; }
}
if (isMain) console.log(`shell: ${PAGES.length} pages, ${changed} rewritten`);

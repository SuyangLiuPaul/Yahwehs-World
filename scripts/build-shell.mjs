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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The pages, in the order they stand in the nav. */
const PAGES = [
  { file: 'index.html', href: '/', en: 'Globe', narrowEn: 'Globe', zh: '圣经世界', narrowZh: '地球',
    loadEn: 'Drawing the world…', loadZh: '正在绘制世界…' },
  { file: 'structures.html', href: '/structures.html', en: 'Measures', narrowEn: 'Sizes', zh: '照着经文的尺寸', narrowZh: '尺寸',
    loadEn: 'Building to the measurements…', loadZh: '正在照着尺寸建造…' },
  { file: 'tabernacle.html', href: '/tabernacle.html', en: 'Tabernacle', narrowEn: 'Tent', zh: '走进会幕', narrowZh: '会幕',
    loadEn: 'Raising the tabernacle…', loadZh: '正在支搭会幕…' },
  { file: 'temple.html', href: '/temple.html', en: 'Temple', narrowEn: 'Temple', zh: '走进圣殿', narrowZh: '圣殿',
    loadEn: 'Building the house…', loadZh: '正在建造圣殿…' },
  { file: 'ark.html', href: '/ark.html', en: 'Ark', narrowEn: 'Ark', zh: '走进方舟', narrowZh: '方舟',
    loadEn: 'Building the ark…', loadZh: '正在造方舟…' },
  { file: 'plan.html', href: '/plan.html', en: 'Plan', narrowEn: 'Plan', zh: '完整的计划', narrowZh: '计划',
    loadEn: 'Laying out the plan…', loadZh: '正在整理全部计划…' },
];

const START = '  <!-- shell:start — written by scripts/build-shell.mjs. Edit that, not this. -->';
const END = '  <!-- shell:end -->';

// The frame BEFORE the loading screen. The stylesheet is a separate file, so
// between the first paint and the CSS arriving the page is whatever white the
// browser defaults to — a flash of white in front of a dark app, on every
// navigation. Two declarations inline in the head cost nothing and remove it.
// `color-scheme` is what stops the scrollbars and the form controls flashing
// light as well.
const HEAD = `  <!-- shell:head --><style>:root{color-scheme:dark}html,body{background:#060d16;margin:0}</style>`;

const tabs = (self) => PAGES.map((p) =>
  `      <li><a class="tab" href="${p.href}"${p.file === self ? ' aria-current="page"' : ''}` +
  ` data-en="${p.en}" data-en-narrow="${p.narrowEn}" data-zh="${p.zh}" data-zh-narrow="${p.narrowZh}">${p.en}</a></li>`
).join('\n');

const shell = (page) => `${START}
  <!-- The opening screen. It is markup rather than something the page's own
       script draws, because the whole point of it is to be on screen BEFORE
       that script has run. The globe is a standalone SVG turning on its own
       CSS, so it costs no WebGL context and no module. -->
  <div id="loading">
    <i id="loading-bar"></i>
    <img id="loading-globe" src="/loading-globe.svg" alt="" width="180" height="180">
    <p id="loading-text" data-en="${page.loadEn}" data-zh="${page.loadZh}">${page.loadEn}</p>
  </div>

  <nav class="sitenav">
    <a class="brand" href="/">
      <span class="zh" data-zh-text="雅伟之界">雅伟之界</span>
      <span class="en">Yahweh's World</span>
    </a>
    <!-- Everything there is, and everything there is going to be. The bar can
         hold six destinations and the plan has fifty-six units; a bar is the
         wrong shape for a growing app, so the bar keeps what is built and this
         button opens the whole index. On a phone the bar drops the tabs and
         this is the only way through — which is why it is not an afterthought
         at the end of the row. -->
    <button type="button" id="all-open" aria-expanded="false" aria-controls="allmenu"
      data-en="All" data-zh="全部"><span aria-hidden="true">☰</span> <b>All</b></button>
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
  <!-- Filled by src/site-shell.ts from the same plan the Plan page reads. -->
  <div id="allmenu" hidden></div>
${END}`;

let changed = 0;
for (const page of PAGES) {
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
  // …and the anti-flash rule in the head.
  if (!html.includes('<!-- shell:head -->')) {
    html = html.replace('</head>', `${HEAD}\n</head>`);
  } else {
    html = html.replace(/[ \t]*<!-- shell:head --><style>.*?<\/style>/, HEAD);
  }

  const before = readFileSync(path, 'utf8');
  if (before !== html) { writeFileSync(path, html); changed++; }
}
console.log(`shell: ${PAGES.length} pages, ${changed} rewritten`);

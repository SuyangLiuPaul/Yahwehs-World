#!/usr/bin/env node
/**
 * Builds the standalone downloadable EPUB 3 book:
 *   public/downloads/cuv-yahweh-illustrated-1443.epub
 *
 * Includes all 7 user refinements:
 *   1. High-resolution canonical event plate links (merged-full 1672x941)
 *   2. Same-page / paragraph-group cohesion (.para-group)
 *   3. Pure Chinese titles, chapter headers, and scripture references (no mixed English)
 *   4. Plain 雅伟 rendered as normal text (not highlighted)
 *   5. Unified warm amber/bronze color (#78350f on #fffbeb) for all markers and ① ② note blocks
 *   6. All 66 Book Intros, 1,443 Words Section Headings & Explanations, 13,616 Paragraph Starts, 41 OT Quotation Blocks, and Chapter Banners placed BEFORE sections
 *   7. Clean layout without repeating marker counts
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const cuvs = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/bible/cuvs-yhwh.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/bible/meta.json'), 'utf8'));
const allEvents = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/events.json'), 'utf8')).events;

const BOOKS = [
  { b: 1, zh: '创世记' },
  { b: 2, zh: '出埃及记' },
  { b: 3, zh: '利未记' },
  { b: 4, zh: '民数记' },
  { b: 5, zh: '申命记' },
  { b: 6, zh: '约书亚记' },
  { b: 7, zh: '士师记' },
  { b: 8, zh: '路得记' },
  { b: 9, zh: '撒母耳记上' },
  { b: 10, zh: '撒母耳记下' },
  { b: 11, zh: '列王纪上' },
  { b: 12, zh: '列王纪下' },
  { b: 13, zh: '历代志上' },
  { b: 14, zh: '历代志下' },
  { b: 15, zh: '以斯拉记' },
  { b: 16, zh: '尼希米记' },
  { b: 17, zh: '以斯帖记' },
  { b: 18, zh: '约伯记' },
  { b: 19, zh: '诗篇' },
  { b: 20, zh: '箴言' },
  { b: 21, zh: '传道书' },
  { b: 22, zh: '雅歌' },
  { b: 23, zh: '以赛亚书' },
  { b: 24, zh: '耶利米书' },
  { b: 25, zh: '耶利米哀歌' },
  { b: 26, zh: '以西结书' },
  { b: 27, zh: '但以理书' },
  { b: 28, zh: '何西阿书' },
  { b: 29, zh: '约珥书' },
  { b: 30, zh: '阿摩司书' },
  { b: 31, zh: '俄巴底亚书' },
  { b: 32, zh: '约拿书' },
  { b: 33, zh: '弥迦书' },
  { b: 34, zh: '那鸿书' },
  { b: 35, zh: '哈巴谷书' },
  { b: 36, zh: '西番雅书' },
  { b: 37, zh: '哈该书' },
  { b: 38, zh: '撒迦利亚书' },
  { b: 39, zh: '玛拉基书' },
  { b: 40, zh: '马太福音' },
  { b: 41, zh: '马可福音' },
  { b: 42, zh: '路加福音' },
  { b: 43, zh: '约翰福音' },
  { b: 44, zh: '使徒行传' },
  { b: 45, zh: '罗马书' },
  { b: 46, zh: '哥林多前书' },
  { b: 47, zh: '哥林多后书' },
  { b: 48, zh: '加拉太书' },
  { b: 49, zh: '以弗所书' },
  { b: 50, zh: '腓立比书' },
  { b: 51, zh: '歌罗西书' },
  { b: 52, zh: '帖撒罗尼迦前书' },
  { b: 53, zh: '帖撒罗尼迦后书' },
  { b: 54, zh: '提摩太前书' },
  { b: 55, zh: '提摩太后书' },
  { b: 56, zh: '提多书' },
  { b: 57, zh: '腓利门书' },
  { b: 58, zh: '希伯来书' },
  { b: 59, zh: '雅各书' },
  { b: 60, zh: '彼得前书' },
  { b: 61, zh: '彼得后书' },
  { b: 62, zh: '约翰一书' },
  { b: 63, zh: '约翰二书' },
  { b: 64, zh: '约翰三书' },
  { b: 65, zh: '犹大书' },
  { b: 66, zh: '启示录' },
];

const paraStartSet = new Set(meta.paraStarts);
const refVerseSet = new Set(meta.refVerses ?? []);
const wordsSections = meta.wordsSections ?? {};

function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function circledNumber(n) {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21);
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + n - 36);
  return String(n);
}

function renderVerseXhtml(rawText, paraNotesOut, vLabel) {
  const notePlaceholders = [];
  let working = rawText.replace(/(?:<note:[^>]+>)+/g, (runMatch) => {
    const singleRegex = /<note:([^>]+)>/g;
    let m;
    let firstLocal = 0;
    let lastLocal = 0;
    while ((m = singleRegex.exec(runMatch)) !== null) {
      paraNotesOut.push({ vLabel, text: m[1].trim() });
      const localNum = paraNotesOut.length;
      if (!firstLocal) firstLocal = localNum;
      lastLocal = localNum;
    }
    const badge =
      lastLocal > firstLocal
        ? `${circledNumber(firstLocal)}⁻${circledNumber(lastLocal)}`
        : circledNumber(firstLocal);
    const idx = notePlaceholders.length;
    notePlaceholders.push(`<span class="fn-ref">${badge}</span>`);
    return `\x01FN_${idx}\x02`;
  });

  working = working.replace(/<H0>/g, '\x01H0\x02').replace(/<G0>/g, '\x01G0\x02');
  working = escXml(working);

  // Unified single-color highlight for 主[雅伟], 主[耶稣], 主[基督]
  working = working.replace(
    /(主宰|主|我|他)\s*\[(雅伟|耶稣|基督)\]/g,
    (_, host, target) => `<span class="mark">${host}[${target}]</span>`,
  );

  // Plain 雅伟 is NOT highlighted per user requirement
  working = working.replace(/\x01(H0|G0)\x02/g, '<sup class="hg0">$1</sup>');
  working = working.replace(/〔([^〕]+)〕/g, '<span class="apparatus">〔$1〕</span>');
  working = working.replace(/\x01FN_(\d+)\x02/g, (_, idx) => notePlaceholders[Number(idx)] ?? '');

  return working;
}

function renderParaNotesXhtml(notes, multiVerse) {
  if (!notes.length) return '';
  const rows = notes
    .map((n, i) => {
      const vref = multiVerse ? `<span class="vnb-vref">(${escXml(n.vLabel)})</span> ` : '';
      return `<tr><td class="vnb-num">${circledNumber(i + 1)}</td><td class="vnb-text">${vref}${escXml(n.text)}</td></tr>`;
    })
    .join('');
  return `<div class="vnb"><table><tbody>${rows}</tbody></table></div>`;
}

// Group events by book
const eventsByBook = new Map();
allEvents.forEach((ev, i) => {
  ev._globalIdx = i + 1;
  const list = eventsByBook.get(ev.b) ?? [];
  list.push(ev);
  eventsByBook.set(ev.b, list);
});

const tmpDir = path.join(ROOT, '.tmp-epub-build');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(path.join(tmpDir, 'META-INF'), { recursive: true });
fs.mkdirSync(path.join(tmpDir, 'OEBPS'), { recursive: true });

// 1. mimetype
fs.writeFileSync(path.join(tmpDir, 'mimetype'), 'application/epub+zip', 'utf8');

// 2. META-INF/container.xml
fs.writeFileSync(
  path.join(tmpDir, 'META-INF/container.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  'utf8',
);

// 3. OEBPS/style.css
fs.writeFileSync(
  path.join(tmpDir, 'OEBPS/style.css'),
  `body {
  font-family: "Noto Serif SC", "Songti SC", "STSong", Georgia, serif;
  line-height: 1.85;
  color: #1c1917;
  margin: 0;
  padding: 0 4%;
}
h1, h2, h3 {
  font-family: "Noto Serif SC", Georgia, serif;
  color: #78350f;
}
.book-header {
  text-align: center;
  padding: 1.5em 0 1em;
  border-bottom: 2px solid #d97706;
  margin-bottom: 1.2em;
}
.book-kicker {
  font-size: 0.8em;
  letter-spacing: 0.1em;
  color: #92400e;
}
.book-intro {
  background: #fffbeb;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 0.8em 1em;
  margin-bottom: 1.5em;
  font-size: 0.92em;
}
.ch-banner {
  font-size: 1.18em;
  font-weight: bold;
  color: #78350f;
  margin: 1.4em 0 0.6em;
  padding: 0.35em 0.7em;
  background: #fef3c7;
  border-left: 4px solid #b45309;
  border-radius: 4px;
}
.sec {
  page-break-inside: avoid;
  break-inside: avoid;
}
.sec-card {
  margin: 1.1em 0 0.7em;
  padding: 0.75em 1em;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #d97706;
  border-radius: 4px;
}
.sec-kicker {
  font-size: 0.78em;
  color: #92400e;
  font-weight: bold;
}
.sec-title {
  margin: 0.2em 0;
  font-size: 1.15em;
  color: #1c1917;
}
.sec-sum {
  margin: 0.3em 0 0;
  font-size: 0.88em;
  color: #44403c;
}
.sec-link {
  display: inline-block;
  margin-top: 0.35em;
  font-size: 0.8em;
  color: #92400e;
  text-decoration: underline;
}
.para-group {
  page-break-inside: avoid;
  break-inside: avoid;
  margin-bottom: 0.55em;
}
.para {
  margin: 0;
  text-align: justify;
  text-indent: 2em;
}
.para-ref {
  margin: 0.15em 0 0.25em 2.2em;
  padding-left: 0.65em;
  border-left: 2px solid #d6d3d1;
  color: #44403c;
  text-indent: 0;
}
.vnum {
  font-size: 0.7em;
  font-weight: bold;
  color: #92400e;
  vertical-align: super;
  margin-right: 2px;
}
/* Unified single color (#78350f on #fef3c7 / #fffbeb) for all markers and ① ② notes */
.mark, .hg0, .fn-ref {
  color: #78350f;
  background: #fef3c7;
  border-bottom: 1px solid #d97706;
  font-weight: 600;
  padding: 0 3px;
  border-radius: 3px;
}
.hg0 {
  font-size: 0.64em;
}
.fn-ref {
  font-size: 0.78em;
}
.apparatus {
  color: #57534e;
  font-size: 0.92em;
}
.vnb {
  margin: 0.25em 0 0.45em 1.2em;
  padding: 0.4em 0.7em;
  border-left: 3px solid #d97706;
  background: #fffbeb;
  border-radius: 4px;
  font-size: 0.86em;
  color: #78350f;
}
.vnb table {
  border-collapse: collapse;
  width: 100%;
}
.vnb-num {
  width: 1%;
  white-space: nowrap;
  vertical-align: top;
  padding-right: 6px;
  font-weight: bold;
  color: #78350f;
}
.vnb-text {
  vertical-align: top;
  color: #78350f;
}
.vnb-vref {
  color: #78350f;
  font-weight: 600;
  font-size: 0.92em;
}
`,
  'utf8',
);

// 4. OEBPS/intro.xhtml
fs.writeFileSync(
  path.join(tmpDir, 'OEBPS/intro.xhtml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <title>《和合本雅伟版 · 画卷圣经》凡例与导读</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="book-header">
    <div class="book-kicker">和合本雅伟版 · 全书六十六卷 · 一千四百四十三幅圣经历史画卷</div>
    <h1>《和合本雅伟版 · 画卷圣经》</h1>
    <p>全书 66 卷 · 1,189 章 · 31,102 节经文 · 1,443 幅正典事件画卷</p>
  </div>
  <div class="book-intro">
    <h3>一、全书凡例与专属标志总表</h3>
    <p>本书将整本《和合本雅伟版》（共 66 卷、1,189 章、31,102 节经文）与全部 1,443 幅正典事件画卷、66 卷书卷导读、1,443 段分段标题及背景解析、13,616 个自然段落完整嵌合：</p>
    <ul>
      <li><strong>神圣之名「雅伟」（全书 7,181 处）</strong>：希伯来圣经圣名 יהוה（YHWH）及希腊圣经引文恢复译为「雅伟」，正文中保持自然排印、不额外加底色，使长篇阅读舒适自然。</li>
      <li><strong><span class="mark">主[雅伟]</span>（全书 212 处）</strong>：标明原文作「主」或代词，按上下文意所指的是<strong>雅伟</strong>。</li>
      <li><strong><span class="mark">主[耶稣]</span>（全书 123 处）</strong>：标明希腊圣经原文作「主」，按上下文意所指的是<strong>主耶稣</strong>。</li>
      <li><strong><span class="mark">主[基督]</span>（全书 17 处）</strong>：标明按上下文意所指的是<strong>基督／弥赛亚</strong>（如诗 110:1 及太 22:44「主[雅伟]对我主[基督]说」）。</li>
      <li><strong><sup class="hg0">H0</sup> / <sup class="hg0">G0</sup> 原文补词标志（全书 295 处：希伯来圣经 H0 共 253 处，希腊圣经 G0 共 42 处）</strong>：标明中文译本按上下文补出而原文无独立对应词之处。</li>
      <li><strong><span class="fn-ref">①</span> <span class="fn-ref">②</span> 随段双栏译者小注（全书 1,202 条）</strong>：所有专属标志与随段译者注采用统一暖金棕色（不混杂红蓝多色），紧贴所属自然段下方呈现。</li>
    </ul>
    <p>在线交互版：<a href="https://yahwehsworld-dev.netlify.app/bible.html">https://yahwehsworld-dev.netlify.app/bible.html</a></p>
  </div>
</body>
</html>`,
  'utf8',
);

// 5. Generate OEBPS/book-01.xhtml .. book-66.xhtml
const manifestItems = [
  `<item id="css" href="style.css" media-type="text/css"/>`,
  `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
  `<item id="intro" href="intro.xhtml" media-type="application/xhtml+xml"/>`,
];
const spineItems = [`<itemref idref="intro"/>`];
const navLinks = [`<li><a href="intro.xhtml">凡例与专属标志导读</a></li>`];

for (const bMeta of BOOKS) {
  const bNum = bMeta.b;
  const fileId = `book-${String(bNum).padStart(2, '0')}`;
  const fileName = `${fileId}.xhtml`;
  const bookEvs = eventsByBook.get(bNum) ?? [];
  const zhChs = cuvs.books[bNum - 1] ?? [];
  const intro = meta.intros[bNum - 1];

  const seenCh = new Set();
  const sectionsXhtml = [];

  for (let sIdx = 0; sIdx < bookEvs.length; sIdx++) {
    const ev = bookEvs[sIdx];
    const cStart = Math.floor(ev.s / 1000) % 1000;
    const vStart = ev.s % 1000;
    const cEnd = Math.floor(ev.e / 1000) % 1000;
    const vEnd = ev.e % 1000;

    // Place chapter banner BEFORE the section card if this section starts a new chapter
    let preSectionBanner = '';
    if (!seenCh.has(cStart)) {
      seenCh.add(cStart);
      preSectionBanner = `<div class="ch-banner" id="ch-${cStart}">${escXml(bMeta.zh)} 第 ${cStart} 章</div>`;
    }

    const blocks = [];
    let paraVerses = [];
    let paraNotes = [];
    let paraIsRef = false;

    const flushPara = () => {
      if (paraVerses.length > 0) {
        const notesHtml = renderParaNotesXhtml(paraNotes, paraVerses.length > 1);
        const cls = paraIsRef ? 'para para-ref' : 'para';
        blocks.push(`<div class="para-group"><p class="${cls}">${paraVerses.join(' ')}</p>${notesHtml}</div>`);
        paraVerses = [];
        paraNotes = [];
        paraIsRef = false;
      }
    };

    for (let c = cStart; c <= cEnd; c++) {
      const chVerses = zhChs[c - 1] ?? [];
      const vMin = c === cStart ? vStart : 1;
      const vMax = c === cEnd ? vEnd : chVerses.length;

      if (!seenCh.has(c)) {
        flushPara();
        seenCh.add(c);
        blocks.push(`<div class="ch-banner" id="ch-${c}">${escXml(bMeta.zh)} 第 ${c} 章</div>`);
      }

      for (let v = vMin; v <= vMax; v++) {
        const vid = bNum * 1_000_000 + c * 1000 + v;
        if (paraStartSet.has(vid) && paraVerses.length > 0) {
          flushPara();
        }
        if (paraVerses.length === 0) {
          paraIsRef = refVerseSet.has(vid);
        }
        const rawV = chVerses[v - 1] ?? '';
        const vLabel = cStart === cEnd ? `${v}` : `${c}:${v}`;
        const vXhtml = renderVerseXhtml(rawV, paraNotes, `${c}:${v}`);
        paraVerses.push(`<span class="v"><span class="vnum">${vLabel}</span>${vXhtml}</span>`);
      }
    }
    flushPara();

    const ws = wordsSections[String(ev.s)];
    const titleZh = ws?.titleHans || ev.zh;
    const wordsCtx = (ws?.contextHans || '').trim();
    const evSum = (ev.sum || '').trim();
    let explainText = '';
    if (wordsCtx && evSum) {
      explainText =
        wordsCtx === evSum || evSum.includes(wordsCtx)
          ? evSum
          : wordsCtx.includes(evSum)
            ? wordsCtx
            : `${wordsCtx} ${evSum}`;
    } else {
      explainText = wordsCtx || evSum;
    }

    const plateUrl = `https://yahwehs-scenes.netlify.app/merged-full/${ev.id}.jpg`;
    sectionsXhtml.push(`
      ${preSectionBanner}
      <section class="sec" id="sec-${escXml(ev.id)}">
        <div class="sec-card">
          <div class="sec-kicker">画卷 #${ev._globalIdx} / 1,443 · ${escXml(ev.refZh)}</div>
          <h3 class="sec-title">${escXml(titleZh)}</h3>
          ${explainText ? `<p class="sec-sum"><strong>【段落导读】</strong>${escXml(explainText)}</p>` : ''}
          <a class="sec-link" href="${plateUrl}">🖼️ 查看本段高清画卷（编号 #${ev._globalIdx}）</a>
        </div>
        ${blocks.join('\n')}
      </section>
    `);
  }

  const themesZh = Array.isArray(intro?.themes?.hans)
    ? intro.themes.hans.map((t) => escXml(t)).join(' · ')
    : '';
  const introXhtml = intro
    ? `<div class="book-intro">
        <p><strong>${escXml(intro.subtitle?.hans)}</strong></p>
        <p>${escXml(intro.summary?.hans)}</p>
        <p><strong>作者：</strong>${escXml(intro.author?.hans)} ｜ <strong>成书年代：</strong>${escXml(intro.date?.hans)}${intro.audience?.hans ? ` ｜ <strong>受众：</strong>${escXml(intro.audience.hans)}` : ''}</p>
        ${themesZh ? `<p><strong>核心主题：</strong>${themesZh}</p>` : ''}
        ${intro.keyPassage ? `<p><strong>核心经文（${escXml(intro.keyPassage)}）：</strong>${escXml(intro.keyPassageDesc?.hans ?? '')}</p>` : ''}
      </div>`
    : '';

  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <title>${escXml(bMeta.zh)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="book-header">
    <div class="book-kicker">圣经正典 第 ${bNum} / 66 卷 · 共 ${zhChs.length} 章 · ${bookEvs.length} 幅正典事件画卷</div>
    <h1>${escXml(bMeta.zh)}</h1>
  </div>
  ${introXhtml}
  ${sectionsXhtml.join('\n')}
</body>
</html>`;

  fs.writeFileSync(path.join(tmpDir, 'OEBPS', fileName), xhtml, 'utf8');
  manifestItems.push(`<item id="${fileId}" href="${fileName}" media-type="application/xhtml+xml"/>`);
  spineItems.push(`<itemref idref="${fileId}"/>`);
  navLinks.push(`<li><a href="${fileName}">${bNum}. ${escXml(bMeta.zh)} · ${bookEvs.length}图</a></li>`);
}

// 6. OEBPS/nav.xhtml
fs.writeFileSync(
  path.join(tmpDir, 'OEBPS/nav.xhtml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <title>目录 · 《和合本雅伟版 · 画卷圣经》</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>《和合本雅伟版 · 画卷圣经》全书 66 卷目录</h1>
    <ol>
      ${navLinks.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`,
  'utf8',
);

// 7. OEBPS/content.opf
fs.writeFileSync(
  path.join(tmpDir, 'OEBPS/content.opf'),
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:cuv-yahweh-illustrated-1443-v2</dc:identifier>
    <dc:title>《和合本雅伟版 · 画卷圣经》（全66卷·1,443幅正典画卷·分段导读与译者注完整版）</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:creator>Yahweh's World · 雅伟的世界</dc:creator>
    <dc:description>将整本《和合本雅伟版》（31,102 节经文）与全部 1,443 幅正典事件画卷、66卷书卷导读、1,443段分段标题及背景解析、13,616个自然段落完整嵌合，完整保留雅伟版专属标志（主[雅伟] 212处、主[耶稣] 123处、主[基督] 17处、H0/G0 295处、①②随段译者小注 1,202条）。</dc:description>
    <meta property="dcterms:modified">2026-10-16T09:00:00Z</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine>
    ${spineItems.join('\n    ')}
  </spine>
</package>`,
  'utf8',
);

// 8. Package into valid EPUB zip container
const outDir = path.join(ROOT, 'public/downloads');
fs.mkdirSync(outDir, { recursive: true });
const outEpub = path.join(outDir, 'cuv-yahweh-illustrated-1443.epub');
fs.rmSync(outEpub, { force: true });

execFileSync('zip', ['-0Xq', outEpub, 'mimetype'], { cwd: tmpDir });
execFileSync('zip', ['-9XrDq', outEpub, 'META-INF', 'OEBPS'], { cwd: tmpDir });
fs.rmSync(tmpDir, { recursive: true, force: true });

const stat = fs.statSync(outEpub);
console.log(`Built ${outEpub} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

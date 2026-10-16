#!/usr/bin/env node
/**
 * Builds the standalone downloadable Illustrated CUV-Yahweh Bible PDF Book:
 *   public/downloads/cuv-yahweh-illustrated-1443.pdf
 *
 * Key Design & Typography Principles:
 *   1. Pure Chinese throughout (no mixed English in book titles, section titles, or verse refs).
 *   2. Plain 「雅伟」 in scripture text is NOT highlighted; only special referent markers
 *      (主[雅伟], 主[耶稣], 主[基督]), H0/G0, and ① ② translator notes carry unified warm-amber styling.
 *   3. Unified single-color styling (#78350f on #fffbeb/#fef3c7) for all inline badges and
 *      ① (18:19) translator note blocks (no multi-colored blue/red/orange).
 *   4. Full Yahweh's Words structure included:
 *      - Complete 66 Book Introductions (subtitle, summary, author, date, audience, themes, keyPassage + explanation)
 *      - Chapter banners placed OUTSIDE and BEFORE the chapter's sections
 *      - All 1,443 Section Headings + full Yahweh's Words study explanations (section_titles.json context + events sum)
 *      - All 13,616 Paragraph divisions (11,922 OT + 1,694 NT from biblexg-v2) with 2em Chinese first-line indent
 *      - All 41 NT Old Testament quotation/reference blocks indented
 *      - All 1,202 ① ② per-paragraph translator notes
 *   5. Large, crystal-clear panoramic illustrations sourced from merged-full (1672x941) so readers
 *      immediately have a strong visual sense (有图像感), while keeping each section & paragraph + notes
 *      together on the same page (break-inside: avoid).
 *   6. Marker counts & legend appear ONCE in the Frontmatter Guide (never repeated on page footers).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const cuvs = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/bible/cuvs-yhwh.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/bible/meta.json'), 'utf8'));
const allEvents = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/events.json'), 'utf8')).events;

const BOOKS = [
  { b: 1, en: 'Genesis', zh: '创世记' },
  { b: 2, en: 'Exodus', zh: '出埃及记' },
  { b: 3, en: 'Leviticus', zh: '利未记' },
  { b: 4, en: 'Numbers', zh: '民数记' },
  { b: 5, en: 'Deuteronomy', zh: '申命记' },
  { b: 6, en: 'Joshua', zh: '约书亚记' },
  { b: 7, en: 'Judges', zh: '士师记' },
  { b: 8, en: 'Ruth', zh: '路得记' },
  { b: 9, en: '1 Samuel', zh: '撒母耳记上' },
  { b: 10, en: '2 Samuel', zh: '撒母耳记下' },
  { b: 11, en: '1 Kings', zh: '列王纪上' },
  { b: 12, en: '2 Kings', zh: '列王纪下' },
  { b: 13, en: '1 Chronicles', zh: '历代志上' },
  { b: 14, en: '2 Chronicles', zh: '历代志下' },
  { b: 15, en: 'Ezra', zh: '以斯拉记' },
  { b: 16, en: 'Nehemiah', zh: '尼希米记' },
  { b: 17, en: 'Esther', zh: '以斯帖记' },
  { b: 18, en: 'Job', zh: '约伯记' },
  { b: 19, en: 'Psalms', zh: '诗篇' },
  { b: 20, en: 'Proverbs', zh: '箴言' },
  { b: 21, en: 'Ecclesiastes', zh: '传道书' },
  { b: 22, en: 'Song of Solomon', zh: '雅歌' },
  { b: 23, en: 'Isaiah', zh: '以赛亚书' },
  { b: 24, en: 'Jeremiah', zh: '耶利米书' },
  { b: 25, en: 'Lamentations', zh: '耶利米哀歌' },
  { b: 26, en: 'Ezekiel', zh: '以西结书' },
  { b: 27, en: 'Daniel', zh: '但以理书' },
  { b: 28, en: 'Hosea', zh: '何西阿书' },
  { b: 29, en: 'Joel', zh: '约珥书' },
  { b: 30, en: 'Amos', zh: '阿摩司书' },
  { b: 31, en: 'Obadiah', zh: '俄巴底亚书' },
  { b: 32, en: 'Jonah', zh: '约拿书' },
  { b: 33, en: 'Micah', zh: '弥迦书' },
  { b: 34, en: 'Nahum', zh: '那鸿书' },
  { b: 35, en: 'Habakkuk', zh: '哈巴谷书' },
  { b: 36, en: 'Zephaniah', zh: '西番雅书' },
  { b: 37, en: 'Haggai', zh: '哈该书' },
  { b: 38, en: 'Zechariah', zh: '撒迦利亚书' },
  { b: 39, en: 'Malachi', zh: '玛拉基书' },
  { b: 40, en: 'Matthew', zh: '马太福音' },
  { b: 41, en: 'Mark', zh: '马可福音' },
  { b: 42, en: 'Luke', zh: '路加福音' },
  { b: 43, en: 'John', zh: '约翰福音' },
  { b: 44, en: 'Acts', zh: '使徒行传' },
  { b: 45, en: 'Romans', zh: '罗马书' },
  { b: 46, en: '1 Corinthians', zh: '哥林多前书' },
  { b: 47, en: '2 Corinthians', zh: '哥林多后书' },
  { b: 48, en: 'Galatians', zh: '加拉太书' },
  { b: 49, en: 'Ephesians', zh: '以弗所书' },
  { b: 50, en: 'Philippians', zh: '腓立比书' },
  { b: 51, en: 'Colossians', zh: '歌罗西书' },
  { b: 52, en: '1 Thessalonians', zh: '帖撒罗尼迦前书' },
  { b: 53, en: '2 Thessalonians', zh: '帖撒罗尼迦后书' },
  { b: 54, en: '1 Timothy', zh: '提摩太前书' },
  { b: 55, en: '2 Timothy', zh: '提摩太后书' },
  { b: 56, en: 'Titus', zh: '提多书' },
  { b: 57, en: 'Philemon', zh: '腓利门书' },
  { b: 58, en: 'Hebrews', zh: '希伯来书' },
  { b: 59, en: 'James', zh: '雅各书' },
  { b: 60, en: '1 Peter', zh: '彼得前书' },
  { b: 61, en: '2 Peter', zh: '彼得后书' },
  { b: 62, en: '1 John', zh: '约翰一书' },
  { b: 63, en: '2 John', zh: '约翰二书' },
  { b: 64, en: '3 John', zh: '约翰三书' },
  { b: 65, en: 'Jude', zh: '犹大书' },
  { b: 66, en: 'Revelation', zh: '启示录' },
];

const paraStartSet = new Set(meta.paraStarts);
const refVerseSet = new Set(meta.refVerses ?? []);
const wordsSections = meta.wordsSections ?? {};

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function localizeKeyPassageZh(kp, bookZh) {
  if (!kp) return '';
  const m = String(kp).trim().match(/^(.+?)\s+(\d.*)$/);
  if (!m) return kp;
  return `${bookZh} ${m[2]}`;
}

function circledNumber(n) {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21);
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + n - 36);
  return String(n);
}

function renderVerseHtml(rawText, paraNotesOut, vLabel) {
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
  working = escHtml(working);

  // Unified single-color highlight for 主[雅伟], 主[耶稣], 主[基督] (plain 雅伟 is NOT highlighted)
  working = working.replace(
    /(主宰|主|我|他)\s*\[(雅伟|耶稣|基督)\]/g,
    (_, host, target) => `<span class="mark">${host}[${target}]</span>`,
  );

  working = working.replace(/\x01(H0|G0)\x02/g, '<sup class="hg0">$1</sup>');
  working = working.replace(/〔([^〕]+)〕/g, '<span class="apparatus">〔$1〕</span>');
  working = working.replace(/\x01FN_(\d+)\x02/g, (_, idx) => notePlaceholders[Number(idx)] ?? '');

  return working;
}

function renderParaNotesHtml(notes, multiVerse) {
  if (!notes.length) return '';
  const rows = notes
    .map((n, i) => {
      const vref = multiVerse ? `<span class="vnb-vref">(${escHtml(n.vLabel)})</span> ` : '';
      return `<tr><td class="vnb-num">${circledNumber(i + 1)}</td><td class="vnb-text">${vref}${escHtml(n.text)}</td></tr>`;
    })
    .join('');
  return `<div class="vnb"><table><tbody>${rows}</tbody></table></div>`;
}

// Step 1: Prepare 1,443 crystal-clear plates from merged-full (880x495 JPEG quality 68)
const thumbCacheDir = '/tmp/bible-pdf-plates-880';
console.log('1. Preparing 1,443 high-clarity event illustrations (880x495) from merged-full in', thumbCacheDir);
execFileSync(
  'python3',
  [
    '-c',
    `
import os, glob
from PIL import Image
from concurrent.futures import ThreadPoolExecutor

src_dir = "/Volumes/T7/yahwehs-globe-scenes/workspace-offload-20261013/site-project/site/merged-full"
dst_dir = "${thumbCacheDir}"
os.makedirs(dst_dir, exist_ok=True)
files = glob.glob(os.path.join(src_dir, "*.jpg"))

def proc(f):
    out = os.path.join(dst_dir, os.path.basename(f))
    if os.path.exists(out) and os.path.getsize(out) > 10000:
        return os.path.getsize(out)
    with Image.open(f) as im:
        im = im.convert("RGB")
        im.thumbnail((880, 495), Image.Resampling.LANCZOS)
        im.save(out, "JPEG", quality=68, optimize=True)
    return os.path.getsize(out)

with ThreadPoolExecutor(max_workers=8) as ex:
    sizes = list(ex.map(proc, files))
print(f"Prepared {len(sizes)} HD plates ({sum(sizes)/1024/1024:.2f} MB)")
`,
  ],
  { stdio: 'inherit' },
);

// Group events by book
const eventsByBook = new Map();
allEvents.forEach((ev, i) => {
  ev._globalIdx = i + 1;
  const list = eventsByBook.get(ev.b) ?? [];
  list.push(ev);
  eventsByBook.set(ev.b, list);
});

const SHARED_CSS = `
  @page {
    size: A4 portrait;
    margin: 13mm 14mm 13mm 14mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: "PingFang SC", "Songti SC", "STSong", "Hiragino Sans GB", serif;
    font-size: 10.2pt;
    line-height: 1.72;
    color: #1c1917;
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .cover-page {
    page-break-after: always;
    padding: 14mm 10mm 10mm;
    text-align: center;
    border: 2px solid #d97706;
    border-radius: 10px;
    background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%);
  }
  .cover-kicker {
    font-size: 9.5pt;
    letter-spacing: 0.14em;
    color: #92400e;
    font-weight: 700;
  }
  .cover-title {
    font-size: 25pt;
    color: #78350f;
    margin: 8px 0 4px;
  }
  .cover-sub {
    font-size: 10.8pt;
    color: #92400e;
    margin: 0 0 12px;
  }
  .cover-hero-img {
    width: 86%;
    max-width: 480px;
    border-radius: 8px;
    border: 2px solid #d97706;
    margin: 4px auto 12px;
    display: block;
  }
  .guide-box {
    text-align: left;
    background: #fffbeb;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    padding: 10px 14px;
    margin-top: 8px;
    font-size: 9pt;
    line-height: 1.6;
    color: #451a03;
  }
  .guide-box h3 {
    margin: 0 0 6px;
    font-size: 10.5pt;
    color: #78350f;
    border-bottom: 1px solid #fde68a;
    padding-bottom: 4px;
  }
  .guide-box ul {
    margin: 0;
    padding-left: 18px;
  }
  .guide-box li {
    margin-bottom: 4px;
  }
  .toc-box {
    page-break-after: always;
    padding: 4px 0;
  }
  .toc-title {
    font-size: 15pt;
    color: #78350f;
    text-align: center;
    margin: 0 0 10px;
    border-bottom: 2px solid #d97706;
    padding-bottom: 6px;
  }
  .toc-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px 14px;
    font-size: 8.8pt;
  }
  .toc-item {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px dotted #d6d3d1;
    padding: 2.5px 0;
  }
  .toc-item a {
    color: #1c1917;
    text-decoration: none;
    font-weight: 600;
  }
  .toc-item span {
    color: #92400e;
    font-size: 8pt;
  }
  .book-section {
    page-break-before: always;
  }
  .book-header {
    text-align: center;
    padding: 9px 12px;
    background: #fffbeb;
    border-top: 2px solid #d97706;
    border-bottom: 2px solid #d97706;
    margin-bottom: 10px;
  }
  .book-kicker {
    font-size: 8.2pt;
    letter-spacing: 0.08em;
    color: #92400e;
    font-weight: 700;
  }
  .book-header h1 {
    font-size: 17pt;
    color: #78350f;
    margin: 2px 0;
  }
  .book-intro {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-left: 3.5px solid #d97706;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 8.8pt;
    line-height: 1.55;
    color: #451a03;
    break-inside: avoid;
  }
  .book-intro-sub {
    font-size: 9.8pt;
    font-weight: 700;
    color: #78350f;
    margin: 0 0 4px;
  }
  .book-intro p {
    margin: 3px 0;
  }
  .book-intro-meta {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px dashed #fcd34d;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 12px;
    font-size: 8.4pt;
  }
  .book-intro-key {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px dashed #fcd34d;
    font-size: 8.5pt;
  }
  .ch-banner {
    font-size: 12pt;
    font-weight: 700;
    color: #78350f;
    margin: 12px 0 6px;
    padding: 3px 10px;
    background: #fffbeb;
    border-left: 4px solid #d97706;
    border-bottom: 1px solid #fde68a;
    break-after: avoid;
    page-break-after: avoid;
  }
  .sec {
    margin: 8px 0 12px;
    padding: 8px 10px;
    border: 1px solid #f3e8d2;
    border-radius: 8px;
    background: #ffffff;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sec-head-plate {
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: avoid;
    page-break-after: avoid;
    margin-bottom: 8px;
  }
  .sec-heading-bar {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    border-left: 3.5px solid #d97706;
    padding-left: 8px;
    margin-bottom: 4px;
  }
  .sec-title {
    font-size: 11.2pt;
    font-weight: 700;
    color: #78350f;
    margin: 0;
  }
  .sec-kicker {
    font-size: 8.2pt;
    color: #92400e;
    font-weight: 600;
    white-space: nowrap;
  }
  .sec-explain {
    margin: 0 0 7px;
    padding: 5px 9px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 5px;
    font-size: 8.8pt;
    color: #573b1a;
    line-height: 1.5;
  }
  .sec-plate-wrap {
    width: 100%;
    text-align: center;
  }
  .sec-thumb {
    width: 98%;
    max-width: 620px;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 6px;
    border: 1.5px solid #d97706;
    display: block;
    margin: 0 auto;
  }
  .sec-body {
    margin-top: 6px;
  }
  .para-group {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 6px;
  }
  .para {
    margin: 0;
    text-align: justify;
    text-indent: 2em;
  }
  .para-ref {
    margin: 2px 0 4px 2.2em;
    padding-left: 8px;
    border-left: 2px solid #e7d8c1;
    color: #3f3a34;
    text-align: justify;
  }
  .vnum {
    font-size: 7.2pt;
    font-weight: 700;
    color: #92400e;
    vertical-align: super;
    margin-right: 1.5px;
    text-indent: 0;
  }
  /* Unified single warm-amber highlight color across all markers and ① ② notes */
  .mark, .hg0, .fn-ref {
    color: #78350f;
    background: #fef3c7;
    border-bottom: 1px solid #d97706;
    font-weight: 600;
    padding: 0 2px;
    border-radius: 2px;
  }
  .hg0 {
    font-size: 6.4pt;
    vertical-align: super;
  }
  .fn-ref {
    font-size: 7.4pt;
    font-weight: 700;
  }
  .apparatus {
    color: #57534e;
    font-size: 9.2pt;
  }
  .vnb {
    margin: 3px 0 4px 2em;
    padding: 4px 8px;
    border-left: 2.5px solid #d97706;
    background: #fffbeb;
    border-radius: 4px;
    font-size: 8.4pt;
    line-height: 1.48;
    color: #78350f;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .vnb table {
    border-collapse: collapse;
    width: 100%;
  }
  .vnb-num {
    width: 1%;
    white-space: nowrap;
    vertical-align: top;
    padding-right: 5px;
    font-weight: 700;
    color: #78350f;
  }
  .vnb-text {
    vertical-align: top;
    color: #78350f;
  }
  .vnb-vref {
    color: #78350f;
    font-weight: 600;
  }
`;

function renderFrontmatterHtml() {
  const hebrewTocItems = BOOKS.slice(0, 39).map((b) => {
    const evCount = (eventsByBook.get(b.b) ?? []).length;
    const chCount = (cuvs.books[b.b - 1] ?? []).length;
    return `<div class="toc-item"><a href="#book-${b.b}">${b.b}. ${escHtml(b.zh)}</a><span>${chCount}章 · ${evCount}图</span></div>`;
  }).join('\n');
  const greekTocItems = BOOKS.slice(39, 66).map((b) => {
    const evCount = (eventsByBook.get(b.b) ?? []).length;
    const chCount = (cuvs.books[b.b - 1] ?? []).length;
    return `<div class="toc-item"><a href="#book-${b.b}">${b.b}. ${escHtml(b.zh)}</a><span>${chCount}章 · ${evCount}图</span></div>`;
  }).join('\n');

  const coverImg = `file://${thumbCacheDir}/genesis-1-1.jpg`;
  return `
    <div class="cover-page">
      <div class="cover-kicker">和合本雅伟版 · 1,443 幅正典事件画卷珍藏本</div>
      <h1 class="cover-title">《和合本雅伟版 · 画卷圣经》</h1>
      <p class="cover-sub">全书 66 卷（希伯来圣经 39 卷 · 希腊圣经 27 卷） · 1,189 章 · 31,102 节经文 · 13,616 个自然段落 · 1,443 幅正典事件画卷与段落导读</p>
      <img class="cover-hero-img" src="${coverImg}" alt="起初创造天地" />
      <div class="guide-box">
        <h3>全书凡例与专属标志总表</h3>
        <ul>
          <li><strong>神圣之名「雅伟」</strong>：希伯来圣经圣名 יהוה 及希腊圣经引文恢复译为「雅伟」（全书共 7,181 处，与正文自然融合排版）。</li>
          <li><strong><span class="mark">主[雅伟]</span>（全书 212 处）</strong>：标明原文作「主」或代词，按上下文意所指的是<strong>雅伟</strong>。</li>
          <li><strong><span class="mark">主[耶稣]</span>（全书 123 处）</strong>：标明希腊圣经原文作「主」，按上下文意所指的是<strong>主耶稣</strong>。</li>
          <li><strong><span class="mark">主[基督]</span>（全书 17 处）</strong>：标明按上下文意所指的是<strong>基督／弥赛亚</strong>（例如太 22:44「主[雅伟]对我主[基督]说」）。</li>
          <li><strong><sup class="hg0">H0</sup> / <sup class="hg0">G0</sup> 原文补词标志（全书 295 处：希伯来圣经 H0 共 253 处，希腊圣经 G0 共 42 处）</strong>：标明中文译本按上下文补出而原文无独立对应词之处。</li>
          <li><strong><span class="fn-ref">①</span> <span class="fn-ref">②</span> 随段译者小注（全书 1,202 条，分布在 1,039 节经文）</strong>：每段独立从 ① 编号，紧随该段经文下方呈现原文异文、字义与译者小注。</li>
          <li><strong>书卷导读、分段标题与背景解释</strong>：完整收录 66 卷书卷导论、1,443 个分段标题与背景解释，以及 13,616 个自然段落与经文引文缩进排版。</li>
        </ul>
      </div>
    </div>
    <div class="toc-box">
      <h2 class="toc-title">全书 66 卷正典与 1,443 幅画卷总目录</h2>
      <h3 style="margin:6px 0 6px;font-size:10.5pt;color:#78350f">希伯来圣经（39 卷）</h3>
      <div class="toc-grid">
        ${hebrewTocItems}
      </div>
      <h3 style="margin:12px 0 6px;font-size:10.5pt;color:#78350f">希腊圣经（27 卷）</h3>
      <div class="toc-grid">
        ${greekTocItems}
      </div>
    </div>
  `;
}

function renderBookHtml(bMeta) {
  const bNum = bMeta.b;
  const bookEvs = eventsByBook.get(bNum) ?? [];
  const zhChs = cuvs.books[bNum - 1] ?? [];
  const intro = meta.intros[bNum - 1];

  const seenCh = new Set();
  const bookPieces = [];

  for (let sIdx = 0; sIdx < bookEvs.length; sIdx++) {
    const ev = bookEvs[sIdx];
    const cStart = Math.floor(ev.s / 1000) % 1000;
    const vStart = ev.s % 1000;
    const cEnd = Math.floor(ev.e / 1000) % 1000;
    const vEnd = ev.e % 1000;

    // Emit Chapter Banner BEFORE the section when a section starts a new chapter!
    if (!seenCh.has(cStart)) {
      seenCh.add(cStart);
      bookPieces.push(`<div class="ch-banner">${escHtml(bMeta.zh)} 第 ${cStart} 章</div>`);
    }

    const blocks = [];
    let paraVerses = [];
    let paraNotes = [];
    let paraIsRef = false;

    const flushPara = () => {
      if (paraVerses.length > 0) {
        const notesHtml = renderParaNotesHtml(paraNotes, paraVerses.length > 1);
        const pCls = paraIsRef ? 'para-ref' : 'para';
        blocks.push(`<div class="para-group"><p class="${pCls}">${paraVerses.join(' ')}</p>${notesHtml}</div>`);
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
        blocks.push(`<div class="ch-banner">${escHtml(bMeta.zh)} 第 ${c} 章</div>`);
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
        const vHtml = renderVerseHtml(rawV, paraNotes, `${c}:${v}`);
        paraVerses.push(`<span class="v"><span class="vnum">${vLabel}</span>${vHtml}</span>`);
      }
    }
    flushPara();

    // Combine Words section_titles.json explanation (contextHans) + Globe narrative summary (ev.sum)
    const ws = wordsSections[String(ev.s)];
    const secTitleZh = ws?.titleHans || ev.zh;
    const ctxHans = (ws?.contextHans || '').trim();
    const sumHans = (ev.sum || '').trim();
    let explainText = ctxHans || sumHans;
    if (ctxHans && sumHans && ctxHans !== sumHans && !sumHans.includes(ctxHans) && !ctxHans.includes(sumHans)) {
      explainText = `${ctxHans} ${sumHans}`;
    } else if (sumHans.length > ctxHans.length) {
      explainText = sumHans;
    }

    const thumbPath = `file://${thumbCacheDir}/${ev.id}.jpg`;
    bookPieces.push(`
      <section class="sec">
        <div class="sec-head-plate">
          <div class="sec-heading-bar">
            <h3 class="sec-title">${escHtml(secTitleZh)}</h3>
            <span class="sec-kicker">${escHtml(ev.refZh)} · 画卷 #${ev._globalIdx}</span>
          </div>
          ${explainText ? `<p class="sec-explain">${escHtml(explainText)}</p>` : ''}
          <div class="sec-plate-wrap">
            <img class="sec-thumb" src="${thumbPath}" alt="${escHtml(secTitleZh)}" />
          </div>
        </div>
        <div class="sec-body">
          ${blocks.join('\n')}
        </div>
      </section>
    `);
  }

  let introHtml = '';
  if (intro) {
    const themesStr = (intro.themes?.hans ?? []).join(' · ');
    const kpZh = localizeKeyPassageZh(intro.keyPassage, bMeta.zh);
    const kpDesc = intro.keyPassageDesc?.hans ?? '';
    introHtml = `
      <div class="book-intro">
        <div class="book-intro-sub">${escHtml(intro.subtitle?.hans ?? '')}</div>
        <p>${escHtml(intro.summary?.hans ?? '')}</p>
        <div class="book-intro-meta">
          <div><strong>作者：</strong>${escHtml(intro.author?.hans ?? '')}</div>
          <div><strong>写作年代：</strong>${escHtml(intro.date?.hans ?? '')}</div>
          ${intro.audience?.hans ? `<div><strong>原初读者：</strong>${escHtml(intro.audience.hans)}</div>` : ''}
          ${themesStr ? `<div><strong>核心主题：</strong>${escHtml(themesStr)}</div>` : ''}
        </div>
        ${kpZh && kpDesc ? `<div class="book-intro-key"><strong>核心经文（${escHtml(kpZh)}）：</strong>${escHtml(kpDesc)}</div>` : ''}
      </div>
    `;
  }

  return `
    <article class="book-section" id="book-${bNum}" data-book="${bNum}">
      <div class="book-header">
        <div class="book-kicker">圣经正典 第 ${bNum} / 66 卷 · 共 ${zhChs.length} 章 · ${bookEvs.length} 幅正典事件画卷</div>
        <h1>${escHtml(bMeta.zh)}</h1>
      </div>
      ${introHtml}
      ${bookPieces.join('\n')}
    </article>
  `;
}

const workDir = '/tmp/bible-pdf-work';
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

console.log('2. Writing unified single-file HTML for all 66 books...');
const allParts = [renderFrontmatterHtml()];
for (const bMeta of BOOKS) {
  allParts.push(renderBookHtml(bMeta));
}
const fullHtmlPath = path.join(workDir, 'full.html');
fs.writeFileSync(
  fullHtmlPath,
  `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>《和合本雅伟版 · 画卷圣经》</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  ${allParts.join('\n')}
</body>
</html>`,
  'utf8',
);

const outDir = path.join(ROOT, 'public/downloads');
fs.mkdirSync(outDir, { recursive: true });
const outPdf = path.join(outDir, 'cuv-yahweh-illustrated-1443.pdf');
const desktopPdf = '/Users/pliu0036/Desktop/和合本雅伟版-画卷圣经-1443图.pdf';

console.log('3. Rendering unified PDF directly via Google Chrome (preserving CJK CID font tables)...');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage();
await page.goto(`file://${fullHtmlPath}`, { waitUntil: 'load', timeout: 240000 });
await page.pdf({
  path: outPdf,
  format: 'A4',
  printBackground: true,
  tagged: false,
  outline: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="width:100%;font-size:7.2pt;color:#92400e;padding:0 14mm;display:flex;justify-content:space-between;font-family:'PingFang SC',serif;"><span>《和合本雅伟版 · 画卷圣经》</span><span>全 66 卷 · 1,443 幅正典事件画卷</span></div>`,
  footerTemplate: `<div style="width:100%;font-size:7.2pt;color:#78350f;padding:0 14mm;text-align:center;font-family:'PingFang SC',serif;">— 第 <span class="pageNumber"></span> / <span class="totalPages"></span> 页 —</div>`,
  margin: { top: '13mm', bottom: '13mm', left: '14mm', right: '14mm' },
});
await browser.close();

execFileSync(
  'python3',
  [
    '-c',
    `
import fitz, shutil
p = ${JSON.stringify(outPdf)}
tmp = p + ".tmp.pdf"
doc = fitz.open(p)
# NEVER call subset_fonts() on Chrome-generated CJK PDFs! Only compress xref streams:
doc.save(tmp, garbage=1, deflate=True, use_objstms=1)
doc.close()
shutil.move(tmp, p)
`,
  ],
  { stdio: 'inherit' },
);

fs.copyFileSync(outPdf, desktopPdf);
const stat = fs.statSync(outPdf);
console.log(`✅ Built ${outPdf} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`✅ Copied to Desktop: ${desktopPdf}`);

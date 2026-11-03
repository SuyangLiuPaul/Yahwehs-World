// Copies the reader's Bible data out of Words, verifies it, and splits it per book.
//
//   node scripts/reader-editions.mjs [--words <path>] [--check] [--update-lock]
//
// The editions the gallery release may serve (owner, 2026-11-03: the first few we hold rights to;
// languages Chinese (Simplified and Traditional), English and Russian; no church packs, no beta
// languages, nothing online):
//   bsb-yhwh, kjv, web-yhwh, asv-yhwh, cuvs-yhwh, cuvs-yhwh-tr, rst-yhwh, rst
// (rst and rst-yhwh are the plain eBible.org Synodal 1876, public domain; the Strong's-tagged LIO text is
// licensed, test-only, and is not read here.)
//
// The bytes are Words' bytes. This script never re-imports a text: it reads
// <words>/assets/<id>.json, checks its SHA-256 against src/reader/sources.lock.json
// (committed, so a silent change in Words stops the build instead of reaching readers),
// and cuts it into one small file per book, the way the globe's own reader is cut.
//
// Inputs (all read-only, from the Words checkout named in the lock):
//   assets/<id>.json                 flat verse lists  { book, chapter, verse, text, id }
//   assets/section_titles.json       headings, sets cuv / cuv-tr / english-classic / ru
//   lib/constants/bible_versions.dart  labels + language (regex; fails loudly if the shape moves)
//   lib/constants/book_name_mapping.dart  Chinese (Hans/Hant) book names
//   lib/utils/reference_parser.dart  English and Chinese book abbreviations
//   lib/constants/section_title_map.dart  edition -> heading set (cross-checked, not copied)
// and from this repo: public/data/bible/meta.json (paraStarts, 13,616 BSB paragraph starts).
//
// Outputs:
//   public/data/reader/text/<id>/<n>.json      (string|null)[chapter][verse-1]   (gitignored, regenerated)
//   public/data/reader/headings/<set>/<n>.json { "<ch>": [{ v, t, c }] }
//   public/data/reader/para/<n>.json           { "<ch>": [verse starting a paragraph] }
//   public/data/reader/catalogue.json          the same catalogue the bundle carries
//   src/reader/catalogue.gen.ts                the catalogue as a TS module (committed)
//   src/reader/sources.lock.json               the pin (committed)
// Rows for handoff/MANIFEST-assets.md are printed at the end of a run.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const flag = (n) => process.argv.includes(n);
const WORDS = resolve(arg('--words') ?? process.env.WORDS_PATH ?? '/Volumes/androidbuild/Words-184');
const CHECK = flag('--check');
const UPDATE_LOCK = flag('--update-lock');
const OUT = join(ROOT, 'public/data/reader');
const LOCK = join(ROOT, 'src/reader/sources.lock.json');
const GEN = join(ROOT, 'src/reader/catalogue.gen.ts');

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const fail = (m) => { console.error('reader-editions: ' + m); process.exit(1); };

// ── what we serve ──────────────────────────────────────────────────────────
// Credit lines are the church's wording for this site (owner, 2026-11-03):
//   * the Union Version editions carry Words' wording "© Yahweh De Hua Ministry · used with permission" (not public domain) and no year is printed;
//   * the divine name is written as the edition does;
//   * never person/Trinity vocabulary (tests/reader/wording.test.ts walks every string here).
// `credit` is in the EDITION's language (plan §2.4); `licence.note` has all three UI languages.
const EDITIONS = [
  {
    id: 'bsb-yhwh', language: 'en', headingSet: 'english-classic',
    copyName: 'BSB, Yahweh edition',
    credit: {
      en: 'BSB (Yahweh) · Berean Standard Bible, public domain (CC0); the divine name restored as Yahweh.',
    },
    licence: {
      kind: 'cc0', holder: 'Berean Bible', url: 'https://bereanbible.com/',
      note: {
        en: 'Public domain (CC0) since 2023-04-30. The divine name is restored as Yahweh; the edition is called BSB (Yahweh), not "Berean".',
        'zh-Hans': '自 2023-04-30 起属公有领域（CC0）。神名还原为雅伟；本版称 BSB (Yahweh)，不称“Berean”。',
        'zh-Hant': '自 2023-04-30 起屬公有領域（CC0）。神名還原為雅偉；本版稱 BSB (Yahweh)，不稱「Berean」。',
        ru: 'Общественное достояние (CC0) с 2023-04-30. Божье имя восстановлено как Яхве (Yahweh); издание называется BSB (Yahweh), а не «Berean».',
      },
    },
  },
  {
    id: 'kjv', language: 'en', headingSet: 'english-classic',
    copyName: 'KJV',
    credit: { en: 'KJV · King James Version (1611 / 1769 revision), public domain; the divine name (LORD) is shown as Yahweh.' },
    licence: {
      kind: 'public-domain', holder: 'Public domain', url: 'https://www.gutenberg.org/',
      note: {
        en: 'Public domain. The divine name (LORD in capitals) is shown as Yahweh, as in Yahweh’s Words.',
        'zh-Hans': '公有领域。神名（大写的 LORD）显示为 Yahweh，与雅伟之言一致。',
        'zh-Hant': '公有領域。神名（大寫的 LORD）顯示為 Yahweh，與雅偉之言一致。',
        ru: 'Общественное достояние. Божье имя (LORD заглавными буквами) показано как Yahweh, как в «Слове Яхве».',
      },
    },
  },
  {
    id: 'web-yhwh', language: 'en', headingSet: 'english-classic',
    copyName: 'WEB, Yahweh edition',
    credit: { en: 'WEB · World English Bible, public domain; the divine name as Yahweh; supplied by Yahwehdehua (from eBible.org).' },
    licence: {
      kind: 'public-domain', holder: 'eBible.org', url: 'https://worldenglish.bible/',
      note: {
        en: 'Public domain. The World English Bible with the divine name as Yahweh; supplied by Yahwehdehua (from eBible.org). The Apocrypha is not included.',
        'zh-Hans': '公有领域。World English Bible，神名作 Yahweh；雅伟的话提供（来自 eBible.org）。不含次经。',
        'zh-Hant': '公有領域。World English Bible，神名作 Yahweh；雅偉的話提供（來自 eBible.org）。不含次經。',
        ru: 'Общественное достояние. World English Bible с Божьим именем Yahweh; предоставлено Yahwehdehua (с eBible.org). Неканонические книги не включены.',
      },
    },
  },
  {
    id: 'asv-yhwh', language: 'en', headingSet: 'english-classic',
    copyName: 'ASV, Yahweh edition',
    credit: { en: 'ASV (Yahweh) · American Standard Version (1901), public domain; Jehovah restored as Yahweh by Yahweh De Hua Ministry.' },
    licence: {
      kind: 'public-domain', holder: 'Yahweh De Hua Ministry (editorial restoration)', url: 'https://yahwehdehua.net/en/bible',
      note: {
        en: 'Public domain (1901). The divine name is Yahweh where the ASV printed Jehovah, an editorial restoration by Yahweh De Hua Ministry.',
        'zh-Hans': '1901 年版本属公有领域。神名由 Jehovah 还原为 Yahweh，为雅伟的话事工的编辑成果。',
        'zh-Hant': '1901 年版本屬公有領域。神名由 Jehovah 還原為 Yahweh，為雅偉的話事工的編輯成果。',
        ru: 'Общественное достояние (1901). Божье имя — Yahweh там, где в ASV напечатано Jehovah; редакторское восстановление служения Yahweh De Hua Ministry.',
      },
    },
  },
  {
    // Words' own record (assets/i18n/ui/*.json "aboutLicenseCuvsYhwh") says "© Yahweh De Hua Ministry · used with
    // permission", not public domain: the church's edition is shown with that wording and the © chip, word for word.
    // (The 2026-11-03 integration fixed an earlier "public domain" line here. No year is printed anywhere.)
    id: 'cuvs-yhwh', language: 'zh-Hans', headingSet: 'cuv',
    copyName: '和合本雅伟版',
    credit: {
      'zh-Hans': '和合本雅伟版 · © 雅伟的话事工 · 经授权使用。', 'zh-Hant': '和合本雅偉版 · © 雅偉的話事工 · 經授權使用。',
      en: 'Chinese Union Version, Yahweh edition · © Yahweh De Hua Ministry · used with permission.',
      ru: 'Chinese Union Version, издание «Яхве» · © Yahweh De Hua Ministry · используется с разрешения.',
    },
    licence: {
      kind: 'permission', holder: 'Yahweh De Hua Ministry', url: 'https://yahwehdehua.net/cn/bible',
      note: {
        en: '© Yahweh De Hua Ministry · used with permission.',
        'zh-Hans': '© 雅伟的话事工 · 经授权使用。',
        'zh-Hant': '© 雅偉的話事工 · 經授權使用。',
        ru: '© Yahweh De Hua Ministry · используется с разрешения.',
      },
    },
  },
  {
    id: 'cuvs-yhwh-tr', language: 'zh-Hant', headingSet: 'cuv-tr',
    copyName: '和合本雅偉版',
    credit: {
      'zh-Hant': '和合本雅偉版 · © 雅偉的話事工 · 經授權使用。', 'zh-Hans': '和合本雅伟版 · © 雅伟的话事工 · 经授权使用。',
      en: 'Chinese Union Version, Yahweh edition (Traditional) · © Yahweh De Hua Ministry · used with permission.',
      ru: 'Chinese Union Version, издание «Яхве» (традиционное письмо) · © Yahweh De Hua Ministry · используется с разрешения.',
    },
    licence: {
      kind: 'permission', holder: 'Yahweh De Hua Ministry', url: 'https://yahwehdehua.net/cn/bible',
      note: {
        en: '© Yahweh De Hua Ministry · used with permission.',
        'zh-Hans': '© 雅伟的话事工 · 经授权使用。',
        'zh-Hant': '© 雅偉的話事工 · 經授權使用。',
        ru: '© Yahweh De Hua Ministry · используется с разрешения.',
      },
    },
  },
  {
    id: 'rst-yhwh', language: 'ru', headingSet: 'ru',
    copyName: 'Синодальный перевод, издание Яхве',
    credit: { ru: 'СП (Яхве) · Синодальный перевод (1876), общественное достояние; имя Божие восстановлено как Яхве по еврейскому тексту (Yahweh\u2019s Words).' },
    licence: {
      kind: 'public-domain', holder: 'eBible.org (russyn); name restored by Yahweh\u2019s Words', url: 'https://ebible.org/rus/',
      note: {
        en: "The Russian Synodal translation (1876, public domain). In this edition the name Яхве (Yahweh) is restored where the Hebrew has יהוה; אֲדֹנָי יְהוִה is «Владыка Яхве». Otherwise the text is unchanged, and «Господь» in the New Testament stays as printed. The list of changed verses is public: yahwehword.com/rst-yhwh/changes.csv",
        'zh-Hans': "俄文 Synodal 译本（1876，公有领域）。本版在希伯来原文为 יהוה 之处恢复神的名字「Яхве」；אֲדֹנָי יְהוִה 作 «Владыка Яхве»。其余文字未改，新约的 «Господь» 保持原样。改动清单公开：yahwehword.com/rst-yhwh/changes.csv",
        'zh-Hant': "俄文 Synodal 譯本（1876，公有領域）。本版在希伯來原文為 יהוה 之處恢復神的名字「Яхве」；אֲדֹנָי יְהוִה 作 «Владыка Яхве»。其餘文字未改，新約的 «Господь» 保持原樣。改動清單公開：yahwehword.com/rst-yhwh/changes.csv",
        ru: "Синодальный перевод 1876 г. (общественное достояние). В этом издании имя Божие Яхве восстановлено там, где в еврейском тексте стоит יהוה; в сочетании אֲדֹנָי יְהוִה оно передано как «Владыка Яхве». В остальном текст не изменён; в Новом Завете «Господь» оставлено как в оригинале. Список изменённых стихов открыт: yahwehword.com/rst-yhwh/changes.csv",
      },
    },
  },
  {
    id: 'rst', language: 'ru', headingSet: 'ru',
    copyName: 'Синодальный перевод',
    credit: { ru: 'СП · Синодальный перевод (1876), общественное достояние.' },
    licence: {
      kind: 'public-domain', holder: 'eBible.org (russyn)', url: 'https://ebible.org/rus/',
      note: {
        en: 'Synodal Translation (1876), public domain, from eBible.org, as printed.',
        'zh-Hans': '俄文《synodal》译本（1876），公有领域，来自 eBible.org，保持原貌。',
        'zh-Hant': '俄文《synodal》譯本（1876），公有領域，來自 eBible.org，保持原貌。',
        ru: 'Синодальный перевод (1876), общественное достояние, с eBible.org, без изменений.',
      },
    },
  },
];
// Chinese credit lines for the English editions when the reader reads in Chinese chrome are not
// needed: credit is in the edition's language. The other-language keys above exist for the licence table.
// Fill the other UI languages' credit from the licence note so every edition has all three.
const UI = ['en', 'zh-Hans', 'zh-Hant', 'ru'];

// ── read Words ─────────────────────────────────────────────────────────────
if (!existsSync(join(WORDS, 'assets/kjv.json'))) fail(`no Words checkout at ${WORDS} (use --words <path>)`);
let wordsHead = 'unknown';
try { wordsHead = execFileSync('git', ['-C', WORDS, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a git dir */ }
let wordsCommit = wordsHead;
const readBuf = (rel) => readFileSync(join(WORDS, rel));

const sourcePaths = [
  ...EDITIONS.map((e) => `assets/${e.id}.json`),
  'assets/section_titles.json',
  'lib/constants/bible_versions.dart',
  'lib/constants/book_name_mapping.dart',
  'lib/utils/reference_parser.dart',
  'lib/constants/section_title_map.dart',
];
const sources = Object.fromEntries(sourcePaths.map((p) => { const b = readBuf(p); return [p, { sha256: sha(b), bytes: b.length }]; }));

if (existsSync(LOCK) && !UPDATE_LOCK) {
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  const bad = [];
  for (const [p, s] of Object.entries(sources)) {
    const want = lock.files[p];
    if (!want) bad.push(`${p}: not in the lock`);
    else if (want.sha256 !== s.sha256) bad.push(`${p}: SHA ${s.sha256.slice(0, 12)} differs from the lock ${want.sha256.slice(0, 12)}`);
  }
  if (bad.length) fail(`Words data differs from src/reader/sources.lock.json (Words ${wordsHead.slice(0, 8)}, lock ${String(lock.wordsCommit).slice(0, 8)}):\n  ` + bad.join('\n  ') + '\n  Review the change, then rerun with --update-lock.');
  // Every file we read is byte-identical to the pin, so the data is the pinned commit's data even if Words has moved on.
  wordsCommit = lock.wordsCommit;
  if (wordsHead !== wordsCommit) console.log(`reader-editions: Words HEAD is ${wordsHead.slice(0, 8)}; the pinned data (${wordsCommit.slice(0, 8)}) is unchanged in it`);
} else if (!existsSync(LOCK) && !UPDATE_LOCK) {
  console.log('reader-editions: no lock yet, writing one');
}

// ── labels from bible_versions.dart ────────────────────────────────────────
const dart = readBuf('lib/constants/bible_versions.dart').toString('utf8');
function versionInfo(id) {
  const at = dart.indexOf(`value: '${id}'`);
  if (at < 0) fail(`bible_versions.dart has no entry ${id}`);
  const start = dart.lastIndexOf('BibleVersionInfo(', at);
  const next = dart.indexOf('BibleVersionInfo(', at);
  const slice = dart.slice(start, next < 0 ? dart.length : next);
  const field = (k) => {
    const m = slice.match(new RegExp(`\\b${k}:\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`));
    return m ? (m[1] ?? m[2]).replace(/\\'/g, "'") : null;
  };
  const out = { shortLabel: field('shortLabel'), menuLabel: field('menuLabel'), language: field('language'), narrowLabel: field('narrowLabel'), editionYear: field('editionYear') };
  if (!out.shortLabel || !out.menuLabel || !out.language) fail(`bible_versions.dart: cannot read the labels of ${id} (shape changed?)`);
  return out;
}

// ── heading-set map, cross-checked against section_title_map.dart ──────────
const mapDart = readBuf('lib/constants/section_title_map.dart').toString('utf8');
for (const e of EDITIONS) {
  const m = mapDart.match(new RegExp(`'${e.id}':\\s*'([^']+)'`));
  if (!m) fail(`section_title_map.dart has no set for ${e.id}`);
  if (m[1] !== e.headingSet) fail(`${e.id}: Words maps it to heading set "${m[1]}", this script says "${e.headingSet}"`);
}

// ── book names + aliases (regex over the Dart maps; loud when the shape moves) ──
function dartMap(src, name) {
  const start = src.indexOf(`const ${name}`);
  if (start < 0) fail(`cannot find ${name}`);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) break; } }
  return src.slice(open + 1, i);
}
const nameDart = readBuf('lib/constants/book_name_mapping.dart').toString('utf8');
const pairs = (body) => [...body.replace(/\/\/.*$/gm, '').matchAll(/(['"])((?:(?!\1).)+)\1\s*:\s*(['"])((?:(?!\3).)+)\3/g)].map((m) => [m[2], m[4]]);
const enToHans = Object.fromEntries(pairs(dartMap(nameDart, 'englishToChinese')));
const enToHant = Object.fromEntries(pairs(dartMap(nameDart, 'englishToChineseTraditional')));
const refDart = readBuf('lib/utils/reference_parser.dart').toString('utf8');
const enAliasBody = dartMap(refDart, 'Map<String, List<String>> _englishAliases').replace(/\/\/.*$/gm, '');
const enAliases = {};
for (const m of enAliasBody.matchAll(/'([^']+)'\s*:\s*\[([^\]]*)\]/g)) enAliases[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
const zhShort = Object.fromEntries(pairs(dartMap(refDart, 'Map<String, String> _chineseShortAliases')));
const zhAliasHtml = Object.fromEntries(pairs(dartMap(nameDart, '_zhAliasToEn')));
const enToRu = Object.fromEntries(pairs(dartMap(nameDart, 'englishToRussian')));
const ruFull = Object.fromEntries(pairs(dartMap(nameDart, '_ruAliasToEn')));
const ruAbbrBody = dartMap(refDart, 'Map<String, List<String>> _russianAliases').replace(/\/\/.*$/gm, '');
const ruAbbr = {};
for (const m of ruAbbrBody.matchAll(/'([^']+)'\s*:\s*\[([^\]]*)\]/g)) ruAbbr[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);

const BOOKS_EN = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];
for (const b of BOOKS_EN) {
  if (!enToHans[b] || !enToHant[b]) fail(`no Chinese name for ${b}`);
  if (!enToRu[b]) fail(`no Russian name for ${b}`);
}

// ── load the six editions ─────────────────────────────────────────────────
const verseArrays = {}; // id -> [book][chapter][verse-1]
const stats = {};
for (const e of EDITIONS) {
  const rows = JSON.parse(readBuf(`assets/${e.id}.json`).toString('utf8'));
  const books = Array.from({ length: 66 }, () => []);
  let n = 0;
  for (const r of rows) {
    const id = Number(r.id);
    const b = Math.floor(id / 1e6), c = Math.floor(id / 1e3) % 1e3, v = id % 1e3;
    if (!(b >= 1 && b <= 66 && c >= 1 && v >= 1)) fail(`${e.id}: bad verse id ${r.id}`);
    const ch = (books[b - 1][c - 1] ??= []);
    if (ch[v - 1] != null) fail(`${e.id}: duplicate ${r.id}`);
    ch[v - 1] = String(r.text);
    n++;
  }
  // holes (a verse an edition omits) become null; a missing chapter is a hard error
  for (const [bi, bk] of books.entries()) {
    for (let c = 0; c < bk.length; c++) {
      if (!bk[c]) fail(`${e.id}: ${BOOKS_EN[bi]} chapter ${c + 1} is empty`);
      for (let v = 0; v < bk[c].length; v++) if (bk[c][v] === undefined) bk[c][v] = null;
    }
  }
  verseArrays[e.id] = books;
  stats[e.id] = { verses: n };
}
// chapter counts and per-chapter verse counts must agree across the six (the alignment rule is "same numbering")
const chapters = verseArrays['kjv'].map((b) => b.length);
const vcount = verseArrays['kjv'].map((b) => b.map((c) => c.length));
for (const e of EDITIONS) {
  const bk = verseArrays[e.id];
  for (let i = 0; i < 66; i++) {
    if (bk[i].length !== chapters[i]) fail(`${e.id}: ${BOOKS_EN[i]} has ${bk[i].length} chapters, KJV ${chapters[i]}`);
    for (let c = 0; c < chapters[i]; c++) if (bk[i][c].length > vcount[i][c]) fail(`${e.id}: ${BOOKS_EN[i]} ${c + 1} has more verses than KJV`);
  }
}

// ── catalogue ──────────────────────────────────────────────────────────────
const editionsOut = EDITIONS.map((e) => {
  const info = versionInfo(e.id);
  if (info.language !== e.language) fail(`${e.id}: Words says language ${info.language}`);
  const credit = {};
  for (const l of UI) credit[l] = e.credit[l] ?? e.credit[e.language];
  return {
    id: e.id, language: e.language, label: info.shortLabel, menu: info.menuLabel, narrow: info.narrowLabel ?? info.shortLabel,
    note: info.editionYear ?? '', headingSet: e.headingSet, copyName: e.copyName,
    credit, licence: e.licence,
    sha256: sources[`assets/${e.id}.json`].sha256, bytes: sources[`assets/${e.id}.json`].bytes, verses: stats[e.id].verses,
  };
});
const aliases = {};
for (const [en, list] of Object.entries(enAliases)) aliases[en] = list;
const booksOut = BOOKS_EN.map((en, i) => ({
  n: i + 1, en, 'zh-Hans': enToHans[en], 'zh-Hant': enToHant[en], ru: enToRu[en], chapters: chapters[i], vc: vcount[i],
}));
const zhAliases = { ...zhShort };
// full Chinese names (every spelling, both scripts) so a typed 創世紀 or 创世记 resolves
for (const [zh, en] of Object.entries(zhAliasHtml)) zhAliases[zh] = en;
const ruAliases = { ...ruFull };
for (const [en, list] of Object.entries(ruAbbr)) for (const a of list) ruAliases[a] = en;
const catalogue = {
  v: 1,
  wordsCommit,
  defaults: { en: 'bsb-yhwh', 'zh-Hans': 'cuvs-yhwh', 'zh-Hant': 'cuvs-yhwh-tr', ru: 'rst-yhwh' },
  editions: editionsOut,
  books: booksOut,
  enAliases: aliases,
  zhAliases,
  ruAliases,
};

// ── headings ───────────────────────────────────────────────────────────────
const titles = JSON.parse(readBuf('assets/section_titles.json').toString('utf8'));
const sets = ['cuv', 'cuv-tr', 'english-classic', 'ru'];
for (const s of sets) if (!titles.sets[s]) fail(`section_titles.json has no set ${s}`);

// ── paragraph starts (this repo's meta.json) ───────────────────────────────
const meta = JSON.parse(readFileSync(join(ROOT, 'public/data/bible/meta.json'), 'utf8'));

// ── write ──────────────────────────────────────────────────────────────────
const files = new Map();
const put = (rel, obj) => files.set(rel, JSON.stringify(obj));
for (const e of EDITIONS) for (let i = 0; i < 66; i++) put(`text/${e.id}/${i + 1}.json`, verseArrays[e.id][i]);
for (const s of sets) {
  for (let i = 0; i < 66; i++) {
    const by = titles.sets[s][BOOKS_EN[i]] ?? {};
    const out = {};
    for (const [ch, list] of Object.entries(by)) out[ch] = list.map((h) => ({ v: h.verse, t: h.title, ...(h.context ? { c: h.context } : {}) }));
    put(`headings/${s}/${i + 1}.json`, out);
  }
}
const paraByBook = Array.from({ length: 67 }, () => ({}));
for (const id of meta.paraStarts) {
  const b = Math.floor(id / 1e6), c = Math.floor(id / 1e3) % 1e3, v = id % 1e3;
  (paraByBook[b][c] ??= []).push(v);
}
for (let b = 1; b <= 66; b++) put(`para/${b}.json`, paraByBook[b]);
put('catalogue.json', catalogue);

const genTs = `// GENERATED by scripts/reader-editions.mjs from Words ${wordsCommit.slice(0, 8)}. Do not edit by hand.\n` +
  `import type { Catalogue } from './types.ts';\n\nexport const CATALOGUE: Catalogue = ${JSON.stringify(catalogue, null, 1)};\n`;
const lockObj = { wordsCommit, files: sources };

if (CHECK) {
  // Rebuild in memory and compare with what is on disk.
  let bad = 0;
  for (const [rel, text] of files) {
    const f = join(OUT, rel);
    if (!existsSync(f) || readFileSync(f, 'utf8') !== text) { bad++; if (bad < 10) console.error('differs: ' + rel); }
  }
  if (!existsSync(GEN) || readFileSync(GEN, 'utf8') !== genTs) { bad++; console.error('differs: src/reader/catalogue.gen.ts'); }
  if (bad) fail(`${bad} file(s) differ from a fresh build`);
  console.log(`reader-editions --check: ${files.size} files and catalogue.gen.ts equal a fresh build from Words ${wordsCommit.slice(0, 8)}`);
  process.exit(0);
}

rmSync(OUT, { recursive: true, force: true });
for (const [rel, text] of files) {
  const f = join(OUT, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, text);
}
writeFileSync(GEN, genTs);
if (UPDATE_LOCK || !existsSync(LOCK)) writeFileSync(LOCK, JSON.stringify(lockObj, null, 1) + '\n');
console.log(`reader-editions: wrote ${files.size} files to public/data/reader/ from Words ${wordsCommit.slice(0, 8)}`);
console.log('\nMANIFEST rows:');
for (const e of editionsOut) console.log(`| \`public/data/reader/text/${e.id}/*.json\` | ${e.id}: ${e.verses} verses, per-book cut of Words \`assets/${e.id}.json\` (${e.bytes} bytes, SHA-256 ${e.sha256.slice(0, 16)}…) | \`scripts/reader-editions.mjs\`, Words ${wordsCommit.slice(0, 8)} | see \`src/reader/catalogue.gen.ts\` | — | generated |`);

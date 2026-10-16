// Builds the compact Bible datasets for /bible.html (《和合本雅伟版·画卷圣经》):
//   - public/data/bible/cuvs-yhwh.json  (31,102 Simplified verses + <H0>/<G0>, [雅伟]/[耶稣]/[基督], <note:...>)
//   - public/data/bible/cuvt-yhwh.json  (31,102 Traditional verses + <H0>/<G0>, [雅偉]/[耶穌]/[基督], <note:...>)
//   - public/data/bible/bsb-yhwh.json   (31,086 English BSB-Yahweh verses)
//   - public/data/bible/meta.json       (66 book intros, paragraph starts, 352 referent markers + 295 H0/G0 index, stats)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORDS_ASSETS = resolve(ROOT, '../Words-reading-plan-20261015/assets');
const TAGGED_DIR = join(WORDS_ASSETS, 'tagged/cuvs-yhwh');
const OUT_DIR = join(ROOT, 'public/data/bible');
mkdirSync(OUT_DIR, { recursive: true });

const BOOKS = JSON.parse(readFileSync(join(ROOT, 'scripts/books.json'), 'utf8'));
const cuvsRaw = JSON.parse(readFileSync(join(WORDS_ASSETS, 'cuvs-yhwh.json'), 'utf8'));
const cuvtRaw = JSON.parse(readFileSync(join(WORDS_ASSETS, 'cuvs-yhwh-tr.json'), 'utf8'));
const bsbRaw = JSON.parse(readFileSync(join(WORDS_ASSETS, 'bsb-yhwh.json'), 'utf8'));
const introsRaw = JSON.parse(readFileSync(join(WORDS_ASSETS, 'book_introductions.json'), 'utf8')).intros;
const otParasRaw = JSON.parse(readFileSync(join(WORDS_ASSETS, 'web-ot-paragraphs.json'), 'utf8')).books;
const eventsDoc = JSON.parse(readFileSync(join(ROOT, 'data/events/all-events.json'), 'utf8'));
const events = eventsDoc.events;

const ALIAS = { 'Song of Songs': 'Song of Solomon' };
const enToNum = new Map(BOOKS.map((b, i) => [b.en, i + 1]));
for (const [a, b] of Object.entries(ALIAS)) enToNum.set(b, enToNum.get(a));
enToNum.set('Psalm', 19);

// Map each verse id to its canonical event id
const eventRanges = events.map((e) => ({ id: e.id, start: e.start, end: e.end }));
function findEventId(vid) {
  let lo = 0, hi = eventRanges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = eventRanges[mid];
    if (vid < r.start) hi = mid - 1;
    else if (vid > r.end) lo = mid + 1;
    else return r.id;
  }
  return eventRanges[0].id;
}

// Load tagged/cuvs-yhwh to extract the 295 H0/G0 supplied-word markers
const hg0ByVid = new Map();
for (let bi = 0; bi < BOOKS.length; bi++) {
  const bEn = BOOKS[bi].en === 'Song of Songs'
    ? 'song_of_solomon'
    : BOOKS[bi].en.toLowerCase().replace(/\s+/g, '_');
  const taggedBook = JSON.parse(readFileSync(join(TAGGED_DIR, `${bEn}.json`), 'utf8'));
  for (const [cv, runs] of Object.entries(taggedBook)) {
    const [c, v] = cv.split(':').map(Number);
    const vid = (bi + 1) * 1_000_000 + c * 1000 + v;
    const targets = [];
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (r.s === 'H0' || r.s === 'G0') {
        const m = r.w.match(/(雅伟|主|神|人|他|我|你|道)([，。；：！？、“”‘’）\]〕]*)$/);
        const tokHans = m ? m[1] : r.w;
        let occIdx = 0;
        for (let j = 0; j <= i; j++) {
          const wClean = runs[j].w.replace(/\[[^\]]+\]/g, '').replace(/〔[^〕]+〕/g, '');
          const matches = wClean.match(new RegExp(tokHans, 'g'));
          if (matches) occIdx += matches.length;
        }
        targets.push({ tokHans, occNumber: occIdx, code: r.s });
      }
    }
    if (targets.length) hg0ByVid.set(vid, targets);
  }
}

function injectHg0(vText, vid, isHant = false) {
  const targets = hg0ByVid.get(vid);
  if (!targets) return vText;
  let out = vText;
  for (const t of targets) {
    const tok = isHant && t.tokHans === '雅伟' ? '雅偉' : t.tokHans;
    let seen = 0;
    const parts = out.split(/(<note:[^>]+>|\[[^\]]+\]|〔[^〕]+〕|<[HG]0>)/g);
    for (let p = 0; p < parts.length; p += 2) {
      parts[p] = parts[p].replace(new RegExp(tok, 'g'), (match) => {
        seen++;
        if (seen === t.occNumber) return `${match}<${t.code}>`;
        return match;
      });
    }
    out = parts.join('');
  }
  return out;
}

function buildCompactBooks(rows, mode) {
  const books = Array.from({ length: 66 }, () => []);
  for (const r of rows) {
    const idStr = String(r.id).padStart(9, '0');
    const vid = parseInt(idStr, 10);
    const b = parseInt(idStr.slice(0, 3), 10) - 1;
    const c = parseInt(idStr.slice(3, 6), 10) - 1;
    const v = parseInt(idStr.slice(6, 9), 10) - 1;
    if (b < 0 || b >= 66) continue;
    if (!books[b][c]) books[b][c] = [];
    let txt = r.text;
    if (mode === 'hans') txt = injectHg0(txt, vid, false);
    else if (mode === 'hant') txt = injectHg0(txt, vid, true);
    else if (mode === 'en') {
      txt = txt
        .replace(/\bthe LORD’s\b/g, "Yahweh’s<H0>")
        .replace(/\bthe LORD's\b/g, "Yahweh's<H0>")
        .replace(/\bThe LORD’s\b/g, "Yahweh’s<H0>")
        .replace(/\bThe LORD's\b/g, "Yahweh's<H0>")
        .replace(/\bthe LORD\b/g, 'Yahweh<H0>')
        .replace(/\bThe LORD\b/g, 'Yahweh<H0>')
        .replace(/\bLORD OF LORDS\b/g, 'Lord of lords')
        .replace(/\bLORD\b/g, 'Yahweh<H0>');
    }
    books[b][c][v] = txt;
  }
  return books;
}

const cuvsBooks = buildCompactBooks(cuvsRaw, 'hans');
const cuvtBooks = buildCompactBooks(cuvtRaw, 'hant');
const bsbBooks = buildCompactBooks(bsbRaw, 'en');

// Build paragraph starts set (combining cuvs-yhwh isParagraphStart + web-ot-paragraphs)
const paraSet = new Set();
for (const r of cuvsRaw) {
  if (r.isParagraphStart) paraSet.add(parseInt(r.id, 10));
}
for (const [bName, chMap] of Object.entries(otParasRaw)) {
  const bNum = enToNum.get(bName);
  if (!bNum) continue;
  for (const [chStr, vList] of Object.entries(chMap)) {
    const cNum = parseInt(chStr, 10);
    for (const vNum of vList) {
      paraSet.add(bNum * 1_000_000 + cNum * 1000 + vNum);
    }
  }
}
const paraStarts = [...paraSet].sort((a, b) => a - b);

// Index all 352 referent markers ([雅伟], [耶稣], [基督]) + 295 H0/G0 markers + 1,202 notes
const cuvtById = new Map(cuvtRaw.map((r) => [parseInt(r.id, 10), r.text]));
const referents = [];
let noteCount = 0;
let yhwhCount = 0;
let h0Count = 0;
let g0Count = 0;

function cleanSnippet(text) {
  return text.replace(/<note:[^>]+>/g, '').trim();
}

for (const r of cuvsRaw) {
  const vid = parseInt(r.id, 10);
  const b = Math.floor(vid / 1_000_000);
  const c = Math.floor(vid / 1000) % 1000;
  const v = vid % 1000;
  const textHans = r.text;
  const textHant = cuvtById.get(vid) ?? textHans;

  const notesInVerse = [...textHans.matchAll(/<note:([^>]+)>/g)];
  noteCount += notesInVerse.length;

  const yhwhMatches = textHans.replace(/<note:[^>]+>/g, '').match(/雅伟/g);
  if (yhwhMatches) yhwhCount += yhwhMatches.length;

  const evId = findEventId(vid);

  const refMatches = [...textHans.matchAll(/(主宰|主|我|他)\[(雅伟|耶稣|基督)\]/g)];
  if (refMatches.length > 0) {
    const seenKinds = new Set();
    for (const m of refMatches) {
      const host = m[1];
      const target = m[2];
      const kind = target === '雅伟' ? 'yhwh' : target === '耶稣' ? 'jesus' : 'christ';
      const key = `${vid}-${kind}-${host}`;
      if (seenKinds.has(key)) continue;
      seenKinds.add(key);
      referents.push({
        id: vid,
        b,
        c,
        v,
        kind,
        host,
        count: refMatches.filter((x) => x[2] === target).length,
        ev: evId,
        hans: cleanSnippet(textHans),
        hant: cleanSnippet(textHant),
      });
    }
  }

  const hg0List = hg0ByVid.get(vid);
  if (hg0List) {
    for (const item of hg0List) {
      if (item.code === 'H0') h0Count++;
      else g0Count++;
    }
    referents.push({
      id: vid,
      b,
      c,
      v,
      kind: hg0List[0].code === 'H0' ? 'h0' : 'g0',
      host: hg0List.map((x) => x.tokHans).join('/'),
      count: hg0List.length,
      ev: evId,
      hans: cleanSnippet(injectHg0(textHans, vid, false)),
      hant: cleanSnippet(injectHg0(textHant, vid, true)),
    });
  }
}

// Normalize LORD -> Yahweh in English book introductions
function normEn(s) {
  if (!s) return '';
  return s.replace(/\bthe LORD's\b/g, "Yahweh's")
    .replace(/\bThe LORD's\b/g, "Yahweh's")
    .replace(/\bthe LORD\b/g, 'Yahweh')
    .replace(/\bThe LORD\b/g, 'Yahweh')
    .replace(/\bLORD\b/g, 'Yahweh');
}

const intros = BOOKS.map((bMeta) => {
  const key = ALIAS[bMeta.en] ?? bMeta.en;
  const item = introsRaw[key] ?? introsRaw[bMeta.en];
  if (!item) return null;
  return {
    subtitle: {
      en: normEn(item.subtitle?.en ?? ''),
      hans: item.subtitle?.['zh-Hans'] ?? '',
      hant: item.subtitle?.['zh-Hant'] ?? '',
    },
    summary: {
      en: normEn(item.summary?.en ?? ''),
      hans: item.summary?.['zh-Hans'] ?? '',
      hant: item.summary?.['zh-Hant'] ?? '',
    },
    author: {
      en: normEn(item.author?.en ?? ''),
      hans: item.author?.['zh-Hans'] ?? '',
      hant: item.author?.['zh-Hant'] ?? '',
    },
    date: {
      en: normEn(item.date?.en ?? ''),
      hans: item.date?.['zh-Hans'] ?? '',
      hant: item.date?.['zh-Hant'] ?? '',
    },
    audience: {
      en: normEn(item.audience?.en ?? ''),
      hans: item.audience?.['zh-Hans'] ?? '',
      hant: item.audience?.['zh-Hant'] ?? '',
    },
    themes: {
      en: (item.themes?.en ?? []).map(normEn),
      hans: item.themes?.['zh-Hans'] ?? [],
      hant: item.themes?.['zh-Hant'] ?? [],
    },
    keyPassage: item.keyPassage ?? '',
    keyPassageDesc: {
      en: normEn(item.keyPassageDescription?.en ?? ''),
      hans: item.keyPassageDescription?.['zh-Hans'] ?? '',
      hant: item.keyPassageDescription?.['zh-Hant'] ?? '',
    },
  };
});

writeFileSync(join(OUT_DIR, 'cuvs-yhwh.json'), JSON.stringify({ books: cuvsBooks }) + '\n');
writeFileSync(join(OUT_DIR, 'cuvt-yhwh.json'), JSON.stringify({ books: cuvtBooks }) + '\n');
writeFileSync(join(OUT_DIR, 'bsb-yhwh.json'), JSON.stringify({ books: bsbBooks }) + '\n');
writeFileSync(
  join(OUT_DIR, 'meta.json'),
  JSON.stringify({
    stats: {
      books: 66,
      chapters: 1189,
      verses: cuvsRaw.length,
      illustrations: events.length,
      yhwhOccurrences: yhwhCount,
      notesCount: noteCount,
      referentMarkersTotal: 352,
      referentYhwh: 212,
      referentJesus: 123,
      referentChrist: 17,
      suppliedH0: h0Count,
      suppliedG0: g0Count,
    },
    intros,
    paraStarts,
    referents,
  }) + '\n',
);

console.log(`Built public/data/bible/:`);
console.log(`  cuvs-yhwh.json: ${cuvsRaw.length} verses`);
console.log(`  cuvt-yhwh.json: ${cuvtRaw.length} verses`);
console.log(`  bsb-yhwh.json:  ${bsbRaw.length} verses`);
console.log(`  meta.json:      66 intros, ${paraStarts.length} paraStarts, ${referents.length} marker entries (352 referents + ${h0Count} H0 + ${g0Count} G0), ${noteCount} notes, ${yhwhCount} 雅伟 occurrences`);

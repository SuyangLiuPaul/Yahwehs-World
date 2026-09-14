// Renders the complete event layer as one readable document, Genesis to
// Revelation, every entry carrying the passage it claims to be.
import { readFileSync, writeFileSync } from 'node:fs';

const BOOKS = JSON.parse(readFileSync('scripts/books.json', 'utf8'));
const d = JSON.parse(readFileSync('data/events/all-events.json', 'utf8'));
const ev = d.events;

const yr = (n) => (n === null || n === undefined ? '' : n < 0 ? `前 ${-n}` : `公元 ${n}`);
const band = (e) => {
  if (e.yearEarly === null) return '未定年';
  if (e.yearEarly === e.yearLate) return yr(e.yearEarly);
  return `${yr(e.yearEarly)} — ${yr(e.yearLate)}`;
};
const CONF = { anchored: '锚定', inferred: '推算', disputed: '有争议', none: '不定年' };

const byBook = new Map();
for (const e of ev) {
  if (!byBook.has(e.book)) byBook.set(e.book, []);
  byBook.get(e.book).push(e);
}
for (const list of byBook.values()) list.sort((a, b) => a.start - b.start);

const L = [];
L.push('# 圣经全事件总表 · Every Event, Genesis to Revelation');
L.push('');
L.push(`生成于 ${d.meta.generated.slice(0, 10)}，共 **${ev.length} 条事件，覆盖全部 66 卷**。`);
L.push('');
L.push('每条都带**经文范围**（起止章节），同一事件在多卷中出现的，列出全部平行经文。');
L.push('中文引用以**雅伟版和合本**为准，神名作「雅伟」。');
L.push('');
L.push('## 这份表是怎么来的');
L.push('');
L.push('没有一样是在这里凭空写的：');
L.push('');
L.push('| 成分 | 来源 | 性质 |');
L.push('|---|---|---|');
L.push('| 段落边界、标题、导语 | SeekSparks `section_titles.json`（简体/繁體/英文三套）| 策展，非某一出版译本的分段 |');
L.push('| 平行经文 | `gospel_synopsis.json`（Robertson《福音合参》1922，公有领域）、`ot_synopsis.json` | 策展 |');
L.push('| 年代 | SeekSparks 年表 105 条已审事件，以所罗门登基（锡尔）为锚点 | 已审 |');
L.push('| 地点 | OpenBible.info 逐节索引（CC BY 4.0），**由脚本算出** | 数据，非人工指定 |');
L.push('| 经文节数 | 雅伟版和合本 `cuvs-yhwh.json` 31,102 节 | 数据 |');
L.push('');
L.push('**事件的名称与范围是提案，地点不是。** 全部 `status = candidate`，等待逐条审阅。');
L.push('');
L.push('## 定年的四档');
L.push('');
L.push('| 档 | 含义 | 条数 |');
L.push('|---|---|---:|');
const conf = {};
for (const e of ev) conf[e.dateConfidence] = (conf[e.dateConfidence] ?? 0) + 1;
L.push(`| 推算 inferred | 年表直接收录，或由前后已定年事件夹逼得出 | ${conf.inferred ?? 0} |`);
L.push(`| 有争议 disputed | 创世记 1—11 章：年份由家谱年数累加，前提本身有争议 | ${conf.disputed ?? 0} |`);
L.push(`| 不定年 none | 体裁或位置不支持绝对定年（诗歌、智慧书、哀歌）| ${conf.none ?? 0} |`);
L.push('');
L.push('夹逼出来的区间，**宽度就是不确定度，不是精度**。马可福音第一段写作「前 6 — 公元 33」，');
L.push('意思是年表在这一段的前后各有一个定点，它落在两点之间，不是说它持续了三十九年。');
L.push('');
L.push('## 按卷统计');
L.push('');
L.push('| # | 书卷 | 事件 | 有地点 | 有年代 | 有平行经文 |');
L.push('|---:|---|---:|---:|---:|---:|');
for (let b = 1; b <= 66; b++) {
  const list = byBook.get(b) ?? [];
  const wp = list.filter((e) => e.placeIds.length).length;
  const wy = list.filter((e) => e.yearEarly !== null).length;
  const wpar = list.filter((e) => e.parallels.length).length;
  L.push(`| ${b} | ${BOOKS[b - 1].zh} ${BOOKS[b - 1].en} | ${list.length} | ${wp} | ${wy} | ${wpar} |`);
}
const tp = ev.filter((e) => e.placeIds.length).length;
const ty = ev.filter((e) => e.yearEarly !== null).length;
const tpar = ev.filter((e) => e.parallels.length).length;
L.push(`| | **合计** | **${ev.length}** | **${tp}** | **${ty}** | **${tpar}** |`);
L.push('');
L.push('---');
L.push('');

for (let b = 1; b <= 66; b++) {
  const list = byBook.get(b) ?? [];
  if (!list.length) continue;
  const meta = BOOKS[b - 1];
  L.push(`## ${b}. ${meta.zh} · ${meta.en}`);
  L.push('');
  L.push(`${list.length} 条事件。`);
  L.push('');
  for (const e of list) {
    L.push(`### ${e.zh} · ${e.en}`);
    L.push('');
    L.push(`- **经文**　${e.refZh}（${e.ref}）`);
    if (e.parallels.length) {
      for (const p of e.parallels) {
        L.push(`- **平行经文**　${p.zh} — 同见 ${p.alsoIn.join('、')}`);
      }
    }
    L.push(`- **年代**　${band(e)}　·　${CONF[e.dateConfidence]}`);
    L.push(`- **定年依据**　${e.dateBasis}`);
    if (e.summaryZh) L.push(`- **内容**　${e.summaryZh}`);
    if (e.placeNames.length) {
      const names = e.placeNames.map((n, i) => (e.placeNamesZh[i] ? `${e.placeNamesZh[i]}（${n}）` : n));
      L.push(`- **地点**　${names.join('、')}`);
    } else {
      L.push('- **地点**　经文此段未点名可定位的地点');
    }
    L.push('');
  }
  L.push('---');
  L.push('');
}

writeFileSync('handoff/ALL-EVENTS.md', L.join('\n') + '\n');
console.log(`handoff/ALL-EVENTS.md — ${ev.length} 条事件，${L.length} 行`);

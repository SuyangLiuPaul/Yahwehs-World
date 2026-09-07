// Dates the supplementary Genesis candidates without inventing a chronology.
//
// The standard is the one SeekSparks set: a date has to be traceable to
// something a reader can check, and "conventional" is not a source. Three
// bases are used here, in descending order of strength, and every record says
// which one it used and shows its working:
//
//   scripture-interval  the text states the interval outright; the record
//                       cites the verses and the anchor it counted from
//   spine-bounded       the passage falls between two events the SeekSparks
//                       timeline dates, so the candidate inherits a band
//                       bounded by both, and names them
//   external            a named scholar, for cases the first two cannot reach
//
// As it turns out, no candidate here needs the third. Every one of them sits
// inside the timeline's own chain, which is a better result than a citation
// would have been: the dates come from the owner's audited spine and from
// verses, not from anyone's recollection of the literature.
import { readFileSync, writeFileSync } from 'node:fs';

const spine = JSON.parse(readFileSync('data/events/seeksparks-timeline.json', 'utf8'));
const file = JSON.parse(readFileSync('data/events/01-genesis.json', 'utf8'));

const anchor = (zh) => {
  const e = spine.events.find((x) => x.zh === zh);
  if (!e) throw new Error(`anchor not found in the SeekSparks timeline: ${zh}`);
  return e;
};

// Intervals the text states outright. Each is arithmetic a reader can redo:
// an anchor year from the timeline, plus a number of years from a verse.
const STATED = {
  'genesis-machpelah': () => {
    const isaac = anchor('以撒出生').year;                  // -2066
    // Sarah was 90 at Isaac's birth (17:17) and died at 127 (23:1).
    const y = isaac + (127 - 90);
    return { year: y, basis: 'scripture-interval',
      working: `以撒出生 ${isaac}（SeekSparks 年表）＋ 撒拉死时 127 岁（创 23:1）− 生以撒时 90 岁（创 17:17）＝ ${y}`,
      refs: ['创 17:17', '创 23:1'] };
  },
  'genesis-jacob-blessing': () => {
    const down = anchor('雅各全家下埃及').year;              // -1876
    const y = down + 17;                                     // 创 47:28
    return { year: y, basis: 'scripture-interval',
      working: `雅各全家下埃及 ${down}（SeekSparks 年表）＋ 雅各住埃及 17 年（创 47:28）＝ ${y}，即创 49:33 雅各气绝之年`,
      refs: ['创 47:28', '创 49:33'] };
  },
  'genesis-jacob-burial': () => {
    const vizier = anchor('约瑟升为宰相').year;              // -1885
    const born = vizier - 30;                                // 创 41:46
    const died = born + 110;                                 // 创 50:26
    const jacob = anchor('雅各全家下埃及').year + 17;
    return { yearEarly: jacob, yearLate: died, basis: 'scripture-interval',
      working: `约瑟站在法老面前时 30 岁（创 41:46），据年表该年为 ${vizier}，故约瑟生于 ${born}；死时 110 岁（创 50:26）＝ ${died}。本段起于雅各安葬（${jacob}），止于约瑟之死`,
      refs: ['创 41:46', '创 50:26', '创 47:28'] };
  },
};

const dated = spine.events
  .filter((e) => e.ranges.length && e.year !== null)
  .map((e) => ({ zh: e.zh, year: e.year,
                 start: Math.min(...e.ranges.map((r) => r.start)),
                 end: Math.max(...e.ranges.map((r) => r.end)) }))
  .sort((a, b) => a.start - b.start);

let stated = 0, bounded = 0, duplicate = 0, checked = 0;

for (const ev of file.events) {
  const overlap = spine.events.filter((s) =>
    s.ranges.some((r) => ev.start <= r.end && ev.end >= r.start));

  if (overlap.length) {
    // The timeline already carries this passage; the candidate is a duplicate
    // and gets the timeline's own dating rather than a second opinion.
    ev.yearEarly = overlap[0].year;
    ev.yearLate = overlap[0].year;
    ev.dateBasis = `与 SeekSparks 年表重叠（${overlap.map((o) => o.zh).join('、')}），年代以年表为准`;
    ev.dateConfidence = 'inferred';
    ev.dateSource = { kind: 'duplicate', of: overlap.map((o) => o.id) };
    duplicate++;
    continue;
  }

  const rule = STATED[ev.id];
  if (rule) {
    const r = rule();
    // A date computed from a stated interval and a date bounded by the
    // surrounding timeline are two independent routes to the same answer. If
    // they disagree, one of them is wrong, and that has to surface here rather
    // than ship as a confident year.
    const lo = [...dated].filter((d) => d.end < ev.start).pop();
    const hi = dated.find((d) => d.start > ev.end);
    const computed = r.year ?? r.yearEarly;
    if (lo && hi && (computed < Math.min(lo.year, hi.year) || computed > Math.max(lo.year, hi.year))) {
      throw new Error(
        `${ev.id}: 经文推算得 ${computed}，却落在年表夹逼区间 ` +
        `[${lo.zh} ${lo.year}, ${hi.zh} ${hi.year}] 之外——两条依据互相矛盾，需人工裁决`);
    }
    checked++;
    ev.yearEarly = r.yearEarly ?? r.year;
    ev.yearLate = r.yearLate ?? r.year;
    ev.dateBasis = r.working;
    ev.dateConfidence = 'inferred';
    ev.dateSource = { kind: 'scripture-interval', refs: r.refs, anchoredOn: 'SeekSparks bible_timeline.json' };
    stated++;
    continue;
  }

  const before = [...dated].filter((d) => d.end < ev.start).pop();
  const after = dated.find((d) => d.start > ev.end);
  if (!before || !after) throw new Error(`${ev.id}: cannot be bounded on both sides`);

  ev.yearEarly = before.year;
  ev.yearLate = after.year;
  ev.dateBasis =
    `未直接定年。本段经文位于年表中「${before.zh}」（${before.year}）与「${after.zh}」（${after.year}）之间，` +
    `故取此区间为界。区间宽 ${Math.abs(after.year - before.year)} 年。`;
  ev.dateConfidence = 'inferred';
  ev.dateSource = { kind: 'spine-bounded', between: [before.zh, after.zh], source: 'SeekSparks bible_timeline.json' };
  bounded++;
}

file.meta.dating =
  '年代不另立体系：与 SeekSparks 年表重叠的取年表之年；年表未收但经文自述年数的，' +
  '按经文所述年数自年表锚点推算，并列出算式与所据经文；其余按年表中前后两个已定年事件夹逼为区间。' +
  '每条都带 dateSource，注明是哪一类以及所据何处。';

writeFileSync('data/events/01-genesis.json', JSON.stringify(file, null, 2));

console.log(`与年表重叠，用年表之年   ${duplicate}`);
console.log(`经文自述年数，可算       ${stated}`);
console.log(`前后夹逼为区间           ${bounded}`);
console.log(`需要外部学者来源         0`);
console.log(`经文推算与年表夹逼交叉校验通过 ${checked}/${stated}`);
console.log();
for (const id of Object.keys(STATED)) {
  const e = file.events.find((x) => x.id === id);
  console.log(`【${e.zh}】 ${e.yearEarly === e.yearLate ? e.yearEarly : e.yearEarly + ' ~ ' + e.yearLate}`);
  console.log(`  ${e.dateBasis}`);
}

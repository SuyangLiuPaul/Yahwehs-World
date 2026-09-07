// A first-pass review of the imported timeline. Everything here is a
// RECOMMENDATION with its reason attached, never a decision: the file records
// `recommend` and `why`, and the owner's own approval is a separate field the
// review tool writes.
//
// What this pass can judge is mechanical — whether a place linkage follows from
// the passage, whether a reference matches the event it is attached to, whether
// a range is wide enough that its place list stopped being the event's
// geography. What it cannot judge is whether an event belongs in the product.
import { readFileSync, writeFileSync } from 'node:fs';

const file = JSON.parse(readFileSync('data/events/seeksparks-timeline.json', 'utf8'));

/** Chapters spanned by an event's ranges. */
const span = (e) => e.ranges.reduce((n, r) =>
  n + (Math.floor((r.end % 1_000_000) / 1000) - Math.floor((r.start % 1_000_000) / 1000) + 1), 0);

const findings = [];
const rec = (e, status, why, kind) => {
  e.recommend = status; e.why = why; e.finding = kind;
  findings.push({ zh: e.zh, status, kind, why });
};

for (const e of file.events) {
  const chapters = span(e);
  const places = e.placeIds.length;

  // A whole book carrying a hundred-odd places is not an event with a location;
  // it is a scope. Pinning it would put 397 dots on one moment.
  if (places >= 60) {
    rec(e, 'edited',
      `范围是整卷或近整卷（${chapters} 章），算出 ${places} 处地点。这不是一个「有地点的事件」，而是一个时段/范围。` +
      `建议单独标为 period/book 类，不在地图上按单点显示。`, 'scope');
    continue;
  }

  // The intertestamental entries carry no biblical reference by nature, so no
  // index can locate them — but three of them name their own place in their
  // own summary, which is a gap worth closing by hand.
  if (e.refs.length === 0) {
    const guess = ['耶路撒冷', '亚历山大', '波斯', '罗马'].filter((g) => e.summaryZh.includes(g));
    rec(e, 'edited',
      `两约之间事件，没有圣经引用，因此索引永远算不出地点。` +
      (guess.length ? `其摘要中已点明地名：${guess.join('、')}——建议人工补上坐标。` : `建议人工判断是否需要地点。`),
      'no-refs');
    continue;
  }

  // A reference that predicts an event is not a reference to the event.
  if (places === 0 && chapters <= 3 && e.year > 0 && /应验|预言/.test(e.summaryZh)) {
    rec(e, 'edited',
      `所引经文（${e.refs.join('、')}）是耶稣的预言，不是事件本身；事件发生在约 ${e.year} 年，` +
      `所引经文却在其约四十年前。因此算出 0 处地点。建议或改引记载事件的经文，或人工指定地点（耶路撒冷）。`,
      'ref-mismatch');
    continue;
  }

  if (places === 0) {
    rec(e, 'approved',
      `0 处地点是正确的——所引经文确实没有指名任何可定位的地名。` +
      `（如登山变像，太 17:1 只说「高山」，未指名；他泊山、黑门山皆为传统认定，非经文所载。）`,
      'zero-correct');
    continue;
  }

  // Once a range crosses several chapters it stops being one scene, and its
  // place list starts collecting where people are FROM and what happens next.
  if (chapters >= 3 && places >= 8) {
    rec(e, 'edited',
      `范围跨 ${chapters} 章，算出 ${places} 处地点，其中多半不属于本事件本身——` +
      `跨章范围会连带收进人物的籍贯（如「书念的童女」带出书念、「基列人巴西莱」带出基列）` +
      `与前后相邻的段落。每处地点后已标出所在经节，建议逐一核对保留哪些。`,
      'range-wide');
    continue;
  }

  rec(e, 'approved',
    `范围 ${chapters} 章，${places} 处地点，规模与事件相称，未见异常。`, 'ok');
}

writeFileSync('data/events/seeksparks-timeline.json', JSON.stringify(file, null, 2));

const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
const byStatus = {};
for (const f of findings) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;

console.log('建议通过 approved:', byStatus.approved ?? 0);
console.log('建议待改 edited  :', byStatus.edited ?? 0);
console.log();
const LABEL = {
  scope: '范围是整卷/时段，不该当单点事件',
  'no-refs': '无圣经引用，索引无法定位',
  'ref-mismatch': '所引经文与事件不符',
  'zero-correct': '0 地点且正确（经文确未指名）',
  'range-wide': '跨章范围过宽，混入籍贯与相邻段落',
  ok: '未见异常',
};
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(n).padStart(3)}  ${LABEL[k]}`);
}
console.log('\n需要你裁决的（建议待改）：');
for (const f of findings.filter((x) => x.status === 'edited')) {
  console.log(`  · ${f.zh}  [${LABEL[f.kind]}]`);
}

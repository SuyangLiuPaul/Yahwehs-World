// The review tool. Its job is to make judging 200 authored claims fast enough
// that the judging actually happens — because the bottleneck on an events
// layer is never generating candidates, it is a person deciding whether each
// one is true.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

// Two sources, and the difference between them is the point of the page.
//
// SeekSparks' timeline is already dated, audited and shipped in three
// languages; it is the spine, and its years are not up for re-litigation here.
// The Genesis candidates were authored before that timeline was found, and
// they exist now only to answer one question: does the spine miss narrative
// worth adding. So they are shown second, marked as supplementary, and any
// that merely restate an event the spine already has are flagged as such —
// because approving a duplicate is the most likely way this page goes wrong.
const spine = JSON.parse(readFileSync('data/events/seeksparks-timeline.json', 'utf8'));

const candFiles = readdirSync('data/events')
  .filter((f) => f.endsWith('.json') && !f.endsWith('.raw.json') && f !== 'seeksparks-timeline.json');
const candBooks = candFiles.sort().map((f) => JSON.parse(readFileSync(`data/events/${f}`, 'utf8')));

/** True when a candidate's passage overlaps one the spine already carries. */
function overlapsSpine(ev) {
  return spine.events.filter((s) =>
    s.ranges.some((r) => ev.start <= r.end && ev.end >= r.start));
}

const spineRows = spine.events.map((e) => ({
  kind: 'spine',
  id: e.id, zh: e.zh, en: e.en, summaryZh: e.summaryZh,
  refZh: e.refs.join('、'), era: e.era,
  year: e.year, basis: e.basis, approximate: e.approximate,
  datingRefs: e.datingRefs.length,
  placeNames: e.placeNames, status: e.status, dup: [],
}));

const candRows = candBooks.flatMap((b) => b.events.map((e) => {
  const hits = overlapsSpine(e);
  return {
    kind: 'candidate',
    id: e.id, zh: e.zh, en: e.en, summaryZh: e.summaryZh,
    refZh: e.refZh, era: null,
    year: null, basis: null, approximate: null, datingRefs: 0,
    placeNames: e.placeNames, status: e.status,
    dup: hits.map((h) => h.zh),
  };
}));

const all = [...spineRows, ...candRows];
const books = [];

// SeekSparks' own basis vocabulary, kept verbatim rather than remapped.
const CONF = {
  'scripture+thiele': ['经文区间 + Thiele 锚点', '#7f9c7a'],
  'thiele':           ['Thiele 王年', '#7f9c7a'],
  'conventional':     ['通行年代', '#8a9bb0'],
};
const ERA = {
  antediluvian: '洪水之前', patriarchs: '族长', mosaic: '摩西', conquest: '征服',
  monarchy: '王国', exile: '被掳', intertestamental: '两约之间', nt: '新约',
};

const html = `<title>圣经事件审阅台</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap">
<style>
:root {
  --ground:#f2ece0; --surface:#fbf7ef; --ink:#16212e; --muted:#6b7684; --faint:#9aa4b0;
  --line:#ddd3c2; --gold:#9d7c1a; --ok:#4f7a55; --no:#9c5b4e; --edit:#8a6a2a;
  --display:'Cormorant Garamond',Georgia,serif; --body:'Noto Serif SC','Songti SC',serif;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#0b1420; --surface:#111d2b; --ink:#ece2cd; --muted:#8d99a8; --faint:#66717e;
  --line:#24354a; --gold:#d9b444; --ok:#7f9c7a; --no:#c08877; --edit:#d9b444;
}}
:root[data-theme="dark"]{
  --ground:#0b1420; --surface:#111d2b; --ink:#ece2cd; --muted:#8d99a8; --faint:#66717e;
  --line:#24354a; --gold:#d9b444; --ok:#7f9c7a; --no:#c08877; --edit:#d9b444;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:58rem;margin:0 auto;padding:2.2rem 1.5rem 6rem}
header{border-bottom:1px solid var(--line);padding-bottom:1.3rem;margin-bottom:1.3rem}
.eyebrow{margin:0 0 .5rem;font-family:var(--mono);font-size:.66rem;letter-spacing:.26em;text-transform:uppercase;color:var(--gold)}
h1{margin:0 0 .4rem;font-size:1.9rem;font-weight:600;letter-spacing:.04em}
.lede{margin:0;color:var(--muted);font-size:.88rem;max-width:44rem}
.warn{margin:.9rem 0 0;padding:.7rem .9rem;border-left:2px solid var(--edit);background:#d9b4441a;font-size:.82rem;color:var(--muted)}
.warn b{color:var(--ink)}

.bar{position:sticky;top:0;z-index:5;background:var(--ground);border-bottom:1px solid var(--line);
  padding:.7rem 0;margin:1.3rem 0 1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap;font-size:.78rem}
.tallies{display:flex;gap:.9rem;font-family:var(--mono);font-variant-numeric:tabular-nums}
.tallies span{color:var(--muted)} .tallies b{font-weight:500}
.t-ok b{color:var(--ok)} .t-no b{color:var(--no)} .t-left b{color:var(--gold)}
.track{flex:1;min-width:6rem;height:3px;background:var(--line);border-radius:2px;overflow:hidden}
.track i{display:block;height:100%;background:var(--ok);width:0;transition:width .25s}
.hint{font-family:var(--mono);font-size:.66rem;color:var(--faint)}
.hint kbd{border:1px solid var(--line);border-radius:2px;padding:0 .28rem;font-family:var(--mono)}

.ev{border:1px solid var(--line);border-radius:3px;background:var(--surface);padding:1rem 1.1rem;margin-bottom:.7rem;scroll-margin-top:4.5rem}
.ev[data-status="approved"]{border-left:3px solid var(--ok)}
.ev[data-status="rejected"]{border-left:3px solid var(--no);opacity:.55}
.ev[data-status="edited"]{border-left:3px solid var(--edit)}
.ev.cursor{outline:2px solid var(--gold);outline-offset:2px}
.ev h2{margin:0 0 .1rem;font-size:1.12rem;font-weight:600;letter-spacing:.03em}
.ev .en{margin:0 0 .5rem;font-family:var(--display);font-size:.85rem;color:var(--muted)}
.ev .sum{margin:0 0 .7rem;font-size:.88rem}
.meta{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.7rem;font-size:.68rem}
.chip{border:1px solid currentColor;border-radius:2px;padding:.16rem .45rem;letter-spacing:.06em}
.chip.ref{color:var(--gold);font-family:var(--mono)}
.chip.yr{font-family:var(--mono)}
.chip.src{color:var(--faint);font-family:var(--mono)}
.chip.dup{color:var(--no)}
.bookhead.alt{color:var(--edit);margin-top:2.4rem;border-top:1px solid var(--line);padding-top:1.4rem}
.places{margin:0 0 .8rem;font-size:.76rem;color:var(--muted);line-height:1.7}
.places b{color:var(--ink);font-weight:400}
.places .lbl{font-family:var(--mono);font-size:.64rem;letter-spacing:.14em;color:var(--faint);text-transform:uppercase;margin-right:.4rem}
.basis{margin:0 0 .8rem;font-size:.74rem;color:var(--faint);line-height:1.65;border-left:1px solid var(--line);padding-left:.7rem}
.acts{display:flex;gap:.4rem;flex-wrap:wrap}
button.act{background:transparent;border:1px solid var(--line);border-radius:2px;padding:.34rem .8rem;
  color:var(--muted);font-family:var(--body);font-size:.78rem;cursor:pointer;transition:all .16s}
button.act:hover{border-color:currentColor}
button.act.ok:hover,.ev[data-status="approved"] .act.ok{color:var(--ok);border-color:var(--ok)}
button.act.no:hover,.ev[data-status="rejected"] .act.no{color:var(--no);border-color:var(--no)}
button.act.ed:hover,.ev[data-status="edited"] .act.ed{color:var(--edit);border-color:var(--edit)}
button.act:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
textarea{width:100%;margin-top:.6rem;background:var(--ground);border:1px solid var(--line);border-radius:2px;
  color:var(--ink);font-family:var(--body);font-size:.82rem;padding:.5rem .6rem;resize:vertical;min-height:3.4rem}
textarea:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
.bookhead{margin:1.8rem 0 .7rem;font-family:var(--mono);font-size:.68rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}
footer{margin-top:2rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.72rem;color:var(--faint)}
#export{background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:2px;padding:.4rem .9rem;font-family:var(--body);font-size:.76rem;cursor:pointer}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
<header>
  <p class="eyebrow">雅伟之界 · 事件层</p>
  <h1>圣经事件审阅台</h1>
  <p class="lede">两组来源，请分开看。前 105 条是 SeekSparks 年表——年份、依据、约略标记原样取用，未作改动；这里要审的只有<b>新算出来的地点关联</b>。末尾 35 条是在找到该年表之前提出的创世记补充候选，<b>名称和范围都是提案</b>。</p>
  <p class="warn"><b>年份不在这里重新议。</b>SeekSparks 以所罗门登基（Thiele）为锚点，按经文自述的年数上溯，来源与审计见该仓库的 <code>docs/WHEEL-PROVENANCE.md</code>。这是已经做过的裁决，本页原样沿用。地点关联由脚本从 OpenBible 逐节索引算出，不是提案；<b>补充候选的名称与经文范围才是提案</b>，其中与年表重叠的已标红。</p>
</header>

<div class="bar">
  <div class="tallies">
    <span class="t-ok">通过 <b id="n-ok">0</b></span>
    <span class="t-no">否决 <b id="n-no">0</b></span>
    <span class="t-left">待审 <b id="n-left">0</b></span>
  </div>
  <span class="track"><i id="prog"></i></span>
  <span class="hint"><kbd>J</kbd>/<kbd>K</kbd> 上下　<kbd>A</kbd> 通过　<kbd>X</kbd> 否决　<kbd>E</kbd> 待改</span>
  <button id="export" type="button">导出结果</button>
</div>

<div id="list"></div>

<footer>
  地点数据 OpenBible.info · CC BY 4.0。候选事件由模型提出，通过与否以本页记录为准。
</footer>
</div>

<script>
const EVENTS = ${JSON.stringify(all)};
const CONF = ${JSON.stringify(CONF)};
const ERA = ${JSON.stringify(ERA)};

let state = {};      // id -> {status, notes}
let store = null;
let cursor = 0;

const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const $ = (id) => document.getElementById(id);

function yearLabel(e) {
  if (e.year === null) return '未定年';
  const y = e.year < 0 ? Math.abs(e.year) + ' BC' : e.year + ' AD';
  return (e.approximate ? '约 ' : '') + y;
}

function render() {
  let html = '', lastGroup = null;
  EVENTS.forEach((e, i) => {
    const group = e.kind === 'spine' ? ('era:' + e.era) : 'cand';
    if (group !== lastGroup) {
      lastGroup = group;
      html += e.kind === 'spine'
        ? \`<h2 class="bookhead">\${esc(ERA[e.era] || e.era)}</h2>\`
        : \`<h2 class="bookhead alt">补充候选 · 创世记叙事（在 SeekSparks 年表之外提出，未定年）</h2>\`;
    }
    const st = state[e.id] || { status: 'candidate', notes: '' };
    const conf = CONF[e.basis] || ['未标依据', '#8a7f9c'];
    html += \`<article class="ev\${i === cursor ? ' cursor' : ''}" data-status="\${st.status}" data-i="\${i}" id="ev\${i}">
      <h2>\${esc(e.zh)}</h2>
      <p class="en">\${esc(e.en)}</p>
      <p class="sum">\${esc(e.summaryZh)}</p>
      <div class="meta">
        <span class="chip ref">\${esc(e.refZh)}</span>
        \${e.kind === 'spine'
          ? \`<span class="chip yr" style="color:\${conf[1]}">\${yearLabel(e)} · \${conf[0]}</span>
              \${e.datingRefs ? \`<span class="chip src">推算链 \${e.datingRefs} 节经文</span>\` : ''}\`
          : '<span class="chip yr" style="color:#8a7f9c">补充候选 · 未定年</span>'}
        \${e.dup.length ? \`<span class="chip dup">年表已有：\${e.dup.map(esc).join('、')}</span>\` : ''}
      </div>
      \${e.placeNames.length ? \`<p class="places"><span class="lbl">经文中的地点 \${e.placeNames.length}</span><b>\${e.placeNames.map(esc).join(' · ')}</b></p>\` :
        '<p class="places"><span class="lbl">经文中的地点</span>这段经文没有提到任何可定位的地名</p>'}

      <div class="acts">
        <button class="act ok" data-a="approved">通过</button>
        <button class="act no" data-a="rejected">否决</button>
        <button class="act ed" data-a="edited">待改</button>
      </div>
      <textarea placeholder="批注：范围要改？名称不妥？年代依据有问题？" data-n="\${e.id}">\${esc(st.notes)}</textarea>
    </article>\`;
  });
  $('list').innerHTML = html;
  tally();
}

function tally() {
  const vals = EVENTS.map((e) => (state[e.id] || {}).status || 'candidate');
  const ok = vals.filter((v) => v === 'approved').length;
  const no = vals.filter((v) => v === 'rejected').length;
  const left = vals.filter((v) => v === 'candidate').length;
  $('n-ok').textContent = ok; $('n-no').textContent = no; $('n-left').textContent = left;
  $('prog').style.width = ((EVENTS.length - left) / EVENTS.length * 100).toFixed(1) + '%';
}

function set(i, status) {
  const e = EVENTS[i];
  const cur = state[e.id] || { status: 'candidate', notes: '' };
  state[e.id] = { ...cur, status: cur.status === status ? 'candidate' : status };
  const el = $('ev' + i);
  el.dataset.status = state[e.id].status;
  tally(); save();
}

$('list').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.act');
  if (!btn) return;
  set(Number(btn.closest('.ev').dataset.i), btn.dataset.a);
});
$('list').addEventListener('input', (ev) => {
  if (ev.target.tagName !== 'TEXTAREA') return;
  const id = ev.target.dataset.n;
  state[id] = { ...(state[id] || { status: 'candidate' }), notes: ev.target.value };
  save();
});

function moveCursor(d) {
  document.querySelectorAll('.ev').forEach((el) => el.classList.remove('cursor'));
  cursor = Math.max(0, Math.min(EVENTS.length - 1, cursor + d));
  const el = $('ev' + cursor);
  el.classList.add('cursor');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'TEXTAREA' || ev.metaKey || ev.ctrlKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'j') { moveCursor(1); ev.preventDefault(); }
  else if (k === 'k') { moveCursor(-1); ev.preventDefault(); }
  else if (k === 'a') { set(cursor, 'approved'); moveCursor(1); ev.preventDefault(); }
  else if (k === 'x') { set(cursor, 'rejected'); moveCursor(1); ev.preventDefault(); }
  else if (k === 'e') { set(cursor, 'edited'); ev.preventDefault(); }
});

$('export').addEventListener('click', () => {
  const rows = EVENTS.map((e) => {
    const st = state[e.id] || { status: 'candidate', notes: '' };
    return { id: e.id, zh: e.zh, ref: e.refZh, status: st.status, notes: st.notes };
  });
  const text = JSON.stringify(rows, null, 2);
  navigator.clipboard?.writeText(text).then(
    () => { $('export').textContent = '已复制到剪贴板'; setTimeout(() => ($('export').textContent = '导出结果'), 2000); },
    () => { $('export').textContent = '复制失败'; },
  );
});

let timer;
function save() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try { localStorage.setItem('events.review', JSON.stringify(state)); } catch {}
    if (store) { try { await store.doc('review/events').set({ state, at: Date.now() }); } catch {} }
  }, 400);
}

try {
  const local = JSON.parse(localStorage.getItem('events.review') || '{}');
  if (local && typeof local === 'object') state = local;
} catch {}

render();

(async () => {
  const db = window.claude && (await window.claude.use('db'));
  if (!db) return;
  store = db;
  try {
    const doc = await db.doc('review/events').get();
    if (doc && doc.state && Object.keys(doc.state).length >= Object.keys(state).length) {
      state = doc.state;
      render();
    }
  } catch {}
})();
</script>`;

writeFileSync('scripts/review-page.html', html);
console.log(`review-page.html  ${all.length} 个候选  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);

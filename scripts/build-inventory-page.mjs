// Renders the coverage inventory as a standalone reviewable page. The data is
// embedded rather than fetched so the page works as a published artifact with
// no network in its loading path.
import { readFileSync, writeFileSync } from 'node:fs';

const inv = JSON.parse(readFileSync('public/data/inventory.json', 'utf8'));

// Trim to what the page actually renders — the full bundle carries fields the
// globe needs and the ledger does not.
const slim = {
  meta: inv.meta,
  books: inv.books.map((b) => ({
    n: b.n, en: b.en, zh: b.zh, e: b.events, p: b.places,
    tc: b.totalChapters, cc: b.coveredChapters,
    c: b.chapters.map((c) => ({ n: c.n, pl: c.places, v: c.verses.map((x) => [x.v, x.places]) })),
  })),
  none: inv.booksWithoutPlaces,
};

const html = `<title>圣经地理事件总账</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap">
<style>
:root {
  --ground: #f2ece0;
  --surface: #fbf7ef;
  --raised: #ffffff;
  --ink: #16212e;
  --muted: #6b7684;
  --faint: #9aa4b0;
  --line: #ddd3c2;
  --gold: #9d7c1a;
  --gold-soft: #c9a22726;
  --done: #4f7a55;
  --none: #8a6a5a;
  --shadow: 0 1px 2px #16212e0f;
  --display: 'Cormorant Garamond', Georgia, serif;
  --body: 'Noto Serif SC', 'Songti SC', serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0b1420; --surface: #111d2b; --raised: #16243450;
    --ink: #ece2cd; --muted: #8d99a8; --faint: #66717e; --line: #24354a;
    --gold: #d9b444; --gold-soft: #c9a22718;
    --done: #7f9c7a; --none: #b08a72; --shadow: 0 1px 2px #0006;
  }
}
:root[data-theme="dark"] {
  --ground: #0b1420; --surface: #111d2b; --raised: #16243450;
  --ink: #ece2cd; --muted: #8d99a8; --faint: #66717e; --line: #24354a;
  --gold: #d9b444; --gold-soft: #c9a22718;
  --done: #7f9c7a; --none: #b08a72; --shadow: 0 1px 2px #0006;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: var(--body); font-size: 15px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 62rem; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }

/* ── masthead ─────────────────────────────────────────────── */
header { border-bottom: 1px solid var(--line); padding-bottom: 1.6rem; margin-bottom: 1.6rem; }
.eyebrow {
  font-family: var(--mono); font-size: .66rem; letter-spacing: .28em;
  text-transform: uppercase; color: var(--gold); margin: 0 0 .5rem;
}
h1 { margin: 0 0 .4rem; font-size: 2rem; font-weight: 600; letter-spacing: .04em; text-wrap: balance; }
.lede { margin: 0; color: var(--muted); font-size: .92rem; max-width: 46rem; }

/* ── totals ───────────────────────────────────────────────── */
.totals {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: 0; margin: 1.6rem 0 0; border: 1px solid var(--line); border-radius: 2px;
  background: var(--surface); overflow: hidden;
}
.totals div { padding: .85rem 1rem; border-right: 1px solid var(--line); }
.totals div:last-child { border-right: none; }
.totals b {
  display: block; font-family: var(--mono); font-size: 1.35rem; font-weight: 500;
  font-variant-numeric: tabular-nums; letter-spacing: -.02em;
}
.totals span { font-size: .68rem; color: var(--muted); letter-spacing: .1em; }

/* ── controls ─────────────────────────────────────────────── */
.controls { display: flex; gap: .8rem; align-items: center; margin: 1.6rem 0 .5rem; flex-wrap: wrap; }
.only { display: inline-flex; align-items: center; gap: .4rem; font-size: .76rem; color: var(--muted); cursor: pointer; white-space: nowrap; }
.only input { accent-color: var(--gold); cursor: pointer; }
#q {
  flex: 1 1 16rem; min-width: 0; padding: .5rem .75rem; background: var(--surface);
  border: 1px solid var(--line); border-radius: 2px; color: var(--ink);
  font-family: var(--body); font-size: .86rem;
}
#q:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.progress { display: flex; align-items: center; gap: .6rem; font-family: var(--mono); font-size: .74rem; color: var(--muted); }
.bar { width: 7rem; height: 3px; background: var(--line); border-radius: 2px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--done); width: 0; transition: width .3s ease; }
.note { font-size: .72rem; color: var(--faint); margin: 0 0 1.2rem; }

/* ── ledger ───────────────────────────────────────────────── */
.book { border-bottom: 1px solid var(--line); }
.book > summary {
  display: grid; grid-template-columns: 2.2rem minmax(0, 1fr) 4.5rem auto auto; gap: .9rem;
  align-items: baseline; padding: .7rem .3rem; cursor: pointer; list-style: none;
}
/* How much of each book the map actually reaches, at a glance. */
.bcov { height: 3px; background: var(--line); border-radius: 2px; overflow: hidden; align-self: center; }
.bcov i { display: block; height: 100%; background: var(--gold); }
.book > summary::-webkit-details-marker { display: none; }
.book > summary:hover { background: var(--gold-soft); }
.book > summary:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; }
.bnum { font-family: var(--mono); font-size: .74rem; color: var(--faint); font-variant-numeric: tabular-nums; }
.bname { font-weight: 600; letter-spacing: .03em; }
.bname em { font-family: var(--display); font-style: normal; color: var(--muted); font-size: .88em; margin-left: .5rem; }
.bstat { font-family: var(--mono); font-size: .74rem; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.bdone { font-family: var(--mono); font-size: .7rem; color: var(--faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
.book[data-complete="1"] .bdone { color: var(--done); }

.chapters { padding: .2rem 0 1rem 2.2rem; display: grid; gap: 1px; }
.ch { display: grid; grid-template-columns: 1.2rem 3.4rem 1fr; gap: .7rem; padding: .45rem .5rem; align-items: start; border-radius: 2px; }
.ch:hover { background: var(--gold-soft); }
/* A chapter naming no place is still a chapter — dimmed, never dropped. */
.ch.empty-ch .cnum { color: var(--faint); }
.cplaces .none { color: var(--faint); font-size: .76rem; letter-spacing: .06em; }
.ch input { margin: .35rem 0 0; accent-color: var(--done); cursor: pointer; }
.ch input:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.cnum { font-family: var(--mono); font-size: .76rem; color: var(--gold); font-variant-numeric: tabular-nums; padding-top: .12rem; }
.cbody { min-width: 0; }
.cplaces { font-size: .82rem; line-height: 1.55; }
.cplaces b { font-weight: 400; }
.ccount { font-family: var(--mono); font-size: .68rem; color: var(--faint); margin-left: .4rem; }
.verses { margin: .35rem 0 0; font-family: var(--mono); font-size: .68rem; color: var(--muted); line-height: 1.75; display: none; }
.ch[data-open="1"] .verses { display: block; }
.vtoggle {
  background: none; border: none; padding: 0; margin-left: .4rem; cursor: pointer;
  font-family: var(--mono); font-size: .66rem; color: var(--gold); text-decoration: underline;
}
.verses i { font-style: normal; color: var(--faint); }

.empty { padding: 1.5rem .3rem 0; }
.empty h2 { font-size: .68rem; font-family: var(--mono); letter-spacing: .24em; text-transform: uppercase; color: var(--none); margin: 0 0 .5rem; }
.empty p { margin: 0 0 .6rem; font-size: .82rem; color: var(--muted); max-width: 42rem; }
.empty ul { margin: 0; padding-left: 1.1rem; font-size: .84rem; color: var(--muted); }

footer { margin-top: 2.5rem; padding-top: 1.2rem; border-top: 1px solid var(--line); font-size: .72rem; color: var(--faint); }
footer a { color: var(--muted); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
@media (max-width: 640px) {
  .wrap { padding: 1.5rem 1rem 4rem; }
  .book > summary { grid-template-columns: 1.8rem minmax(0, 1fr) auto; gap: .5rem; }
  .bdone, .bcov { display: none; }
  .chapters { padding-left: .6rem; }
}
</style>

<div class="wrap">
<header>
  <p class="eyebrow">雅伟之界 · 圣经世界 · 覆盖总账</p>
  <h1>圣经地理事件总账</h1>
  <p class="lede">
    圣经中每一节提到可定位地点的经文，按卷、章、节全部列出。这不是人工整理的"重要事件"精选，
    而是数据本身的完整审计——每一行都来自 OpenBible.info 的地名数据集，没有一条是凭记忆写的。
    勾选用于记录你已经审阅过哪些章。
  </p>
  <div class="totals">
    <div><b>${inv.meta.totalEvents.toLocaleString()}</b><span>含地名的经文</span></div>
    <div><b>${inv.meta.totalInstances.toLocaleString()}</b><span>地点实例</span></div>
    <div><b>${inv.meta.chaptersTotal.toLocaleString()}</b><span>全部章数</span></div>
    <div><b>${inv.books.reduce((n, b) => n + b.coveredChapters, 0).toLocaleString()}</b><span>有地名的章</span></div>
    <div><b>${(inv.meta.chaptersTotal - inv.books.reduce((n, b) => n + b.coveredChapters, 0)).toLocaleString()}</b><span>无地名的章</span></div>
    <div><b>${inv.meta.booksCovered}/66</b><span>涉及书卷</span></div>
    <div><b>${inv.meta.totalPlaces.toLocaleString()}</b><span>可定位地点</span></div>
  </div>
</header>

<div class="controls">
  <input id="q" type="search" placeholder="搜索书卷或地名，例如 迦南 / Hebron / 使徒行传" autocomplete="off">
  <label class="only"><input id="only" type="checkbox"> 只看有地名的章</label>
  <div class="progress"><span id="ptext">0 / 0 章已审</span><span class="bar"><i id="pbar"></i></span></div>
</div>
<p class="note" id="synced"></p>

<div id="ledger"></div>

<section class="empty">
  <h2>五卷书没有任何地名</h2>
  <p>这不是数据缺失，是这些书本身没有地理内容——它们是写给个人或泛指受众的短信，行文中不指名任何地方。地球上不会有它们的点，这是正确的。</p>
  <ul>${inv.booksWithoutPlaces.map((b) => `<li>${b.zh} <span style="color:var(--faint)">${b.en}</span></li>`).join('')}</ul>
</section>

<footer>
  地名与经文引用来自 <a href="https://www.openbible.info/geo/" target="_blank" rel="noopener">OpenBible.info Bible Geocoding</a>，CC BY 4.0。
  生成于 ${new Date(inv.meta.generated).toISOString().slice(0, 10)}。
</footer>
</div>

<script>
const DATA = ${JSON.stringify(slim)};
const ledger = document.getElementById('ledger');
const bar = document.getElementById('pbar');
const ptext = document.getElementById('ptext');
const synced = document.getElementById('synced');

const TOTAL_CH = DATA.books.reduce((n, b) => n + b.c.length, 0);
let checked = new Set();
let store = null;           // db namespace, when the viewer can run it
const key = (b, c) => b + ':' + c;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function render(filter) {
  const f = (filter || '').trim().toLowerCase();
  const onlyPlaces = document.getElementById('only').checked;
  ledger.innerHTML = DATA.books.map((b) => {
    let chapters = onlyPlaces ? b.c.filter((c) => c.v.length > 0) : b.c;
    if (f) chapters = chapters.filter((c) => c.pl.some((p) => p.toLowerCase().includes(f)));
    const bookHit = !f || b.zh.includes(f) || b.en.toLowerCase().includes(f);
    if (f && !bookHit && chapters.length === 0) return '';
    const base = onlyPlaces ? b.c.filter((c) => c.v.length > 0) : b.c;
    const shown = (f && bookHit && chapters.length === 0) ? base : chapters;
    if (shown.length === 0 && !bookHit) return '';
    const done = b.c.filter((c) => checked.has(key(b.n, c.n))).length;
    const pct = b.tc ? (b.cc / b.tc * 100).toFixed(0) : 0;
    return \`<details class="book" data-b="\${b.n}" data-complete="\${done === b.c.length ? 1 : 0}"\${f ? ' open' : ''}>
      <summary>
        <span class="bnum">\${String(b.n).padStart(2, '0')}</span>
        <span class="bname">\${esc(b.zh)}<em>\${esc(b.en)}</em></span>
        <span class="bcov" title="\${b.cc} / \${b.tc} 章含地名"><i style="width:\${pct}%"></i></span>
        <span class="bstat">\${b.cc}/\${b.tc} 章 · \${b.e} 节 · \${b.p} 地</span>
        <span class="bdone">\${done}/\${b.c.length}</span>
      </summary>
      <div class="chapters">\${shown.map((c) => {
        const empty = c.v.length === 0;
        return \`
        <div class="ch\${empty ? ' empty-ch' : ''}" data-b="\${b.n}" data-c="\${c.n}">
          <input type="checkbox" \${checked.has(key(b.n, c.n)) ? 'checked' : ''} aria-label="第 \${c.n} 章已审">
          <span class="cnum">\${c.n} 章</span>
          <div class="cbody">
            <div class="cplaces">\${empty
              ? '<span class="none">无地名</span>'
              : \`<b>\${c.pl.map(esc).join(' · ')}</b><span class="ccount">\${c.v.length} 节</span><button class="vtoggle" type="button">经节</button>\`}</div>
            \${empty ? '' : \`<div class="verses">\${c.v.map((v) => \`\${c.n}:\${v[0]} <i>\${v[1].map(esc).join('、')}</i>\`).join('　')}</div>\`}
          </div>
        </div>\`; }).join('')}</div>
    </details>\`;
  }).join('');
  updateProgress();
}

function updateProgress() {
  const n = checked.size;
  ptext.textContent = n + ' / ' + TOTAL_CH + ' 章已审';
  bar.style.width = (n / TOTAL_CH * 100).toFixed(1) + '%';
}

ledger.addEventListener('change', (e) => {
  const box = e.target;
  if (box.type !== 'checkbox') return;
  const row = box.closest('.ch');
  const k = key(+row.dataset.b, +row.dataset.c);
  box.checked ? checked.add(k) : checked.delete(k);
  const details = box.closest('.book');
  const b = DATA.books.find((x) => x.n === +details.dataset.b);
  const done = b.c.filter((c) => checked.has(key(b.n, c.n))).length;
  details.querySelector('.bdone').textContent = done + '/' + b.c.length;
  details.dataset.complete = done === b.c.length ? 1 : 0;
  updateProgress();
  save();
});

ledger.addEventListener('click', (e) => {
  if (!e.target.classList.contains('vtoggle')) return;
  const row = e.target.closest('.ch');
  row.dataset.open = row.dataset.open === '1' ? '0' : '1';
});

let saveTimer;
function save() {
  // Ticks arrive in bursts while reviewing; one write per settled burst.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const value = [...checked];
    try { localStorage.setItem('ledger.reviewed', JSON.stringify(value)); } catch {}
    if (store) {
      try {
        await store.doc('review/chapters').set({ reviewed: value, at: Date.now() });
        synced.textContent = '进度已保存（跨设备）· ' + new Date().toLocaleTimeString();
      } catch { synced.textContent = '进度仅保存在本机'; }
    }
  }, 400);
}

// Local state first so the page is usable immediately, then upgrade to the
// shared store if this viewer can run it. Absence is normal, not an error.
try {
  const local = JSON.parse(localStorage.getItem('ledger.reviewed') || '[]');
  if (Array.isArray(local)) checked = new Set(local);
} catch {}

render('');

document.getElementById('q').addEventListener('input', (e) => render(e.target.value));
document.getElementById('only').addEventListener('change', () => render(document.getElementById('q').value));

(async () => {
  const db = window.claude && (await window.claude.use('db'));
  if (!db) { synced.textContent = '进度保存在本机浏览器'; return; }
  store = db;
  try {
    const doc = await db.doc('review/chapters').get();
    const remote = doc && doc.reviewed;
    if (Array.isArray(remote) && remote.length >= checked.size) {
      checked = new Set(remote);
      render(document.getElementById('q').value);
    }
    synced.textContent = '进度跨设备同步';
  } catch { synced.textContent = '进度仅保存在本机'; }
})();
</script>`;

writeFileSync('scripts/inventory-page.html', html);
console.log(`inventory-page.html  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);

// Standalone demo + verification harness for the reader module. Not part of any release surface.
//   reader-demo.html?view=chapter   a chapter reader that owns #ref=…
//   reader-demo.html?view=passage&b=1&from=15:1&to=15:21&limit=12   the verses under a picture
// Test hooks: ?rtl=1 mirrors the chrome with an Arabic string fixture; ?origin=… sets the link origin.
import { mountPassage, mountReader, resetSharedSession, sessionFor } from './index.ts';
import type { ReaderHandle } from './index.ts';
import { UI_LANGS } from './types.ts';
import type { UiLang } from './types.ts';

const q = new URLSearchParams(location.search);
const view = q.get('view') === 'passage' ? 'passage' : 'chapter';
const app = document.getElementById('app')!;
const sel = document.getElementById('lang') as HTMLSelectElement;
const info = document.getElementById('info')!;

// A right-to-left fixture: the reader's chrome must mirror without a rewrite when such a language ships.
const AR = { prevChapter: 'الفصل السابق', nextChapter: 'الفصل التالي', pickChapter: 'اختيار السفر والإصحاح', modeVerse: 'آيات', modeParagraph: 'فقرات', modeParallel: 'متوازي', copy: 'نسخ', display: 'عرض', edition: 'ترجمة', layout: 'طريقة القراءة', done: 'تم' };
const rtl = q.get('rtl') === '1';
resetSharedSession();
const opts = {
  route: view === 'chapter' ? ('hash' as const) : ('none' as const),
  origin: q.get('origin') ?? undefined,
  persistData: q.get('persist') === '0' ? false : undefined,
  ...(rtl ? { dir: 'rtl' as const, strings: AR } : {}),
};
const session = sessionFor(opts);
if (q.get('lang')) session.setLocale(q.get('lang') as UiLang);
sel.value = session.ui;
document.documentElement.lang = session.ui;
document.documentElement.dir = session.dir;

let handle: ReaderHandle;
(async () => {
  if (view === 'chapter') {
    handle = await mountReader(app, opts);
  } else {
    app.innerHTML = '<div class="demo-pic"><div class="plate" role="img" aria-label="plate"></div><div id="passage"></div></div>';
    const [fc, fv] = (q.get('from') ?? '15:1').split(':').map(Number);
    const [tc, tv] = (q.get('to') ?? '15:21').split(':').map(Number);
    handle = await mountPassage(document.getElementById('passage')!, { ...opts, onOpenChapter: (r) => { info.textContent = `open chapter ${r.book}:${r.chapter}`; } }, {
      book: Number(q.get('b') ?? 1), from: { chapter: fc!, verse: fv! }, to: { chapter: tc!, verse: tv! }, limit: Number(q.get('limit') ?? 12),
    });
  }
  (window as unknown as Record<string, unknown>).__reader = handle;
  document.documentElement.dataset.ready = '1';
})();

sel.addEventListener('change', async () => {
  const l = sel.value as UiLang;
  if (!UI_LANGS.includes(l)) return;
  session.setLocale(l, true);
  document.documentElement.lang = l;
  document.documentElement.dir = session.dir;
  await handle.refresh();
});

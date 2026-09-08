// One locale for the whole site, remembered between visits.
//
// English is the default. The Chinese is the thing no other Bible atlas has,
// but a visitor who cannot read it will not discover the switch — so the site
// opens in the language almost anyone can read and says, in the switch itself,
// that the other one is there.

export type Locale = 'en' | 'zh';

const KEY = 'ydh.locale';

function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* private mode, blocked storage — fall through */ }
  return 'en';
}

let current: Locale = initial();
const listeners = new Set<(l: Locale) => void>();

export const locale = () => current;

export function setLocale(l: Locale) {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* nothing to do */ }
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  for (const fn of listeners) fn(l);
}

export const onLocale = (fn: (l: Locale) => void) => { listeners.add(fn); };

export const t = <T>(en: T, zh: T): T => (current === 'zh' ? zh : en);

/** Wires a button that flips the language and labels itself with the other
 *  one — a switch reading 中文 offers Chinese, which is the only label a
 *  reader who cannot yet read the page will understand. */
export function bindSwitch(btn: HTMLElement) {
  const label = () => { btn.textContent = current === 'zh' ? 'EN' : '中文'; };
  label();
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
  btn.addEventListener('click', () => setLocale(current === 'zh' ? 'en' : 'zh'));
  onLocale(label);
}

/** Applies [data-en]/[data-zh] pairs anywhere in the document. */
export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => {
    const en = el.dataset.en ?? '';
    const zh = el.dataset.zh ?? en;
    el.textContent = current === 'zh' ? zh : en;
  });
}

// The language control: one globe button that opens a menu of four readings, each written in its own language.
//
// It replaced four 24×26 px buttons (EN | 简 | 繁 | РУ) wedged into the right-hand end of the bar — the smallest
// targets on the site and, in a four-language product, the ones a new visitor reaches for first (P1-1). A menu
// costs one tap more and gives back: a 44 px target, the languages spelled the way a reader of each would
// recognise them rather than as one glyph, and room in the bar at every width.
//
// Accessibility is the whole point of the control, so it is not optional here:
//   · the button carries aria-haspopup="menu", aria-expanded, and an aria-label in the CURRENT language;
//   · the popover is role="menu" and each row role="menuitemradio" with aria-checked, so the four readings are
//     announced as one choice of four and not as four unrelated buttons;
//   · Enter / Space / ArrowDown / ArrowUp open it (ArrowUp from the end), arrows and Home/End move inside it,
//     Escape and Tab close it and focus returns to the button;
//   · the chosen language applies at once — no reload — and <html lang>, the document title, the chrome, the
//     captions and the Bible text all follow (src/locale.ts).
import { applyStatic, fullLocale, onLocale, setLocale, t, type Locale } from '../locale.ts';

/** Each reading named in itself. A reader looking for 繁體 must not have to recognise the word in English. */
export const LANG_NAMES: { id: Locale; name: string; tag: string }[] = [
  { id: 'en', name: 'English', tag: 'en' },
  { id: 'zh-Hans', name: '简体中文', tag: 'zh-Hans' },
  { id: 'zh-Hant', name: '繁體中文', tag: 'zh-Hant' },
  { id: 'ru', name: 'Русский', tag: 'ru' },
];

const label = () => t('Language', '语言', 'Язык');

export function mountLangMenu(root: HTMLElement | null) {
  if (!root) return;
  const btn = root.querySelector<HTMLButtonElement>('.lang-btn');
  const pop = root.querySelector<HTMLElement>('.lang-pop');
  if (!btn || !pop) return;

  const items = () => Array.from(pop.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));

  const mark = () => {
    const cur = fullLocale();
    for (const el of items()) el.setAttribute('aria-checked', String(el.dataset.locale === cur));
    // The button says which language is open, in that language, so a screen-reader user is not told only "Language".
    const name = LANG_NAMES.find((l) => l.id === cur)?.name ?? 'English';
    btn.setAttribute('aria-label', `${label()}: ${name}`);
    btn.title = `${label()}: ${name}`;
  };

  let openNow = false;
  const close = (refocus = true) => {
    if (!openNow) return;
    openNow = false;
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus({ preventScroll: true });
  };
  const open = (focus: 'first' | 'last' | 'current' = 'current') => {
    openNow = true;
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const list = items();
    const at = focus === 'last' ? list[list.length - 1]
      : focus === 'first' ? list[0]
        : list.find((el) => el.getAttribute('aria-checked') === 'true') ?? list[0];
    at?.focus({ preventScroll: true });
  };

  btn.addEventListener('click', () => (openNow ? close() : open()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); open('first'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open('last'); }
  });

  pop.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-locale]');
    if (!el) return;
    close();
    void setLocale(el.dataset.locale as Locale);
  });

  pop.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { close(false); return; }   // Tab leaves the menu; the page behind it is not inert
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
  });

  // one press anywhere else puts it away
  document.addEventListener('pointerdown', (e) => {
    if (openNow && !root.contains(e.target as Node)) close(false);
  }, true);

  mark();
  onLocale(() => { mark(); applyStatic(root); });
}

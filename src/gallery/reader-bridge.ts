// The one seam between the gallery pages and the reader module (src/reader): the shared Session, and the few things a
// host has to do for it. Loaded only by pages that mount a reader view or open one of its sheets; the home page imports
// it on demand so the reader's data tables are not part of the home page's first view.
//
//   shared state   language, edition(s), layout, text size, theme: ONE Session for the picture page, the Bible page and
//                  the home page's sheets. Its record in localStorage ('yr.prefs.v1') is what editions.ts reads cheaply.
//   language       the site's language switch (locale.ts) owns the language; the Session follows it, and every mounted
//                  view re-renders on its own.
//   theme          the reader's theme (auto, dark, light, paper) is mirrored to html[data-read] for the pages' own chrome.
import { fullLocale, onLocale } from '../locale.ts';
import { sessionFor, type Session, type UiLang } from '../reader/index.ts';
import { setReadTheme } from './chrome.ts';

export const ORIGIN = 'https://world.yahwehword.com';
let session: Session | null = null;

export function readerSession(): Session {
  if (session) return session;
  const s = (session = sessionFor({ locale: fullLocale() as UiLang, origin: ORIGIN }));
  // the site's language switch is the only thing that changes the language
  s.setLocale(fullLocale() as UiLang);
  onLocale(() => s.setLocale(fullLocale() as UiLang));
  s.onChange((k) => {
    if (k === 'theme') setReadTheme(s.prefs.theme, false);
    if (k === 'edition' || k === 'parallel' || k === 'mode') document.dispatchEvent(new CustomEvent('gx:edition'));
  });
  setReadTheme(s.prefs.theme, false);
  return s;
}

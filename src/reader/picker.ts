// The edition sheet on its own: for a host page that has no mounted reader view (the gallery's home page).
// It is the same sheet the chapter reader and the passage open (chrome.ts), driven by the same Session, so
// choosing an edition, building a 对照 set and the licence tags behave identically everywhere.
import { applyChrome, editionSheetHtml, mountToast, parallelSheetHtml, Sheet } from './chrome.ts';
import { moveEdition, toggleEdition } from './parallel.ts';
import type { Session } from './session.ts';

/** Opens the edition sheet over the page. Returns a function that closes it. */
export function openEditionPicker(s: Session, opener?: HTMLElement | null): () => void {
  const host = document.createElement('div');
  host.className = 'yr yr-picker';
  host.style.cssText = 'position:static;background:none';
  applyChrome(host, s);
  document.body.append(host);
  const toast = mountToast(host);
  const sheet = new Sheet(host, s, s.tr('edition'));
  let kind: 'edition' | 'parallel' = 'edition';
  const render = () => (kind === 'parallel' ? parallelSheetHtml(s) : editionSheetHtml(s));
  const act = (el: HTMLElement) => {
    const id = el.dataset.id ?? '';
    switch (el.dataset.act) {
      case 'close': sheet.close(); break;
      case 'edition': s.setEdition(id); sheet.close(); toast(s.tr('editionSwitched', { name: s.main().menu })); break;
      case 'compare': s.setMode('parallel'); kind = 'parallel'; open(); break;
      case 'toggle': {
        if (el.getAttribute('aria-disabled') === 'true') { toast(s.tr('maxThree'), 'warn'); break; }
        const next = toggleEdition(s.set().map((e) => e.id), id);
        s.setParallel(next);
        s.setMode(next.length < 2 ? 'verse' : 'parallel');
        break;
      }
      case 'up': case 'down': s.setParallel(moveEdition(s.set().map((e) => e.id), id, el.dataset.act === 'up' ? -1 : 1)); break;
    }
  };
  const open = () => sheet.open(kind === 'parallel' ? s.tr('compareEditions') : s.tr('chooseEdition'), render, act);
  const off = s.onChange(() => { applyChrome(host, s); if (sheet.isOpen) { sheet.dialog.lang = s.ui; sheet.refresh(); } });
  sheet.dialog.addEventListener('close', () => {
    off();
    opener?.focus?.({ preventScroll: true });
    setTimeout(() => host.remove(), 2600); // after a toast has had its moment
  });
  open();
  return () => sheet.close();
}

// A sheet: a modal <dialog> that is a bottom sheet on a phone and a popover under the bar on wider screens
// (chrome.css). The browser gives it the focus trap, Escape and the inert page behind it; this adds the close
// button, a tap on the backdrop, and putting focus back where it came from.
import { t } from '../locale.ts';

export interface SheetOptions {
  title: string;
  /** fills the body; may be async (a body that is still loading shows its own skeleton) */
  render: (body: HTMLElement, close: () => void) => void;
  className?: string;
  /** which element to hand focus back to; defaults to whatever had it */
  returnFocus?: HTMLElement | null;
  onClose?: () => void;
}

export function openSheet(o: SheetOptions): HTMLDialogElement {
  const back = o.returnFocus ?? (document.activeElement as HTMLElement | null);
  const d = document.createElement('dialog');
  d.className = `gx-sheet ${o.className ?? ''}`.trim();
  d.setAttribute('aria-label', o.title);
  d.innerHTML = `<div class="gx-grab"></div>
    <div class="gx-sheet-head"><h2></h2><button type="button" class="gx-iconbtn" data-close aria-label=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="gx-sheet-body"></div>`;
  d.querySelector('h2')!.textContent = o.title;
  d.querySelector('[data-close]')!.setAttribute('aria-label', t('Close', '关闭', 'Закрыть'));
  const close = () => d.close();
  d.addEventListener('click', (e) => {
    // a tap on the dimmed area outside the sheet (the dialog's own box is the sheet)
    const r = d.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside || (e.target as HTMLElement).closest('[data-close]')) close();
  });
  d.addEventListener('close', () => {
    // let the exit transition play, then remove
    setTimeout(() => d.remove(), 260);
    o.onClose?.();
    back?.focus?.({ preventScroll: true });
  });
  document.body.append(d);
  o.render(d.querySelector('.gx-sheet-body') as HTMLElement, close);
  d.showModal();
  return d;
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;
/** A quiet confirmation. Announced politely to screen readers; never a blocking dialog. */
export function toast(text: string) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'gx-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  // restart the transition when a second toast follows quickly
  toastEl.classList.remove('on');
  void toastEl.offsetWidth;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('on'), 2200);
}

// The Bible page: the reader module's chapter view, on the same Session as the passages under the pictures.
// /bible.html#ref=Genesis 15:1-5 (and &ed=, &par=, &m=, &lang=) is the reader's own address; a picture's "whole chapter"
// link lands here with the picture's verses marked. The old address /bible.html?book=1&ch=15 still works.
import './reader-page.css';
import { applyStatic, bindSwitch } from '../locale.ts';
import { loadingStep, loadingSteps, pageReady } from '../site-shell.ts';
import { BOOKS, mountReader } from '../reader/index.ts';
import { formatHash } from '../reader/route.ts';
import { readerSession } from './reader-bridge.ts';

loadingSteps(1);
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
applyStatic();

// An address from before the reader module: ?book=<1..66>&ch=<n> becomes #ref=
{
  const q = new URLSearchParams(location.search);
  const b = Number(q.get('book')), c = Number(q.get('ch'));
  if (q.has('book') && b >= 1 && b <= 66 && !/(?:^|[#&])ref=/.test(location.hash)) {
    history.replaceState(null, '', `/bible.html${formatHash({ ref: { book: b, chapter: c >= 1 && c <= BOOKS[b - 1]!.chapters ? c : 1 } })}`);
  }
}

// The chapter bar sticks under the site's own bar, whatever height it has on this screen.
const nav = document.querySelector<HTMLElement>('.sitenav');
const host = document.getElementById('reader')!;
const stick = () => host.style.setProperty('--yr-sticky-top', `${nav?.offsetHeight ?? 0}px`);
stick();
if (nav && 'ResizeObserver' in window) new ResizeObserver(stick).observe(nav);

void mountReader(host, { session: readerSession(), route: 'hash' }).finally(() => { loadingStep(); pageReady(); });

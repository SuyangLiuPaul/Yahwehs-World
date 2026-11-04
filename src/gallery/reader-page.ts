// The Bible page: the reader module's chapter view, on the same Session as the passages under the pictures.
// /bible.html#ref=Genesis 15:1-5 (and &ed=, &par=, &m=, &lang=) is the reader's own address; a picture's "whole chapter"
// link lands here with the picture's verses marked. The old address /bible.html?book=1&ch=15 still works.
import './reader-page.css';
import { applyStatic, bindSwitch } from '../locale.ts';
import { loadingStep, loadingSteps, pageReady } from '../site-shell.ts';
import { BOOKS, mountReader } from '../reader/index.ts';
import { formatHash } from '../reader/route.ts';
import { readerSession } from './reader-bridge.ts';
import { platesFor, readyPlates } from './plates.ts';

loadingSteps(1);
bindSwitch(null); // the globe menu is wired by src/gallery/chrome.ts; this is here for <html lang>
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

// The chapter and its pictures are one view. The gallery index is a separate (small) file, so the chapter is not
// held up by it: the reader mounts at once with whatever platesFor can answer, and re-renders once the index is in.
// The chapter and its pictures are one view, but they are two files. The page is ready as soon as the TEXT is on
// screen; the gallery index is fetched alongside and the plates appear in place when it lands (refresh keeps the
// reader's scroll anchor, so the words the reader is looking at do not move).
const plates = readyPlates(); // starts now, in parallel with the chapter's own text
// The opening screen lifts on the FIRST PAINT of the chapter (onNavigate fires inside the reader's show(), straight
// after it has written the verses), not when mountReader's promise settles. The scrim was still fully opaque over a
// completely rendered, legible chapter four seconds in (P1-4): it made the fastest page on the site feel like the
// slowest and dimmed text the reader could already read. .finally() stays, because a chapter that FAILS to load
// never reaches onNavigate and its error state must not sit behind the scrim either. pageReady() is idempotent.
const standing = () => { loadingStep(); pageReady(); };
void mountReader(host, { session: readerSession(), route: 'hash', platesFor, onNavigate: standing })
  .finally(standing)
  .then(async (r) => { if (await plates) await r.refresh(); });

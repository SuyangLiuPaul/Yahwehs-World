// Public API of the reader module. Integrators import from here only.
//
//   import { mountReader, mountPassage } from './reader/index.ts';
//   const r = await mountReader(el, { route: 'hash' });                         // /bible.html: a chapter, owns #ref=…
//   const p = await mountPassage(el, { onOpenChapter }, { book: 1, from: { chapter: 15, verse: 1 }, to: { chapter: 15, verse: 21 } });
//   p.goto(nextSpec);            // the next picture
//   p.session.setLocale('ru');   // the host's language switch (every mounted view re-renders on its own)
//   openEditionPicker(session, button);   // the edition sheet for a page with no mounted view (the gallery's home)
//
// Pass one `session` to several views to share edition, layout, language, size and theme (the default does).
import './reader.css';
import { ReaderView } from './view.ts';
import type { PassageSpec, ReaderHandle } from './view.ts';
import type { ReaderOptions } from './session.ts';
import type { Ref } from './types.ts';

export type { PassageSpec, ReaderHandle, ReaderOptions };
export { openEditionPicker } from './picker.ts';
export { Session, sessionFor, resetSharedSession } from './session.ts';
export { BOOKS, EDITIONS, parseReference, referenceLabel, resolveBook, matchUiTag, resolveUi } from './books.ts';
export { COPY_VERSE_CAP, buildCopy, copyText } from './copy.ts';
export { parseHash, formatHash } from './route.ts';
export { UI_LANGS, UI_LANG_INFO } from './types.ts';
export { placePlates, plateVerses } from './plates.ts';
export type { ScenePlate, PlateAnchors } from './plates.ts';
export type { Ref, UiLang, Mode, EditionInfo } from './types.ts';

/** A chapter reader (Bible page). Resolves when the first chapter is on screen or its error state is. */
export async function mountReader(el: HTMLElement, opts: ReaderOptions = {}, start: Ref = { book: 1, chapter: 1 }): Promise<ReaderHandle> {
  const v = new ReaderView(el, 'chapter', opts, start);
  await v.start();
  return v;
}

/** The verses of one passage (a picture's `s–e`), with the edition chip, 对照, copy and "read the whole chapter". */
export async function mountPassage(el: HTMLElement, opts: ReaderOptions, spec: PassageSpec): Promise<ReaderHandle> {
  const v = new ReaderView(el, 'passage', { ...opts, route: 'none' }, spec);
  await v.start();
  return v;
}

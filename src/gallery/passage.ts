// The passage under a picture: the verses an event covers, in the reader module (src/reader).
//
// This file is the whole seam between the picture page and Bible text. It used to carry its own PassageProvider
// (split text files, one hand-written edition table, its own copy format). Now the reader module does all of it,
// from the same data and the same Session as the Bible page:
//
//   editions   bsb-yhwh, kjv, web-yhwh, asv-yhwh, cuvs-yhwh, cuvs-yhwh-tr, rst-yhwh, rst: one sheet, grouped by language
//   对照       vertical parallel (up to three editions, the reader's 对照 control), verse by verse
//   headings   小标题 in the heading set of the edition (cuv, cuv-tr, english-classic, ru), from Words' data
//   copy       the verses with their citation, the edition's credit line, and a link to this picture (/p/<id>)
//   chapter    "Read the whole chapter" opens /bible.html at that chapter with the picture's verses marked
//
// The reader module is loaded here, on the first picture, and not with the page: the gallery grid does not need it.
import type { PassageSpec, ReaderHandle, Ref } from '../reader/index.ts';
import { chapterOf, verseOf, type Scene } from './data.ts';

type Reader = typeof import('../reader/index.ts');

/** The verses of a scene as the reader module wants them. */
export function specOf(sc: Pick<Scene, 'b' | 's' | 'e'>): PassageSpec {
  return { book: sc.b, from: { chapter: chapterOf(sc.s), verse: verseOf(sc.s) }, to: { chapter: chapterOf(sc.e), verse: verseOf(sc.e) }, limit: 12 };
}

/** Where "whole chapter" goes: the Bible page at the chapter the picture starts in, with the picture's own verses
 *  marked when it sits inside one chapter and does not simply cover all of it. English book names in the hash. */
export function chapterRef(sc: Pick<Scene, 'b' | 's' | 'e'>, verses: number | null): Ref {
  const c = chapterOf(sc.s);
  if (chapterOf(sc.e) !== c) return { book: sc.b, chapter: c };
  const v1 = verseOf(sc.s), v2 = verseOf(sc.e);
  if (v1 <= 1 && verses != null && v2 >= verses) return { book: sc.b, chapter: c };
  return { book: sc.b, chapter: c, v1, v2 };
}

export interface ScenePassage {
  /** Shows this scene's verses (mounts the first time). Resolves when they are on screen or their error state is. */
  show(sc: Scene): Promise<void>;
  handle(): ReaderHandle | null;
}

export function mountScenePassage(host: HTMLElement): ScenePassage {
  let now: Scene | null = null;
  let h: ReaderHandle | null = null;
  let mounting: Promise<void> | null = null;
  return {
    handle: () => h,
    async show(sc) {
      now = sc;
      if (mounting) await mounting;
      if (h) { await h.goto(specOf(sc)); return; }
      mounting = (async () => {
        const [reader, bridge] = await Promise.all([import('../reader/index.ts') as Promise<Reader>, import('./reader-bridge.ts')]);
        h = await reader.mountPassage(host, {
          session: bridge.readerSession(),
          route: 'none',
          origin: bridge.ORIGIN,
          // a selection copied from a picture links back to the picture (it unfurls with its own title and plate)
          linkFor: () => `${bridge.ORIGIN}/p/${now?.id ?? ''}`,
          onOpenChapter: () => {
            if (!now) return;
            const vc = reader.BOOKS[now.b - 1]?.vc[chapterOf(now.s) - 1] ?? null;
            location.href = `/bible.html${reader.formatHash({ ref: chapterRef(now, vc) })}`;
          },
        }, specOf(sc));
      })();
      try { await mounting; } finally { mounting = null; }
      // the scene may have moved on while the first mount was loading
      if (now && now !== sc) await h!.goto(specOf(now));
    },
  };
}

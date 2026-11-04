import type { GalleryIndex, Scene, Summaries } from './data.ts';

type Row = { scene: Scene; title: string; book: string; body: string };

/** Build once per data/script revision, preserving the original fields and weights. */
export function buildSearchIndex(ix: GalleryIndex, sums: Summaries | null,
  bookTitle: (b: number, lang: 'zh' | 'en' | 'ru') => string, hant: (s: string) => string): Row[] {
  const books = new Map<number, string>();
  return ix.scenes.map((sc) => {
    if (!books.has(sc.b)) books.set(sc.b, `${bookTitle(sc.b, 'zh')} ${bookTitle(sc.b, 'en')} ${bookTitle(sc.b, 'ru')}`.toLowerCase());
    return {
      scene: sc,
      title: `${sc.zh} ${hant(sc.zh)} ${sc.en} ${sc.ru}`.toLowerCase(),
      book: books.get(sc.b)!,
      body: sums ? `${sums.zh[sc.i] ?? ''} ${hant(sums.zh[sc.i] ?? '')} ${sums.en[sc.i] ?? ''} ${sums.ru?.[sc.i] ?? ''}`.toLowerCase() : '',
    };
  });
}

export function searchIndex(index: Row[], q: string, max = 12): Scene[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored: [number, Scene][] = [];
  for (const { scene, title, book, body } of index) {
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      else if (book.includes(term)) score += 4;
      else if (body.includes(term)) score += 2;
      else { score = 0; break; }
    }
    if (score) scored.push([score, scene]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].i - b[1].i);
  return scored.slice(0, max).map((x) => x[1]);
}

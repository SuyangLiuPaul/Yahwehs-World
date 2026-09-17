// The canonical key in the data is bbbcccvvv, so book number is key / 1e6.
// Numbering is the 66-book Protestant order (2 Kings = 12, matching the
// dataset's own `sort` values). Chinese names follow 和合本.

import { hant } from './locale.ts';
export const BOOKS: { en: string; zh: string }[] = [
  { en: 'Genesis', zh: '创世记' }, { en: 'Exodus', zh: '出埃及记' },
  { en: 'Leviticus', zh: '利未记' }, { en: 'Numbers', zh: '民数记' },
  { en: 'Deuteronomy', zh: '申命记' }, { en: 'Joshua', zh: '约书亚记' },
  { en: 'Judges', zh: '士师记' }, { en: 'Ruth', zh: '路得记' },
  { en: '1 Samuel', zh: '撒母耳记上' }, { en: '2 Samuel', zh: '撒母耳记下' },
  { en: '1 Kings', zh: '列王纪上' }, { en: '2 Kings', zh: '列王纪下' },
  { en: '1 Chronicles', zh: '历代志上' }, { en: '2 Chronicles', zh: '历代志下' },
  { en: 'Ezra', zh: '以斯拉记' }, { en: 'Nehemiah', zh: '尼希米记' },
  { en: 'Esther', zh: '以斯帖记' }, { en: 'Job', zh: '约伯记' },
  { en: 'Psalms', zh: '诗篇' }, { en: 'Proverbs', zh: '箴言' },
  { en: 'Ecclesiastes', zh: '传道书' }, { en: 'Song of Songs', zh: '雅歌' },
  { en: 'Isaiah', zh: '以赛亚书' }, { en: 'Jeremiah', zh: '耶利米书' },
  { en: 'Lamentations', zh: '耶利米哀歌' }, { en: 'Ezekiel', zh: '以西结书' },
  { en: 'Daniel', zh: '但以理书' }, { en: 'Hosea', zh: '何西阿书' },
  { en: 'Joel', zh: '约珥书' }, { en: 'Amos', zh: '阿摩司书' },
  { en: 'Obadiah', zh: '俄巴底亚书' }, { en: 'Jonah', zh: '约拿书' },
  { en: 'Micah', zh: '弥迦书' }, { en: 'Nahum', zh: '那鸿书' },
  { en: 'Habakkuk', zh: '哈巴谷书' }, { en: 'Zephaniah', zh: '西番雅书' },
  { en: 'Haggai', zh: '哈该书' }, { en: 'Zechariah', zh: '撒迦利亚书' },
  { en: 'Malachi', zh: '玛拉基书' }, { en: 'Matthew', zh: '马太福音' },
  { en: 'Mark', zh: '马可福音' }, { en: 'Luke', zh: '路加福音' },
  { en: 'John', zh: '约翰福音' }, { en: 'Acts', zh: '使徒行传' },
  { en: 'Romans', zh: '罗马书' }, { en: '1 Corinthians', zh: '哥林多前书' },
  { en: '2 Corinthians', zh: '哥林多后书' }, { en: 'Galatians', zh: '加拉太书' },
  { en: 'Ephesians', zh: '以弗所书' }, { en: 'Philippians', zh: '腓立比书' },
  { en: 'Colossians', zh: '歌罗西书' }, { en: '1 Thessalonians', zh: '帖撒罗尼迦前书' },
  { en: '2 Thessalonians', zh: '帖撒罗尼迦后书' }, { en: '1 Timothy', zh: '提摩太前书' },
  { en: '2 Timothy', zh: '提摩太后书' }, { en: 'Titus', zh: '提多书' },
  { en: 'Philemon', zh: '腓利门书' }, { en: 'Hebrews', zh: '希伯来书' },
  { en: 'James', zh: '雅各书' }, { en: '1 Peter', zh: '彼得前书' },
  { en: '2 Peter', zh: '彼得后书' }, { en: '1 John', zh: '约翰壹书' },
  { en: '2 John', zh: '约翰贰书' }, { en: '3 John', zh: '约翰叁书' },
  { en: 'Jude', zh: '犹大书' }, { en: 'Revelation', zh: '启示录' },
];

export const bookOf = (sortKey: number) => Math.floor(sortKey / 1_000_000);
export const bookName = (n: number, locale: 'en' | 'zh') => {
  const name = BOOKS[n - 1]?.[locale] ?? '';
  return locale === 'zh' ? hant(name) : name;
};
/** Canonical key just past the end of book `n` — the timeline steps in books. */
export const endOfBook = (n: number) => n * 1_000_000 + 999_999;

// ── references ────────────────────────────────────────────────────────────
// The two reference strings the data carries were written in opposite
// languages: journeys.json gives `range` in Chinese ("使徒行传 13:1 – 14:28")
// and every marker's `ref` in English ("Acts 13:1"). Whichever locale the
// reader picked, one of them used to come out in the other language. Rather
// than duplicate every string in the data, translate the book name on the way
// to the screen — it is the only part of a reference that is language at all;
// chapter, verse and dash are the same in both.
//
// Names are matched longest-first so that 撒母耳记上 wins over 撒母耳记 and
// "1 Corinthians" is never read as a stray "Corinthians". Every name in the
// string is replaced, because two ranges span two books ("撒母耳记上4章 –
// 撒母耳记下6章"). Anything that is not a book name is left exactly as it is,
// so a reference this table does not know passes through unharmed.
const NAME_TO_INDEX = new Map<string, number>();
for (const [i, b] of BOOKS.entries()) {
  NAME_TO_INDEX.set(b.en, i);
  NAME_TO_INDEX.set(b.zh, i);
}
const ANY_BOOK = new RegExp(
  [...NAME_TO_INDEX.keys()]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);

export function localiseRef(ref: string, locale: 'en' | 'zh'): string {
  let out = ref.replace(ANY_BOOK, (m) => {
    const name = BOOKS[NAME_TO_INDEX.get(m)!]![locale];
    return locale === 'zh' ? hant(name) : name;
  });
  // 「4章」 is how Chinese cites a whole chapter; English just gives the number.
  if (locale === 'en') out = out.replace(/(\d+)\s*章/g, '$1');
  return out;
}

/** "Acts 13:1" / "创世记 6:15" -> the canonical key bbbcccvvv, or null if the
 *  string does not start with a book this table knows. Used to join the parts
 *  of the app that cite verses to the 1,443 events, which carry the same keys
 *  — see src/bridges.ts. Book names are matched longest-first by ANY_BOOK, so
 *  "1 Samuel" is never read as "Samuel". */
export function refKey(ref: string): number | null {
  const at = ref.match(ANY_BOOK);
  if (!at?.length) return null;
  const name = at[0];
  const rest = ref.slice(ref.indexOf(name) + name.length);
  const cv = /^\s*(\d+)(?::(\d+))?/.exec(rest);
  if (!cv) return null;
  const book = NAME_TO_INDEX.get(name)! + 1;
  return book * 1_000_000 + Number(cv[1]) * 1000 + Number(cv[2] ?? 0);
}

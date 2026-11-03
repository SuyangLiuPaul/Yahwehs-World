// Search queries that name a place in the Bible: "创 12", "Gen 12:1", "创世记12章", "1 sam 3", "约翰福音 3:16".
// Returns the book, the chapter and (optionally) the verse; the caller finds the scene that covers it.
import { BOOKS } from '../books.ts';
import { BOOKS_RU, RU_SHORT } from './books-ru.ts';

/** Chinese short names (和合本 convention) by book, index 0 = Genesis. */
const ZH_SHORT = ['创', '出', '利', '民', '申', '书', '士', '得', '撒上', '撒下', '王上', '王下', '代上', '代下', '拉', '尼', '斯', '伯', '诗', '箴', '传', '歌', '赛', '耶', '哀', '结', '但', '何', '珥', '摩', '俄', '拿', '弥', '鸿', '哈', '番', '该', '亚', '玛',
  '太', '可', '路', '约', '徒', '罗', '林前', '林后', '加', '弗', '腓', '西', '帖前', '帖后', '提前', '提后', '多', '门', '来', '雅', '彼前', '彼后', '约一', '约二', '约三', '犹', '启'];
/** Common English abbreviations beyond the first letters of the full name. */
const EN_ABBR: Record<string, number> = {
  gn: 1, ge: 1, ex: 2, exo: 2, lv: 3, lev: 3, nm: 4, num: 4, dt: 5, deut: 5, jos: 6, josh: 6, jdg: 7, judg: 7, rt: 8,
  '1sa': 9, '1sam': 9, '2sa': 10, '2sam': 10, '1ki': 11, '1kgs': 11, '2ki': 12, '2kgs': 12, '1ch': 13, '1chr': 13, '2ch': 14, '2chr': 14,
  neh: 16, est: 17, ps: 19, psa: 19, psalm: 19, pr: 20, prov: 20, ecc: 21, eccl: 21, song: 22, sos: 22, isa: 23, jer: 24, lam: 25, eze: 26, ezek: 26,
  dan: 27, hos: 28, ob: 31, obad: 31, mic: 33, nah: 34, hab: 35, zep: 36, zeph: 36, hag: 37, zec: 38, zech: 38, mal: 39,
  mt: 40, matt: 40, mk: 41, lk: 42, jn: 43, ac: 44, rom: 45, '1co': 46, '1cor': 46, '2co': 47, '2cor': 47, gal: 48, eph: 49, php: 50, phil: 50,
  col: 51, '1th': 52, '1thess': 52, '2th': 53, '2thess': 53, '1ti': 54, '1tim': 54, '2ti': 55, '2tim': 55, tit: 56, phm: 57, philem: 57, heb: 58, jas: 59,
  '1pe': 60, '1pet': 60, '2pe': 61, '2pet': 61, '1jn': 62, '1john': 62, '2jn': 63, '3jn': 64, rev: 66,
};

export interface RefQuery { b: number; ch: number; v: number | null }

const norm = (s: string) => s.toLowerCase().replace(/[.\s]+/g, '');

/** Parses a reference query, or returns null when the text is not one. A bare book name ("创世记") is a reference
 *  to chapter 1: the caller shows the book's first scenes. */
export function parseRef(raw: string): RefQuery | null {
  const q = raw.trim();
  if (!q) return null;
  // chapter and verse: "12", "12:1", "12章", "12章3节", "12.3"
  const m = /^(.*?)(\d+)\s*(?:[:：.]\s*(\d+))?\s*[章篇]?\s*(?:(\d+)\s*节)?\s*$/.exec(q);
  const namePart = (m ? m[1] ?? "" : q).trim();
  const ch = m ? Number(m[2]) : 1;
  const verse = m ? Number(m[3] ?? m[4] ?? 0) || null : null;
  if (!namePart) return null;
  // a number that belongs to the book's name ("1 Sam 3"): the regex above ate the "3", the "1" is in namePart
  const key = norm(namePart);
  let b = 0;
  // Russian: short form, then full name, then prefix ("от иоанна" and "иоанна" both mean John)
  if (/[а-яё]/i.test(key)) {
    const ru = key.replace(/^от/, '');
    const i = RU_SHORT.indexOf(ru);
    if (i >= 0) return { b: i + 1, ch: Math.max(1, ch), v: verse };
    const full = BOOKS_RU.findIndex((x) => norm(x).replace(/^от/, '') === ru);
    if (full >= 0) return { b: full + 1, ch: Math.max(1, ch), v: verse };
    const hit = BOOKS_RU.findIndex((x) => norm(x).replace(/^от/, '').startsWith(ru));
    return hit >= 0 ? { b: hit + 1, ch: Math.max(1, ch), v: verse } : null;
  }
  // Chinese: full name, then short name
  const zhFull = BOOKS.findIndex((x) => x.zh === namePart || x.zh === `${namePart}书`);
  if (zhFull >= 0) b = zhFull + 1;
  if (!b) { const s = ZH_SHORT.indexOf(namePart); if (s >= 0) b = s + 1; }
  // English: exact full name, abbreviation, then unique prefix
  if (!b) {
    const full = BOOKS.findIndex((x) => norm(x.en) === key);
    if (full >= 0) b = full + 1;
  }
  const abbr = EN_ABBR[key];
  if (!b && abbr) b = abbr;
  if (!b && /^[a-z0-9]{2,}$/.test(key) && /[a-z]/.test(key)) {
    const hits = BOOKS.map((x, i) => ({ n: norm(x.en), i })).filter((x) => x.n.startsWith(key));
    if (hits.length) b = hits[0]!.i + 1; // "ro" -> Romans before Ruth is a guess; the first in canon order is what a reader means
  }
  if (!b) return null;
  return { b, ch: Math.max(1, ch), v: verse };
}

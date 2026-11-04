// The church's forbidden vocabulary, in ONE place.
//
// Why this file exists: `tests/reader/wording.test.ts` already carried the full
// list (it is the union of Words' `section_title_wording_test.dart` and
// `book_intro_wording_test.dart`), but `scripts/verify-gallery.mjs` carried a
// SHORTER copy of its own — no 神性, no 道成肉身, no 本体, no 圣子/圣父, no
// 完全是神/完全是人, no 先存. So three served Chinese captions
// (`micah-7-1`, `matthew-17-1`, `mark-9-1`) said 神性 and the gate stayed green.
// Two copies of a rule is one copy too many; the gate and the test now read
// this module, so widening the rule widens both at once.
//
// Owner, 2026-10-20: 「小标题和背景都要根据讲道和圣经内容，别用位格、三位一体
// 之类的词语」 — and the rule is never, not even to deny it. God is 他, never
// 祂; the divine name is 雅伟 / 雅偉.

/** Simplified and Traditional terms that may not appear in text this product writes. */
export const ZH = [
  '位格', '本体', '本體', '三位一体', '三位一體', '三一', '子神', '圣子', '聖子',
  '圣父', '聖父', '神性', '完全是神', '完全是人', '先存',
  '神成为人', '神成為人', '道成肉身',
  // the pronoun rule: God is 他
  '祂',
];

/** English terms.
 *
 * `deity` and `divinity` are NOT here on their own: a caption about the ten
 * plagues says "each of the ten plagues confronts an Egyptian deity", which is
 * about Egypt's gods and is exactly the kind of sentence the rule is not aimed
 * at. What is forbidden is the claim, so the collocations are listed instead.
 */
export const EN = [
  'trinit', 'triune', 'godhead', 'god the son', 'second person', 'three persons',
  'divine nature', 'fully god', 'fully man',
  'deity of christ', 'deity of jesus', 'deity of the son', 'his deity',
  'divinity of christ', 'divinity of jesus', 'divinity of the son', 'his divinity',
  'pre-exist', 'preexist', 'pre-incarnate', 'incarnat', 'god became man',
  'jesus is god', 'god became',
];

/** Russian terms. */
export const RU = [
  'троиц', 'триедин', 'бог-сын', 'ипостас', 'воплощ', 'божествен',
  'предсуществ', 'богочеловек',
];

/** The substitute reading of the divine name, which text we write never uses.
 *
 * Kept apart from the lists above because it is a DIFFERENT rule with a
 * different exception: an edition's own name and its publisher's licence note
 * may say it (`ASV (Jehovah)` and its credit line in
 * `src/reader/catalogue.gen.ts`), and the Union Version's own verses are not
 * ours to edit. So the caption gate applies it and the headings/credits test
 * does not. */
export const NAMES = { zh: ['耶和华', '耶和華'], en: ['jehovah'], ru: ['иегов'] };

/** `{zh, en, ru}` → the first forbidden term a string carries, or null. */
export const hit = {
  zh: (s) => ZH.find((t) => s.includes(t)) ?? null,
  en: (s) => {
    const low = s.toLowerCase();
    return EN.find((t) => low.includes(t)) ?? null;
  },
  ru: (s) => {
    const low = s.toLowerCase();
    return RU.find((t) => low.includes(t)) ?? null;
  },
};

/// What is NOT covered here, deliberately:
///
///  * The Bible's own words. 神性 stands in Acts 17:29 and Rom 1:20 of the
///    Union Version, 本体 in Heb 1:3; the rule is about text this product
///    writes, and the licensed text is not ours to edit.
///  * `public/data/bible/meta.json` and `public/data/bible/split/book/*.json`
///    (book introductions and section-title background notes). Those are built
///    by `scripts/build-bible-book-data.mjs` from a SIBLING snapshot
///    (`../Words-reading-plan-20261015/assets`, `../SeekSparks/assets`) that
///    still carries this vocabulary — 8 × 神性, 8 × 道成肉身, 110 × 祂 and more
///    as served today, and MORE if the build is re-run against that snapshot
///    (19 / 15 / 175), while the Words and Sword release trees have cleaned
///    their own copies to zero. Refreshing the source is an owner decision,
///    because the same refresh also brings a modernised Union Version text
///    (豫备 → 预备, 希利尼 → 希腊, 该撒 → 凯撒, 巡抚 → 总督). Until then the
///    counts are pinned by `scripts/verify-bible-notes-vocabulary.mjs` (run by
///    `npm run verify:gallery`) so they cannot grow.

/** As [hit], plus the substitute divine name: the rule for captions. */
export const hitCaption = {
  zh: (s) => hit.zh(s) ?? (NAMES.zh.find((t) => s.includes(t)) ?? null),
  en: (s) => hit.en(s) ?? (NAMES.en.find((t) => s.toLowerCase().includes(t)) ?? null),
  ru: (s) => hit.ru(s) ?? (NAMES.ru.find((t) => s.toLowerCase().includes(t)) ?? null),
};

// Place names as a reader should see them.
//
// OpenBible.info distinguishes homonyms with a trailing number — "Antioch 1"
// is the Syrian city, "Antioch 2" the Pisidian one — and 312 of the 1,332
// places carry such a suffix. It is an identifier, not a name, and printed
// beside a stop ordinal it reads as a mistake: the first stop of Paul's first
// journey rendered as "1 Antioch 1".
//
// Stripping it costs a real distinction wherever two different cities share a
// bare name. Across all ten journeys exactly one such case exists — both
// Antiochs appear in Paul's first journey, 500km apart — so the ambiguity is
// resolved by naming those two rather than by inventing a general mechanism
// for a problem that occurs once.

const QUALIFIED: Record<string, { en: string; zh: string }> = {
  'Antioch 1': { en: 'Antioch in Syria', zh: '叙利亚的安提阿' },
  'Antioch 2': { en: 'Antioch in Pisidia', zh: '彼西底的安提阿' },
};

/** The name without OpenBible's homonym number. */
export function bareName(name: string): string {
  return name.replace(/\s\d+$/, '');
}

/** What to print for a place. `zh` is the Chinese name where one is known; it
 *  never carries a suffix, so in Chinese the only work is the qualifier. */
export function placeLabel(name: string, zh: string | undefined, locale: 'zh' | 'en'): string {
  const q = QUALIFIED[name];
  if (locale === 'zh') return q ? q.zh : (zh || bareName(name));
  return q ? q.en : bareName(name);
}

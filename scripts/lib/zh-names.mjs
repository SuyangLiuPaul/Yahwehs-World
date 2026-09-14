// One decision, one place: given a gazetteer entry, what Chinese name does this
// project use for it?
//
// This existed twice before, and both times a correction reached one consumer
// and not the other — the globe called Ephrath 伯特利 after the journeys had
// stopped, and the voyage to Rome still called Malta 马耳他 after the globe had
// started saying 米利大. The tables are data; the order they are applied in is
// the only logic, and it lives here.
//
// Order, most specific first:
//   1. withdrawn  — the name belongs to another place; show nothing
//   2. cuv        — the Union Version's own rendering, read out of the text
//   3. corrected  — the gazetteer is wrong and a verse says so
//   4. gazetteer  — what the shared asset says
// `names-from-text` is not here: it answers a different question (a place the
// gazetteer has no entry for at all) and only merge-chinese-names can ask it.
import { readFileSync } from 'node:fs';

export function makeZhResolver(root = '.') {
  const g = JSON.parse(readFileSync(`${root}/data/events/gazetteer-corrections.json`, 'utf8'));
  const c = JSON.parse(readFileSync(`${root}/data/places/cuv-renderings.json`, 'utf8'));

  const withdrawn = new Map((g.removals?.places ?? []).map((x) => [x.name, x]));
  const corrected = new Map(g.corrections.map((x) => [x.name, x]));
  const cuv = new Map(c.renderings.filter((r) => r.cuvZh).map((r) => [r.name, r]));

  /** `entry` is a gazetteer record: { n, s, t }. */
  return function resolve(entry) {
    if (!entry) return null;
    const w = withdrawn.get(entry.n);
    if (w && entry.s === w.wasZh) {
      return { zh: '', zhHant: '', source: 'withdrawn', why: w.evidence };
    }
    const fix = corrected.get(entry.n);
    const base = fix && entry.s === fix.wasZh ? fix.zh : entry.s ?? '';
    const baseHant = fix && entry.s === fix.wasZh ? fix.zh : entry.t ?? '';

    const r = cuv.get(entry.n);
    if (r && r.cuvZh && r.cuvZh !== base) {
      return {
        zh: r.cuvZh, zhHant: r.cuvZh, source: 'cuv',
        why: r.evidence, modern: base.includes('耶和华') ? undefined : base,
      };
    }
    if (fix && entry.s === fix.wasZh) {
      return { zh: base, zhHant: baseHant, source: 'corrected', why: fix.evidence };
    }
    return { zh: base, zhHant: baseHant, source: 'gazetteer' };
  };
}

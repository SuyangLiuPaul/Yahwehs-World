// The Bible editions the gallery release carries, and which one the reader has chosen.
//
// Owner, 2026-11-03: only the editions we hold the rights to, the same ones (same ids, same bytes) as Yahweh's
// Words and Yahweh's Sword: bsb-yhwh, kjv, web-yhwh, asv-yhwh, cuvs-yhwh, cuvs-yhwh-tr, and for the Russian reader
// rst-yhwh and rst. No church packs, no licensed editions, no beta languages.
//
// INTEGRATION POINT (the editions work in the other worktree): the catalogue below says what each edition is and
// how it is credited; it does NOT say whether this build has its text. That is decided at run time:
//   - the three editions this repo already ships (bsb-yhwh, cuvs-yhwh, cuvs-yhwh-tr) are read from
//     /data/bible/split/text/{bsb|cuvs|cuvt}/<book>.json, the files the shipped reader uses;
//   - every other id is available when /data/bible/editions.json lists it:
//       { "v": 1, "editions": [ { "id": "kjv" } ] }
//     and its text is at /data/bible/<id>/<book>.json as string[chapter][verse] (the per-book form of
//     docs "2.3"); nothing else in this file or in passage.ts has to change when the other worktree lands it.
//   - the credit lines are Words' own wording (assets/i18n/ui/*.json "aboutLicense*"), copied, not paraphrased.
import { fullLocale, t } from '../locale.ts';

/** One string per reading. Russian is machine-translated at Words and not natively reviewed there either. */
export interface Words { en: string; zh: string; ru: string }
export type Group = 'zh-Hans' | 'zh-Hant' | 'en' | 'ru';

export interface Edition {
  id: string;
  group: Group;
  name: Words;
  sub: Words;
  /** the licence chip: PD = public domain; © = the church's own edition, used with permission */
  lic: 'PD' | '©';
  credit: Words;
  /** where the shipped reader already has its text; absent = the per-book form listed in editions.json */
  legacyDir?: 'bsb' | 'cuvs' | 'cuvt';
}

const PD: Words = { en: 'Public domain.', zh: '公有领域 · 无版权限制。', ru: 'Общественное достояние.' };

export const EDITIONS: Edition[] = [
  { id: 'cuvs-yhwh', group: 'zh-Hans', lic: '©', legacyDir: 'cuvs',
    name: { en: 'CUV, Yahweh edition (Simplified)', zh: '和合本雅伟版', ru: 'CUV, издание «Яхве» (упрощённый)' },
    sub: { en: 'Chinese Union Version · the divine name as Yahweh', zh: '和合本 · 神名作雅伟', ru: 'Chinese Union Version · имя Божие — Яхве' },
    credit: { en: '© Yahweh De Hua Ministry · used with permission.', zh: '© 雅伟的话事工 · 经授权使用。', ru: '© Yahweh De Hua Ministry · используется с разрешения.' } },
  { id: 'cuvs-yhwh-tr', group: 'zh-Hant', lic: '©', legacyDir: 'cuvt',
    name: { en: 'CUV, Yahweh edition (Traditional)', zh: '和合本雅偉版', ru: 'CUV, издание «Яхве» (традиционный)' },
    sub: { en: 'Chinese Union Version · the divine name as Yahweh', zh: '和合本 · 神名作雅偉', ru: 'Chinese Union Version · имя Божие — Яхве' },
    credit: { en: '© Yahweh De Hua Ministry · used with permission.', zh: '© 雅偉的話事工 · 經授權使用。', ru: '© Yahweh De Hua Ministry · используется с разрешения.' } },
  { id: 'bsb-yhwh', group: 'en', lic: 'PD', legacyDir: 'bsb',
    name: { en: 'BSB (Yahweh)', zh: 'BSB 雅伟版', ru: 'BSB («Яхве»)' },
    sub: { en: 'Berean Standard Bible · the divine name restored', zh: 'Berean Standard Bible · 神名作雅伟', ru: 'Berean Standard Bible · имя Божие восстановлено' },
    credit: { en: "Public domain since 2023-04-30, no permission required for any use · the Yahweh edition's divine-name restoration is the work of Yahweh De Hua Ministry.",
      zh: '自 2023-04-30 起属公有领域，任何用途均无需授权 · 「雅伟」版的神名还原为雅伟的话事工的编辑成果。',
      ru: 'Общественное достояние с 2023-04-30, разрешение для любого использования не требуется · восстановление Божьего имени в издании «Yahweh» выполнено служением Yahweh De Hua Ministry.' } },
  { id: 'kjv', group: 'en', lic: 'PD',
    name: { en: 'KJV', zh: 'KJV', ru: 'KJV' },
    sub: { en: 'King James Version · 1611 / 1769', zh: 'King James Version · 1611 / 1769', ru: 'King James Version · 1611 / 1769' },
    credit: PD },
  { id: 'web-yhwh', group: 'en', lic: 'PD',
    name: { en: 'WEB (Yahweh)', zh: 'WEB 雅伟版', ru: 'WEB («Яхве»)' },
    sub: { en: 'World English Bible · the divine name as Yahweh', zh: 'World English Bible · 神名作 Yahweh', ru: 'World English Bible · имя Божие — Yahweh' },
    credit: { en: 'Public domain. The World English Bible, with the divine name as Yahweh; supplied by Yahwehdehua (from eBible.org). The Apocrypha is not included.',
      zh: '公有领域。World English Bible，神名作 Yahweh；雅伟的话提供（来自 eBible.org）。不含次经。',
      ru: 'Общественное достояние. World English Bible с Божьим именем Yahweh; предоставлено Yahwehdehua (с eBible.org). Неканонические книги не включены.' } },
  { id: 'asv-yhwh', group: 'en', lic: 'PD',
    name: { en: 'ASV (Yahweh)', zh: 'ASV 雅伟版', ru: 'ASV («Яхве»)' },
    sub: { en: 'American Standard Version · 1901', zh: 'American Standard Version · 1901', ru: 'American Standard Version · 1901' },
    credit: { en: 'Public domain (1901) · the divine name is rendered Yahweh where the ASV printed Jehovah, an editorial restoration by Yahweh De Hua Ministry.',
      zh: '1901 年版本属公有领域 · 神名由 Jehovah 还原为 Yahweh，为雅伟的话事工的编辑成果。',
      ru: 'Общественное достояние (1901) · там, где в ASV напечатано Jehovah, Божье имя передано как Yahweh — редакторское восстановление служения Yahweh De Hua Ministry.' } },
  { id: 'rst-yhwh', group: 'ru', lic: 'PD',
    name: { en: 'Synodal (Yahweh)', zh: 'Синодальный（雅伟版）', ru: 'Синодальный (Яхве)' },
    sub: { en: 'Russian Synodal translation · 1876 · the name Яхве restored', zh: '俄文 Synodal 译本 · 1876', ru: 'Синодальный перевод · 1876 · имя Яхве восстановлено' },
    credit: { en: 'The Russian Synodal translation (1876, public domain). In this edition the name Яхве (Yahweh) is restored where the Hebrew has יהוה; אֲדֹנָי יְהוִה is «Владыка Яхве». Otherwise the text is unchanged, and «Господь» in the New Testament stays as printed. The list of changed verses is public: yahwehword.com/rst-yhwh/changes.csv',
      zh: '俄文 Synodal 译本（1876，公有领域）。本版在希伯来原文为 יהוה 之处恢复神的名字「Яхве」；אֲדֹנָי יְהוִה 作 «Владыка Яхве»。其余文字未改，新约的 «Господь» 保持原样。改动清单公开：yahwehword.com/rst-yhwh/changes.csv',
      ru: 'Синодальный перевод 1876 г. (общественное достояние). В этом издании имя Божие Яхве восстановлено там, где в еврейском тексте стоит יהוה; в сочетании אֲדֹנָי יְהוִה оно передано как «Владыка Яхве». В остальном текст не изменён; в Новом Завете «Господь» оставлено как в оригинале. Список изменённых стихов открыт: yahwehword.com/rst-yhwh/changes.csv' } },
  { id: 'rst', group: 'ru', lic: 'PD',
    name: { en: 'Synodal', zh: 'Синодальный', ru: 'Синодальный' },
    sub: { en: 'Russian Synodal translation · 1876', zh: '俄文 Synodal 译本 · 1876', ru: 'Синодальный перевод · 1876' },
    credit: PD },
];

export const GROUPS: { id: Group; name: Words }[] = [
  { id: 'zh-Hans', name: { en: '简体中文', zh: '简体中文', ru: '简体中文' } },
  { id: 'zh-Hant', name: { en: '繁體中文', zh: '繁體中文', ru: '繁體中文' } },
  { id: 'en', name: { en: 'English', zh: 'English', ru: 'English' } },
  { id: 'ru', name: { en: 'Русский', zh: 'Русский', ru: 'Русский' } },
];

export const word = (w: Words) => t(w.en, w.zh, w.ru);
export const byId = (id: string) => EDITIONS.find((e) => e.id === id);
export const defaultFor = (l = fullLocale()) => (l === 'ru' ? 'rst-yhwh' : l === 'zh-Hans' ? 'cuvs-yhwh' : l === 'zh-Hant' ? 'cuvs-yhwh-tr' : 'bsb-yhwh');

// ── which editions this build has ───────────────────────────────────────
let availP: Promise<Set<string>> | null = null;
/** The ids whose text is in this build: the three legacy files, plus whatever /data/bible/editions.json lists. */
export function available(): Promise<Set<string>> {
  availP ??= fetch('/data/bible/editions.json')
    .then((r) => (r.ok ? r.json() : { editions: [] }))
    .catch(() => ({ editions: [] }))
    .then((j: { editions?: { id: string }[] }) => new Set<string>([...EDITIONS.filter((e) => e.legacyDir).map((e) => e.id), ...(j.editions ?? []).map((e) => e.id)]));
  return availP;
}

// ── the reader's choice, remembered per reading ─────────────────────────
const key = () => `ydh.edition.${fullLocale()}`;
export function chosenId(): string {
  // #ed=<id> in a shared link wins for this visit and is not saved
  const shared = /(?:^|[#&])ed=([a-z0-9-]+)(?:&|$)/.exec(location.hash)?.[1];
  if (shared && byId(shared)) return shared;
  try { const v = localStorage.getItem(key()); if (v && byId(v)) return v; } catch { /* blocked storage: the default */ }
  return defaultFor();
}
export function choose(id: string) {
  try { localStorage.setItem(key(), id); } catch { /* nothing to do */ }
  document.dispatchEvent(new CustomEvent('gx:edition', { detail: id }));
}
/** The edition to use now: the choice if this build has it, else the reading's default, else BSB. */
export async function current(): Promise<Edition> {
  const have = await available();
  const id = chosenId();
  return byId(have.has(id) ? id : have.has(defaultFor()) ? defaultFor() : 'bsb-yhwh')!;
}

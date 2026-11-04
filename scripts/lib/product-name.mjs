// The product name's Chinese spellings, read from src/config/site.ts (the one source) so the build templates never carry a literal.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/config/site.ts'), 'utf8');
const m = /export const NAME_ZH = \{ hans: '([^']+)', hant: '([^']+)' \}/.exec(site);
if (!m) throw new Error('src/config/site.ts: NAME_ZH not found');
export const NAME_HANS = m[1];
export const NAME_HANT = m[2];

/** The whole naming table (owner, 2026-11-04: named like Words), parsed from the same one source.
 *    wordmark  the Latin name, never shortened
 *    short     the label under the icon, per language
 *    store     the title a store lists, per store locale
 *  Kept as a literal-free read so a manifest, an installer and a store listing cannot name four different products. */
const pick = (re, what) => { const m = re.exec(site); if (!m) throw new Error(`src/config/site.ts: ${what} not found`); return m[1]; };
export const PRODUCT_NAMES = {
  wordmark: pick(/wordmark: "([^"]+)"/, 'PRODUCT.wordmark'),
  short: {
    en: pick(/\n  en: '([^']+)'/, 'PRODUCT.en'),
    'zh-Hans': pick(/\n  zhHans: '([^']+)'/, 'PRODUCT.zhHans'),
    'zh-Hant': pick(/\n  zhHant: '([^']+)'/, 'PRODUCT.zhHant'),
    ru: pick(/\n  ru: '([^']+)'/, 'PRODUCT.ru'),
  },
  store: {
    'en-US': pick(/'en-US': "([^"]+)"/, "PRODUCT.store['en-US']"),
    'zh-Hans': pick(/'zh-Hans': '([^']+)'/, "PRODUCT.store['zh-Hans']"),
    'zh-Hant': pick(/'zh-Hant': '([^']+)'/, "PRODUCT.store['zh-Hant']"),
    ru: pick(/\n    ru: "([^"]+)"/, 'PRODUCT.store.ru'),
  },
};

/** THE WORDMARK, AS MARKUP. All four readings are written into the page and `html[lang]` shows one of them in CSS
 *  (the .tri rules in scripts/build-shell.mjs CRITICAL, inline in every head). Pure CSS on purpose: the first-paint
 *  script has already set <html lang> from the stored language, so the name is RIGHT IN THE FIRST PAINT — a module
 *  that wrote it afterwards gave every English and Russian reader a frame of the Chinese name. src/locale.ts leaves
 *  an element that carries readings alone for the same reason.
 *
 *  en and ru both read the Latin wordmark (owner, 2026-11-04: Russian keeps the Latin name, as Words does); the
 *  Simplified spelling appears only in the l-hans reading, which is the one place `npm run verify:shell` allows it. */
export const wordmarkLockup = (cls = 'wm tri') => `<span class="${cls}" data-brand`
  + `><i class="l-en">${PRODUCT_NAMES.wordmark}</i><i class="l-hans">${NAME_HANS}</i>`
  + `<i class="l-hant">${NAME_HANT}</i><i class="l-ru">${PRODUCT_NAMES.wordmark}</i></span>`;

// The location hash the chapter reader owns: #ref=Genesis 15:5-6&ed=kjv&par=kjv,cuvs-yhwh&m=parallel
// A passage under a picture does not use it (the host page owns that hash).
import type { Mode, Ref, UiLang } from './types.ts';
import { BOOKS, editionById, matchUiTag, parseReference } from './books.ts';

export interface RouteState {
  ref?: Ref;
  ed?: string;
  lang?: UiLang;
  par?: string[];
  mode?: Mode;
}

const MODES: readonly Mode[] = ['verse', 'paragraph', 'parallel'];

export function parseHash(hash: string): RouteState {
  const h = hash.replace(/^#/, '');
  const out: RouteState = {};
  if (!h) return out;
  const params = new URLSearchParams(h);
  const ref = params.get('ref');
  if (ref) { const r = parseReference(ref); if (r) out.ref = r; }
  const ed = params.get('ed');
  if (ed && editionById(ed)) out.ed = ed;
  const lang = matchUiTag(params.get('lang'));
  if (params.get('lang') && lang) out.lang = lang;
  const par = params.get('par');
  if (par) { const ids = par.split(',').filter((x) => !!editionById(x)); if (ids.length) out.par = ids; }
  const m = params.get('m');
  if (m && MODES.includes(m as Mode)) out.mode = m as Mode;
  return out;
}

/** English canonical reference text, e.g. "Genesis 15:5-6" (the form every deep link uses). */
export function canonicalRef(r: Ref): string {
  let s = `${BOOKS[r.book - 1]!.en} ${r.chapter}`;
  if (r.v1 != null) { s += `:${r.v1}`; if (r.v2 != null && r.v2 > r.v1) s += `-${r.v2}`; }
  return s;
}

export function formatHash(s: RouteState): string {
  const parts: string[] = [];
  if (s.ref) parts.push(`ref=${encodeURIComponent(canonicalRef(s.ref))}`);
  if (s.ed) parts.push(`ed=${s.ed}`);
  if (s.lang) parts.push(`lang=${s.lang}`);
  if (s.par?.length) parts.push(`par=${s.par.join(',')}`);
  if (s.mode && s.mode !== 'verse') parts.push(`m=${s.mode}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

// Which page of the app a link opens. Pure (no window), so tests/shell/deeplink.test.ts feeds it real links.
//
//   https://world.yahwehword.com/p/<id>        a shared picture (App Links / Universal Links, when the OS routes the link here)
//   https://world.yahwehword.com/{,scenes.html,bible.html}[#...]   the same pages the website has
//   yahwehsworld://p/<id>                       the custom scheme, a fallback where the https link is not routed to the app
//
// yahwehsworld://packs used to open the offline-pictures sheet. That sheet was a stub and has been taken out
// (src/shell/boot.ts), so the link is no longer known and is ignored like any other unknown link.
//
// Anything else is ignored: a link the app does not know must never navigate the window somewhere else.
import { SITE_HOST } from '../config/site.ts';

export type DeepLinkTarget = { kind: 'page'; href: string };

const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const PAGES = new Set(['/', '/index.html', '/scenes.html', '/bible.html']);

const withFragment = (base: string, frag: string) => (frag ? `${base}${base.includes('#') ? '&' : '#'}${frag}` : base);

export function routeForDeepLink(raw: string): DeepLinkTarget | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const frag = url.hash.startsWith('#') ? url.hash.slice(1) : '';
  if (url.protocol === 'https:' && url.origin === SITE_HOST) {
    const m = /^\/p\/([^/]+)\/?$/.exec(url.pathname);
    if (m) return ID.test(m[1]!) ? { kind: 'page', href: withFragment(`/scenes.html#p=${m[1]}`, frag) } : null;
    if (PAGES.has(url.pathname)) return { kind: 'page', href: `${url.pathname === '/index.html' ? '/' : url.pathname}${frag ? `#${frag}` : ''}` };
    return null;
  }
  if (url.protocol === 'yahwehsworld:') {
    const rest = raw.slice('yahwehsworld://'.length).split('#')[0]!.split('?')[0]!.replace(/\/+$/, '');
    const m = /^p\/([^/]+)$/.exec(rest);
    if (m && ID.test(m[1]!)) return { kind: 'page', href: withFragment(`/scenes.html#p=${m[1]}`, frag) };
  }
  return null;
}

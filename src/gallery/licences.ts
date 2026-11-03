// The licences sheet: every edition in the build with its licence text in the reader's language, from the reader
// module's catalogue (Words' own wording). Loaded on demand from the home page's footer.
import { t } from '../locale.ts';
import { EDITIONS } from '../reader/index.ts';
import { readerSession } from './reader-bridge.ts';
import { openSheet } from './sheet.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function openLicences(returnFocus?: HTMLElement | null) {
  const s = readerSession();
  openSheet({
    title: t('Editions and licences', '译本与授权', 'Издания и лицензии'),
    returnFocus,
    className: 'center',
    render(body) {
      body.innerHTML = EDITIONS.map((e) => {
        const chip = e.licence.kind === 'cc0' ? 'CC0' : e.licence.kind === 'permission' ? '©' : s.tr('licencePD');
        const src = e.licence.url ? ` · <a href="${esc(e.licence.url)}" rel="noopener">${esc(e.licence.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : '';
        return `<div class="gx-lic" lang="${e.language}"><div class="gx-h3">${esc(e.menu)} <span class="lic gx-mono">${esc(chip)}</span></div>` +
          `<p class="gx-lede" lang="${s.ui}">${esc(e.licence.note[s.ui])}</p><div class="gx-mono">${esc(e.licence.holder)}${src}</div></div>`;
      }).join('');
    },
  });
}

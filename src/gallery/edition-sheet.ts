// The edition sheet (grouped by language, one tap, remembered per reading) and the licences sheet (every edition's
// credit line, in full). Both are fed by editions.ts and open from the home page, the picture page and the footer.
import { t } from '../locale.ts';
import { GROUPS, EDITIONS, available, byId, chosenId, choose, word, type Edition } from './editions.ts';
import { openSheet } from './sheet.ts';

const row = (e: Edition, selected: boolean) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gx-opt';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(selected));
  b.dataset.id = e.id;
  b.innerHTML = `<span class="chk"></span><span class="n"></span><span class="lic"></span>`;
  b.querySelector('.n')!.innerHTML = `${esc(word(e.name))}<small>${esc(word(e.sub))}</small>`;
  b.querySelector('.lic')!.textContent = e.lic;
  return b;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function openEditionSheet(returnFocus?: HTMLElement | null) {
  openSheet({
    title: t('Edition', '译本', 'Издание'),
    returnFocus,
    render(body, close) {
      body.innerHTML = `<div role="radiogroup" aria-label="${t('Edition', '译本', 'Издание')}"></div>
        <p class="gx-pal-hint">${t('The same editions as Yahweh’s Words and Yahweh’s Sword.', '与雅伟之言、雅伟之剑同一套译本。', 'Те же издания, что в «Слове Яхве» и «Мече Яхве».')}</p>`;
      const host = body.querySelector('div')!;
      void available().then((have) => {
        const sel = chosenId();
        for (const g of GROUPS) {
          const list = EDITIONS.filter((e) => e.group === g.id && have.has(e.id));
          if (!list.length) continue;
          const h = document.createElement('div');
          h.className = 'gx-group';
          h.textContent = word(g.name);
          host.append(h, ...list.map((e) => row(e, e.id === sel)));
        }
        host.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
      });
      host.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('.gx-opt');
        if (!b) return;
        choose(b.dataset.id!);
        close();
      });
    },
  });
}

/** Every edition in this build, with its credit line as Words words it. */
export function openLicences(returnFocus?: HTMLElement | null) {
  openSheet({
    title: t('Editions and licences', '译本与授权', 'Издания и лицензии'),
    returnFocus,
    className: 'center',
    render(body) {
      void available().then((have) => {
        body.innerHTML = EDITIONS.filter((e) => have.has(e.id)).map((e) =>
          `<div class="gx-lic"><div class="gx-h3">${esc(word(e.name))} <span class="lic gx-mono">${e.lic}</span></div><div class="gx-mono">${esc(word(e.sub))}</div><p class="gx-lede">${esc(word(e.credit))}</p></div>`).join('');
      });
    },
  });
}

export const editionName = (id: string) => { const e = byId(id); return e ? word(e.name) : id; };

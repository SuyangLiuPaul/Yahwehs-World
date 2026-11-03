// "Tell us about this picture": one tap on the picture page opens this sheet. An optional note, optional quick reasons, an
// optional e-mail address for a reply, Send and Cancel. Sending posts to /api/feedback (netlify/functions/feedback.mjs), which
// mails the owner with the picture, its reference, the page, the language, the edition, the theme and the browser.
//
// Rules this file keeps (owner, 2026-11-03):
//   - nothing is sent until Send is pressed, and nothing is stored here: no cookies, no localStorage, no tracker, no third-party script;
//   - an empty report is allowed (the picture and the reasons are the report);
//   - when the function is not set up, or the network fails, the sheet says so plainly and offers a prefilled mailto: link to
//     support@yahwehword.com carrying the same context. Feedback is never silently lost.
// Loaded on demand (the first tap), with its own stylesheet.
import './feedback.css';
import { fullLocale, t } from '../locale.ts';
import { refText, sceneTitle, type Scene } from './data.ts';
import { choice } from './editions.ts';
import { readTheme } from './chrome.ts';
import { openSheet } from './sheet.ts';

export const SUPPORT = 'support@yahwehword.com';
export const ENDPOINT = '/api/feedback';
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/;

type Reason = 'picture' | 'caption' | 'bible' | 'other';
const REASONS: { key: Reason; label: () => string }[] = [
  { key: 'picture', label: () => t('The picture looks wrong', '画面有问题', 'Картина выглядит неверно') },
  { key: 'caption', label: () => t('Caption or reference wrong', '标题或出处有误', 'Ошибка в подписи или ссылке') },
  { key: 'bible', label: () => t('Bible text problem', '经文有问题', 'Проблема с текстом Библии') },
  { key: 'other', label: () => t('Other', '其他', 'Другое') },
];

/** The reading theme as the reader will show it: the choice, and what "auto" turned into. */
function themeNow(): string {
  const pref = readTheme();
  if (pref !== 'auto') return pref;
  let dark = true;
  try { dark = matchMedia('(prefers-color-scheme: dark)').matches; } catch { /* no matchMedia: dark, the site's own ground */ }
  return `auto (${dark ? 'dark' : 'paper'})`;
}
/** What the mail carries besides the reader's words. Built when Send is pressed, never earlier. */
export function contextOf(sc: Scene) {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const z = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return {
    ref: refText(sc, 'en'),
    url: location.href,
    lang: fullLocale(),
    edition: choice().id,
    theme: themeNow(),
    userAgent: navigator.userAgent,
    time: `${d.toISOString()} (UTC${off < 0 ? '-' : '+'}${z(off / 60)}:${z(off % 60)})`,
    viewport: `${innerWidth}x${innerHeight}`,
  };
}

/** The prefilled mail the sheet falls back to. Kept short enough for every mail client's link limit. */
export function mailtoFor(sc: Scene, message: string, reasons: Reason[], email: string): string {
  const c = contextOf(sc);
  const why = REASONS.filter((r) => reasons.includes(r.key)).map((r) => r.label()).join('; ');
  const lines: (string | null)[] = [
    message.slice(0, 1400), '', '---',
    `Picture: ${sc.id}`, `Reference: ${c.ref}`, `Page: ${c.url}`, why ? `Reasons: ${why}` : null, email ? `Reply to: ${email}` : null,
    `Language: ${c.lang}`, `Edition: ${c.edition}`, `Theme: ${c.theme}`, `Time: ${c.time}`, `Browser: ${c.userAgent.slice(0, 200)}`,
  ];
  const body = lines.filter((l): l is string => l !== null).join('\n');
  return `mailto:${SUPPORT}?subject=${encodeURIComponent(`Yahweh's World feedback [${sc.id}]`)}&body=${encodeURIComponent(body)}`;
}

type Outcome = { kind: 'ok' } | { kind: 'rate' } | { kind: 'down' };
async function post(payload: unknown, fetcher: typeof fetch = fetch): Promise<Outcome> {
  try {
    const r = await fetcher(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) return { kind: 'ok' };
    return r.status === 429 ? { kind: 'rate' } : { kind: 'down' };
  } catch { return { kind: 'down' }; }
}

export function openFeedback(sc: Scene, returnFocus?: HTMLElement | null): HTMLDialogElement {
  const reasons = new Set<Reason>();
  const dlg = openSheet({
    title: t('Tell us about this picture', '告诉我们这幅画的问题', 'Сообщить об этой картине'),
    returnFocus,
    className: 'gx-fb',
    render(body, close) {
      body.innerHTML = `
        <form class="fb" novalidate>
          <p class="fb-ctx gx-mono"></p>
          <fieldset class="fb-set"><legend class="fb-l"></legend><div class="fb-chips" role="group"></div></fieldset>
          <div class="fb-f"><label class="fb-l" for="fb-text"></label><textarea id="fb-text" name="message" rows="3" maxlength="4000" autocomplete="off"></textarea></div>
          <div class="fb-f"><label class="fb-l" for="fb-mail"></label><input id="fb-mail" name="email" type="email" inputmode="email" autocomplete="email" maxlength="320" aria-describedby="fb-mail-err">
            <p class="fb-err" id="fb-mail-err" hidden></p></div>
          <div class="fb-hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
          <p class="fb-privacy"></p>
          <div class="fb-live" role="status" aria-live="polite"></div>
          <div class="fb-fallback" hidden><a class="gx-btn quiet" id="fb-mailto"></a></div>
          <div class="fb-actions"><button type="button" class="gx-btn quiet" data-cancel></button><button type="submit" class="gx-btn primary" data-send></button></div>
        </form>
        <div class="fb-done" hidden tabindex="-1" role="status"><div class="fb-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
          <h3 class="fb-thanks"></h3><p class="fb-sub"></p><button type="button" class="gx-btn primary" data-done></button></div>`;
      const $ = <T extends HTMLElement>(s: string) => body.querySelector<T>(s)!;
      const form = $<HTMLFormElement>('form');
      $('.fb-ctx').textContent = `${sceneTitle(sc)} · ${refText(sc)}`;
      form.querySelector('fieldset .fb-l')!.textContent = t('What is wrong? (optional)', '哪里不对？（可不选）', 'Что не так? (необязательно)');
      const chips = $('.fb-chips');
      chips.setAttribute('aria-label', t('Reasons', '原因', 'Причины'));
      for (const r of REASONS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'gx-pill'; b.dataset.r = r.key; b.setAttribute('aria-pressed', 'false'); b.textContent = r.label();
        chips.append(b);
      }
      chips.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
        if (!b) return;
        const k = b.dataset.r as Reason;
        if (reasons.has(k)) reasons.delete(k); else reasons.add(k);
        b.setAttribute('aria-pressed', String(reasons.has(k)));
      });
      form.querySelector('label[for="fb-text"]')!.textContent = t('Tell us more (optional)', '想多说几句（可不写）', 'Расскажите подробнее (необязательно)');
      const text = $<HTMLTextAreaElement>('#fb-text');
      const mail = $<HTMLInputElement>('#fb-mail');
      form.querySelector('label[for="fb-mail"]')!.textContent = t('Your e-mail, if you would like a reply (optional)', '你的邮箱，如需回复（可不填）', 'Ваш e-mail, если нужен ответ (необязательно)');
      $('.fb-privacy').textContent = t(
        'Nothing is sent until you press Send. Your note goes by e-mail to the team with the picture, your language, edition and browser type. This site stores nothing about you: no cookies, no tracking.',
        '点“发送”之前不会发出任何内容。你的留言连同这幅画、语言、译本和浏览器类型，会以电子邮件发给团队。本站不保存任何关于你的信息，没有 cookie，也不做追踪。',
        'Ничего не отправляется, пока вы не нажмёте «Отправить». Сообщение уходит команде по e-mail вместе с картиной, языком, изданием и типом браузера. Сайт ничего о вас не хранит: ни cookie, ни отслеживания.');
      const live = $('.fb-live');
      const send = $<HTMLButtonElement>('[data-send]');
      const cancel = $<HTMLButtonElement>('[data-cancel]');
      send.textContent = t('Send', '发送', 'Отправить');
      cancel.textContent = t('Cancel', '取消', 'Отмена');
      cancel.addEventListener('click', close);
      const fb = $('.fb-fallback');
      const mailErr = $('#fb-mail-err');
      const refreshMailto = () => { $<HTMLAnchorElement>('#fb-mailto').href = mailtoFor(sc, text.value, [...reasons], mail.value.trim()); };
      $<HTMLAnchorElement>('#fb-mailto').textContent = t(`Write to ${SUPPORT} instead`, `改为写信给 ${SUPPORT}`, `Написать на ${SUPPORT}`);
      // the link is rebuilt when it is used, so it carries what the reader has typed by then
      $('#fb-mailto').addEventListener('click', refreshMailto);
      $('#fb-mailto').addEventListener('focus', refreshMailto);
      $('#fb-mailto').addEventListener('pointerdown', refreshMailto);
      mail.addEventListener('input', () => { mail.removeAttribute('aria-invalid'); mailErr.hidden = true; });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if ((form.elements.namedItem('website') as HTMLInputElement).value) return; // a bot: nothing to say to it
        const address = mail.value.trim();
        if (address && !EMAIL.test(address)) {
          mail.setAttribute('aria-invalid', 'true');
          mailErr.textContent = t('That e-mail address does not look right. You can also leave it empty.', '这个邮箱地址好像不对。也可以留空。', 'Адрес e-mail выглядит неверно. Его можно и не указывать.');
          mailErr.hidden = false;
          mail.focus();
          return;
        }
        send.disabled = true; cancel.disabled = true;
        send.textContent = t('Sending…', '发送中…', 'Отправляем…');
        live.textContent = '';
        fb.hidden = true;
        const out = await post({
          pictureId: sc.id, reasons: [...reasons], message: text.value.trim(), email: address, context: contextOf(sc),
          website: (form.elements.namedItem('website') as HTMLInputElement).value,
        });
        if (out.kind === 'ok') {
          form.hidden = true;
          const done = $('.fb-done');
          done.hidden = false;
          $('.fb-thanks').textContent = t('Thank you', '谢谢你', 'Спасибо');
          $('.fb-sub').textContent = t('Your note is on its way to the team. Every one is read.', '你的留言已经送到团队手中，每一条我们都会读。', 'Ваше сообщение передано команде. Мы читаем каждое.');
          const dn = $<HTMLButtonElement>('[data-done]');
          dn.textContent = t('Close', '关闭', 'Закрыть');
          dn.addEventListener('click', close);
          done.focus();
          return;
        }
        send.disabled = false; cancel.disabled = false;
        send.textContent = t('Try again', '重试', 'Повторить');
        live.textContent = out.kind === 'rate'
          ? t('Too many notes from this connection today. Please try again tomorrow, or write to us by e-mail.', '今天从这个网络发出的留言太多了，请明天再试，或直接写邮件给我们。', 'Сегодня с этого подключения отправлено слишком много сообщений. Попробуйте завтра или напишите нам по e-mail.')
          : t('The note could not be sent just now. Your text is still here; try again, or write to us by e-mail.', '暂时没能发出去。你写的内容还在，可以重试，也可以直接写邮件给我们。', 'Сообщение сейчас не отправилось. Ваш текст сохранён здесь: повторите попытку или напишите нам по e-mail.');
        refreshMailto();
        fb.hidden = false;
      });
    },
  });
  // the sheet follows the reading theme (dark, light, paper), as the passage beside it does
  dlg.dataset.theme = themeNow().replace(/^auto \((\w+)\)$/, '$1');
  dlg.lang = document.documentElement.lang;
  return dlg;
}

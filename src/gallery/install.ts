// The "Install the app" entry in the home page's footer, and the line that says how much is saved for offline.
//   Chromium (Chrome, Edge, Samsung Internet, Opera, Android): the browser's own install prompt, kept from `beforeinstallprompt` (chrome.ts)
//   iPhone / iPad (any browser, but only Safari really can): a sheet with the three taps, in the four languages
//   Safari on a Mac: a sheet for File > Add to Dock
//   already installed (display-mode: standalone, or navigator.standalone on iOS): nothing at all
//   anything else (Firefox on a computer, an old browser): nothing; there is no way to install from there
// Loaded by home.ts after the page is up. docs/gallery-pwa.md.
import { applyStatic, onLocale, t } from '../locale.ts';
import { NAME_ZH } from '../config/site.ts';
import { platformOf } from '../pwa/platform.ts';
import { install } from './chrome.ts';
import { ask, type Report } from './pwa-bridge.ts';
import { openSheet } from './sheet.ts';

type Mode = 'none' | 'prompt' | 'ios' | 'mac-safari';

const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const name = () => t("Yahweh's World", NAME_ZH.hans, 'Мир Яхве');

export function installMode(): Mode {
  if (import.meta.env.VITE_TARGET === 'shell' || standalone()) return 'none';
  if (install.event) return 'prompt';
  const p = platformOf(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  return p.family === 'ios' ? 'ios' : p.family === 'mac-safari' ? 'mac-safari' : 'none';
}

const SHARE = '<svg class="in-share" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M8.2 7.2 12 3.5l3.8 3.7"/><path d="M7 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18 10.5h-1"/></svg>';

function openHowTo(mode: 'ios' | 'mac-safari', from: HTMLElement) {
  const inApp = platformOf(navigator.userAgent, navigator.platform, navigator.maxTouchPoints).inApp;
  openSheet({
    title: mode === 'ios' ? t('Add to Home Screen', '添加到主屏幕', 'Добавить на экран «Домой»') : t('Add to the Dock', '添加到程序坞', 'Добавить в Dock'),
    returnFocus: from,
    render(body) {
      const steps: string[] = mode === 'ios'
        ? [
          t(`Tap the Share button ${SHARE} in the toolbar (on an iPad it is at the top right).`, `点按工具栏里的“分享”按钮 ${SHARE}（iPad 在右上角）。`, `Нажмите кнопку «Поделиться» ${SHARE} на панели инструментов (на iPad она вверху справа).`),
          t('Scroll down and choose “Add to Home Screen”.', '向下滚动，选择“添加到主屏幕”。', 'Прокрутите вниз и выберите «На экран “Домой”».'),
          t('Tap Add.', '点按“添加”。', 'Нажмите «Добавить».'),
        ]
        : [
          t('In the menu bar choose File ▸ Add to Dock…', '在菜单栏选择“文件”▸“添加到程序坞…”。', 'В строке меню выберите «Файл» ▸ «Добавить в Dock…».'),
          t('Click Add.', '点按“添加”。', 'Нажмите «Добавить».'),
        ];
      const after = t(
        `${name()} then opens full screen like an app, and the scenes and chapters you have opened stay available without a network.`,
        `${name()}会像应用一样全屏打开，看过的画卷和章节在没有网络时也能打开。`,
        `${name()} откроется на весь экран, как приложение, а открытые вами сцены и главы останутся доступны без сети.`,
      );
      const warn = inApp ? `<p class="in-warn">${t('This browser inside another app cannot add it. Open this page in Safari first.', '另一个应用里的内置浏览器无法添加。请先在 Safari 里打开这个页面。', 'Встроенный браузер другого приложения не умеет это делать. Сначала откройте страницу в Safari.')}</p>` : '';
      body.innerHTML = `${warn}<ol class="in-steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol><p class="in-after">${after}</p>`;
    },
  });
}

function words(host: HTMLElement, mode: Mode) {
  host.hidden = mode === 'none';
  if (mode === 'none') { host.replaceChildren(); return; }
  host.innerHTML = '<h3></h3><p class="hm-install-note"></p><button type="button" class="gx-pill gold" id="hm-install-btn"></button>';
  host.querySelector('h3')!.textContent = t('Install the app', '安装为应用', 'Установить приложение');
  host.querySelector('.hm-install-note')!.textContent = t(`${name()} opens full screen, and what you have already opened works without a network.`, `${name()}全屏打开；已经看过的内容没有网络也能用。`, `${name()} открывается на весь экран; то, что вы уже открывали, работает без сети.`);
  host.querySelector('#hm-install-btn')!.textContent = mode === 'prompt' ? t('Install', '安装', 'Установить') : t('How to add it', '怎么添加', 'Как добавить');
}

export function mountInstall(host: HTMLElement) {
  const paint = () => words(host, installMode());
  paint();
  host.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest('#hm-install-btn') as HTMLElement | null;
    if (!b) return;
    const mode = installMode();
    if (mode === 'prompt' && install.event) {
      const ev = install.event;
      install.event = null;            // a prompt can be used once
      try { await ev.prompt(); await ev.userChoice; } catch { /* closed */ }
      paint();
    } else if (mode === 'ios' || mode === 'mac-safari') openHowTo(mode, b);
  });
  document.addEventListener('gx:installable', paint);
  document.addEventListener('gx:installed', paint);
  onLocale(paint);
  matchMedia('(display-mode: standalone)').addEventListener?.('change', paint);
}

// ── what is saved on this device ──────────────────────────────────────────────────────────────────────────────
const mb = (n: number) => `${Math.max(1, Math.round(n / 1048576))} MB`;

export async function mountOffline(host: HTMLElement) {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return;
  const paint = async () => {
    const r = await ask<Report>(sw, { type: 'report' });
    if (!r?.caches) { host.hidden = true; return; }
    const used = Object.values(r.caches).reduce((a, c) => a + c.bytes, 0);
    const cap = Object.values(r.caches).reduce((a, c) => a + c.budget, 0);
    if (used < 1048576) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = '<span></span> <button type="button" class="hm-link"></button>';
    host.querySelector('span')!.textContent = t(`Saved on this device for offline: ${mb(used)} of at most ${mb(cap)}.`, `已保存在这台设备上供离线使用：${mb(used)}，上限 ${mb(cap)}。`, `Сохранено на этом устройстве для работы без сети: ${mb(used)} из максимум ${mb(cap)}.`);
    host.querySelector('button')!.textContent = t('Clear', '清除', 'Очистить');
  };
  host.addEventListener('click', async (e) => {
    if (!(e.target as HTMLElement).closest('button')) return;
    await ask(sw, { type: 'clear' });
    void paint();
  });
  onLocale(() => void paint());
  void paint();
  applyStatic(host);
}

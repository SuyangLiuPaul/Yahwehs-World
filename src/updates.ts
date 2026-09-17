// Update check for the native shell (macOS/Windows/Android/iOS) only. The
// plain website is always the current build — there is nothing to check — so
// this returns before touching the page unless it is running inside Tauri.
//
// The button and the dialog are built here rather than written into each
// page's HTML. Three reasons, in order of how much trouble they saved: the
// website never ships markup for a feature it cannot have; all three pages
// get the same panel without three copies of it to keep in step; and the
// button keeps its ⚙, which it did not when it carried data-en/data-zh —
// applyStatic() sets textContent from those, so the glyph was replaced by
// the word "Settings" in a 30px circle. The accessible name is an
// aria-label now, which is what it should have been.
//
// Versioning contract (matches tools/release_web.sh and tools/bump_version.sh):
//   - getVersion() (Tauri) reads tauri.conf.json's plain X.Y.Z. That is the
//     ONLY string ever compared against a GitHub release tag.
//   - VITE_DISPLAY_VERSION, baked in at build time, may carry a trailing
//     ".<commits since last tag>" for a dev build. It is shown to a reader
//     and never compared — comparing it would make 0.1.0.7 look "greater"
//     than the 0.1.0 release it was built from.
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { applyStatic, onLocale, t } from './locale.ts';

const REPO = 'SuyangLiuPaul/yahwehs-globe';
const CHECK_KEY = 'ydh.update.mode';
const LAST_CHECK_KEY = 'ydh.update.lastChecked';

type CheckMode = 'launch' | 'daily' | 'weekly' | 'manual';
const MODES: CheckMode[] = ['launch', 'daily', 'weekly', 'manual'];

function readMode(): CheckMode {
  try {
    const saved = localStorage.getItem(CHECK_KEY);
    if (saved && (MODES as string[]).includes(saved)) return saved as CheckMode;
  } catch { /* private mode, blocked storage */ }
  return 'launch';
}

function writeMode(mode: CheckMode) {
  try { localStorage.setItem(CHECK_KEY, mode); } catch { /* nothing to do */ }
}

function dueByMode(mode: CheckMode): boolean {
  if (mode === 'manual') return false;
  if (mode === 'launch') return true;
  let last = 0;
  try { last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0); } catch { /* ignore */ }
  const elapsed = Date.now() - last;
  const day = 24 * 60 * 60 * 1000;
  return mode === 'daily' ? elapsed >= day : elapsed >= 7 * day;
}

function stampChecked() {
  try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch { /* ignore */ }
}

/** First three dot-separated segments, so a dev suffix never affects a
 *  comparison — see the contract note at the top of the file. */
function releaseTriplet(v: string): [number, number, number] {
  const [a = 0, b = 0, c = 0] = v.split('.').slice(0, 3).map((n) => Number(n) || 0);
  return [a, b, c];
}

function isNewer(latest: string, current: string): boolean {
  const [la, lb, lc] = releaseTriplet(latest);
  const [ca, cb, cc] = releaseTriplet(current);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}

interface UpdateResult { latest: string; htmlUrl: string }

async function fetchLatestRelease(): Promise<UpdateResult | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const data = await res.json() as { tag_name?: string; html_url?: string };
  if (!data.tag_name) return null;
  return {
    latest: data.tag_name.replace(/^v/, ''),
    htmlUrl: data.html_url ?? `https://github.com/${REPO}/releases`,
  };
}

const MODE_LABELS: [CheckMode, string, string][] = [
  ['launch', 'Every time the app opens', '每次打开时'],
  ['daily', 'Once a day', '每天一次'],
  ['weekly', 'Once a week', '每周一次'],
  ['manual', 'Only when I ask', '仅手动检查时'],
];

// The note below the cadence list describes Android's installer. It was
// appearing on iPhone too, where it is not true — iOS will not install a
// sideloaded update at all, tap or no tap.
const isAndroid = /android/i.test(navigator.userAgent);

function buildUI(mode: CheckMode) {
  const androidOnly = isAndroid ? '' : ' hidden';
  const openBtn = document.createElement('button');
  openBtn.id = 'settings-open';
  openBtn.type = 'button';
  openBtn.textContent = '⚙';

  const dialog = document.createElement('dialog');
  dialog.id = 'settings';
  dialog.innerHTML = `
    <header>
      <h2 id="settings-title" data-en="Settings" data-zh="设置">Settings</h2>
      <button id="settings-close" type="button">×</button>
    </header>
    <dl id="settings-version-row">
      <dt data-en="This app" data-zh="当前版本">This app</dt>
      <dd id="settings-version"></dd>
    </dl>
    <p id="settings-status"></p>
    <a id="settings-download" href="#" hidden data-en="Download the update" data-zh="下载更新">Download the update</a>
    <fieldset id="settings-check-mode">
      <legend data-en="Check for updates" data-zh="检查更新">Check for updates</legend>
      ${MODE_LABELS.map(([value, en, zh]) => `
      <label><input type="radio" name="update-mode" value="${value}"${value === mode ? ' checked' : ''}><span data-en="${en}" data-zh="${zh}">${en}</span></label>`).join('')}
    </fieldset>
    <p class="settings-note"${androidOnly} data-en="Android installs still need one tap to confirm — the system will not install an update silently, even on automatic." data-zh="Android 上仍需手动点一下确认安装——即使选了自动，系统也不会静默安装。"></p>
    <button id="settings-check-now" type="button" data-en="Check now" data-zh="立即检查">Check now</button>`;

  document.querySelector('.sitenav')?.insertBefore(openBtn, document.querySelector('.lang-switch'));
  document.body.append(dialog);

  // The accessible names are not text content, so applyStatic cannot carry
  // them; they are re-set whenever the reading changes.
  const label = () => {
    openBtn.setAttribute('aria-label', t('Settings', '设置'));
    dialog.setAttribute('aria-label', t('Settings', '设置'));
    dialog.querySelector('#settings-close')!.setAttribute('aria-label', t('Close settings', '关闭设置'));
  };
  label();
  onLocale(label);
  applyStatic(dialog);

  return { openBtn, dialog };
}

export function installUpdateChecker() {
  if (!isTauri()) return; // the website has no app to update
  if (document.getElementById('settings-open')) return;

  const mode = readMode();
  const { openBtn, dialog } = buildUI(mode);

  const versionEl = dialog.querySelector('#settings-version') as HTMLElement;
  const statusEl = dialog.querySelector('#settings-status') as HTMLElement;
  const downloadLink = dialog.querySelector('#settings-download') as HTMLAnchorElement;
  const checkNowBtn = dialog.querySelector('#settings-check-now') as HTMLButtonElement;

  dialog.querySelectorAll<HTMLInputElement>('input[name="update-mode"]').forEach((input) => {
    input.addEventListener('change', () => { if (input.checked) writeMode(input.value as CheckMode); });
  });

  openBtn.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('#settings-close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  // Tauri's WebView does not navigate to an external URL by itself; the
  // release page is handed to the OS instead.
  downloadLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (downloadLink.href) void openUrl(downloadLink.href);
  });

  // The status is written by this module, not from data-en/data-zh, so
  // applyStatic cannot re-render it when the reading changes — it stayed in
  // English inside an otherwise 简体 panel. What is remembered is therefore
  // what it is SAYING, and the sentence is produced again each time.
  type Status =
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'latest' }
    | { kind: 'error' }
    | { kind: 'update'; version: string };
  let status: Status = { kind: 'idle' };

  function paintStatus() {
    const state = status.kind === 'update' ? 'update' : status.kind === 'error' ? 'error' : undefined;
    statusEl.textContent =
      status.kind === 'idle' ? ''
      : status.kind === 'checking' ? t('Checking…', '正在检查…')
      : status.kind === 'latest' ? t('You have the latest version.', '已是最新版本。')
      : status.kind === 'error' ? t('Could not check for updates.', '无法检查更新。')
      : t(`Version ${status.version} is available.`, `发现新版本 ${status.version}。`);
    if (state) statusEl.dataset.state = state; else delete statusEl.dataset.state;
  }
  onLocale(paintStatus);

  function setStatus(next: Status) {
    status = next;
    paintStatus();
  }

  let currentVersion = '';

  async function runCheck() {
    checkNowBtn.disabled = true;
    setStatus({ kind: 'checking' });
    try {
      const result = await fetchLatestRelease();
      stampChecked();
      if (result && isNewer(result.latest, currentVersion)) {
        setStatus({ kind: 'update', version: result.latest });
        downloadLink.href = result.htmlUrl;
        downloadLink.hidden = false;
      } else {
        setStatus({ kind: 'latest' });
        downloadLink.hidden = true;
      }
    } catch {
      setStatus({ kind: 'error' });
    } finally {
      checkNowBtn.disabled = false;
    }
  }

  checkNowBtn.addEventListener('click', () => { void runCheck(); });

  void (async () => {
    currentVersion = await getVersion();
    // VITE_DISPLAY_VERSION carries the dev-build suffix for a dev build and
    // is absent on a release build — either way, display only, never
    // compared (see the contract note at the top of the file).
    versionEl.textContent = import.meta.env.VITE_DISPLAY_VERSION || currentVersion;
    if (dueByMode(readMode())) await runCheck();
  })();
}

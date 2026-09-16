// Update check for the native shell (macOS/Windows/Android/iOS) only. The
// plain website is always the current build — there is nothing to check —
// so every entry point here is gated on isTauri() and no-ops on the web.
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
import { t } from './locale.ts';

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

interface UpdateResult {
  latest: string;
  htmlUrl: string;
}

async function fetchLatestRelease(): Promise<UpdateResult | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const data = await res.json() as { tag_name?: string; html_url?: string };
  const tag = data.tag_name;
  if (!tag) return null;
  return { latest: tag.replace(/^v/, ''), htmlUrl: data.html_url ?? `https://github.com/${REPO}/releases` };
}

const checkingText = () => t('Checking…', '正在检查…');
const upToDateText = () => t('You have the latest version.', '已是最新版本。');
const errorText = () => t('Could not check for updates.', '无法检查更新。');
const availableText = (v: string) => t(`Version ${v} is available.`, `发现新版本 ${v}。`);

export function installUpdateChecker() {
  const openBtn = document.getElementById('settings-open');
  if (!openBtn) return;
  if (!isTauri()) return; // stays hidden — the website has no app to update

  openBtn.hidden = false;

  const dialog = document.getElementById('settings') as HTMLDialogElement | null;
  const closeBtn = document.getElementById('settings-close');
  const versionEl = document.getElementById('settings-version');
  const statusEl = document.getElementById('settings-status');
  const downloadLink = document.getElementById('settings-download') as HTMLAnchorElement | null;
  const checkNowBtn = document.getElementById('settings-check-now') as HTMLButtonElement | null;
  const modeInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('#settings-check-mode input[name="update-mode"]'),
  );
  if (!dialog || !statusEl || !versionEl || !checkNowBtn) return;

  const mode = readMode();
  for (const input of modeInputs) input.checked = input.value === mode;
  for (const input of modeInputs) {
    input.addEventListener('change', () => { if (input.checked) writeMode(input.value as CheckMode); });
  }

  openBtn.addEventListener('click', () => dialog.showModal());
  closeBtn?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  // Tauri's WebView does not navigate an <a target="_blank"> to an external
  // URL by itself — the release page is opened via the OS handler instead.
  downloadLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (downloadLink.href) void openUrl(downloadLink.href);
  });

  function setStatus(text: string, state?: 'update' | 'error') {
    statusEl!.textContent = text;
    if (state) statusEl!.dataset.state = state; else delete statusEl!.dataset.state;
  }

  async function runCheck(currentVersion: string) {
    checkNowBtn!.disabled = true;
    setStatus(checkingText());
    try {
      const result = await fetchLatestRelease();
      stampChecked();
      if (!result) { setStatus(upToDateText()); return; }
      if (isNewer(result.latest, currentVersion)) {
        setStatus(availableText(result.latest), 'update');
        if (downloadLink) {
          downloadLink.href = result.htmlUrl;
          downloadLink.hidden = false;
        }
      } else {
        setStatus(upToDateText());
        if (downloadLink) downloadLink.hidden = true;
      }
    } catch {
      setStatus(errorText(), 'error');
    } finally {
      checkNowBtn!.disabled = false;
    }
  }

  let currentVersion = '';
  checkNowBtn.addEventListener('click', () => { void runCheck(currentVersion); });

  (async () => {
    currentVersion = await getVersion();
    // VITE_DISPLAY_VERSION carries the dev-build suffix for a dev deploy and
    // is absent on a release build — either way, display only, never
    // compared (see the contract note at the top of the file).
    versionEl!.textContent = import.meta.env.VITE_DISPLAY_VERSION || currentVersion;

    if (dueByMode(readMode())) {
      await runCheck(currentVersion);
    }
  })();
}

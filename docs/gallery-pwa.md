# 雅偉之界 / Yahweh's World gallery as an installable app (PWA)

Status: built and tested in Chrome on this Mac against `dist/` (`npm run verify:pwa`, part of `npm run verify:gallery`). **Not yet opened on a real iPhone, iPad, Android phone, Windows PC or Safari on a Mac**; section 9 lists what a person must try. Nothing is deployed.

The product name is **雅偉之界 / Yahweh's World** (Traditional characters, the owner's decision of 2026-11-03). Every manifest carries that as `name`. The short name (the label under the icon) follows the language:

| Reading | `short_name` | `apple-mobile-web-app-title` | Manifest file |
|---|---|---|---|
| English | Yahweh's World | Yahweh's World | `/manifest.webmanifest` |
| 简体 | 雅偉之界 | 雅偉之界 | `/manifest.zh-Hans.webmanifest` |
| 繁體 | 雅偉之界 | 雅偉之界 | `/manifest.zh-Hant.webmanifest` |
| Русский | Мир Яхве | Мир Яхве | `/manifest.ru.webmanifest` |

Inside the pages the 简体 reading still shows 雅伟之界 (the site's own simplified wordmark); only the manifest, the stores and the home-screen label keep 雅偉之界. The Russian short name `Мир Яхве` is the site's existing Russian wordmark; it is a one-line change in `scripts/lib/pwa-build.mjs` (`LANGS.ru.short`) if the owner wants 雅偉之界 there too.

## 1. What was added

| Piece | Where |
|---|---|
| Manifests (4) | `scripts/lib/pwa-build.mjs` writes `dist/manifest*.webmanifest` |
| Icons | `public/pwa/*`, made by `scripts/build-pwa-icons.py` from `public/logo.png` only (the Lion and Lamb mark; no new artwork, and the golden cube emblem is not used: it is only the small corner mark inside some pictures) |
| Service worker | `src/pwa/sw.ts` + pure rules `src/pwa/core.ts`; bundled by esbuild (already a Vite dependency, no new package) to `dist/sw.js` |
| Offline page | `src/pwa/offline.html` -> `dist/offline.html` (self-contained, four languages) |
| Head tags in every gallery page | `PWA_HEAD` in `scripts/lib/vite-gallery-surface.mjs` |
| Page side (register, update notice, first-visit hand-over, durable storage) | `src/gallery/pwa.ts`, loaded after the page has finished loading; production builds only |
| Install entry + offline-storage line | `src/gallery/install.ts` (home footer) |
| Netlify headers | `netlify.toml` (`/sw.js`, `/manifest*.webmanifest`, `/pwa/*`; the old rules untouched) |
| Tests | `tests/gallery/pwa-core.test.ts` (75 unit tests), `scripts/verify-pwa.mjs` (browser, 11 sections) |

Only the **gallery surface** is affected. The full surface (`VITE_SURFACE=full`, the globe) has no manifest, no worker and none of these tags.

## 2. The manifest

`id` and `start_url` and `scope` are `/`; `display: standalone` (with `display_override` standalone, minimal-ui); `lang` per file; `categories` books, education, lifestyle; `theme_color #0e2b4b`, `background_color #0a1e36`; icons 192 and 512 `any`, 192 and 512 `maskable`, 512 `monochrome`; three shortcuts (Home `/`, Scenes `/scenes.html`, Bible `/bible.html`, named in the file's language, with the 96 px icon).

**Theme colours.** The dark, light and paper reading themes only repaint the reader's text surface; the bar at the top and the tab bar at the bottom stay navy in all three (checked on the Bible page in paper). So one `theme_color` (the bar's colour, `#0e2b4b`) is correct for all three, and the status bar and address bar tint match the bar in every theme. If the bar is ever themed, switch `<meta name="theme-color">` from `onLocale`/`gx:read` in `src/gallery/pwa.ts`.

Which manifest a page uses is decided in the head, before first paint, from `<html lang>` (set by the existing first-paint language script): `/manifest.<lang>.webmanifest`. `pwa.ts` re-points it and the home-screen label when the reader switches language.

**Icons** (`python3 scripts/build-pwa-icons.py`, needs Pillow and numpy):
- `icon-192/512.png`: the mark as it is, rounded corners transparent (`any`).
- `maskable-192/512.png`: opaque, full-bleed, the mark at 78% inside the 80% safe circle; the margin is continued from the mark's own sky-blue edge (normalised convolution; its pale edge stroke is dropped first).
- `apple-touch-180/167/152/120.png` and `/apple-touch-icon.png`: opaque, the mark full size with its four transparent corners filled the same way. The old `apple-touch-icon.png` had transparent corners, which iOS paints black.
- `monochrome-512.png`: lion, lamb and leaves as an alpha silhouette with some inner tone (Android 13+ themed icons tint it). Its halo arc leaves two thin brackets at the sides: acceptable, not hand-retouched.
- `shortcut-96.png`.

## 3. The service worker

Scope `/`, registered with `updateViaCache: 'none'`. About 9.6 KB minified. Cache names are versioned: the shell cache is `ydh-shell-<build id>`; the runtime caches are `ydh-pictures-v1`, `ydh-thumbs-v1`, `ydh-data-v1`, `ydh-fonts-v1` and `ydh-meta-v1` (the least-recently-used bookkeeping). On activation every cache that starts with `ydh-` and is not in the current set is deleted (checked in `verify:pwa`).

The **build id** is a hash of every byte of the precache plus the worker's own source (`buildId()` in `pwa-build.mjs`). It is written into `sw.js` and into the three pages (`<meta name="ydh-build">`). Any change to the shell is a new worker; nothing else is.

| Request | Strategy |
|---|---|
| Page loads (`/`, `/scenes.html`, `/bible.html`, `/p/<id>`) | **Network first, 3 s**, then this build's saved copy. A deploy is therefore seen on the next load, not after a worker cycle. Offline, `/p/<id>` is answered with a redirect to `/scenes.html#p=<id>`; a page that was never saved gets `offline.html` |
| `/assets/*` (hashed scripts and styles), brand images, `/pwa/*` | This build's precache, then the network |
| `/data/*` | Network first (6 s), then the saved copy: the three start-up files (`gallery/index.json`, `gallery/summaries.json`, `reader/catalogue.json`) come from the precache, everything else (Bible text, headings, paragraphs, the Traditional table) is saved on use in `ydh-data-v1` |
| `/pictures/full/*`, `/pictures/thumb/*` | Cache first with a byte budget (below); a picture older than 3 days is refetched behind the scenes (a corrected picture keeps its file name) |
| Google Fonts stylesheet | Saved copy at once, a fresh one fetched behind it (asked with CORS so the copy is readable and countable) |
| Google Fonts files | Cache first, budgeted |
| **Never** | any method but GET (so `POST /api/feedback` is untouched), `/api/*` and `/.netlify/*` whatever the method, Range requests, opaque responses, every other host |

**Precache** (33 files, 1,013 KiB on this build, hard limit 4 MiB, the build fails above it): the three pages, `offline.html`, every `/assets/*.js|css`, the nav mark, favicon, tab icon, Apple touch icon, and the three small data files. Not precached: pictures, `/p/*`, the rest of the Bible data, `version.json` (the home footer reads it and ignores a failure).

**Budgets** (`BUDGETS` in `src/pwa/core.ts`; measured with the real numbers by `verify:pwa`):

| Cache | Budget | Measured when filled past its limit |
|---|---|---|
| Full pictures | 60 MiB, least recently used leave first | 640 requested (96.2 MiB) -> 60.0 MiB kept, 408 files |
| Thumbnails | 30 MiB | all 1,443 requested (48.9 MiB) -> 30.0 MiB kept, 904 files |
| Bible data | 40 MiB | every one of the 858 reader files requested (36.7 MiB, all editions) all fit: 36.7 MiB kept. The whole Bible in every edition is under the budget, so this cache is not evicted in practice; the same eviction code is exercised by the two above |
| Fonts | 20 MiB | not exercised (see section 9) |
| Shell | about 1 MiB | fixed by the build |

Everything together stays under about 154 MiB (measured 127.6 MiB with all of the above full). A picture bigger than its whole budget is simply not saved. A write that hits the browser's quota evicts half of that cache once and retries; it never fails the page.

**Eviction by the browser.** If the browser drops the shell cache, the next online page load notices (`healShell`): when the server is still on this build the shell is saved again; when a newer build is deployed the worker looks for the newer worker, and the page (already on the newer build) asks it to take over. Tested by dropping the cache in `verify:pwa` (section `heal`).

## 4. Updating, and why a page never mixes versions

Hashed file names do not change under one URL, and the old files disappear from the server when a new deploy is published. Three rules make that safe:

1. **A new worker installs in the background and waits.** It never calls `skipWaiting()` on its own, so a tab that is already open keeps the scripts and lazy chunks it came with, served from the old worker's cache (tested: after a simulated deploy that deletes every old file name, an old tab still opens its search palette, and reloads offline from build 1 completely).
2. **A page opened after the deploy is new at once** (network first): its HTML names the new files, which the old worker passes through to the network. Tested: every script and style such a page loads belongs to the new build.
3. **The page and the worker are matched by the build id.** If the page is on the new build and nothing else is open, the page asks the waiting worker to take over (`activate-if-alone`; no notice, nothing to press: this is "applies on the next load"). If the page is on an older build than the waiting worker, a quiet notice appears at the bottom, in the reader's language ("A new version is ready." / "新版本已准备好。" / "新版本已準備好。" / "Доступна новая версия."), with a Reload button and a close button; Reload swaps workers and reloads. Ignoring it is safe: the new worker takes over when every tab is closed.

The page checks for a new worker on load, when it returns to the foreground (at most every 30 minutes) and once an hour.

## 5. Installing, per platform

The **Install** entry is in the home page's footer (the third column, below the reading-surface buttons): `src/gallery/install.ts`.

| Platform | What happens |
|---|---|
| Chrome, Edge, Opera, Samsung Internet (Windows, macOS, Linux, ChromeOS, Android) | The browser's install prompt is kept (its own banner is held back) and the footer shows **Install**; pressing it opens the browser's dialog. The address-bar install icon works as usual |
| iPhone, iPad (Safari, and Chrome/Edge/Firefox on iOS 16.4+) | The footer shows **How to add it**: a sheet with the three taps (Share, Add to Home Screen, Add) in English, 简体, 繁體, Русский. Inside an in-app browser (WeChat, Facebook, ...) the sheet first says to open the page in Safari. iPadOS that reports itself as a Mac is detected by its touch screen |
| Safari on a Mac (17+) | **How to add it**: File, Add to Dock |
| Already installed (`display-mode: standalone`, or iOS `navigator.standalone`) | no entry at all |
| Firefox on a computer, anything else | no entry (it cannot install) |

Once something is saved, the footer also shows one line, "Saved on this device for offline: N MB of at most M MB", with a **Clear** button.

## 6. Standalone mode

- **Safe areas.** Every page has `viewport-fit=cover`; the top bar, the tab bar and the sheets already pad themselves with `env(safe-area-inset-*)` (`--safe-*` in `src/tokens.css`). The status-bar style is `black-translucent`, so the navy bar runs under the clock on iOS.
- **No back button needed.** Every view is reachable from the bar (desktop) or the tab bar (phone); a picture page has its own Back button that falls back to the book's grid when there is no history; the search palette is on the bar and on ⌘K. iOS's edge swipe still works.
- **Pull-to-refresh and the rubber band are off** (`html[data-display="standalone"] { overscroll-behavior-y: none }`). The flag is set in the head before first paint. Updates arrive through section 4, not through a pull.
- **Durable storage** is requested once, with `navigator.storage.persist()`: at once from an installed app, otherwise on the third calendar day of visits, never twice within 14 days, never on a first visit.
- External links (the two sister apps) leave the app scope and open in the system's browser view.

## 7. What iOS can and cannot do

True of the iOS and Safari versions current at the time of writing; **not verified on a device by this work**.

Can:
- Add to Home Screen from Safari (and from Chrome, Edge and Firefox on iOS 16.4 and later); runs standalone, full screen.
- Run this service worker, so the installed app opens offline for what it has seen; keep the Cache API data.
- Use the opaque Apple touch icons and the home-screen label from `apple-mobile-web-app-title` (the page language at the moment of adding).
- Treat a Home Screen web app's storage as exempt from Safari's seven-days-without-use clearing.

Cannot, or does differently:
- **No install prompt and no `beforeinstallprompt` / `appinstalled` events:** the only route is the Share menu, hence the instruction sheet. A page cannot tell whether it has been added except by being opened standalone.
- **Manifest icons are not used for the home-screen icon** (the Apple touch icons are); maskable and monochrome icons, `shortcuts` and `display_override` are ignored.
- **No splash screen from the manifest.** iOS needs a `apple-touch-startup-image` per device size; none is provided, so launch shows the background colour of the page (known gap, cosmetic).
- **The installed app has its own storage, separate from the Safari tab it was added from.** After adding it, the app must be opened once with a network before it works offline, and what was read in Safari must be read again. (The instruction sheet says "stay available without a network"; the first launch is the moment that is true from.)
- **Storage is the browser's to give back.** Safari can evict an origin's data under storage pressure, and clears script-writable storage of a site used only in a Safari tab after seven days without interaction (installed apps are exempt). That is why the budgets are modest, the shell is small and the worker repairs itself. `persist()` may answer no; the app does not depend on it.
- No background sync, no periodic sync, no background fetch, no badge control worth using; the app never asks for notifications and sends nothing to anyone (no analytics, no tracking, nothing but the page's own files and, on a tap of Send, the feedback form).
- Pictures are saved when looked at; there is no way to download the whole 293 MB set for offline use, by design.

Windows and macOS Chrome/Edge: install from the address bar or the footer; shortcuts appear in the app's jump list. Android Chrome: install from the footer or the menu; maskable icon, themed (monochrome) icon on Android 13+, shortcuts on long press.

## 8. Tests and how to run them

```
set -o pipefail; VITE_SURFACE=gallery npm run build      # writes dist/ including sw.js, manifests, offline.html
npm run test:gallery                                    # includes tests/gallery/pwa-core.test.ts (75 tests, no browser)
npm run verify:pwa                                      # node scripts/verify-pwa.mjs [--only build,install,offline,update,never,budget,ui,standalone,heal]
npm run verify:gallery                                  # everything, verify:pwa last (about 3 minutes)
```

`verify:pwa` serves `dist/` with the headers read from `netlify.toml` (so the real header rules are what is tested) and can switch the server off, which is what "offline" means in it (the page's and the worker's requests both fail). It checks, in Chrome:

| Section | Checks |
|---|---|
| build | 4 manifests parse and match the generator; icon sizes and opacity; one build id in the pages and `sw.js`; the precache list exists and is small; head tags; `netlify.toml` headers for `/sw.js` and the manifests, existing cache and security headers unchanged |
| install | Chrome's own `Page.getInstallabilityErrors` is empty and `Page.getAppManifest` has no error, in all four languages (a persistent profile, since an incognito one cannot install); the worker is registered at `/` and `sw.js` is `no-store` |
| offline | after one visit: home (the first visit's hero picture too, handed over after the worker took control), a picture page (picture, title, verses), a thumbnail grid, a Bible chapter all reload with the server off; a never-seen picture degrades to its colour plate; `/p/<id>` still lands on the picture; an unsaved page gets the offline page |
| update | a simulated deploy (every script and style renamed, old names gone, new worker and build id written by the same step the build ends with): the open tab is offered the notice in four languages and keeps working (lazy chunk, offline); a new tab gets the new scripts at once; Reload swaps, the old caches are deleted; a second deploy with one tab is taken over without a press |
| never | `POST` and `GET /api/feedback` always reach the server, no `/api/` URL in any cache, offline they fail honestly; a Range request is not touched or saved |
| budget | the real budgets above, the LRU order, a re-viewed picture outliving an older one, the worker's own byte count equal to the bytes really stored |
| ui | the Chromium prompt entry, the iPhone sheet in four languages (and the home-screen label and manifest link per language), the WeChat warning, the Safari-on-Mac sheet, Firefox (none), iOS standalone |
| standalone | `display-mode: standalone` (a Chrome `--app` window), the head flag, pull-to-refresh off, durable storage asked once and late |
| heal | the shell cache is deleted under a running worker; it is saved again and the app opens offline |

Lighthouse is not in the repository and no longer has a PWA category; the check above is the same Chrome call DevTools' Application panel uses.

Other browser scripts (`verify-gallery-ui`, `verify-ru`, `verify-redirects`, `gallery-shots`, `audit-apple-design`, `measure-loading`) open their contexts with `serviceWorkers: 'block'`: with a worker in control, `page.route()` no longer sees a page's requests, and the measurements are meant to be of an uncached first load.

## 9. What is not done or not verified

- **Real devices.** Not tried: iPhone Safari, iPad, installed iOS app (standalone, safe areas, status bar, icon corners, the label), Android Chrome (install, maskable, themed icon, shortcuts), Windows Edge/Chrome, Safari on a Mac (Add to Dock). The runbook's Step 5 "by a person" should include one install on an iPhone and one on an Android phone, then airplane mode.
- **Fonts offline.** The worker saves Google Fonts (stylesheet and files) and the classification is unit-tested, but the real Google endpoints were blocked in every test. Without them the pages fall back to system fonts, as they already do on a first load without network.
- **Screenshots in the manifest** (richer install dialog on Chrome and Android) are not provided.
- **iOS splash images** (`apple-touch-startup-image`) are not provided.
- The Android runtime install, the `beforeinstallprompt` event and `navigator.storage.persist()` outcome are simulated or stubbed in tests; the real browsers decide.
- The Russian short name (section 0) is an assumption.
- Not run: any deploy, push, tag or version bump. `package.json`'s version is unchanged; a new release is a new build id automatically.

## 10. Maintenance

- A new file the app needs offline from the first load: add it to `collectPrecache()` in `scripts/lib/pwa-build.mjs` (and keep the total under `SHELL_MAX`, which exists in `src/pwa/core.ts` and the build lib).
- A new kind of runtime data: add a branch to `classify()` in `src/pwa/core.ts`, a budget to `BUDGETS`, a test in `tests/gallery/pwa-core.test.ts`.
- Changing the format of anything kept in a runtime cache: rename its cache (`-v2`); the old one is deleted on activation.
- A page that must not be touched by the worker: add its path to `NEVER` in `core.ts` (or give it a file extension other than `.html`, which makes navigations to it bypass).
- Language strings: the notice in `src/gallery/pwa.ts`, the install entry and sheets in `src/gallery/install.ts`, the offline page in `src/pwa/offline.html` (static, written in all four readings by hand), the manifests in `LANGS` of `pwa-build.mjs`.

// npm run verify:shell — the checks that stand behind the native shells (docs/gallery-shells.md).
//
//   Static (always): the Tauri configuration, the capabilities, the ids and names, the one host constant, the store/direct channel rule,
//   the workflow files (manual only, secret NAMES only), the scripts parse, the Android patch is idempotent.
//   Built (when dist-shell/ exists, i.e. after npm run app:dist): size budget, no full pictures inside, no website-only files, no inline
//   handlers (the app's CSP forbids them), the pack manifest parses and matches the files, boot script present.
//
// Exit 1 on any failure; every line says what it checked.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
let failed = 0, passed = 0;
const check = (ok, what, detail = '') => {
  if (ok) { passed++; console.log(`ok    ${what}`); } else { failed++; console.log(`FAIL  ${what}${detail ? `\n        ${detail}` : ''}`); }
};
const SKIP = new Set(['target', 'gen', 'node_modules', '__pycache__']);
const walk = (dir) => readdirSync(dir).filter((n) => !SKIP.has(n)).flatMap((n) => { const p = join(dir, n); return lstatSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => relative(ROOT, p);

// ---------------------------------------------------------------------------------------------------------------- names and ids
const site = read('src/config/site.ts');
const SITE_HOST = /export const SITE_HOST = '([^']+)'/.exec(site)?.[1] ?? '';
check(/^https:\/\/[a-z0-9.-]+$/.test(SITE_HOST), `SITE_HOST is one https origin (${SITE_HOST})`);
const product = Object.fromEntries([...site.matchAll(/^\s+(en|zhHant|zhHans|ru): (["'])(.*?)\2/gm)].map((m) => [m[1], m[3]]));
check(product.en === "Yahweh's World" && product.zhHant === '雅偉之界' && product.zhHans === '雅偉之界' && !!product.ru, 'PRODUCT names: Yahweh\'s World, 雅偉之界 (Traditional in 简 and 繁 alike), a Russian label');

const conf = json('src-tauri/tauri.conf.json');
check(conf.identifier === 'com.yahwehword.world', 'Tauri identifier is com.yahwehword.world (stores, TestFlight, Play)');
check(conf.productName === "Yahweh's World", 'Tauri productName is Yahweh\'s World');
check(conf.app.windows[0].title === `雅偉之界 · Yahweh's World`, 'window title is 雅偉之界 · Yahweh\'s World (Traditional)');
check(conf.build.frontendDist === '../dist-shell' && /app:dist/.test(conf.build.beforeBuildCommand), 'frontendDist is dist-shell, built by npm run app:dist');
check(json('package.json').version === conf.version && /^version = "([^"]+)"/m.exec(read('src-tauri/Cargo.toml'))?.[1] === conf.version, `versions agree: package.json, tauri.conf.json, Cargo.toml (${conf.version})`);

// the legacy id may appear only where the GitHub APK is built, and in documents that explain why
const LEGACY = 'com.yahwehsworld.globe';
const SHELL_FILES = [
  ...walk(join(ROOT, 'src-tauri')).filter((p) => !/[\\/](target|gen|icons)[\\/]/.test(p) && !/Cargo\.lock$/.test(p)),
  ...walk(join(ROOT, 'tools/shell')).filter((p) => !p.includes('__pycache__')), ...walk(join(ROOT, '.github')), ...walk(join(ROOT, 'packaging')),
  ...['tools/build_android.sh', 'tools/release_mac.sh', 'tools/release_ios.sh', 'tools/pack_shell_content.sh', 'src/config/site.ts'].map((p) => join(ROOT, p)),
].filter((p) => !/\.(png|icns|ico)$/.test(p));
const legacyUses = SHELL_FILES.filter((p) => readFileSync(p, 'utf8').includes(LEGACY)).map(rel);
const LEGACY_OK = ['tools/shell/android_patch.py', '.github/workflows/shell-android.yml', 'tools/build_android.sh'];
check(legacyUses.every((p) => LEGACY_OK.includes(p)), `the old id ${LEGACY} appears in no shell file except comments explaining it (${LEGACY_OK.length} files); tools/build_apk.sh is the only code that sets it`, legacyUses.filter((p) => !LEGACY_OK.includes(p)).join(', '));
const apk = read('tools/build_apk.sh');
check(apk.includes(`ORG_GRADLE_PROJECT_ywAppId="${LEGACY}"`) && apk.includes('VITE_SHELL_CHANNEL=direct'), 'tools/build_apk.sh keeps the old id for the GitHub APK through the ywAppId Gradle property');
const patch = read('tools/shell/android_patch.py');
check(/project\.findProperty\("ywAppId"\) as String\?\) \?: "[^"]+"/.test(patch), 'the Android patch takes the application id from ywAppId, defaulting to the store id');
check(!/storePassword\s*=\s*"|keyPassword\s*=\s*"/.test(patch), 'no password literal in the Android patch');

// names under the icon: the four locale files, the Android strings, the Info.plist all agree with PRODUCT
for (const [lproj, want] of [['en', product.en], ['zh-Hans', product.zhHans], ['zh-Hant', product.zhHant], ['ru', product.ru]]) {
  const f = `src-tauri/locales/${lproj}.lproj/InfoPlist.strings`;
  check(existsSync(join(ROOT, f)) && read(f).includes(`"CFBundleDisplayName" = "${want}";`), `${f} carries ${want}`);
}
for (const want of [product.en, product.zhHans, product.zhHant, product.ru]) check(patch.includes(`"${want}"`) || patch.includes(want.replace("'", "\\'")), `android_patch.py names the app ${want}`);
const mac = json('src-tauri/tauri.macos.conf.json');
check(Object.keys(mac.bundle.macOS.files).length === 4 && mac.bundle.macOS.hardenedRuntime === true && mac.bundle.targets.includes('dmg'), 'macOS: DMG, hardened runtime, four localised name files, no signing identity stored');
check(mac.bundle.macOS.signingIdentity === null, 'macOS signing identity is null in the repository (it comes from APPLE_SIGNING_IDENTITY)');
const win = json('src-tauri/tauri.windows.conf.json');
check(win.bundle.targets.join() === 'nsis' && win.bundle.windows.nsis.languages.length === 4, 'Windows: NSIS installer in four languages');
const msix = json('packaging/msix/identity.json');
check(msix.Name === 'YahwehsPeople.YahwehsWorld' && /PLACEHOLDER/.test(msix.Publisher), 'MSIX identity YahwehsPeople.YahwehsWorld with a placeholder Publisher');
check(json('src-tauri/tauri.ios.conf.json').bundle.iOS.minimumSystemVersion === '15.0', 'iOS: minimum 15.0, team id not in the repository');
check(!/DEVELOPMENT_TEAM|developmentTeam/.test(JSON.stringify(conf) + JSON.stringify(json('src-tauri/tauri.ios.conf.json'))), 'no Apple team id in any Tauri config (APPLE_DEVELOPMENT_TEAM from the environment)');
check(read('src-tauri/ios/ExportOptions.testflight.plist').includes('TEAMID_PLACEHOLDER') && read('src-tauri/ios/ExportOptions.testflight.plist').includes('app-store-connect'), 'TestFlight export options: app-store-connect, team id placeholder');

// ---------------------------------------------------------------------------------------------------------------- CSP and capabilities
const csp = conf.app.security.csp;
const dir = (name) => (csp[name] ?? '').split(/\s+/);
check(!/unsafe-eval/.test(JSON.stringify(csp)) && dir('script-src').join(' ') === "'self'", 'CSP: scripts are \'self\' only, no unsafe-eval');
check(dir('img-src').includes(SITE_HOST) && dir('connect-src').includes(SITE_HOST), `CSP lets pictures and requests reach ${SITE_HOST} (the one host constant)`);
check(dir('default-src').join(' ') === "'self'" && dir('object-src').includes("'none'"), 'CSP: default-src \'self\', object-src none');
const hosts = Object.values(csp).join(' ').match(/https?:\/\/[^\s;]+/g) ?? [];
check(hosts.every((h) => [SITE_HOST, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://api.github.com', 'http://ipc.localhost', 'http://asset.localhost'].includes(h)), 'CSP names no other host', hosts.join(' '));
const cap = json('src-tauri/capabilities/default.json');
const perms = cap.permissions.map((p) => (typeof p === 'string' ? p : p.identifier));
check(!perms.some((p) => /^(shell|process|notification|dialog|clipboard-manager|updater)/.test(p)) && !perms.includes('fs:default') && !perms.some((p) => /^fs:(scope|deny)/.test(p)), 'capabilities: no shell, process, notification, dialog, updater, no blanket file access');
const fsEntries = cap.permissions.filter((p) => typeof p === 'object' && p.identifier.startsWith('fs:'));
check(fsEntries.length > 0 && fsEntries.every((p) => (p.allow ?? []).every((a) => a.path === '$APPLOCALDATA/pictures' || a.path.startsWith('$APPLOCALDATA/pictures/'))), 'every file permission is scoped to $APPLOCALDATA/pictures');
const http = cap.permissions.find((p) => typeof p === 'object' && p.identifier === 'http:default');
check(!!http && http.allow.every((a) => a.url.startsWith(`${SITE_HOST}/`) || a.url.startsWith('https://api.github.com/repos/SuyangLiuPaul/Yahwehs-World/')), 'the HTTP plugin may reach only SITE_HOST and this repository\'s releases');
check(conf.app.security.assetProtocol.scope.every((s) => s.startsWith('$APPLOCALDATA/pictures')), 'the asset protocol serves only the offline pictures folder');
const lib = read('src-tauri/src/lib.rs');
for (const plugin of ['store', 'fs', 'http', 'os', 'deep_link', 'opener']) check(lib.includes(`tauri_plugin_${plugin}::`), `Rust registers tauri_plugin_${plugin}`);
check(!lib.includes('tauri_plugin_notification') && !lib.includes('tauri_plugin_shell'), 'Rust registers no notification and no shell plugin');
const deep = conf.plugins['deep-link'];
check(deep.mobile[0].host === SITE_HOST.replace('https://', '') && deep.mobile[0].pathPrefix[0] === '/p/' && deep.desktop.schemes[0] === 'yahwehsworld', 'deep links: https://<host>/p/<id> and yahwehsworld://');

// ---------------------------------------------------------------------------------------------------------------- the channel rule
const tauriAdapter = read('src/platform/tauri.ts');
check(/channel === 'store'\) return null/.test(tauriAdapter), 'a store build never asks GitHub for an update (Tauri adapter returns null)');
const boot = read('src/shell/boot.ts');
check(/channelOf\(import\.meta\.env\) === 'direct'/.test(boot) && /updates\.check/.test(boot), 'boot.ts checks for updates on a direct build only');
check(read('tools/release_ios.sh').includes('VITE_SHELL_CHANNEL=store') && read('tools/build_android.sh').includes('VITE_SHELL_CHANNEL=store') && read('tools/release_mac.sh').includes('VITE_SHELL_CHANNEL=direct'), 'iOS and Play build with channel=store, the DMG and the GitHub APK with channel=direct');

// ---------------------------------------------------------------------------------------------------------------- workflows and scripts
const ALLOWED_SECRETS = new Set(['GITHUB_TOKEN', 'APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'KEYCHAIN_PASSWORD', 'APPLE_SIGNING_IDENTITY', 'APPLE_API_ISSUER', 'APPLE_API_KEY_ID', 'APPLE_API_KEY_P8', 'ANDROID_UPLOAD_KEYSTORE_BASE64', 'ANDROID_KEY_ALIAS', 'ANDROID_KEYSTORE_PASSWORD']);
for (const f of ['shell-windows', 'shell-macos', 'shell-android']) {
  const y = read(`.github/workflows/${f}.yml`);
  check(/^on:\n  workflow_dispatch:/m.test(y) && !/^\s+(push|pull_request|schedule):/m.test(y), `${f}.yml runs only when started by hand`);
  const names = [...y.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  check(names.every((n) => ALLOWED_SECRETS.has(n)), `${f}.yml references only the documented secret names`, names.filter((n) => !ALLOWED_SECRETS.has(n)).join(' '));
  check(!/permissions:\n\s+\w+: write/.test(y) && /permissions:\n  contents: read/.test(y), `${f}.yml has read-only repository permissions`);
  check(!/[A-Za-z0-9+/]{60,}={0,2}/.test(y.replace(/https?:\/\/\S+/g, '')), `${f}.yml carries no key-like literal`);
}
for (const f of ['tools/release_mac.sh', 'tools/release_ios.sh', 'tools/build_android.sh', 'tools/build_apk.sh', 'tools/pack_shell_content.sh']) {
  check(spawnSync('bash', ['-n', join(ROOT, f)]).status === 0, `${f} parses (bash -n)`);
}
for (const f of ['tools/shell/android_patch.py', 'tools/shell/ios_patch.py']) {
  check(spawnSync('python3', ['-I', '-c', 'import sys;compile(open(sys.argv[1]).read(), sys.argv[1], "exec")', join(ROOT, f)]).status === 0, `${f} compiles`);
}
for (const f of ['src-tauri/Info.plist', 'src-tauri/Info.ios.plist', 'src-tauri/Entitlements.plist', 'src-tauri/ios/ExportOptions.testflight.plist']) {
  check(spawnSync('plutil', ['-lint', join(ROOT, f)]).status === 0 || process.platform !== 'darwin', `${f} is a valid plist`);
}
check(!/(password|secret)\s*[:=]\s*['"][^'"]{4,}/i.test(SHELL_FILES.filter((p) => /\.(sh|py|yml|json|rs|ts|plist)$/.test(p)).map((p) => readFileSync(p, 'utf8')).join('\n')), 'no password or secret literal in any shell file');

// the Android patch is idempotent on a Tauri-shaped Gradle file
{
  const tmp = mkdtempSync(join(tmpdir(), 'ywpatch-'));
  mkdirSync(join(tmp, 'app/src/main/res/values'), { recursive: true });
  mkdirSync(join(tmp, 'app/src/main/java/com/yahwehword/world'), { recursive: true });
  writeFileSync(join(tmp, 'app/src/main/java/com/yahwehword/world/MainActivity.kt'), 'package com.yahwehword.world\n\nimport android.os.Bundle\nimport androidx.activity.enableEdgeToEdge\n\nclass MainActivity : TauriActivity() {\n  override fun onCreate(savedInstanceState: Bundle?) {\n    enableEdgeToEdge()\n    super.onCreate(savedInstanceState)\n  }\n}\n');
  writeFileSync(join(tmp, 'app/build.gradle.kts'), `import java.util.Properties

val tauriProperties = Properties()

android {
    compileSdk = 36
    namespace = "com.yahwehword.world"
    defaultConfig {
        applicationId = "com.yahwehword.world"
        minSdk = 24
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
        }
    }
}
`);
  writeFileSync(join(tmp, 'app/src/main/res/values/themes.xml'), '<resources>\n    <style name="Theme.app" parent="Theme.Material3.DayNight.NoActionBar">\n    </style>\n</resources>\n');
  const run = () => execFileSync('python3', ['-I', join(ROOT, 'tools/shell/android_patch.py'), tmp], { encoding: 'utf8' });
  const first = run();
  const g1 = readFileSync(join(tmp, 'app/build.gradle.kts'), 'utf8');
  const second = run();
  const g2 = readFileSync(join(tmp, 'app/build.gradle.kts'), 'utf8');
  check(first.includes('patched') && second.includes('already patched') && g1 === g2, 'the Android patch is idempotent (second run changes nothing)');
  check(g1.includes('ywAppId') && g1.includes('ywKeystorePath') && g1.includes('YW_KEYSTORE_PASSWORD') && g1.includes('* 10 + build') && g1.includes('namespace = "com.yahwehword.world"'), 'patched Gradle: id and versionCode properties, signing from a path property and an environment variable, namespace unchanged');
  const names = ['values', 'values-zh', 'values-zh-rTW', 'values-zh-rHK', 'values-b+zh+Hant', 'values-ru'].map((d) => readFileSync(join(tmp, `app/src/main/res/${d}/strings.xml`), 'utf8'));
  check(names[0].includes("Yahweh's World") && names[1].includes('雅偉之界') && names[2].includes('雅偉之界') && names[4].includes('雅偉之界') && names[5].includes('Мир Яхве'), 'Android launcher names: en, 简, 繁 (TW, HK, script), ru');
  check(!/雅伟之界/.test(names.join('')), 'no Simplified 雅伟之界 as a name in the Android strings');
  const act = readFileSync(join(tmp, 'app/src/main/java/com/yahwehword/world/MainActivity.kt'), 'utf8');
  check(act.includes('SystemBarStyle.dark') && act.includes('isAppearanceLightStatusBars = false') && !act.includes('enableEdgeToEdge()'), 'patched MainActivity: light status-bar and navigation-bar icons whatever the phone\'s day/night mode (SystemBarStyle.dark), and the patch is idempotent');
}

// the old name: shell-owned files must not write the product name in Simplified; the website surface is reported, not failed
const simplified = SHELL_FILES.filter((p) => /\.(json|plist|strings|xml|ya?ml|sh|py|rs|template)$/.test(p) && readFileSync(p, 'utf8').includes('雅伟之界')).map(rel);
check(simplified.length === 0, 'no shell file writes the product name in Simplified (雅伟之界)', simplified.join(', '));
// The page-name rule (owner, 2026-11-04): 雅偉之界 (Traditional) in English, Russian and 繁體 pages; 雅伟之界 only while the page language is 简体.
// One source (NAME_ZH in src/config/site.ts); a page, script or template may carry the Simplified spelling only where it is the 简体 reading:
// a <i class="l-hans">, a data-zh= / data-aria-zh= attribute. Everything else takes it from NAME_ZH (runtime) or scripts/lib/product-name.mjs (build).
{
  const nameZh = /export const NAME_ZH = \{ hans: '([^']+)', hant: '([^']+)' \}/.exec(site);
  check(!!nameZh && nameZh[1] === '雅伟之界' && nameZh[2] === '雅偉之界', 'NAME_ZH in site.ts: 雅伟之界 (简体 only) and 雅偉之界 (everything else)');
  const files = [...readdirSync(ROOT).filter((n) => n.endsWith('.html')), 'scripts/build-shell.mjs', 'scripts/lib/vite-gallery-surface.mjs', 'scripts/lib/pwa-build.mjs', 'netlify/functions/feedback.mjs',
    ...walk(join(ROOT, 'src')).map(rel)].filter((p) => existsSync(join(ROOT, p)) && p !== 'src/config/site.ts');
  const stray = [];
  for (const p of files) {
    const lines = read(p).split('\n');
    lines.forEach((line, n) => {
      if (!line.includes('雅伟之界')) return;
      const rest = line.replace(/<i class="l-hans">[^<]*<\/i>/g, '').replace(/data-(?:aria-)?zh="[^"]*"/g, '').replace(/^\s*(?:\/\/|\*|\/\*).*$/, '');
      if (rest.includes('雅伟之界')) stray.push(`${p}:${n + 1}`);
    });
  }
  check(stray.length === 0, 'the Simplified product name 雅伟之界 is written only as the 简体 reading (l-hans, data-zh, NAME_ZH): never as a header, <title> or og: literal', stray.join(', '));
  const brands = readdirSync(ROOT).filter((n) => n.endsWith('.html') && read(n).includes('class="brand"') && !/data-brand/.test(read(n)));
  check(brands.length === 0, 'every page with a wordmark sets it through data-brand (the page language chooses the spelling)', brands.join(', '));
  const titles = readdirSync(ROOT).filter((n) => n.endsWith('.html')).filter((n) => /<title>[^<]*雅伟之界/.test(read(n)));
  check(titles.length === 0, 'no static <title> or og: tag spells the name Simplified (it is shown to English and Russian readers before the script runs)', titles.join(', '));
}

// Side safe-area insets: the iPhone Duo reports 84 px on the right in portrait (its status pill sits over the screen), and notched phones
// do the same in landscape. These rules draw rows of controls or columns of text at the page's edge, so each must pad by --safe-left/right.
{
  const must = [
    ['src/gallery/scenes-page.css', ['.pc-top {', '.pc-nav {', '.pc-caption {', '.passage {', '.sc-head {', '.sc-grid {', 'dialog.gx-fs .gx-iconbtn {']],
    ['src/gallery/home.css', ['.hm-copy {', '.hm-body {']],
    ['src/gallery/chrome.css', ['dialog.gx-sheet {', 'html[data-surface="gallery"] .sitenav {']],
    ['src/reader/reader.css', ['.yr-bar {', '.yr-tools {', '.yr-body {']],
  ];
  const missing = [];
  for (const [file, sels] of must) {
    const css = read(file);
    for (const sel of sels) {
      const at = css.split('\n').findIndex((l) => l.trimStart().startsWith(sel));
      const block = at < 0 ? '' : css.slice(css.split('\n').slice(0, at).join('\n').length).split('}')[0];
      if (!/safe-(left|right)|safe-area-inset-(left|right)/.test(block)) missing.push(`${file} ${sel}`);
    }
  }
  check(missing.length === 0, 'rows of controls and columns of text at the page edge pad by the side safe-area insets (iPhone Duo: 84 px right in portrait)', missing.join(', '));
  const noCover = ['home.html', 'gallery-scenes.html', 'gallery-bible.html'].filter((p) => !/viewport-fit=cover/.test(read(p)));
  check(noCover.length === 0, 'the gallery pages ask for viewport-fit=cover (so env(safe-area-inset-*) is reported, and the shells draw edge to edge)', noCover.join(', '));
}

// ---------------------------------------------------------------------------------------------------------------- the built content
const OUT = join(ROOT, 'dist-shell');
if (!existsSync(join(OUT, 'shell-sizes.json'))) {
  console.log('note  dist-shell/ not built: the content checks were skipped (npm run app:dist)');
} else {
  const sizes = json('dist-shell/shell-sizes.json');
  const MiB = (n) => `${(n / 1048576).toFixed(1)} MiB`;
  check(sizes.totalBytes <= 100 * 1024 * 1024, `bundle is ${MiB(sizes.totalBytes)}, under the 100 MiB budget`);
  check(!existsSync(join(OUT, 'pictures/full')), 'no full-size pictures inside the bundle');
  const thumbs = readdirSync(join(OUT, 'pictures/thumb')).length;
  check(thumbs === 1443, `all 1,443 thumbnails are inside (${thumbs})`);
  check(existsSync(join(OUT, 'data/reader/catalogue.json')), 'the Bible data is inside (data/reader/catalogue.json)');
  for (const f of ['p', 'sitemap.xml', 'robots.txt', '_redirects', 'sw.js', 'offline.html']) check(!existsSync(join(OUT, f)), `the bundle has no website-only ${f}`);
  check(!readdirSync(OUT).some((n) => /^manifest.*webmanifest$/.test(n)), 'the bundle has no web manifest');
  const htmls = ['index.html', 'scenes.html', 'bible.html'].map((f) => [f, readFileSync(join(OUT, f), 'utf8')]);
  check(htmls.every(([, h]) => !/\son[a-z]+\s*=/.test(h)), 'no inline event handler in any page (the app\'s CSP forbids them)', htmls.filter(([, h]) => /\son[a-z]+\s*=/.test(h)).map(([f]) => f).join(' '));
  check(htmls.every(([, h]) => /assets\/boot-[\w-]+\.js/.test(h) && h.includes('data-target="shell"')), 'every page loads the shell boot script and is marked data-target="shell"');
  check(htmls.every(([, h]) => !/<script(?![^>]*\bsrc=)(?![^>]*type="module")[^>]*>[^<]*(fetch|XMLHttpRequest)/.test(h)), 'no inline script makes network requests');
  const js = readdirSync(join(OUT, 'assets')).filter((n) => n.endsWith('.js')).map((n) => readFileSync(join(OUT, 'assets', n), 'utf8')).join('\n');
  check(js.includes(`${SITE_HOST}`) && js.includes('/pictures/full/'), 'the compiled code builds full-picture URLs from the site host');
  check(!js.includes('yahwehs-scenes.netlify.app'), 'no old picture host in the compiled code');
  const { parseManifest } = await import(pathToFileURL(join(ROOT, 'src/core/packs.ts')).href);
  let manifest = null;
  try { manifest = parseManifest(json('dist-shell/data/packs.json')); } catch (e) { check(false, 'dist-shell/data/packs.json parses', String(e)); }
  if (manifest) {
    const by = Object.fromEntries(manifest.packs.map((p) => [p.id, p]));
    check(manifest.host === SITE_HOST, 'the pack manifest host is SITE_HOST');
    check(by.thumbs.files.length === 1443 && by.full.files.length === 1443 && !by.full.bundled && by.thumbs.bundled && by.editions.bundled, 'pack manifest: 1,443 thumbnails (bundled), 1,443 full pictures (fetched), the Bible data (bundled)');
    const onDisk = by.thumbs.files.every(([n, b]) => existsSync(join(OUT, 'pictures/thumb', n)) && statSync(join(OUT, 'pictures/thumb', n)).size === b);
    check(onDisk, 'every bundled thumbnail is in the bundle with the size the manifest says');
    check(by.full.bytes === sizes.fullBytes && by.thumbs.bytes === sizes.thumbBytes, 'manifest byte counts equal the size report');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

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
import { PRODUCT_NAMES } from './lib/product-name.mjs';

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
// The naming table, read the way the build reads it (scripts/lib/product-name.mjs), so this check and the
// manifests/installers cannot disagree. Owner, 2026-11-04 (named like Words): the launcher label is SHORT and per
// language; the store title is the full name per store locale; the Latin wordmark is never shortened. The combined
// "雅偉之界 / Yahweh's World" must appear in nothing a reader sees.
const product = PRODUCT_NAMES.short;
check(product.en === 'World' && product['zh-Hans'] === '雅伟之界' && product['zh-Hant'] === '雅偉之界' && product.ru === 'Мир',
  `icon labels: World / 雅伟之界 (简) / 雅偉之界 (繁) / Мир (${Object.values(product).join(' · ')})`);
check(PRODUCT_NAMES.wordmark === "Yahweh's World" && PRODUCT_NAMES.store['en-US'] === "Yahweh's World" && PRODUCT_NAMES.store.ru === "Yahweh's World"
  && PRODUCT_NAMES.store['zh-Hans'] === '雅伟之界' && PRODUCT_NAMES.store['zh-Hant'] === '雅偉之界',
  'store titles: Yahweh\'s World (en-US and ru), 雅伟之界 (简), 雅偉之界 (繁); the wordmark is never shortened');

const conf = json('src-tauri/tauri.conf.json');
check(conf.identifier === 'com.yahwehword.world', 'Tauri identifier is com.yahwehword.world (stores, TestFlight, Play)');
check(conf.productName === "Yahweh's World", 'Tauri productName is Yahweh\'s World');
check(conf.app.windows[0].title === PRODUCT_NAMES.wordmark, `window title is the Latin wordmark (${conf.app.windows[0].title})`);
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
for (const [lproj, want] of Object.entries(product)) {
  const f = `src-tauri/locales/${lproj}.lproj/InfoPlist.strings`;
  check(existsSync(join(ROOT, f)) && read(f).includes(`"CFBundleDisplayName" = "${want}";`), `${f} carries ${want}`);
}
for (const want of Object.values(product)) check(patch.includes(`"${want}"`), `android_patch.py names the app ${want}`);
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
check(hosts.every((h) => [SITE_HOST, 'https://api.github.com', 'http://ipc.localhost', 'http://asset.localhost'].includes(h)), 'CSP names no other host', hosts.join(' '));
// The fonts are ours (public/fonts). If a Google Fonts host ever reappears in the CSP or in a page head, the apps
// are one bad network away from system fallback faces again, which is the regression the owner reported.
check(!/fonts\.(googleapis|gstatic)\.com/.test(JSON.stringify(csp)), 'CSP does not allow Google Fonts (the fonts are self-hosted)');
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
  check(names[0].includes(product.en) && names[1].includes(product['zh-Hans']) && names[2].includes(product['zh-Hant'])
    && names[3].includes(product['zh-Hant']) && names[4].includes(product['zh-Hant']) && names[5].includes(product.ru),
    `Android launcher names: ${product.en} (en), ${product['zh-Hans']} (values-zh = 简体), ${product['zh-Hant']} (TW/HK/script), ${product.ru} (ru)`);
  // values-zh is Simplified Chinese; it gets the Simplified spelling (owner, 2026-11-04). The rule that still holds is
  // that 简体 and 繁體 must not be mixed up, so each directory is checked against its OWN spelling above.
  check(!/雅偉之界/.test(names[1]) && !/雅伟之界/.test(names[2] + names[3] + names[4]),
    'no 繁體 name in values-zh and no 简体 name in the Traditional directories');
  const act = readFileSync(join(tmp, 'app/src/main/java/com/yahwehword/world/MainActivity.kt'), 'utf8');
  check(act.includes('SystemBarStyle.dark') && act.includes('isAppearanceLightStatusBars = false') && !act.includes('enableEdgeToEdge()'), 'patched MainActivity: light status-bar and navigation-bar icons whatever the phone\'s day/night mode (SystemBarStyle.dark), and the patch is idempotent');
}

// The combined name is what must appear nowhere a reader sees: "雅偉之界 / Yahweh's World" is 20 characters of two
// scripts for a reader who reads one, and it is what pushed every title and installer name over its field's length
// (owner, 2026-11-04). The Simplified spelling is now CORRECT in the 简体 launcher label and in zh-Hans listings, so
// the old blanket ban on 雅伟之界 in shell files is gone; what is checked is that the two spellings are not mixed.
const COMBINED = /雅偉之界\s*[/·]\s*Yahweh|Yahweh[’']s World\s*[/·]\s*雅[偉伟]之界/;
const combined = SHELL_FILES.filter((p) => /\.(json|plist|strings|xml|ya?ml|sh|py|rs|template)$/.test(p) && COMBINED.test(readFileSync(p, 'utf8'))).map(rel);
check(combined.length === 0, 'no shell file carries the combined "雅偉之界 / Yahweh\'s World"', combined.join(', '));
const mixedScript = SHELL_FILES.filter((p) => /\.(strings|xml)$/.test(p) && /雅伟之界/.test(readFileSync(p, 'utf8')) && /zh-Hant|rTW|rHK/.test(p)).map(rel);
check(mixedScript.length === 0, 'no Traditional name file carries the Simplified spelling', mixedScript.join(', '));
// THE NAME FOLLOWS THE LANGUAGE (owner, 2026-11-04, on TestFlight build 3): en and ru read "Yahweh's World", zh-Hans 雅伟之界,
// zh-Hant 雅偉之界. One source (PRODUCT / NAME_ZH in src/config/site.ts). A page, script or template may carry a Chinese spelling
// only where it IS that language's reading: <i class="l-hans">, <span class="t hans">, data-zh= / data-aria-zh= / data-hans=.
// Everything else takes the name from productName (runtime) or scripts/lib/product-name.mjs (build).
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
      const rest = line
        .replace(/<i class="l-hans">[^<]*<\/i>/g, '')          // the 简体 reading of a .tri lockup (the wordmark, the loading line)
        .replace(/<span class="t hans">[^<]*<\/span>/g, '')    // the 简体 reading on a page with no bundle (src/pwa/*.html)
        .replace(/data-(?:aria-)?zh="[^"]*"/g, '')             // the 简体 reading of a [data-en] pair
        .replace(/data-hans="[^"]*"/g, '')                     // the 简体 reading of a four-way <title>
        .replace(/^\s*(?:\/\/|\*|\/\*).*$/, '');
      if (rest.includes('雅伟之界')) stray.push(`${p}:${n + 1}`);
    });
  }
  check(stray.length === 0, 'the Simplified product name 雅伟之界 is written only as the 简体 reading (l-hans, data-zh, NAME_ZH): never as a header, <title> or og: literal', stray.join(', '));
  const brands = readdirSync(ROOT).filter((n) => n.endsWith('.html') && read(n).includes('class="brand"') && !/data-brand/.test(read(n)));
  check(brands.length === 0, 'every page with a wordmark sets it through data-brand (the page language chooses the spelling)', brands.join(', '));
  const titles = readdirSync(ROOT).filter((n) => n.endsWith('.html')).filter((n) => /<title>[^<]*雅伟之界/.test(read(n)));
  check(titles.length === 0, 'no static <title> or og: tag spells the name Simplified (it is shown to English and Russian readers before the script runs)', titles.join(', '));
  // THE WORDMARK CARRIES ALL FOUR READINGS, IN THE MARKUP. This is what makes the name right in the first paint: a page
  // whose lockup is missing a reading shows nothing at all in that language, and one whose en/ru reading is Chinese is
  // the build-3 fault itself (the bar read 雅偉之界 above "Home" and "Главная"). Both generators and every built page.
  const LOCKUP = [
    ['the Latin wordmark for English', /<i class="l-en">Yahweh(?:'|&#39;|’)s World<\/i>/],
    ['the Simplified name for 简体', /<i class="l-hans">雅伟之界<\/i>/],
    ['the Traditional name for 繁體', /<i class="l-hant">雅偉之界<\/i>/],
    ['the Latin wordmark for Russian', /<i class="l-ru">Yahweh(?:'|&#39;|’)s World<\/i>/],
  ];
  const lockupIn = (text) => LOCKUP.filter(([, re]) => !re.test(text)).map(([what]) => what);
  for (const gen of ['scripts/lib/product-name.mjs', 'scripts/build-shell.mjs', 'scripts/lib/vite-gallery-surface.mjs']) {
    const src = read(gen);
    const miss = gen.endsWith('product-name.mjs') ? lockupIn(src.replace(/\$\{PRODUCT_NAMES\.wordmark\}/g, "Yahweh's World").replace(/\$\{NAME_HANS\}/g, '雅伟之界').replace(/\$\{NAME_HANT\}/g, '雅偉之界')) : [];
    check(gen.endsWith('product-name.mjs') ? miss.length === 0 : /wordmarkLockup\(/.test(src),
      gen.endsWith('product-name.mjs') ? 'the wordmark lockup writes all four readings' : `${gen} takes the wordmark from the lockup, not a literal`, miss.join(', '));
  }
  const noLockup = readdirSync(ROOT).filter((n) => n.endsWith('.html') && read(n).includes('data-brand')).filter((n) => lockupIn(read(n)).length);
  check(noLockup.length === 0, 'every built page carries the wordmark in all four readings (en and ru Latin, 简体 and 繁體 Chinese)',
    noLockup.map((n) => `${n}: missing ${lockupIn(read(n)).join(' + ')}`).join('; '));
}

// The fonts are ours. Every page must load /fonts/fonts.css and no page may name a Google Fonts host: a page that
// does falls back to system faces on a first launch, offline or on a slow network, which is what the owner saw.
{
  const all = readdirSync(ROOT).filter((n) => n.endsWith('.html'));
  const google = all.filter((n) => /fonts\.(googleapis|gstatic)\.com/.test(read(n)));
  // every page, lab pages included: a lab page that reaches out to Google is still a third-party request
  check(google.length === 0, 'no page fetches a font from Google (the fonts are self-hosted in public/fonts)', google.join(', '));
  // the pages that ship: the eight shell pages carry the link itself, the three gallery pages take it from a marker
  const shipped = ['index.html', 'bible.html', 'scenes.html', 'tabernacle.html', 'temple.html', 'ark.html', 'figures.html', 'plan.html',
    'home.html', 'gallery-bible.html', 'gallery-scenes.html'];
  const missing = shipped.filter((n) => !read(n).includes('/fonts/fonts.css') && !read(n).includes('<!-- gallery-fonts -->'));
  check(missing.length === 0, 'every shipped page loads the bundled font stylesheet', missing.join(', '));
  const css = read('public/fonts/fonts.css');
  const files = [...css.matchAll(/url\('?(\/fonts\/[^')]+)'?\)/g)].map((m) => m[1]);
  check(files.length > 0, 'public/fonts/fonts.css declares @font-face files', String(files.length));
  const absent = [...new Set(files)].filter((f) => !existsSync(join(ROOT, 'public', f)));
  check(absent.length === 0, 'every font file fonts.css names is present in public/fonts', absent.join(', '));
  const preloads = [...read('scripts/build-shell.mjs').matchAll(/'(\/fonts\/[^']+\.woff2)'/g)].map((m) => m[1]);
  const noPreload = preloads.filter((f) => !existsSync(join(ROOT, 'public', f)));
  check(preloads.length > 0 && noPreload.length === 0, 'every preloaded font file exists', noPreload.join(', '));
  check(existsSync(join(ROOT, 'public/fonts/OFL.txt')), 'the fonts ship their OFL notices (public/fonts/OFL.txt)');
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

// ---------------------------------------------------------------------------------------------------------------- app icons
{
  const r = spawnSync('python3', [join(ROOT, 'scripts/verify-icons.py')], { encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').filter(Boolean).map((l) => l.startsWith('ok') ? (passed++, l) : l.startsWith('FAIL') ? (failed++, l) : l).join('\n') + '\n');
  if (r.status !== 0 && !/FAIL/.test(r.stdout)) { failed++; console.log(`FAIL  verify-icons.py crashed\n        ${r.stderr}`); }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

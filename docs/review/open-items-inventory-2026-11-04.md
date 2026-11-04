# 雅偉之界 / Yahweh's World 1.0.0 - inventory of everything still open (2026-11-04)

Read-only inventory for Paul. Repo `/Volumes/androidbuild/globe-shell`, branch `gallery/shell-1`, HEAD `c3f01ae` (350 commits). Nothing was edited, built, deployed or committed. The Fable handoff docs in `/Users/pliu0036/Documents/CodingProject/yahwehs-globe/handoff/` were read only (`fable-gallery-all-platforms`, `fable-gallery-release`, `fable-redesign`, `fable-rulings-apple-design`); that working tree was not touched. Statuses come from reading and grepping the code and `git log`, plus GET-only `curl` against the live site; no test, build or npm script was run (one read-only script, `node scripts/audit-zh-hant.mjs`, was run by a reader).

Owner rule applied: everything open ships in 1.0.0; nothing is deferred. Plan items the owner later dropped or changed are listed as OBSOLETE with the ruling, not as work. Two readers covered two slices; their full tables are appendices E and F (fields: ID/title, plan or audit reference, verified status with evidence, class, effort, dependencies, platforms, church-rule flag).

## 1. Headline findings

1. **The live site is not the repo.** `https://world.yahwehword.com` serves build `c567591e3cdc` (version.json says 1.0.0); local `dist/` is `796ed53e016b`. Production still loads fonts from Google, shows Netlify's stock 404 page, returns 404 for `/privacy.html` and `/privacy`, and has no `/.well-known/*`. So every fix below marked DONE is done in code only, and one web release (`tools/release_web.sh`, only on the owner's word 「release」) is the precondition for the privacy URL that every store form needs, the 404 page, Google-free fonts for the PWA, app links and Search Console. Full pictures are live (200 image/webp), so the audit's "shell shows no picture" cause is gone.
2. **The gap audit is mostly closed.** Of its 38 findings (7 P0, 15 P1, 16 P2), 29 are DONE in code with evidence, 1 partly, 4 open, 1 obsolete (P1-2, the product name now follows the page language by the owner's 2026-11-04 ruling), 3 need eyes. What is open from it: shells' offline first screen, offline pictures (P1-5), sheet origin (P2-1), caption/plate fit (P2-11), evidence shots (P2-16).
3. **The build-4 backlog is almost entirely undone.** Nav order Home - Bible - Scenes is NOT changed (`scripts/lib/vite-gallery-surface.mjs:76-80` is still home, scenes, bible; also the 404/offline/privacy pages, manifest shortcuts, verify scripts). The Chinese reading text is still serif (`--yr-read` starts with Spectral and Noto Serif; Latin inside Chinese is Spectral, not Inter; no rule puts the CJK face first for curly quotes). TestFlight build 3 predates the per-language-name rule and the iPad two-column layout, so a build 4 is needed.
4. **Offline pictures are removed, with no mock-up or spec to rebuild from.** The sheet was deleted on purpose (`8c55ab8`, "out until it is real"). Neither Fable mock-up contains it; the only requirements text is in the all-platforms plan (§2.1, §6.1 A3, §12.7). The PWA doc says "no download-all, by design", which contradicts the plan, and `scripts/verify-shell-ui.mjs` now asserts the entry is absent. Worse, **the store text in all 12 listings promises "Pictures you have opened keep working without a connection"**, but in the native shells nothing caches a full picture (no service worker; `src/core/packs.ts` only reads packs nobody can create), and when a full picture fails the plate stays an empty mat without falling back to the bundled thumbnail.
5. **The 3D-extensibility promise is mostly unbuilt.** Built: platform layer, pack manager, build flag `VITE_SURFACE`. Not built: feature registry, `surfaces.json`, `src/render/createRenderer()`, device classes and budgets, remote flags `/config/flags.json`, registry-driven harness and import-graph guard tests. `src/features/types.ts` is an orphan interface.
6. **Windows is much further behind than the docs read.** No Windows build has ever been made; the CI workflow `shell-windows.yml` has never run; `packaging/msix/identity.json` Publisher is `CN=PLACEHOLDER-...` and the workflow throws on it; the MSIX manifest template is untested, with English-only DisplayName and no localized resources. The notarised macOS DMG and the GitHub APK 1.0.0 (old package id, old release key) are not built either. The signed Play AAB (152.7 MB, `dist-app/YahwehsWorld-1.0.0-play.aab`) exists but there is no record of a Play app record or upload.
7. **Three live Chinese captions say 神性** (`micah-7-1`, `matthew-17-1`, `mark-9-1`, `public/data/gallery/summaries.json`). 神性 is on Fable's banned list and in `tests/reader/wording.test.ts`, but `scripts/verify-gallery.mjs` BANNED.zh does not list it, so the gate is green. 126 English summaries are also over the plan's 20-word limit.
8. **Store paperwork is mostly not prepared**: no age-rating answers, Play Data safety, Apple nutrition labels, review notes, Play content declarations, Windows `runFullTrust` justification, copyright line, category, or China-availability decision exist anywhere in the repo. Listing text exists in 4 languages for all three stores; screenshots are not store-ready (the 17 images in `docs/evidence/shell-2026-11/` are test evidence, untracked in git, and pre-date build 4). The build volume `/Volumes/androidbuild` is 99 percent full (1.9 GiB free of 150), which blocks simulator builds and every screenshot.
9. **Simplified characters in Traditional strings are fixed** (`audit-zh-hant.mjs`: 0 leftovers in 11,031 strings; store zh-Hant fields clean). The variant forms found in the Bible text (悦, 脱, 羣, ...) are historic Traditional forms in Words' pinned bytes, not leaks; do not "fix" them here.
10. **Two Fable rulings were reversed by later commits and need the owner's confirmation**: the reading surface now paints home and gallery too (`fa920c3`, reverses "home stays dark"), and the owner's nav order change is still to do and reverses Fable's 首页 · 画卷 · 圣经.

## 2. Counts

| Slice | Source | Rows | Status |
|---|---|---|---|
| E | Fable plans and shell/PWA/runbook docs vs code | 46 open rows (27 NOT SHIPPED, 11 PARTLY, 8 UNVERIFIED), 13 OBSOLETE / deliberately changed, 38 SHIPPED ids | Primary class of the 46: A 21, B 4, C 16, D 5 |
| F | Gap audit (38), build-4 backlog (11), 7 new findings, store fields | 56 rows in Part 1 (audit 38: DONE 29, PARTLY 1, OPEN 4, OBSOLETE 1, UNVERIFIED 3; backlog 11: DONE 1, PARTLY 2, OPEN 6, UNVERIFIED 2; new 7 OPEN) plus about 45 store-field rows (ST-ALL 12, ST-APPLE 13, ST-PLAY 13, ST-MS 6, ST-WEB 6) | Open or partial in Part 1: about 12 class A, 6 D, 3 B, 6 C |

De-duplicated estimate: about 95 distinct open or partial items (E's 46 plus about 13 new from F's Part 1 plus about 35 new store-field rows; overlaps are nav order, type, offline pictures, release, app links, name, screenshots, privacy). By class roughly A 30 percent, B 16 percent, C 38 percent, D 16 percent. Class D items become A after a mock-up or ruling.

Class definitions: A doable by code now; B needs content or wording (church rules, translation, pastor review), drafts possible; C needs the owner or a third party (store consoles, accounts, licences, device-only tests); D needs a design decision or mock-up first.

## 3. What the Fable plan promised that is not shipped (index; details in appendix E)

| ID | Promise | Status | Class / Effort |
|---|---|---|---|
| FP-A-OFF1 | Offline-pictures sheet (byte-accurate choices, `storage.estimate()`, progress, cancel, "may be cleared" line, one sheet for all packs) | removed; no mock-up | D then B then A / L |
| FP-A-EXT5 | Versioned `packs.json` for web and generic packs sheet | shells only; live `/data/packs.json` 404 | A / M (needs OFF1) |
| FP-A-WIN1 | Windows NSIS installer and portable zip | never built; CI never run | C then A / M |
| FP-A-WIN2 | Windows MSIX and Partner Center identity | placeholder Publisher; manifest untested | C+A / M |
| FP-A-WIN3 | Code signing or an explicit "unsigned for 1.0.0" decision | not wired | C/D / S |
| FP-A-MAC1 | Developer-ID notarised universal DMG | script written, never run; x86_64 slice never built | C / M |
| FP-A-AND1 | Play app record, AAB upload, Play App Signing SHA | AAB built; no upload on record | C / S |
| FP-A-AND2 | GitHub APK under old id `com.yahwehsworld.globe` with the old release key | not built | C / S |
| FP-A-SHOT1 | Store screenshots per platform and locale | none store-ready; iPhone 6.9", iPad 13", Mac, Windows, Play 7"/10" tablet missing | A+B+C / M |
| FP-A-ART1 | Play feature graphic 1024x500, Play icon 512, Microsoft tiles | missing | D then A / S |
| FP-A-PRIV1 | Privacy labels, Data safety, age ratings, content declarations, privacy URL field | not prepared | B+C / S |
| FP-A-REV1 | Review notes ("why it is not a web clip") and TestFlight "what to test" | not written | B / S |
| FP-A-DYN1 | System text size honoured (`-apple-system-body`, Android text zoom) | only browser zoom verified | A / M |
| FP-A-SHR1 | Native share sheet in shells | falls back to Web Share or copying the link | A / M |
| FP-A-PERF1 | Per-platform budgets measured, `?perf=1` probe, `docs/evidence/gallery-2026-11/platforms.md` | file absent; only web numbers | A+C / M |
| FP-A-EXT1..4 | Feature registry + `surfaces.json`; `render/` + device classes + budgets; remote flags; shared harness and guard tests | absent (orphan type only) | A / M, L, S, M |
| FP-A-LNK1 | Universal links / App Links site side | client side done; no AASA, no assetlinks (needs Play App Signing SHA) | A+C / S |
| FP-A-NAME1 | Per-language product name everywhere | web/PWA, iOS, macOS, Android done; Tauri `productName` / window title and MSIX names Latin only | D then A / S |
| FP-A-PWA2 | PWA manifest `screenshots`, iOS splash images | not provided | A / S |
| FP-A-DEV1 | Add-to-Home-Screen and airplane-mode checks, VoiceOver, TalkBack, iOS copy/paste, Mac Dock, Windows Edge | none recorded | C / M |
| FP-A-TERMS1 | Check that the image service's terms cover distribution in store apps | no record | C / S |
| FP-A-SIZE1 | App size at most 100 MB on every shell | content 87.8 MiB OK; Play AAB 152.7 MB (two ABIs) | A / M |
| FP-A-UPD1 | Update toast on direct-download builds (wording is a stub) | stub | B / S |
| FP-R-LANG1 | Ten beta languages (id, es, pt-BR, fr, de, it, ko, ja, th, vi) and `src/i18n/*.json` | not started; no ruling cut it | D then B / L |
| FP-R-STILL1 | "写实" realistic stills as a second plate | no code | D / M |
| FP-R-CAP1 | Caption checks (word/char limits, full banned lists) | 3 captions say 神性; 126 summaries too long | A+B / S |
| FP-R-CAP2 | OpenGraph card with title and reference on the plate | `og:image` is the bare plate | A / S |
| FP-R-HANT1 | zh-Hant as an authored pack with reviewed diff | OpenCC table plus repairs, 0 leftovers; no reviewed pack | B / M |
| FP-R-RUREAD | Russian read by a native speaker | notice shipped; no reader named | C / S |
| FP-D-NAV1 | Nav order Home - Bible - Scenes | not changed | A / S |
| FP-D-TYPE1 | Build-4 type findings (YaHei-like sans, CJK quotes, hero kicker contrast, fonts in the iOS shell, chip pairing) | not done | A (+D taste) / M |
| FP-D-A11Y1 | 10 distinct font sizes on Bible page (plan at most 7), 2 targets under 44 px, hit-test thefts | no re-run since | A / S |
| FP-R-REL1 / REL2 | Deploy HEAD to dev then prod; env vars; one real feedback mail; Search Console; tag; retire old host | not executed | C / S |
| FP-R-DOC1, FP-R-L7 | Runbook drift (sitemap 1446 vs 1447; Mac App Store route); `language_state` bookkeeping | open | A / S |
| FP-A-A11Y2 | Search resolves "大马色" test | not asserted | A / S |
| FP-A-BG1 | Words/Sword deep links into the globe still resolve | not recorded | A / S |
| FP-A-IOS1, FP-A-MAS1, FP-S-ENV1, FP-S-REC1, FP-A-IPAD1 | TestFlight builds processed? Mac pkg uploaded? Resend variables set? Play and Partner Center records exist? iPad look at build 4 | unverified | C / S |

Obsolete or changed (do not build): church packs and 21 editions (eight only), "public domain" Union Version credit, combined brand name, five-slot phone bar, the globe-era redesign stage A, globe interactions, merged bilingual pictures, 60/300/50 MiB SW budgets, immutable picture caching, `localhost` origin, `yahwehsworld://packs`, Capacitor fallback, Tauri updater, and the wrong "Continue in Words" route (corrected and built).

## 4. Store readiness by store

Common: free, no ads, no account, no analytics; the only data leaving the device is the optional feedback note (mail through Resend) and a salted-hash per-IP counter. Listing text exists for en, zh-Hans, zh-Hant, ru in `docs/store-listing/world-1.0.0.{md,json}` (Apple 6 fields, Play 3, Microsoft 4 plus 3 features; limits checked); machine-written Russian has never been read by a native speaker.

| Field | Apple (iOS, iPadOS, macOS) | Google Play | Microsoft Store |
|---|---|---|---|
| Records / signing | ASC app 6830164556; cert V6D4VV2K24, Mac installer 5733XK5344, profiles 495RSHVC2W / GPHFL27772; iOS builds 1-3 uploaded; Mac pkg b1-b3 built (upload unverified); build 4 pending | Upload key made; AAB built; **app record not created, nothing uploaded** | Name not reserved; identity Publisher placeholder |
| Listing text 4 languages | present; Russian name inconsistent (three names) | present (30/80/4000 respected) | present |
| Screenshots | missing: iPhone 6.9" 1320x2868, iPad 13" 2064x2752, Mac 16:10; per locale | phone: 3 old emulator shots; 7" and 10" tablet none | none (Windows never built) |
| Icon / graphics | 1024 opaque Lion and Lamb OK | 512 not exported; **feature graphic 1024x500 missing** | tile sizes 300 and 150 to check |
| Privacy policy URL | page written (4 languages) but **404 on prod**; field absent in listing doc | same | same |
| Age rating / content | not prepared (expect Apple 9+/12+, IARC 12+; realistic-style biblical violence infrequent/mild) | IARC not prepared; target audience, ads (none), app access (none), AI-generated-content declaration (no generative feature) not prepared | IARC not prepared |
| Data declarations | nutrition labels not prepared (optional e-mail and free-text feedback, not tracking, none linked) | Data safety not prepared | privacy answers not prepared |
| Review notes | missing (no sign-in; Bible text and thumbnails inside app; full pictures from the site; feedback sends mail) | n/a | `runFullTrust` justification text missing |
| Export compliance | done in plists (`ITSAppUsesNonExemptEncryption=false`) | n/a | n/a |
| Category | plist says Education; no console value chosen (suggest Reference / Books & Reference) | not recorded | not recorded |
| China availability | repo silent; untick mainland China (ICP and permits) | Play not available there | untick China |
| Copyright / publisher line | three spellings: "Yahweh's People", "Yahweh De Hua Ministry", 雅偉的話事工 - one needed | developer name | Publisher display name |
| Support / marketing URL | both site root; contact address shown only on the privacy page | contact support@yahwehword.com exists | same |
| App links | AASA missing (`public/.well-known/apple-app-site-association`, appID `YC5JZD3DY7.com.yahwehword.world`, `/p/*`) | `assetlinks.json` needs the Play App Signing SHA-256 (not the upload SHA 49:C2:41:EB...) | n/a |
| Testing gate | TestFlight internal | 12 testers x 14 days closed test before production | none |
| AI-image disclosure | present in all 12 descriptions and under every picture; Apple has no AI-image label; Google/Microsoft: answer "no generative feature" and check the Microsoft generative-AI item | | |
| Union Version credit in store text | descriptions never print "© 雅偉的話事工 · 經授權使用" (in-app wording is right everywhere) - consider adding | | |

Web/PWA: manifests x4, icons, shortcuts, service worker, offline.html, 404.html, sitemap (1,446 listed, build now emits 1,447) are in `dist/` and verified by `verify:pwa`; not live. The privacy link exists only on the home page footer (Scenes and Bible pages have none). Search Console submission, Resend env vars (`RESEND_API_KEY`, `FEEDBACK_TO`), one real feedback mail, and retirement of `yahwehs-scenes.netlify.app` (after 24 h clean logs) remain.

## 5. Work batches

Order matters: store screenshots must come after nav order and type changes, and everything that needs a live site waits for the release. Effort is rough agent time (S under 1 h, M a few hours, L a day or more).

**Batch W1 - Build-4 code batch. Effort L (about 10 h).**
Files: `scripts/lib/vite-gallery-surface.mjs`, `src/pwa/*.html`, `src/gallery/*`, `src/reader/*.css`, `public/fonts`, `tools/subset-fonts.sh`, `scripts/verify-*.mjs`, `public/data/gallery/summaries.json`, `tests/*`.
Items: FP-D-NAV1 / B4-1 (reorder to Home - Bible - Scenes everywhere: tab bar, top bar, 404/offline/privacy, manifest shortcuts, verify scripts, docs; flag the reversal of Fable), FP-D-TYPE1 / B4-10 / B4-5 / B4-6 / B4-9 / B4-7 (Chinese sans reading text, Latin in Chinese as Inter, weights 500/700, CJK face first for quotes and dashes, hero kicker contrast check in all four surfaces, chip pairing; the serif Bible subsets must leave in the same change to stay under the cap) (D for taste: show the owner one chapter first), B4-4 (dist 300.0 MiB cap), FP-R-CAP1 (rewrite the 3 captions with 神性, extend BANNED.zh from the term sheets, add word/char limit checks, review the 126 long English summaries), N-2 (fall back to the bundled thumbnail and a message when a full picture fails), FP-A-DYN1 (system text size), FP-D-A11Y1 (re-run the audit; fix font-size count, 44 px targets, hit-test thefts), ST-WEB-3 (privacy link on Scenes and Bible pages), P2-14 / P2-15 / P2-2 checks, FP-A-A11Y2 test, N-4 / FP-R-DOC1 docs drift, FP-A-BG1 grep, N-5 (track the evidence folder and backlog in git: owner decides when to commit), ST-ALL-9 (contact line), AASA file (N-8, FP-A-LNK1 site side).
Depends on: owner confirms the nav reversal and the paper-surface reversal; free disk space for rebuilds.

**Batch W2 - Store paperwork drafts. Effort M (about 4 h).**
Files: `docs/store-listing/*`, `docs/store/privacy-labels-world.md` (new).
Items: FP-A-PRIV1 (age-rating answers, Apple nutrition labels, Play Data safety, Play content and target-audience declarations, Microsoft privacy answers: all draftable from the privacy page), FP-A-REV1 (Apple review notes, TestFlight what-to-test, Microsoft `runFullTrust` justification), ST-ALL-1 (add the Privacy Policy URL field to all three listings), ST-ALL-3 (AI-disclosure wording check), ST-ALL-4 (copyright line), ST-ALL-5 (Union Version credit in descriptions), ST-ALL-7 (category), ST-ALL-8 (China availability note), N-3 / ST-ALL-6 (reword the "keeps working offline" claim unless OFF1 ships first), Russian name consistency and "Berean Standard Bible" spelling (item 4 in section 7), FP-A-ART1 (feature graphic and Play icon from `brand/lion-lamb-1024.png`; mock-up first), FP-A-PWA2.
Depends on: owner/pastor for copyright line, Berean wording, 耶和华 keyword, sister-app name.

**Batch W3 - Native shells, build 4 and Windows. Effort L (about 12 h).**
Files: `src-tauri/*`, `packaging/*`, `tools/release_*.sh`, `tools/build_*.sh`, `.github/workflows/shell-*.yml`.
Items: rebuild (`npm run app:dist`, then `npm run verify:shell`; the 8 red checks are against a stale `dist-shell`), iOS shell font check in WKWebView (B4-8), P0-2 / P2-16 / FP-A-IPAD1 (re-shoot iPhone, iPad, Duo, Mac, Android evidence), FP-A-SHR1 (native share plugins), FP-A-PERF1 (shell budgets and `?perf=1`), B4-3 / FP-A-NAME1 (window title and `productName`; MSIX DisplayName and localized resources) (D), FP-A-WIN1/2 (NSIS, portable zip, MSIX pack after identity is filled; pin workflow actions by SHA), FP-A-MAC1 (run `tools/release_mac.sh`), FP-A-AND2 (GitHub APK with the old key), FP-A-SIZE1 (move content into shared Android assets to shrink the AAB), FP-A-UPD1 (update toast wording x4).
Depends on: free disk (N-6); owner steps in section 6 (Play app record, Partner Center, Developer ID, old keystore); batch W1 finished.

**Batch W4 - Offline pictures and the 3D-extensibility hooks. Effort L (about 20 h; mock-up first).**
Files: `src/core/packs.ts`, `src/gallery/install.ts`, service worker, `src/features/*` (new), `src/render/*` (new), `scripts/harness/*`, `public/config`.
Items: FP-A-OFF1 + FP-A-EXT5 + N-3 + P1-5 (mock-up for the owner, Opus wording x4 languages, then web via Cache Storage and service-worker budgets, shells via the pack manager, Playwright offline test, flip `verify-shell-ui`), FP-A-EXT1 (registry + `surfaces.json`), FP-A-EXT2 (`createRenderer()` stub with device classes and a unit-testable class function), FP-A-EXT3 (flags), FP-A-EXT4 (harness and import-graph guard tests), P2-1 (sheets anchored to their trigger) (D), FP-R-STILL1 (stills in 1.0.0 or not) (D).
Depends on: W3 (shells rebuilt), owner approves mock-up, decision on moving globe/walks code in 1.0.0.

**Batch W5 - Languages and content review. Effort L (about 10 h plus reviewers).**
Files: `src/i18n/*` (new), `src/gallery/lang.ts`, `public/data/gallery/*`, fonts.
Items: FP-R-LANG1 (confirm scope first: ten beta languages need fonts for th, ko, ja, vi inside a cap that has 31 KB spare) (D), FP-R-HANT1 (reviewed zh-Hant authored pack), FP-R-RUREAD (named Russian reader), P2-11 (caption/plate fit pass over 1,443 titles whose range runs past what the title names, e.g. `genesis-1-14`), heading-set origin check against Words `docs/headings` (section 7 item 2), FP-R-CAP2 (OpenGraph share card), FP-R-L7.
Depends on: owner/pastor/readers; W1's font work for any new scripts.

**Batch W6 - Release and after-release (owner-led). Effort S for the agent, owner for the rest.**
Items: FP-R-REL1 / N-1 (deploy HEAD to dev, owner looks, then prod with `--include-prod`; read back `version.json`; check redirects, privacy URL, 404, fonts), FP-R-REL2 / ST-WEB-5 (Resend variables, one real feedback mail), ST-WEB-4 (Search Console), assetlinks.json (after the Play App Signing SHA), AASA deploy, tag and notes x4, retire the old pictures host after 24 h, 24 h clean function logs, Play internal upload and 12 testers x 14 days, TestFlight build 4, Mac upload, store submissions.
Depends on: all other batches; the owner's word 「release」 and version number.

Suggested order: W1, W2 (parallel with W1, docs only), W3, W4, W5, then W6; screenshots (FP-A-SHOT1) are taken after W1 and W3, before W6, and are captioned in W2.

## 6. What the owner must do himself (short, concrete)

1. Say 「release」 and the version: dev deploy first, his look on phone and desktop, then prod. Nothing store-side can use the privacy URL until then.
2. Free disk space on `/Volumes/androidbuild` (1.9 GiB free; iOS simulator builds need about 6 GB).
3. Google Play Console: create the app record, upload the AAB to internal testing, copy the Play App Signing SHA-256 (for `assetlinks.json`), enter Data safety, IARC, target audience and the AI-content answer, recruit 12 testers for 14 days.
4. Microsoft Partner Center: reserve "Yahweh's World" (and the zh and ru store titles), copy Identity Name and Publisher into `packaging/msix/identity.json`; decide signed or unsigned for the direct installer; run the Windows workflow or lend a Windows machine for screenshots.
5. Apple: Developer ID Application certificate and `notarytool store-credentials "yahwehs-world-notary"` (he types the app-specific password); enter nutrition labels, age rating, review notes, category, copyright and China availability; install build 4 on iPhone and iPad and look.
6. Netlify (dev, then prod): set `RESEND_API_KEY` and `FEEDBACK_TO`, send the one real feedback mail; submit the sitemap in Search Console; back up `~/Documents/CodingProject-secrets-local/yahwehs-world/` to Drive.
7. Old APK keystore `~/keys/yahwehs-globe-release.jks` for the GitHub APK; check that the image service's accepted terms cover store-app distribution.
8. Decisions: confirm the nav order reversal and the paper-surface-on-home reversal; macOS and Windows window title (Latin or per language); one copyright/publisher line; the Russian name (three in one listing); "Berean Standard Bible" in descriptions vs the edition label "BSB (Yahweh)"; offline sheet mock-up approval; whether the ten beta languages and "写实" stills are in 1.0.0; Windows signing; sister-app name (雅偉之言 vs 雅伟的话).
9. People: name a Russian reader and a Traditional-Chinese reader; pastor to answer the 耶和华/耶和華 search keyword question and the heading-set origin check.
10. Real-device passes: Add to Home Screen and airplane mode on iPhone and Android, VoiceOver and TalkBack on a picture page, Safari Dock, Edge on Windows, iPad at build 4, iOS shell copy/paste.

## 7. Contradictions with church rules and risks

1. **神性 in three live Chinese captions** (`micah-7-1`, `matthew-17-1`, `mark-9-1`) - forbidden term, gate does not catch it. Fix wording and the gate (batch W1, class A+B).
2. **Heading sets' origin unknown.** English headings come from the BSB (`src/reader/headings.ts` says never NIV/NASB). The Chinese sets (`cuv`, `cuv-tr`) and the Russian set `ru` are described only as "the church's" / "Words' Russian set"; this repo does not state whether they derive from 和合本 or NASB headings. Check against Words `docs/headings/` (class B, pastor). Note the sister repo Sword currently uses 290 和合本 headings under an owner approval, so the question is live.
3. **Union Version** is labelled correctly in-app everywhere checked ("© 雅偉的話事工 · 經授權使用", no year, never public domain; `tests/gallery/no-1919.test.ts`). The store descriptions never print the credit (consider adding). The plan document's original "public domain" line is corrected in `docs/gallery-plan-corrections.md`.
4. **"Berean Standard Bible"** is spelled out in the en and ru store descriptions, while the catalogue note says the edition is "BSB (Yahweh)", not "Berean". Decide whether the rule is about the label only.
5. **Russian naming**: store Name "Yahweh's World", but subtitle and body say «Мир Яхве» and the icon label is «Мир» - three names in one listing.
6. **Sister-app name**: home footer uses 雅偉之言 / 雅伟之言 while church materials use 雅伟的话; confirm.
7. **耶和华 / 耶和華 as Apple search keywords** in zh-Hans and zh-Hant: the church restores Yahweh; a policy call.
8. **Publisher spelled three ways** ("Yahweh's People", "Yahweh De Hua Ministry", 雅偉的話事工).
9. **Trinitarian words appear only as meta mentions**: a code comment at `src/reader/strings.ts:4` and a doc line at `docs/store-listing/world-1.0.0.md:482` state the rule by naming the vocabulary. The rule says never, even to deny; suggest rewording both to "the church vocabulary rule" (class A, S).
10. **Claim accuracy**: "Pictures you have opened keep working without a connection" is false for the shells (headline 4); "reviewed verse by verse" is backed by the 1,443/1,443 gate.
11. **Fable rulings reversed without a ruling**: reading surface on home (fa920c3) and nav order (pending). Flag both to the owner.
12. Non-issues, listed so nobody "fixes" them: variant Traditional forms in Words' pinned Bible bytes (SHA-locked), 云/于/准 legitimate in context, the Union Version/Words text is not ours to edit here.

---

# Appendices (full per-item tables)


## Appendix E - Fable plan promises vs the code


Slice: `fable-gallery-all-platforms` (AP), `fable-gallery-release` (GR), `fable-redesign` (RD), `fable-rulings-apple-design` (RU), plus repo docs `gallery-shells.md` (SH), `gallery-release-runbook.md` (RB), `gallery-pwa.md` (PW), `apple-design-audit` (AU).
Checked at HEAD `c3f01ae` (gallery/shell-1, 2026-11-04 13:30), working tree clean except untracked `docs/evidence/shell-2026-11/` and `docs/review/world-build4-backlog.md`. Live sites probed with curl (GET only).
Method: grep/read of src, src-tauri, packaging, tools, scripts, tests, netlify.toml, dist, dist-app, docs; `git log`. Nothing was edited, built or pushed.

**Count line: 46 open rows = 27 NOT SHIPPED, 11 PARTLY, 8 UNVERIFIED; plus 13 OBSOLETE/deliberately changed (do not build) and 38 SHIPPED IDs (compact list at the end).**
Primary class over the 46 open rows (first letter where a row has two): A code now 21, B content/wording/review 4, C owner or third party 16, D design decision/mock-up first 5.

Legend: Class A code now, B content/wording/translation/pastor review, C owner or third party (store console, account, licence, device-only test), D design decision or mock-up first. Effort S <1 day, M 1-3, L >3. Platforms: Web (site + PWA), iOS, iPad, And (Android), Mac, Win, Duo (iPhone Duo / foldables). Church flag Y = the row touches reader-visible words, licence wording, divine-name forms or picture choice (rules: never trinitarian vocabulary even to deny it; Bible headings from the BSB set; Union Version credit exactly "© 雅偉的話事工 · 經授權使用" (zh-Hant; 雅伟的话事工 / 经授权使用 in Hans), never "public domain"; no year anywhere; licence rows as in `src/reader/catalogue.gen.ts`).

## Five headline facts that change planning
1. Production (world.yahwehword.com) is an OLD build: build id `c567591e3cdc` vs HEAD `796ed53e016b`; its manifest still says "雅偉之界 / Yahweh's World", `/privacy.html` is 404 and unknown URLs get Netlify's stock 404 page. The shells' "Privacy" link and every shell's full pictures point at this host. Dev (yahwehsworld-dev) is also older than HEAD (id `3b9cd31b3a7b`, has privacy.html). `/.well-known/*` 404 on both.
2. Three served Chinese captions contain 神性 (`micah-7-1`, `matthew-17-1`, `mark-9-1`, summaries.json index 748/841/926). 神性 is on Fable's banned list (GR §4.2 step 4) and in `tests/reader/wording.test.ts`, but `scripts/verify-gallery.mjs` BANNED.zh does not list it, so the gate is green.
3. The offline-pictures sheet has no mock-up or spec anywhere: `handoff/gallery-home-mockup-2026-11-03.html` and `redesign-mockup-2026-11-03.html` contain no offline sheet; only AP §2.1/§6.1-A3/§12.7 describe it. The web PWA also contradicts the plan (`PW §7`: "no way to download the whole set, by design").
4. The 3D-extensibility architecture (AP §10.3 step 1, §12) was promised "introduced here"; what exists is the platform layer, the pack manager and the build flag. `src/features/types.ts` is an orphan type (the only FeatureModule consumer, the packs feature, was deleted in 8c55ab8); no registry, no `surfaces.json`, no `render/`, no flags, no harness.
5. TestFlight build 3 (12:45) predates the per-language-name rule and the iPad two-column layout (both 13:30/12:54), so the shells need a build 4; `docs/review/world-build4-backlog.md` is untracked and lists owner findings (nav order, Chinese type) that are not in code yet.

---
## A. NOT SHIPPED

| ID | Title | Plan ref | Status and evidence | Cl | Eff | Dependencies | Platforms | Church |
|---|---|---|---|---|---|---|---|---|
| FP-A-OFF1 | Offline-pictures / 离线下载 sheet: byte-accurate choices (thumbs 48.9 MiB, testament, all 253 MiB, editions 37.6 MiB), `storage.estimate()` before/after, `persist()`, progress, cancel, "may be cleared by the system" line, one sheet for every pack | AP §2.1, §6.1 A3, §11.5 1.2, §12.7; SH §7 | Removed on purpose in `8c55ab8` ("out until it is real"). Left: `src/core/packs.ts` (manager, shell only, started in `src/shell/boot.ts:startPacks`), shell-only manifest `dist-shell/data/packs.json` (`scripts/shell-dist.mjs:64`; live `/data/packs.json` is 404). Web has only the passive footer line "Saved on this device for offline: N MB of at most M MB · Clear" (`src/gallery/install.ts`, PW §5). `yahwehsworld://packs` deleted. **No mock-up, no spec file**: the two Fable mock-ups have no such screen; the only requirements text is AP §2.1/§6.1/§12.7 (list above). `scripts/verify-shell-ui.mjs` now asserts the entry is ABSENT and must be flipped. The web SW budgets (60/30/40 MiB) are smaller than "all pictures 253 MiB", so a web "download all" also needs a bigger/explicit cache (`yw-packs-v1`, SH §6). | D then B then A | L | 1) mock-up for the owner (premium bar), 2) Opus-medium wording x4 languages, 3) build: web via Cache Storage + SW read of `yw-packs-v1`, shell via Tauri fs (pack manager exists), 4) Playwright offline test, 5) update verify-shell-ui | Web, iOS, iPad, And, Mac, Win, Duo | Y (wording; no licence text; no year) |
| FP-A-WIN1 | Windows installer (NSIS) + portable zip: never built | AP §11.5 1.7; SH §4, §8 | `.github/workflows/shell-windows.yml` exists (on origin/main), header says "NOT RUN YET". Needs a GitHub release holding `dist-shell-<ver>.zip` + `.sha256` (`tools/pack_shell_content.sh`, `gh release upload`) because pictures/Bible data can't be built on a runner. No Windows artifact exists in `dist-app/`. WebView2 bootstrapper config in `src-tauri/tauri.windows.conf.json`. | C then A | M | owner says release/pushes content asset; Actions pinned by major tag only (SH §4: pin SHAs first); then smoke run on a Windows box | Win | N |
| FP-A-WIN2 | Windows MSIX + Partner Center identity | AP §3.2, §11.2 (Microsoft row), §11.5 1.7; SH §3.1 Partner Center | `packaging/msix/identity.json` Publisher = `CN=PLACEHOLDER-copy-the-Publisher-from-Partner-Center`; workflow throws on the placeholder. `AppxManifest.xml.template` is "UNTESTED: written from the schema": DisplayName hard-coded English, `Resource Language` en/zh-Hans/zh-Hant/ru declared with no localized strings (no `resources.pri`), only 3 logo assets copied, no Square310/Wide/Splash. Never packed. | C + A | M | Partner Center: reserve "Yahweh's World" (zh/ru store titles per `docs/store-listing`), copy Identity Name/Publisher; then fix manifest per-language names (FP-A-NAME1), pack with makeappx on Windows, optional MSIX validation (WACK); owner uploads | Win | N |
| FP-A-WIN3 | Windows code signing (or an explicit owner decision to ship unsigned) | AP §11.5 1.7 ("unsigned flagged in the release notes") | Not wired; SmartScreen will warn for NSIS/zip. | C / D | S | purchase of a code-signing cert, or decision "unsigned for 1.0.0" + release-note line x4 | Win | N |
| FP-A-MAC1 | macOS Developer-ID, notarised, stapled universal DMG (direct download) | AP §11.5 1.6; SH §3.4, §8 | `tools/release_mac.sh` written, "NOT RUN YET"; only unsigned arm64 `.app`/DMG was built once (SH §8). `dist-app/` holds the Mac App Store `.pkg` (b1-b3) only. Needs Developer ID Application cert (Xcode Accounts) + `xcrun notarytool store-credentials "yahwehs-world-notary"`. x86_64 slice never built. | C | M | owner: Developer ID cert + notary profile (app-specific password typed by him); then run script, `spctl` check | Mac | N |
| FP-A-AND2 | GitHub APK 1.0.0 under old id `com.yahwehsworld.globe` with old release key | AP §11.2 (two ids), §11.5 1.8, 2.3 | `tools/build_apk.sh` patched (ywAppId property) but never run for 1.0.0 (SH §8 "not built"); no APK in `dist-app/` except `0.1.9-debug`. | C | S | old keystore `~/keys/yahwehs-globe-release.jks` (owner), arm64-only caveat (32-bit-only phones), GitHub release = publication | And | N |
| FP-A-SHOT1 | Store screenshots per platform and per locale | AP §3.3, §11.5 3.3; `docs/store-listing/world-1.0.0.md` "Screenshots needed" | Exist (test evidence, not store-ready): `docs/evidence/shell-2026-11/`: android x3 1080x2400 (taken before fonts/name/two-column changes, likely stale), duo x11 1398x2034 (+ `duo-home-d3` 2007x2853), ipad x4 1668x2420 (`ipad-bible-ru` is the only ru; `duo-zhhant` the only zh-Hant). Web shots 244 JPEG at 375x812/1440x900 in `docs/evidence/gallery-2026-11/shots/` (not store sizes). **Missing**: iPhone 6.9" 1320x2868 (any locale); iPad 13" 2064x2752; Mac 1280x800+ (none); Windows >=1366x768 (none; no Windows build); Play phone set after build 4; Play 7" and 10" tablet (none); per-locale sets en/zh-Hans/zh-Hant/ru for every store. | A (capture) + B (pick/caption) + C (upload) | M | build 4 first (names, two-column, fonts); simulators for iPhone 17 Pro Max / iPad 13" / Android emulator (phone+tablet); Mac window capture; Windows needs a Windows box; use `scripts/gallery-shots.mjs` for raw frames | iOS, iPad, And, Mac, Win, Duo, Web | Y (choose pictures that obey the depiction rules; Union Version credit shown correctly; no year) |
| FP-A-ART1 | Play feature graphic 1024x500, Play icon 512, Microsoft tiles/promo | AP §3.3; store-listing doc | "none exists, make it from a picture plus the name" (store-listing). Icon masters exist (`brand/lion-lamb-1024.png`); no 512 export, no 1024x500, no MS 300/150 tiles (Tauri `Square*` icons exist). | D then A | S | design decision/mock-up (premium bar) | And, Win | Y (picture choice) |
| FP-A-PRIV1 | Store-side privacy paperwork: App Privacy labels, Play Data safety, age rating questionnaires, Play content rating/target audience/ads declaration, and the Privacy Policy URL field | AP §3.3, §11.3, §11.5 3.2 (`docs/store/privacy-labels-world.md`) | No such doc in repo. Listing drafts list only Support/Marketing URL (`world-1.0.0.md:69,70`) and no Privacy Policy URL; the page exists locally (`src/pwa/privacy.html` -> `dist/privacy.html`, 4 languages, linked from footer `home.html:108` and feedback sheet) but is 404 on prod. Export compliance is set (`Info.ios.plist` ITSAppUsesNonExemptEncryption=false). Facts to declare: feedback text + optional e-mail, IP counted for rate limit (salted hash in Netlify Blobs), no analytics/cookies/third parties. | B + C | S | privacy page live (FP-R-REL1); owner enters answers in ASC/Play/Partner Center | iOS, iPad, Mac, And, Win | Y (licence/AI-disclosure wording) |
| FP-A-REV1 | Review notes (why it is not a web clip: original pictures, offline start, reader, share, deep links) and TestFlight "what to test" | AP §3.2, §11.5 3.1 | Not written anywhere. | B | S | Opus-medium for church-rule + licence wording; owner pastes | iOS, iPad, Mac, And, Win | Y |
| FP-A-DYN1 | System text size honoured (`font: -apple-system-body` / rem opt-in; Android text zoom) | AP §2.3, §3.3, §11.5 2.1 | Only browser-zoom/rem is verified (`scripts/verify-text-scale.mjs`, rem tokens); no `-apple-system-body` or `text-size-adjust` in `src/**/*.css`; not checked inside WKWebView/Android WebView (SH §7 "not re-audited"). | A | M | iOS simulator with larger text sizes; Android font scale | iOS, iPad, And, Duo | N |
| FP-A-SHR1 | Native share sheet in the shells | AP §3.2 (Apple 4.2 mitigation), §11.5 | `src/platform/tauri.ts:116` uses Web Share where the view has it else copies the link ("No native share plugin exists yet"); SH §7. | A | M | small custom plugin per platform (iOS UIActivityViewController, Android Intent.ACTION_SEND, macOS NSSharingServicePicker) | iOS, iPad, And, Mac | N |
| FP-A-PERF1 | Per-platform budgets measured and recorded (`docs/evidence/gallery-2026-11/platforms.md`): cold start, grid scroll, picture open, memory; `?perf=1` probe; startup timer to shell log | AP §11.4, §11.5 2.5, §10.1 | File absent. Web numbers exist (`measure-loading-final.json`: home 558 ms/29 KB, scenes 553 ms, Bible 1,284 ms, CLS 0). No shell-side numbers, no probe code (`grep perf=1` empty). | A + C | M | owner devices (Web Inspector on iPhone, `adb dumpsys gfxinfo`), Windows box | iOS, iPad, And, Mac, Win, Duo | N |
| FP-A-EXT1 | Feature registry + `surfaces.json` driving nav, redirects, sitemap, bridges | AP §10.3 step 1, §12.1-12.3, §12.9 | Only `src/features/types.ts` (FeatureModule interface, no importer). `VITE_SURFACE` + hard-coded `TABS`/`PAGES` in `scripts/lib/vite-gallery-surface.mjs`; no `src/features/index.ts`, no `surfaces.json`. Full-surface page list is separate in `scripts/build-shell.mjs`. | A | M | decide whether globe/walks code moves in 1.0.0 (plan: "next") or only the registry + gallery modules | Web, all shells | N |
| FP-A-EXT2 | `render/createRenderer()` (WebGL2/WebGPU), device classes, LOD policy, `budgets.json`, context-loss, thermal watchdog | AP §12.5, §12.6, §12.10 | Absent (`src/render/` does not exist; three.js lives in the hidden globe/walk pages with their own setup). | A | L | needs a 3D scene to test against; can ship as a tested stub with a unit-testable device-class function | Web, all shells | N |
| FP-A-EXT3 | Remote flags / kill switches `/config/flags.json` (cached by SW) | AP §12.7 | Absent (no `public/config`). | A | S | none | Web, all shells | N |
| FP-A-EXT4 | Shared harness + guard tests: registry-driven `verify -- --surface`, import-graph rule (`features -> core|shell|platform|render`), token-literal lint, church-content lint over all features | AP §10.1 (Design system, Tests), §12.1, §12.8 | None. Existing: `scripts/audit-tokens.mjs` only checks that `var(--x)` is defined (not literals); separate verify-*.mjs scripts. `scripts/harness/` absent. | A | M | FP-A-EXT1 | Web | N |
| FP-R-LANG1 | Ten beta languages (id, es, pt-BR, fr, de, it, ko, ja, th, vi) + moving chrome strings out of `data-en`/`data-zh` into `src/i18n/*.json` + registering the site in Words' `tools/i18n/translate` pipeline + checker in `npm run check` + "Beta · machine translated" label | GR §4.1-4.2, §6 S6, §9 | Not started: `src/gallery/lang.ts` offers exactly 4 languages (en, zh-Hans, zh-Hant, ru); strings are still `t(en, zh, ru)` calls and `data-*` attributes; no `src/i18n/`. No owner ruling cutting it was found (the release checklist, plan corrections and PW only say "four languages"). Under "finish everything" it is open. | D (confirm scope) then B | L | owner confirms; Words' pipeline (`/Volumes/androidbuild/Words-184/tools/i18n/translate`), term sheets D1 per language; fonts for th/ko/ja/vi must be added to the self-hosted subsets (size cap: dist is at 300.0 MiB, 31 KB spare per build-4 backlog) | Web, all shells | Y (D1 divine-name spelling per language: 雅伟/雅偉/Yahweh/Яхве, Gia-vê, ยาห์เวห์, ヤハウェ...; banned lists per language; never the Jehovah form) |
| FP-R-STILL1 | "写实" realistic still as a second plate on the picture page where a still has passed | GR §5.5, §8.3, §9.2 | No code for stills in `src/gallery`. Plan said stills are not a release condition and "appear per picture as they pass" (241 pass at 15:05 on 11-03). | D | M | owner: stills in 1.0.0 or not; promote lane for stills; review of each still | Web, all shells | Y (picture review rules) |
| FP-R-REL1 | Deploy HEAD to dev then prod; verify live | RB steps 4-7 | RB header "NOT EXECUTED". Prod and dev are older builds (see headline 1). Live 404 page = Netlify stock; live `/privacy.html` 404; `/p/<id>` 301 (trailing slash) ok. `tools/release_web.sh` exists. | C | S | owner says 「release」 + version (1.0.0 already in package.json/version.json; owner sets version); step 5 checks; T7 + Words checkout mounted for the build | Web (+ shells' fonts/pictures/feedback hosts) | N |
| FP-R-REL2 | After-release steps: set `RESEND_API_KEY`/`FEEDBACK_TO` on dev then prod and send the one real feedback mail; Search Console sitemap; tag + notes x4; retire old host `yahwehs-scenes.netlify.app` after 24 h, revoke the 10/17 API key, check Google Cloud bill | RB steps 3, 5, 8-10; GR §7 | Not done (RB). Function is deployed (`GET /api/feedback` 405, bad-origin POST 403 on both hosts); env vars unverifiable from outside. | C | S | owner accounts | Web | N |
| FP-D-NAV1 | Tab/nav order: owner wants Home · Bible · Scenes (reverses Fable's 首页 · 画卷 · 圣经) | GR §1.1 line 38; `docs/review/world-build4-backlog.md` item 1 | Not changed: `TABS` in `scripts/lib/vite-gallery-surface.mjs:76-80` is home, scenes, bible. Backlog item unchecked. | A | S | update every place that asserts the order (verify scripts, 404/privacy/offline pages, footer, shots, store text) | Web, all shells | N |
| FP-D-TYPE1 | Build-4 owner findings: Chinese in a YaHei-like sans, CJK quotes/punctuation face, hero kicker contrast on light/paper, fonts verified inside the iOS shell, calmer chip pairing | `world-build4-backlog.md` (owner, outside the Fable plan) | All unchecked in the backlog; fonts: `public/fonts`, `tools/subset-fonts.sh`, `tools/font-coverage.mjs`. | A (+D for taste) | M | size cap (300.0 MiB used); iOS simulator check; compare with Words' Noto subset | Web, iOS, iPad, And, Mac, Win, Duo | Y (church name forms in headings only) |
| FP-A-PWA2 | PWA extras: manifest `screenshots`, iOS `apple-touch-startup-image` splashes | PW §9 | Declared "not provided". Not in AP A1 minimum. | A | S | screenshots from FP-A-SHOT1 | Web/PWA (iOS, Android) | N |
| FP-A-DEV1 | Real-device checks nobody could do: Add-to-Home-Screen + airplane mode on an iPhone and an Android (AP A6); iOS shell copy/paste (SH §9 "not tested"); VoiceOver pass on one picture page; TalkBack; Safari on Mac Add to Dock; Windows Edge; iPad layout look at build 4 | AP §6.1 A6, §8; GR §3.1 a11y; SH §8-9; PW §9 | None recorded. | C | M | owner devices | Web, iOS, iPad, And, Mac, Win, Duo | N |
| FP-A-TERMS1 | One-line check that the image-service terms the owner accepted cover distribution inside store apps | AP §9 last row | No record in repo. | C | S | owner's account | all | N |
| FP-R-RUREAD | Russian captions/UI read by a native speaker (kept as "not yet read" notice) | GR §4.2 step 3, §9.5; RB step 6 | Notice shipped (home note, reader display sheet); no reader named. | C | S | owner names a reader | Web, all shells | Y (church rules in ru) |

## B. PARTLY SHIPPED

| ID | Title | Plan ref | Done / exactly what is missing | Cl | Eff | Dependencies | Platforms | Church |
|---|---|---|---|---|---|---|---|---|
| FP-A-LNK1 | Universal / App Links and URL scheme | AP §11.2 last row, §11.5 2.1; SH §3.6 | Done: Tauri deep-link plugin (`tauri.conf.json` plugins.deep-link: https `world.yahwehword.com` `/p/`, appLink true; desktop scheme `yahwehsworld`), Android intent-filter `autoVerify` in the AAB manifest, iOS `applinks:` entitlement, `src/shell/deeplink.ts` + test, `yahwehsworld://p/<id>`. **Missing**: the site side. No `public/.well-known/`, nothing in `dist/`, no header rule in `netlify.toml`; both live hosts 404. AASA can be written now (appID `YC5JZD3DY7.com.yahwehword.world`, `/p/*`, `Content-Type: application/json`, no redirect); `assetlinks.json` needs the SHA-256 of the **Play App Signing** certificate from Play Console (the upload-key SHA in `docs/signing-setup.md` is NOT the one). `#ref=` is not a universal link (fragments never reach apps) so that plan line is moot. | A (AASA, headers, test) + C (assetlinks SHA, deploy) | S | Play app record + first upload (FP-A-AND1); deploy (FP-R-REL1) | Web, iOS, iPad, And, Duo | N |
| FP-A-NAME1 | Per-language product name everywhere | AP §11.2; owner 2026-11-04 (SH §1, PW §0) | Done: web/PWA (4 manifests, bar lockup, titles), iOS/macOS localized display names (`src-tauri/locales/*/InfoPlist.strings`), Android labels (values-zh, -zh-rTW/HK/MO, -b+zh+Hant, -ru), store titles in `docs/store-listing`. **Missing/undecided**: Tauri `productName`/window title and NSIS/MSIX names are Latin only (`tauri.conf.json:3,13`; backlog "decide whether it should localise"); MSIX `DisplayName` hard-coded; Windows start-menu folder English; Android Play listing names per locale (console, C). | D then A | S | owner decision on macOS/Windows window title; build 4 | Mac, Win | N |
| FP-R-CAP1 | Caption data checks (`verify-captions.mjs`: English title <=8 words, summary <=20, Chinese title <=12 chars, reference inside s-e, full banned lists, 他 not 祂) | GR §5.4 L2-L3, §4.2 step 4 | Done: banned-vocabulary check on titles+summaries in zh/en/ru inside `scripts/verify-gallery.mjs:67-76`; no 1919 test; refs now come from numbers (23 wrong refs moot). **Missing**: no word/char-limit check; measured now: 126 English summaries >20 words (max 38), 1 title of 9 words (`psalms-124-1`), 1 Chinese title of 13 chars (`psalms-118-1`); BANNED.zh lacks 神性 and the other terms in `tests/reader/wording.test.ts` (本体 圣父 圣子 子神 神性 ...) so **3 live captions say 神性** (`micah-7-1`, `matthew-17-1`, `mark-9-1`); the zh Hant copy derives from them. | A + B | S | Opus-medium rewrite of the 3 captions and a review of the 126 long ones; extend BANNED lists from the term sheets (`docs/audit/term-sheets-decisions-2026-11-10.md` in Words) | Web, all shells | **Y** |
| FP-R-CAP2 | OpenGraph share card with title + reference on the plate | GR §5.4 L6 | `og:image` is the bare plate (`vite-gallery-surface.mjs:243`). Plan allowed this as the fallback ("not on the critical path"); the template/`scripts/build-share-cards.mjs` does not exist. | A | S | optional | Web | N |
| FP-R-HANT1 | zh-Hant as an authored pack, diffed against OpenCC | GR §4.2 step 1, §5.4 L4 | Done: OpenCC table + gazetteer repairs, `scripts/audit-zh-hant.mjs` (0 leftovers), 雅偉 rules. **Missing**: no authored `zh-Hant` chrome/caption pack and no reviewed diff. | B | M | a Traditional reader/Opus-medium review | Web, all shells | Y |
| FP-D-A11Y1 | Remaining measured a11y/design numbers | GR §6 S5 acceptance; AP §10.1 (targets >=44, <=7 sizes) | Evidence `audit-apple-design-final.json` (11-03, before later commits): Bible page 10 distinct computed font sizes at 375/1440 (plan <=7); home 375 has 2 targets under 44 (`EN` 34x44, `#hm-all-licences` 28 high); hit-test "stolen" on home (`#hm-plate <- div.hm-copy`) and Bible (`button.yr-vn <- a.tb`). Later commits (`1a22b9a` 44 px icon buttons, `045d984` language globe) may have fixed some; no re-run recorded. | A | S | re-run `node scripts/audit-apple-design.mjs` at HEAD | Web, all shells | N |
| FP-A-UPD1 | Update toast on direct-download builds | AP §11.5 1.4, SH §7 | `src/shell/boot.ts` toast marked "STUB wording (needs the Opus medium review)"; no Tauri updater plugin (GitHub release check only; moot until FP-A-MAC1/WIN1/AND2 exist). | B | S | Opus-medium wording x4 | Mac, Win, And (direct) | Y |
| FP-A-SIZE1 | App size budget <=100 MB on every shell | AP §11.4 last row, §11.1 | Content 87.8 MiB (budget met). Built artifacts: iOS ipa 77 MB, Mac pkg 76 MB, **Play AAB 152.7 MB** (two ABIs each embed ~90 MB, SH §8), download per device ~70-80 MB. Moving content to Android `assets/` (shared by ABIs) not done. | A | M | optional if the per-device download is accepted | And | N |
| FP-A-EXT5 | Versioned `packs.json` for web/PWA + generic packs manager sheet | AP §12.6-12.7 | Pack manager and manifest exist for shells only; web has no `packs.json` (live 404) and the SW has its own budgets. | A | M | FP-A-OFF1 | Web | N |
| FP-R-DOC1 | Runbook/doc drift | RB step 5, 8 | RB still expects `sitemap.xml` `<loc>` count 1446; build now emits 1447 (privacy.html added, `SITE_PAGES`). `docs/gallery-shells.md` §3.5 says Mac TestFlight "not set up" but a Mac App Store config/pkg exists (`e402651`, `dist-app/mac-1.0.0-b3`). | A | S | none | Web | N |
| FP-R-L7 | Redefine `language_state` for squares | GR §5.4 L7 | `tools/scenes/register_text_free_candidate.py:74,89,104` still writes `language_state: "not_started"`; the 1,443 stub layers not retired. Internal pipeline bookkeeping, no user impact. | A | S | none | n/a | N |

## C. UNVERIFIED (cannot be established from the repo or by a GET)

| ID | Question | Evidence so far | Cl | What settles it |
|---|---|---|---|---|
| FP-A-AND1 | Is the Play app record created and the 1.0.0 AAB uploaded to internal testing? Play App Signing SHA? | AAB built and signed with the upload key (`dist-app/YahwehsWorld-1.0.0-play.aab`, 152.7 MB, `jarsigner` alias YAHWEHSW; keystore recorded in `docs/signing-setup.md`; upload-cert SHA-256 49:C2:41:EB...). No record of an upload, listing entry, data-safety form, content rating or 12-tester/14-day closed test (production gate). | C | owner opens Play Console |
| FP-A-IOS1 | TestFlight 1.0.0 builds 1-3: processed, internal group "Owner" created, export-compliance answered? iOS shell on a device: fonts load, copy works | `dist-app/ios-1.0.0-b3/*.ipa` + upload command recorded in `signing-setup.md`; ASC app id 6830164556. Build-4 backlog: "the previous agent never drove the iOS shell" for fonts; SH §9 copy/paste "iOS shell not tested". | C | owner / simulator run |
| FP-A-MAS1 | Mac App Store TestFlight upload of `Yahweh's World-1.0.0.pkg` (b3) done? | pkg exists for b1-b3; altool `--type macos` documented; nothing records the result. | C | owner / ASC |
| FP-S-ENV1 | Are `RESEND_API_KEY` / `FEEDBACK_TO` set on dev and prod; has the one real feedback mail been received? | Function deployed; cannot test without sending mail. | C | owner |
| FP-S-REC1 | Do the other store records exist: Play app, Partner Center reserved name (only ASC is recorded)? | `identity.json` placeholder suggests Partner Center identity not copied yet. | C | owner |
| FP-A-A11Y2 | Search resolves "大马色" (GR §3 table) | "创 12" and "Gen 12:1" are asserted in `scripts/verify-gallery-ui.mjs:183-189`; no test for 大马色 found. | A | add the case |
| FP-A-IPAD1 | iPad / split-view sizes look right in the shell | `ipad-*.png` exist (11-04); layout changed after (3d6a033); SH §8 "iPad layout not looked at". | C | re-capture at build 4 |
| FP-A-BG1 | Words/Sword deep links into the globe still resolve (grep both repos) | RB step 5 asks for it; not recorded. | A | grep `world.yahwehword.com`/`yahwehsworld` in both repos |

## D. OBSOLETE or deliberately changed (do NOT build)

| ID | Plan item | Why dropped/changed (ruling) |
|---|---|---|
| FP-O1 | Option D "画卷 inside Words" (WP-D D0-D9, Words store line, Words offline category) | Superseded the same evening by owner: standalone World on every platform (AP §0.1, §6 banner). |
| FP-O2 | 21 editions incl. 12 church packs, he/grc, licensed editions | Owner 2026-11-03: eight editions only (`bsb-yhwh kjv web-yhwh asv-yhwh cuvs-yhwh cuvs-yhwh-tr rst-yhwh rst`), church packs out (`gallery-plan-corrections.md` B, C). |
| FP-O3 | Union Version "public domain" credit | Corrected to "© Yahweh De Hua Ministry · used with permission" (`54b5af6`, `catalogue.gen.ts`); `verify-gallery.mjs:105-108`. |
| FP-O4 | Combined name "雅偉之界 / Yahweh's World" in manifest/titles; Traditional name "everywhere it is a name" | Owner 2026-11-04: the name follows the page language (SH §1, PW §0, `src/config/site.ts`). Prod still shows the old one until deploy. |
| FP-O5 | Phone bottom bar with five slots (RU 3 / RD §4) | GR §1.1: three tabs in the gallery build; five-slot bar is for the full surface (still in `scripts/build-shell.mjs`). Order itself is reopened by the owner (FP-D-NAV1). |
| FP-O6 | Redesign stage A (Bible as home, map tiers, globe diet, A1-A7) | Superseded by the gallery-only plan (GR header: its map rule/globe diet/entry swap are not in this version). |
| FP-O7 | RU 1a/1b/1c/2b (globe coast, spring zoom, fly-to, place-card sheet), item 4 canvas keys, item 6 door drags | Globe is hidden in this version. Items 4 and 6 are committed in the full surface (`563a8f8`); 1b/1c/2b stay pending for when the globe returns. |
| FP-O8 | Merged bilingual burned-in pictures and the 491 HOLD set; per-language composites | Retired by GR §5.1 (text as HTML); `merged-*` unused in `src/gallery`. 1,443/1,443 squares pass, no `release-exclusions.json` needed. |
| FP-O9 | Service-worker budgets 60/300/50 MiB | Shipped smaller on purpose: pictures 60, thumbs 30, data 40 MiB (PW §3). The 253 MiB "all" case belongs to FP-A-OFF1. |
| FP-O10 | Pictures `Cache-Control` long-lived immutable | Kept `max-age=0, must-revalidate` because file names are stable across redraws (RB rollback table). |
| FP-O11 | `ORIGINS += http://localhost` | Not added; shell origins `tauri://localhost`, `http(s)://tauri.localhost`, `capacitor://localhost` only (`e9e0036`, safer). |
| FP-O12 | `yahwehsworld://packs`; Capacitor iOS fallback; Tauri updater plugin | Deleted with the stub; Tauri iOS worked so Capacitor is moot; store builds never self-update, direct builds use a release check. |
| FP-O13 | "Continue in Words" route `#/bible/<book>/<ch>` | Corrected to `yahwehword.com/#/<bookSlug>/<chapter>[:<verse>][?v=<edition>]`, built (`src/reader/words-link.ts`, `gallery-plan-corrections.md` B). |

---
## E. SHIPPED (IDs with evidence, compact)

- FP-S01 PWA manifests x4 (`scripts/lib/pwa-build.mjs`), icons from Lion & Lamb (`public/pwa`, `scripts/build-pwa-icons.py`), SW with budgets, update notice, install entry, offline.html (PW §1-6; `verify:pwa`; 75 unit tests).
- FP-S02 PWA tests and standalone mode (`tests/gallery/pwa-core.test.ts`, `scripts/verify-pwa.mjs`; PW §6).
- FP-S03 Platform capability interface + web/tauri adapters + tests (`src/platform/*`, `tests/platform/*`).
- FP-S04 Pack manager (`src/core/packs.ts`, tests) wired in shells; local full pictures served from device (`media.ts localFull`).
- FP-S05 Tauri 2 config: id `com.yahwehword.world`, real CSP, scoped capabilities, per-platform overlays (`src-tauri/tauri.conf.json`); two-id APK scheme (`tools/build_apk.sh`).
- FP-S06 Feedback origins for shells + test (`e9e0036`); feedback sheet, rate limits, mailto fallback (`netlify/functions/feedback.mjs`, `tests/gallery/feedback-function.test.ts`).
- FP-S07 Bundled content 87.8 MiB (thumbs + Bible data + pages), full pictures fetched (`scripts/shell-dist.mjs`).
- FP-S08 iOS/iPadOS: archive, export, upload recipe, localized names, Associated Domains, ITSAppUsesNonExemptEncryption (`signing-setup.md`, `Info.ios.plist`, `tools/release_ios.sh`); b1-b3 built.
- FP-S09 macOS Mac App Store config + sandbox entitlements + pkg b3 (`tauri.macos-appstore.conf.json`, `Entitlements.appstore.plist`).
- FP-S10 Android debug APK + signed Play AAB 1.0.0 (`tools/build_android.sh`, `dist-app/...-1.0.0-play.aab`), adaptive icon, light system-bar icons.
- FP-S11 App icon Lion & Lamb on all platforms + `scripts/verify-icons.py` (`ef7f207`).
- FP-S12 Self-hosted subset fonts incl. Cyrillic, CSP without Google (`public/fonts`, `tools/subset-fonts.sh`, `verify:fonts`).
- FP-S13 Gallery surface: 3 pages, `_redirects` (302 hidden pages, 301 `/gallery` `/pictures`), `/p/<id>` x1,443, sitemap (1,447), robots, version.json (`vite-gallery-surface.mjs`, `verify-redirects.mjs` 38 checks).
- FP-S14 404.html, privacy.html, offline.html in 4 languages (`src/pwa/*.html`, `STATIC_PAGES`), privacy linked from footer and feedback sheet; no cookies/analytics/third parties stated and true (grep clean).
- FP-S15 Pictures 1,443/1,443 passed and served, 253.0 MiB, dist 293.3 MiB under the 300 cap, SHA recorded (`data/gallery/pictures.json`, `verify-gallery.mjs --strict-pictures`).
- FP-S16 Home (scene of the day, browse by book, search palette, licences sheet, footer), gallery, picture + passage page, 对照 max 3, copy with credit, edition sheet, themes dark/light/paper, hash routes (`src/gallery/*`).
- FP-S17 Reader: 8 editions SHA-pinned to Words, headings sets cuv/cuv-tr/english-classic/ru, parallel, copy rules, text size, RTL-ready, footnotes, Continue-in-Words (`src/reader/*`, 90 node tests, `verify-reader-robustness` 169).
- FP-S18 Union Version credit wording and chip, no-year test (`catalogue.gen.ts`, `tests/gallery/no-1919.test.ts`, `verify-gallery.mjs`).
- FP-S19 Russian complete and labelled unread (`verify-ru.mjs` 74 checks; captions, headings, UI).
- FP-S20 Church-wording tests on reader data/headings (`tests/reader/wording.test.ts`) and caption banned-vocab (partial, see FP-R-CAP1).
- FP-S21 Budgets: first-view profile gallery (`scripts/check-budget.mjs`), loading numbers (`measure-loading-final.json`), Apple-design audit (`audit-apple-design.mjs`), contrast 0 fails, text under 12 px 0.
- FP-S22 Sheet/menu motion 160/220 ms with reduced-motion fades (`src/gallery/chrome.css:156-178,261-280`); press/hover/target fixes (AU items 3, 6, 7, 11-13, 17).
- FP-S23 No analytics/telemetry anywhere (grep of `src`, pages, privacy statement).
- FP-S24 Deep-link client side + Android autoVerify filter + iOS entitlement (`src/shell/deeplink.ts`, `tests/shell/deeplink.test.ts`).
- FP-S25 Store listing drafts x4 languages x 3 stores with field-length and church-rule check (`docs/store-listing/world-1.0.0.{md,json}`).
- FP-S26 Signing material and ASC bundle/app records (`docs/signing-setup.md`: team YC5JZD3DY7, cert/profile ids).
- FP-S27 Product-name source of truth and guards (`src/config/site.ts`, `scripts/lib/product-name.mjs`, `verify:shell`).
- FP-S28 Android shell light status/nav bar icons; Duo side safe-area insets (`87492c1`, `b062a42`).
- FP-S29 Copy/paste fix for non-Safari WKWebView, selectable text, verse action bar (SH §9; `src/reader/copy.ts`).
- FP-S30 Pictures served from own origin; old host referenced nowhere (`verify-gallery.mjs:139`).
- FP-S31 Hash-link forwarding (`#ref`, `#event`, `?book=&ch=`) and the Words-route link verified against Words (`gallery-plan-corrections.md`).
- FP-S32 Share stubs with per-plate title/image (`/p/<id>`, `og:*` in `vite-gallery-surface.mjs:243`).
- FP-S33 Hidden pages (globe, walks, figures, plan, labs) kept in repo, out of gallery build, tests intact (`VITE_SURFACE=full`).
- FP-S34 Feedback privacy sentence in 4 languages and zh-Hant table audit (`5335358`, `c924...` audit).
- FP-S35 MSIX identity file + template + workflow stubs (exist; unusable until FP-A-WIN2).
- FP-S36 Owner steps documented exactly (`docs/gallery-shells.md` §3: three store records, Xcode login, Android keystore, notarisation, TestFlight, site files for app links).
- FP-S37 Shell CI workflows for macOS/Android/Windows written (`workflow_dispatch`, read-only permissions).
- FP-S38 Export compliance and sandbox/hardened-runtime settings for the Mac and iOS builds.

## Notes for the planner
- Order that unblocks most rows: build 4 (names, nav order, type, fonts, iPad layout) -> deploy dev -> screenshots (FP-A-SHOT1) -> privacy live -> AASA + assetlinks -> store paperwork -> Windows CI.
- Owner-only list consolidated from `gallery-shells.md` §3: Play app record + upload + Play App Signing SHA; Partner Center reserve + Identity Name/Publisher; Developer ID cert + notary profile; old APK keystore; Netlify env vars; 12 testers x 14 days (Play production); real-device passes; 「release」 + version.
- Not checked: Words/Sword repos, T7 contents, ASC/Play consoles, Netlify env.

## Appendix F - Gap audit, build-4 backlog, store readiness


Repo `/Volumes/androidbuild/globe-shell`, branch gallery/shell-1, HEAD `c3f01ae` (350 commits). Read-only: no edits, no builds, no npm/cargo. I ran only `node scripts/audit-zh-hant.mjs` (reads files, writes nothing), curl on the live site, unzip -l, and small python/node read-only scans.

Legend. Status: DONE / PARTLY / OPEN / OBSOLETE / UNVERIFIED. Class: A code now; B content/wording/translation/pastor review (drafts possible); C owner or third party; D needs design decision or mock-up first. Effort S <1h, M hours, L day+. "Church" = church-rule flag.

## 0. The fact that changes everything

The live site is NOT the repo. `https://world.yahwehword.com` serves build `c567591e3cdc` (still loads fonts from fonts.googleapis.com, still shows Netlify's stock 404 for unknown paths, `/privacy.html` and `/privacy` return 404, `/.well-known/*` 404). Local `dist/` is build `796ed53e016b` (13:14 today; HEAD 13:30 is docs/verify only). So every fix marked DONE below is DONE IN CODE and local dist, not live. Full pictures ARE live (`/pictures/full/john-8-31.webp` = 200 image/webp), so the "shell shows no picture" cause named in the audit is gone. One web release (`tools/release_web.sh`, only on the owner's word 「release」) is a precondition for: privacy URL in every store form, 404 page, Google-free fonts for the PWA, AASA/assetlinks, sitemap submission.

## Part 1. Verification of the audit and the build-4 backlog

Count line: 38 audit findings (P0 7, P1 15, P2 16) + 11 build-4 backlog bullets + 7 new items found (N-1..N-6, N-8) = 56 rows.
Audit 38: DONE 29, PARTLY 1, OPEN 4, OBSOLETE 1, UNVERIFIED 3.
Backlog 11: DONE 1, PARTLY 2, OPEN 6, UNVERIFIED 2.
New 7 (all OPEN).

### 1A. ALREADY DONE (29 audit + 1 backlog). Evidence is code/commit; "live" means NOT live until web release.

| ID | Title | Evidence | Class | Eff | Platforms | Church |
|---|---|---|---|---|---|---|
| P0-1 | Reader has no plates | cade312; `src/reader/plates.ts`, `src/gallery/plates.ts`, `reader-page.ts:10`; `tests/reader/plates.test.ts`; `verify-gallery-ui.mjs:590-636` (3 plates in Genesis 1, none inside a verse row). Needs a person's look once live | A (verify C) | S | all | no |
| P0-3 | Simplified chars in zh-Hant | `public/data/zh-hant.json` maps 辅->輔 and has phrase "画家的想象 · AI 辅助绘制，逐节审核" -> "畫家的想像 · AI 輔助繪製，逐節審核"; `node scripts/audit-zh-hant.mjs`: 11,031 strings, 0 leftover (ecfbb17, c6924cd). My own scan of the 8 store zh-Hant fields and the pwa `data-hant` strings: clean. See section 3 for the Bible text. | A | S | all | yes (Traditional rule) satisfied |
| P0-4 | 404 is Netlify stock | `src/pwa/404.html` (4 languages, 3 doors), `dist/404.html`, `dist/_redirects` ends `/* /404.html 404`. Live still stock (checked). | A done; deploy C | S | web | no |
| P0-5 | Fonts from Google | d01f97f, 6c698af, 58f279b, bac5885; `public/fonts/*.woff2` + `fonts.css`; `src/pwa/core.ts:66` says nothing comes from another host; CSP `font-src 'self' data:`; `npm run verify:fonts`. Live still on Google (checked). | A done; deploy C | S | web, PWA, shells | no |
| P0-6 | Paper control does nothing | Fixed by fa920c3 the other way round: the reading surface now paints home/gallery too (reverses Fable's "home stays dark"; the commit says FLAGGED for owner to confirm). Pills no longer wrap (`.hm-theme-pills nowrap`, home.css:137). | A done; owner confirm of the reversal C | S | web, shells | no |
| P0-7 | App icon | ef7f207: Lion & Lamb on all platforms, `scripts/verify-icons.py` (not default Tauri, no alpha on iOS, matches gen/). `docs/gallery-shells.md` §6 still says "navy circle + gold cross": stale (see N-4). | A done | S | all | no |
| P1-1 | Language switcher tiny / not globe | 045d984; `chrome.ts:90 mountLangMenu`, `.lang-menu`, 44 px (`chrome.css:175`) | A done | S | all | no |
| P1-3 | Title stale on back/forward | `src/reader/view.ts:752-761 setDocTitle()` from the render path; popstate wired (:139) | A done | S | web, shells | no |
| P1-4 | Bible boot overlay over rendered text | `reader-page.ts:34-41`: page is ready on the text, plates load after, `.finally()` for failure | A done | S | all | no |
| P1-6 | Hero link has no name | `home.ts:71` aria-label = title + reference | A done | S | all | no |
| P1-7 | Card titles truncate | `scenes-page.css:33` line-clamp 2 | A done | S | phone | no |
| P1-8 | English reference beside localised | `home.ts:66-68`, `scenes-page.ts:158-161`: one reference | A done | S | all | no |
| P1-9 | "Continue in Yahweh's Words" | `src/reader/words-link.ts`, `tests/reader/words-link.test.ts`, `.yr-words` css; route checked against Words and live yahwehword.com (checklist §8); the audit's `#/bible/<book>/<ch>` was wrong | A done | S | all | no |
| P1-10 | No privacy link / feedback entry | `home.html:108-109` Privacy + Send feedback; `src/pwa/privacy.html` (4 languages), `_redirects /privacy -> /privacy.html`; sitemap lists it. Scenes and Bible pages have no footer (only home): see ST-WEB-3 | A done; deploy C | S | all | no |
| P1-11 | Feedback sends empty report | c3f01ae: Send disabled until a reason is ticked or text written, `requestSubmit()` path refused, checked in 4 languages | A done | S | all | no |
| P1-12 | Duo top safe-area | `--safe-top` on `.sitenav` (`chrome.css:86,122`), side insets b062a42. Not re-shot on a Duo: see P2-16 | A done; device look C | S | Duo, iPhone | no |
| P1-13 | Home labelled "The scenes" | `vite-gallery-surface.mjs:84` page name Home / 首页 / Главная (894c099) | A done | S | all | no |
| P1-14 | Scene count twice | `scenes-page.ts:46-52` one formatted count | A done | S | web | no |
| P1-15 | Empty find box on phone | `home.html:74-76` text "Book, reference or caption…", `home.css:145` | A done | S | phone | no |
| P2-3 | Palette focus returns to BODY | `search.ts:51-52` explicit return; `sheet.ts` close -> `back.focus()` | A done | S | web | no |
| P2-4 | Selection bar overlays text | `.yr-selbar` is `position: sticky` in flow (`reader.css:214`), not an overlay. Not seen on screen | A done | S | all | no |
| P2-5 | Edition label twice in a11y text | `render.ts:168-169` visible label aria-hidden, sr copy once | A done | S | all | no |
| P2-6 | 簡體中文 heading in Traditional | `strings.ts:37` group is 简体中文 on a 繁體 page | A done | S | all | yes (script rule) satisfied |
| P2-7 | Edition sheet shows no licence word | `chrome.ts:150` `.yr-tag` = `licenceWord(kind)` per row | A done | S | all | no |
| P2-8 | Reader measure too wide | `.yr-body max-inline-size: 40rem` (reader.css:116); ~66 Latin chars at 19 px | A done | S | iPad | no |
| P2-9 | Prev/next labels detached | `scenes-page.ts:163-165` comment says words sit beside the arrows | A done | S | web | no |
| P2-10 | Unknown `#p=` silent | `scenes-page.ts:98 notFound()`, called at :258 | A done | S | web | no |
| P2-12 | Mixed scripts in zh-Hans footer | `home.html:98` zh note now "中文（简体、繁体）" all Simplified | A done | S | web | yes satisfied |
| P2-13 | One static manifest | `dist/manifest.{,zh-Hans,zh-Hant,ru}.webmanifest`; `verify-pwa.mjs:126` | A done | S | PWA | no |
| B4-2 | Per-language wordmark | Done in bafcb80 (the backlog says c3f01ae: wrong hash). Needs `npm run app:dist` + `npm run verify:shell` (8 verify-shell-ui checks red vs the old dist-shell) | A (rebuild) | S | shells | yes (name rule) satisfied |

### 1B. PARTLY

| ID | Title | What is missing | Class | Eff | Deps | Platforms | Church |
|---|---|---|---|---|---|---|---|
| P0-2 | Shells show no picture on first screen | Done: full pictures live (200), `home.css:69` two-column from 768 (iPad), `.is-failed` mat. MISSING: (1) no re-shot iPad/Duo/iPhone/Mac evidence; (2) when the full picture fails (offline shell) `media.ts:54` only paints an empty mat, with no fallback to the bundled thumbnail (`thumbUrl`) and no message: first screen offline is still blank (N-2); (3) `dist-shell` is stale (version 3c50b23). | A (fallback), C/A (shots) | M | free disk (N-6), `app:dist` | iOS, iPadOS, Duo, macOS, Android | no |
| B4-7 | Hero kicker unreadable on light/paper | Kicker colour pinned `--gold-bright` on the dark scrim since fa920c3 (`home.css:21`); wide layout uses `--gold-dim` on the page (:74). MISSING: the requested contrast check over kicker/title/subtitle/chips in all four surfaces (`verify-gallery-ui.mjs:705` skips the scrim hero) and a look at iPhone light mode. | A | S | none | iPhone, all | no |
| B4-10 | Chinese text in sans (微软雅黑 direction) | Done: sans CJK subsets exist (Noto Sans SC/TC 400, `fonts.css`), UI stacks start Inter then Noto Sans. MISSING: Chinese READING text still serif (`--yr-read` = Spectral, Noto Serif SC/TC, reader.css:25,56); Latin inside Chinese is Spectral not Inter; one weight only (400 sans, serif 500) so 500/700 are synthetic; the 300 MiB cap means the serif Bible subsets must go in the same change. | D (owner already ruled direction; wants a look first) then A | L | B4-4 size, B4-5 | all | no |

### 1C. OPEN

| ID | Title | Status + evidence | Class | Eff | Deps | Platforms | Church |
|---|---|---|---|---|---|---|---|
| B4-1 | Nav order 首页·圣经·画卷 | OPEN. Still Home, Scenes, Bible in: `scripts/lib/vite-gallery-surface.mjs:70-74 TABS` (bottom bar + top bar), `src/pwa/{offline,404,privacy}.html` nav, manifest shortcuts (`verify-pwa.mjs:126` asserts `/,/scenes.html,/bible.html`), `docs/gallery-pwa.md:45`, `scripts/build-pwa.mjs`, store screenshots (none yet). Reverses Fable's ruling: flag. Possibly also home.html footer / any shortcut list. | A | M | none; do before store screenshots | all | no |
| B4-3 | macOS window title / productName | OPEN decision. `tauri.conf.json:3,17` productName and window title "Yahweh's World" (Latin) on every language; the mac label under the icon is localised via lproj. | D (small) | S | none | macOS | name rule: Chinese macOS user sees Latin window title |
| B4-4 | dist at the 300 MiB cap | OPEN constraint. `du` says 311.9 MiB (block overhead ~12); backlog says 31 KB headroom. Any new asset (sans fonts at more weights, hero thumbs, 404/privacy) must be paid for elsewhere. | A | M | B4-10 | web, shells | no |
| B4-5 | Typography parity with Words | OPEN. Reader uses Spectral/Noto Serif at 19 px/1.8 (`reader.css:116`); never compared side by side with Words on the same chapter; iOS WKWebView not checked. | D then A | L | B4-10 | iOS first | no |
| B4-6 | CJK quotes/punctuation | OPEN, UNVERIFIED by eye. No rule puts the CJK face first for U+2018/2019/201C/201D/2014/2026: `--yr-read` lists Spectral before Noto Serif, and Spectral's Latin subset claims U+201C/D. No `:lang(zh)` / `font-variant-east-asian` / text-spacing rule found (only `reader.css:122` line-height). | A | S | B4-10 | all | no |
| B4-9 | Mixed faces on home chips | OPEN, taste. | D | S | B4-10 | all | no |
| P1-5 | Offline pictures | OPEN as a FEATURE. The stub sheet, entry and `yahwehsworld://packs` were removed (8c55ab8) and `verify-shell-ui` fails if they return; `src/core/packs.ts` stays. Result: no way to download pictures for offline on any platform; shells fetch each full picture from the site and nothing stores it (see N-3). The owner's "everything in 1.0.0" means this is back on the list: mock-up first. | D then A | L | N-3, pack manager | shells + web | no |
| P2-1 | Sheets have no spatial origin | OPEN. `chrome.css:275`: popover pinned `margin: 70px 28px auto auto` at >=768, bottom sheet on phone; not anchored to the trigger. | D (apple-design item 8) / A | M | none | desktop, iPad | no |
| P2-11 | Caption/plate fit | OPEN, content pass over 1,443 titles whose reference range runs past what the title names (example `genesis-1-14`). Not surveyed. | B | L | gate tooling in `tools/scenes` | all | no |
| P2-16 | Evidence has no iPhone/macOS shots | OPEN. `docs/evidence/shell-2026-11/` still has android x3, duo x9, ipad x4 only, and the folder is untracked in git (`?? docs/evidence/shell-2026-11/`, N-5). | A/C (capture) | M | N-6, `app:dist` | iPhone, macOS | no |
| N-1 | Live site older than the repo | OPEN. See section 0. | C (owner says 「release」) | S | `release_web.sh`, owner yes | web | no |
| N-2 | Full picture failure has no fallback | OPEN (see P0-2 (2)). | A | S | none | shells, offline PWA | no |
| N-3 | Opened pictures are not kept in the shells | OPEN. Store text in all 4 languages x 3 stores says "Pictures you have opened keep working without a connection" (`world-1.0.0.md` "SIMPLE"); on web the service worker does that, but in the shells there is no SW and `core/packs.ts` only reads packs nobody can create. Bundled: thumbnails + Bible text only. Either build per-picture caching (A, M) or reword (B, S). | A or B | S-M | P1-5 | iOS, Android, macOS, Windows | no (claim accuracy) |
| N-4 | Docs stale | OPEN. `gallery-shells.md` §6 (icons) and §3.5 ("Mac App Store route not set up") contradict ef7f207/73cad8b/signing-setup.md; backlog cites wrong hash; `world-1.0.0.md` counts table still shows name 19 chars (now 14). | B | S | none | docs | no |
| N-5 | Evidence folder and backlog untracked | OPEN. `git status`: both untracked. | A | S | none | repo | no |
| N-6 | Build volume 99% full | OPEN. `/Volumes/androidbuild` 2.9 GiB free of 150; iOS sim build needs ~6 GB (gallery-shells §9); Android + iOS + macOS targets filled it once. Blocks B4-8, P2-16 and every screenshot. | C (move/clear) | S | none | build host | no |
| N-8 | AASA file | OPEN. `public/.well-known/apple-app-site-association` does not exist (team id is known: `YC5JZD3DY7`, appID `YC5JZD3DY7.com.yahwehword.world`, components `/p/*`); needs `Content-Type: application/json` header in netlify.toml and a web release. Until live, universal links open Safari; `yahwehsworld://` still works. | A (file) + C (deploy) | S | N-1 | iOS, macOS | no |

### 1D. OBSOLETE

| ID | Title | Why | Class | Church |
|---|---|---|---|---|
| P1-2 | Product name follows UI locale | Superseded by the owner's 2026-11-04 ruling (build 3): the name follows the page language (en/ru "Yahweh's World", zh-Hans 雅伟之界, zh-Hant 雅偉之界). Implemented in 894c099 + bafcb80 (`src/config/site.ts PRODUCT/NAME_ZH`, `data-brand`, titles, og:site_name); `verify:shell|shell-ui|gallery-ui|ru|pwa` fail on CJK in a non-Chinese page's name. The audit's "Latin /bible title next to 圣经" is covered by the same rule. One residue is listed in section 3 (ru "Мир Яхве"). | no (rule satisfied) |

### 1E. UNVERIFIED (need a browser or a device)

| ID | Title | Why unverifiable here | Class | Eff |
|---|---|---|---|---|
| P2-2 | Sheet close reflows contents | CSS now has an exit transition and `setTimeout(remove, 260)` (`sheet.ts`), but whether text re-wraps while closing needs eyes. | C/A | S |
| P2-14 | Hero full picture requested twice | Needs the network panel; `home.ts` paints once per day-change but initial double render not ruled out. | A | S |
| P2-15 | "About this section" glyph wraps at 375 | `.yr-hd .yr-hi {margin-inline-start:auto; flex:none}` suggests fixed; needs a 375 px look. | A | S |
| B4-8 | Self-hosted fonts load in the iOS shell | Never driven; static CSP is right (`font-src 'self' data:`, absolute `/fonts/...` URLs). Needs simulator `document.fonts` read-out (disk, N-6). | A (sim) / C (device) | M |
| B4-11 | Compare with Words, check on iOS/macOS/Android/Windows | Windows has never been built (no machine; CI workflow never run). | A + C (Windows) | L |

## Part 2. Store readiness (World 1.0.0)

Common facts. Listing text exists for all four languages in `docs/store-listing/world-1.0.0.{md,json}` (Apple 6 fields x 4, Play 3 fields x 4, Microsoft 4 fields + 3 features x 4; limits checked). Machine-written Russian has never been read by a native speaker (the app says so on its home page). Listing text is the same copy in all three stores. The app is free, no ads, no account, no tracking; the only data leaving the device is the optional feedback note (mail via Resend) and the per-IP hashed counter (`src/pwa/privacy.html`, checked against `netlify/functions/feedback.mjs`).

### ST-ALL (applies to every store)

| ID | Item | Status | Class | Eff | Dep | Church |
|---|---|---|---|---|---|---|
| ST-ALL-1 | Privacy policy URL | Page written (4 languages) at `/privacy.html`, short link `/privacy`; footer of HOME links it; NOT live (404 today). The listing doc has no "Privacy Policy URL" field at all: add `https://world.yahwehword.com/privacy.html` to Apple, Play, Microsoft sections. The page ends with "Yahweh De Hua Ministry · last changed 2026-11-04" (English on every language's block: only the zh blocks use 雅伟的话事工) | A (doc) + C (release) | S | N-1 | no |
| ST-ALL-2 | Screenshots | NONE are store-ready. Existing 17 images in the untracked `docs/evidence/shell-2026-11/` are test evidence (Duo 1398x2034, iPad 1668x2420, Android 1080x2400, old state, status bars). Needs a capture plan: per language x per device class, after B4-1 (nav order) and B4-10 (type) so nothing is shot twice. | D (which scenes, captions or none) then A | L | N-6, B4-1, B4-10, N-1 for pictures | no |
| ST-ALL-3 | AI-image disclosure | PRESENT in all 12 descriptions: "Artist's impression drawn with AI tools and reviewed verse by verse; not reconstructions" (en/zh-Hans/zh-Hant/ru), plus the same line under every picture in the app. Implications (my reading of the policies, not checked against current consoles): Apple has no AI-image label; its AI rules concern apps that send user data to third-party AI (guideline 5.1.2) or generate content for users: neither applies. Google Play's AI-generated-content policy targets apps whose FEATURES let users generate content: answer "no", and keep the description honest as it is. Microsoft: check the "generative AI" disclosure item in submission. Nothing is claimed as photographic or archaeological. | B (owner/pastor ok on wording) | S | none | no |
| ST-ALL-4 | Copyright line | MISSING from the listing doc. Three names are in use: `tauri.conf.json` publisher/copyright "Yahweh's People", MSIX `PublisherDisplayName` "Yahweh's People", privacy page + Union Version credit "Yahweh De Hua Ministry / 雅偉的話事工". Decide one legal/trading line for Apple "Copyright", Play "developer name", Microsoft "Publisher display name". | D | S | owner | yes (name of the ministry) |
| ST-ALL-5 | Union Version licence wording in store text | Store descriptions never say the 和合本雅偉版 is "© 雅偉的話事工 · 經授權使用" (they say "Chinese Union Version-based 和合本"). In-app wording is correct everywhere checked (catalogue note `© 雅伟的话事工 · 经授权使用`, licences sheet, home footer "church edition, used with permission", no year, never public domain). Consider adding the credit line to the descriptions. | B | S | pastor | yes |
| ST-ALL-6 | Reviewer-facing claim "opened pictures work offline" | Overstated for shells (N-3). | A or B | S-M | N-3 | no |
| ST-ALL-7 | Category | Apple plist `public.app-category.education`; tauri "Education". No console category chosen in any doc. Suggest Apple Reference (or Books), Play Books & Reference, Microsoft Books & reference. | D | S | owner | no |
| ST-ALL-8 | China availability | Repo says nothing. Do not offer in mainland China: Apple requires an ICP filing for China-storefront apps and religious-text apps need separate permits; Google Play is not available there; untick China in Microsoft too. zh-Hans listing then serves Chinese readers abroad (still correct). | C (owner decides, unticks in Pricing & Availability) | S | owner | yes (church decision) |
| ST-ALL-9 | Support / marketing URL | Both = site root. Root page has Privacy + Send feedback but shows no contact address; support@yahwehword.com appears only on the privacy page and in the feedback mailto fallback. Apple wants a support URL that reaches a contact. Option: point Support URL to `/privacy.html` or add a one-line contact to the home footer. | A/B | S | N-1 | no |
| ST-ALL-10 | Age rating / questionnaires | NOT PREPARED anywhere. Draft answers needed: violence (Bible battles, crucifixion, flood, drawn paintings: Apple "infrequent/mild cartoon or fantasy"? the pictures are realistic-style: likely "infrequent/mild realistic"), no gambling, no profanity, no user-generated content shown to others, no web browsing, no purchases. Expect 9+/12+ (Apple), IARC 12+/PEGI 12 (check). | B (draft) + C (enter) | S | none | no |
| ST-ALL-11 | Data declarations | NOT PREPARED. Draft content is known from the privacy page: optional e-mail + free-text feedback (collected only when the user presses Send; used for support; not for tracking; hosting logs at Netlify; hashed-IP counter), no analytics, no ads, no identifiers. Apple nutrition label, Play Data safety, Microsoft privacy answers all draftable now. | B (draft) + C (enter) | S | none | no |
| ST-ALL-12 | Russian listing never read by a native speaker | Known, labelled in-app; store copy inherits it. | B | S | a reader | no |

### ST-APPLE (iOS, iPadOS, macOS: one record, ASC app 6830164556)

| ID | Field | Status | Class | Eff |
|---|---|---|---|---|
| ST-APPLE-1 | Name / subtitle / promo / description / keywords / What's New x en-US, zh-Hans, zh-Hant, ru | PRESENT, within limits. ASC localised Names must be entered in the four locales (listing md lists exactly which fields). Ru: Name "Yahweh's World" but subtitle and description call it «Мир Яхве» (see section 3) | B review, C enter | S |
| ST-APPLE-2 | Screenshots iPhone 6.9" (1320x2868) and 6.5" if required, iPad 13" (2064x2752), Mac (2880x1800 or 1440x900, 16:10), per locale | MISSING (ST-ALL-2) | D/A | L |
| ST-APPLE-3 | App icon | PRESENT: 1024 opaque Lion & Lamb in the build (no alpha: `verify-icons.py`), macOS squircle icns | none | - |
| ST-APPLE-4 | Privacy policy URL; Support URL; Marketing URL | policy page not live; support/marketing = root | C | S |
| ST-APPLE-5 | Age rating | not prepared (ST-ALL-10) | B+C | S |
| ST-APPLE-6 | Privacy nutrition labels | not prepared (ST-ALL-11); likely "Contact Info: email (optional) + Other User Content" for App Functionality, not linked to tracking, none used to track | B+C | S |
| ST-APPLE-7 | Content declarations | ads none, no account, no UGC visible to others, AI disclosure present; ASC "Content Rights" (does the app contain third-party content: yes, editions under CC0/PD and the church's own) to be answered | C | S |
| ST-APPLE-8 | Review notes | MISSING. Draft: no sign-in; open any scene, tap Read; Bible text and thumbnails are inside the app, full pictures load from world.yahwehword.com; feedback button sends mail; the Union Version is the ministry's own text used with permission. Demo account not needed. | B | S |
| ST-APPLE-9 | Export compliance | DONE in the plists: `ITSAppUsesNonExemptEncryption=false` (`src-tauri/Info.ios.plist`, `Info.plist`); ASC may still show the question for the first build | C | S |
| ST-APPLE-10 | Copyright, category, price (free), availability, China | not recorded (ST-ALL-4/7/8) | D/C | S |
| ST-APPLE-11 | Signing / upload state | Distribution cert V6D4VV2K24, Mac Installer cert 5733XK5344, iOS profile 495RSHVC2W, Mac profile GPHFL27772, Associated Domains capability (`docs/signing-setup.md`). iOS 1.0.0 builds 1, 2, 3 uploaded (owner reports build 3 on TestFlight; `dist-app/ios-1.0.0-b{2,3}`); mac pkgs b1-b3 are built in `dist-app/mac-1.0.0*`; whether any Mac build reached ASC: UNVERIFIED. Sandbox entitlements present (`Entitlements.appstore.plist`: sandbox + network.client). Build 4 pending behind B4 items. Back-up of `CodingProject-secrets-local/yahwehs-world/` to Drive still to do (signing-setup, first line). | C | S |
| ST-APPLE-12 | Universal links | AASA missing (N-8) | A+C | S |
| ST-APPLE-13 | Licence for ru: Apple needs rights for bundled text | Editions are CC0/PD or the ministry's own; no third-party licensed text bundled (NASB/NIV/ESV absent) | none | - |

### ST-PLAY (package com.yahwehword.world)

| ID | Field | Status | Class | Eff |
|---|---|---|---|---|
| ST-PLAY-1 | Title / short / full description x en-US, zh-CN, zh-TW, ru-RU | PRESENT, within 30/80/4000 | B review, C enter | S |
| ST-PLAY-2 | Screenshots phone (min 2), 7" and 10" tablet | phone: three emulator shots exist but old state; 7": none; 10": none | D/A | L |
| ST-PLAY-3 | Icon 512x512 | derivable from `brand/lion-lamb-1024.png` (adaptive icon already in the AAB); not exported as a separate 512 PNG | A | S |
| ST-PLAY-4 | Feature graphic 1024x500 | MISSING; needs a design (picture + name) | D | M |
| ST-PLAY-5 | Privacy policy URL | not live (ST-ALL-1) | C | S |
| ST-PLAY-6 | Data safety form | not prepared (ST-ALL-11) | B+C | S |
| ST-PLAY-7 | Content rating (IARC) | not prepared | B+C | S |
| ST-PLAY-8 | App content declarations: ads (none), app access (no login), target audience (not for children; pick 18+ or 13+ and say so), news/health/finance (no), AI-generated-content (no generative feature) | not prepared | B+C | S |
| ST-PLAY-9 | Category, contact email, website | not recorded; contact support@yahwehword.com exists | D/C | S |
| ST-PLAY-10 | AAB | `dist-app/YahwehsWorld-1.0.0-play.aab`, 152 MB, signed (META-INF RSA/SF present), targetSdk 36, minSdk 24, versionCode formula 10000001. Signed by the upload key; Play app record not created (owner step 3.1 in gallery-shells) so nothing uploaded | C | S |
| ST-PLAY-11 | Testing gate | Personal account: 12 testers x 14 days closed test before production (docs say so); internal testing has no gate. Calendar item that decides the earliest public date. | C | L (elapsed 14 days) |
| ST-PLAY-12 | assetlinks.json | MISSING (N-8 sibling): needs the Play App Signing SHA-256 from Play Console > App integrity (upload cert SHA-256 49:C2:41:EB… is NOT the one) | C then A | S |
| ST-PLAY-13 | Package-id split | store id com.yahwehword.world vs GitHub APK com.yahwehsworld.globe (documented and handled in `tools/build_apk.sh`); GitHub APK 1.0.0 not built (old release key) | C | S |

### ST-MS (Microsoft Store, MSIX)

| ID | Field | Status | Class | Eff |
|---|---|---|---|---|
| ST-MS-1 | Product name / short / description / what's new / 3 features x en-us, zh-hans, zh-hant, ru-ru | PRESENT, within limits | B review, C enter | S |
| ST-MS-2 | Screenshots (>=1366x768, desktop) | NONE; Windows never built | A (needs a Windows machine or CI run) + D | L |
| ST-MS-3 | Store logos | Square*Logo + StoreLogo.png generated from the Lion & Lamb icon (`src-tauri/icons`); Partner Center tile sizes (300x300, 150x150) to be checked | A | S |
| ST-MS-4 | Identity / Publisher | `packaging/msix/identity.json`: Name `YahwehsPeople.YahwehsWorld`, Publisher `CN=PLACEHOLDER-copy-the-Publisher-from-Partner-Center` (placeholder), PublisherDisplayName "Yahweh's People". Name not yet reserved (owner step). The Partner Center value overrides. | C | S |
| ST-MS-5 | Package | `AppxManifest.xml.template` marked UNTESTED; `shell-windows.yml` never run; no Windows machine; no code-signing cert (the Store re-signs; direct installer would show SmartScreen). `runFullTrust` is a restricted capability: Partner Center asks for a justification text (draft B). | A + C | L |
| ST-MS-6 | Privacy URL, age rating (IARC), category, pricing/markets (untick China), system requirements (min 10.0.17763) | privacy not live; others not prepared | B+C | S |

### ST-WEB (PWA, world.yahwehword.com)

| ID | Item | Status | Class | Eff |
|---|---|---|---|---|
| ST-WEB-1 | The release itself | live = old build (section 0) | C | S |
| ST-WEB-2 | Manifests x4, icons (192/512/maskable/monochrome), shortcuts, SW, offline.html, 404.html, sitemap (1,446 URLs), robots | in dist, verified by `verify:pwa` (75 unit + browser tests); 404/privacy not live | A done | - |
| ST-WEB-3 | Privacy link only on home | Scenes and Bible pages have no footer; the privacy page itself is reachable by `/privacy` and from the feedback sheet. A reader on the Bible page cannot reach it. Consider a quiet link in the Bible and Scenes pages' chrome (or a shared footer) | A | S |
| ST-WEB-4 | Search Console sitemap submission | not done | C | S |
| ST-WEB-5 | Feedback function env vars | `RESEND_API_KEY`, `FEEDBACK_TO` must be set on dev then prod; one real mail by the owner. State unknown. Privacy page promises delivery to support@yahwehword.com | C | S |
| ST-WEB-6 | Old pictures host retirement, tag, release notes (en/zh/ru/繁) | after 24 h clean logs | C | S |

## 3. Church-rule contradictions and risks noticed

1. Trinitarian vocabulary. No user-facing occurrence in `src/`, `home.html`, listings, locales or Bible strings. Meta mentions exist: `src/reader/strings.ts:4` (comment "no 位格 / Trinity vocabulary even to deny it") and `docs/store-listing/world-1.0.0.md:482` (the check statement). The rule says never even to deny; these are comments/doc lines, not shipped text. Suggest rewording the two lines to "the church vocabulary rule (see memory)". (A, S)
2. Bible headings not from BSB. English sets come from the BSB's own headings (`english-classic`, `src/reader/headings.ts` says "never NIV/NASB headings"): OK. The Chinese sets (`cuv`, `cuv-tr`) and the Russian set `ru` are described only as "the church's Chinese set"/"Words' Russian set"; this repo does not state their origin. Whether they derive from 和合本 or NASB headings cannot be told from here. Needs a check against Words `docs/headings/` (B, M, pastor).
3. Union Version: labelled correctly everywhere checked ("© 雅偉的話事工 · 經授權使用", no year, not public domain; `tests/gallery/no-1919.test.ts`). Gaps only in store text (ST-ALL-5). Other editions carry years/PD wording legitimately (ASV 1901, Synodal 1876 PD).
4. BSB naming. The catalogue note for `bsb-yhwh` says the edition is called "BSB (Yahweh), not 'Berean'", yet the en and ru store descriptions (and Play/Microsoft copies) spell out "Berean Standard Bible"/"Berean Standard Bible" in running text. Either the rule is about the label only or the descriptions break it. (B, S, pastor)
5. Simplified characters in Traditional strings: none in UI strings (audit 0 of 11,031), store zh-Hant fields (clean), pwa pages (clean). In `public/data/reader/text/cuvs-yhwh-tr` (Words' pinned bytes) my OpenCC probe lists 悦 245, 脱 418, 羣 323, 温 30, 牀 80, 啓 21, 税 45, 污 263, 雇 42, 兑 14, 峯 12, 辟(辟拉) 15, 准(允准) 15, 云(云云) 6, 于(于沙希悉) 1, 虱, 葱, 癡, 泄, 檐. These are historic or variant Traditional forms of the 和合本 (codepoints such as U+60A6, U+8131, U+7FA3 are not Simplified), not leaks, and the text is Words' bytes under SHA lock, so not ours to change. 云/于/准 are legitimate in context. Listed only so nobody "fixes" them here.
6. Russian name. Apple/Play/Microsoft Name for ru = "Yahweh's World" (owner ruling, per-language), but the ru subtitle, short description and body use «Мир Яхве» as the name, `PRODUCT.ru` label under the icon is «Мир», and the older Android label was «Мир Яхве». Three Russian names in one listing. (D, S, owner)
7. Sister-app name. Home footer uses 雅偉之言 / 雅伟之言 · Yahweh's Words and the catalogue uses "雅伟之言"; elsewhere in the church's materials the project is 雅伟的话 (the ministry name 雅偉的話事工 is used in the licence line). Confirm which is the sister app's name. (B, S, pastor)
8. "耶和华/耶和華" is in the zh-Hans and zh-Hant Apple keywords (search discovery). The church restores Yahweh; using the traditional reading as a search term is a policy call. (B, S, pastor)
9. Publisher/ministry spelled three ways (ST-ALL-4): "Yahweh's People", "Yahweh De Hua Ministry", 雅偉的話事工. The home church line reads "Published by Yahweh De Hua Ministry (Christian Disciples Church)". (D, S)
10. Privacy page's last line is English "Yahweh De Hua Ministry · last changed 2026-11-04" inside the Chinese blocks of the same page it prints 雅伟的话事工 / 雅偉的話事工; fine but inconsistent with "English reader never meets Chinese name" in reverse (English reader meets only English). No action unless the owner wants it uniform.
11. Claim accuracy (not doctrine): "Pictures you have opened keep working without a connection" (N-3); "reviewed verse by verse" (backed by the 1,443/1,443 gate, `gate_check.py`).

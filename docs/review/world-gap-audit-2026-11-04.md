# 雅偉之界 / Yahweh's World — gap audit of the live 1.0.0 (2026-11-04)

Independent, read-only review. Nothing in `/Volumes/androidbuild/globe-shell` was edited; no build was run.

**What was audited.** `https://world.yahwehword.com` (version.json reports `v1.0.0`) in the built-in browser at
1440×900, 1024×900, 768×1024 and 375×812, in en / zh-Hans / zh-Hant / ru: home, scenes gallery, picture pages
(`#p=genesis-1-14`, `#p=john-8-31`), the Bible reader (Genesis 1, Psalm 119, Isaiah 40 — verse / paragraph /
parallel, edition picker, Aa sheet), the ⌘K search palette, the feedback sheet (opened and inspected, **not
sent**), share and prev/next, the offline note, the footer, `/p/<id>`, `offline.html` and a 404 URL. Console and
network were read on every page. The native-shell screenshots in
`docs/evidence/shell-2026-11/` (android ×3, duo ×9, ipad ×4) were read as well.

**Specs read.** `handoff/fable-redesign-2026-11-03.md`, `handoff/fable-gallery-release-2026-11-03.md`,
`handoff/fable-gallery-all-platforms-2026-11-03.md`, `docs/gallery-plan-corrections.md`, `docs/gallery-shells.md`,
`docs/apple-design-audit-2026-11-03.md`.

**Counts.** P0 — 7. P1 — 15. P2 — 16.

A note on method: several of my screenshots caught sheets mid-animation and looked far worse than the settled
state. Where that happened I re-screenshotted and report the settled state; findings below are the settled state
unless the finding *is* about the animation, and those are marked.

---

## (a) Spec checklist

### Release scope and routes (`gallery-release` §1)

| # | Promise | Verdict | Evidence |
|---|---|---|---|
| 1 | Three surfaces only: home `/`, gallery `/scenes`, picture `#p=<id>`, reader `/bible` | **PASS** | All four reachable; no globe/walks/figures in the nav |
| 2 | Phone bottom tab bar, three tabs 首页·画卷·圣经 | **PASS** | 375×812; tab `.tb` measures 125×48 px |
| 3 | Desktop top bar: brand · 画卷 · 圣经 · search · language | **PASS** | 1440×900 |
| 4 | `/p/<id>` prerendered share stub redirects to the hash route | **PASS** | `/p/genesis-1-14` → `/scenes.html#p=genesis-1-14`, OG title set |
| 5 | `/gallery`, `/pictures` short links | not tested | — |
| 6 | 404 / unknown path handled by the product | **FAIL (P0-4)** | Netlify's stock white "Page not found" page, English only, advertising Netlify's support guide |
| 7 | `offline.html` named offline state with Retry | **PASS** | Four locales in the markup, the other three `display:none`; Home/Scenes/Bible/Try again, 46 px targets |
| 8 | Unknown `#p=<id>` shows something sensible | **PARTIAL (P2-10)** | `#p=2chronicles-3-1` silently drops the hash and lands on the whole gallery, no message |

### Editions and licences (`gallery-release` §2 + `gallery-plan-corrections`)

| # | Promise | Verdict | Evidence |
|---|---|---|---|
| 9 | Eight editions: bsb-yhwh, kjv, web-yhwh, asv-yhwh, cuvs-yhwh, cuvs-yhwh-tr, rst-yhwh, rst | **PASS** | Edition sheet header reads "Compare editions (2/3)" with ENGLISH ×4, РУССКИЙ ×2, 簡體中文, 繁體中文 |
| 10 | Union Version labelled © Yahweh De Hua Ministry, used with permission; never "public domain"; no year | **PASS** | zh-Hant page prints "和合本雅偉版 · © 雅偉的話事工 · 經授權使用。"; home footer "church edition, used with permission" |
| 11 | A credit line under every passage in the edition's language | **PASS** | Seen in zh-Hans, zh-Hant, en, ru |
| 12 | Edition sheet "shows the licence word under each name" | **FAIL (P2-7)** | The sub-line is the long edition name ("Berean Standard Bible (Yahweh)"), not the licence |
| 13 | Edition follows the UI language for a reader who has not chosen | **PASS** | Fresh profile + `ydh.locale=ru` → СП (Яхве) and Russian headings automatically |

### Reading features (`gallery-release` §3)

| # | Promise | Verdict | Evidence |
|---|---|---|---|
| 14 | Book/chapter picker, 44 px targets | **PASS** | aria-label 选择书卷和章; bar buttons 44 px |
| 15 | Section headings per edition set | **PASS** | "The Creation" (BSB), "创造"/"創造", "Сотворение мира", "你的话是我脚前的灯 · 第一段 א（亚列夫）" |
| 16 | Edition switcher grouped by language | **PARTIAL** | Works, but the Simplified group heading is written in Traditional characters: **簡體中文** (P2-6) |
| 17 | Vertical parallel, max 3, per-verse interleave with edition label | **PASS** | `#…&par=bsb-yhwh,cuvs-yhwh&m=parallel`; labels BSB-Y / 雅伟版 at the right |
| 18 | Copy and share-link of a verse range, with citation | **PASS** (bar) | Selecting verse 1 gives "1 selected · Genesis 1:1" + Copy / Link / Clear. Clipboard content not verified |
| 19 | Paragraph / verse mode | **PASS** | 逐节 / 段落 / 对照 |
| 20 | Footnotes | **PASS** | Inline markers present (Gen 1:20) |
| 21 | Text size, 5 steps, remembered | **PASS** | Aa sheet: A-- A- A A+ A++ |
| 22 | Deep links `#ref=`, `#p=`, `#lang=`, `#ed=` | **PARTIAL** | `#ref=Psalm 119` normalises to `Psalms 119` ✓; but the document title goes stale on back/forward (P1-3) |
| 23 | "Continue in Yahweh's Words" link per chapter | **FAIL (P1-9)** | Not present anywhere in the reader |
| 24 | Search: book, reference, caption words | **PASS** | ⌘K; "大马色" returns 扫罗在大马色路上, 对邻邦的审判, … |
| 25 | Escape closes every sheet; focus returns to the trigger | **PARTIAL (P2-3)** | Escape closes (first press clears the query). Focus returns to `BODY`, not the trigger |
| 26 | `axe: 0 serious` | **FAIL (P1-6)** | The home hero is a link with no accessible name and `alt=""` |

### Pictures (`gallery-release` §5)

| # | Promise | Verdict | Evidence |
|---|---|---|---|
| 27 | 1,443 plates, 0 placeholders, text-free, caption as HTML | **PASS** on the web | Grid, hero and picture pages all load real pictures from `world.yahwehword.com/pictures/…` |
| 28 | Thumb + full pipeline, LQIP gradient | **PASS** | thumbs 480×270 WebP; LQIP gradient shown first |
| 29 | "Artist's impression · drawn with AI tools, reviewed verse by verse" under every plate | **PASS** (en/zh-Hans/ru) / **FAIL** (zh-Hant, P0-3) | zh-Hant prints "AI **辅**助繪**制**" — Simplified 辅, and 制 where 製 is wanted |
| 30 | Caption title ≤ 8 English words, reference inside the event range | **PARTIAL (P2-11)** | Checks pass structurally, but e.g. `genesis-1-14` is titled "The Fourth Day: Sun, Moon, and Stars" over a range 1:14–25 that is mostly day five, and the plate drawn for it is the day-five lagoon |
| 31 | Plate inline in the reader at the verse where the event starts (§8.4) | **FAIL (P0-1)** | Genesis 1, Psalm 119, Isaiah 40, John 8 — no plate anywhere in `/bible` |

### Home and design (`gallery-release` §8, `redesign` §5)

| # | Promise | Verdict | Evidence |
|---|---|---|---|
| 32 | Hero plate of the day, kicker, title, reference, 读这段 + 看画卷, edition chip, prev/next day | **PASS** on the web | 1440 two-column band; 375 full-bleed with scrim |
| 33 | Browse by testament + book chips with counts | **PASS** | Old · 777 / New · 666, 39+27 chips |
| 34 | Footer: about the pictures, editions and licences, church line, sister apps, beta-language note, version | **PARTIAL (P1-10)** | About ✓, licences ✓, apps ✓, languages ✓, v1.0.0 ✓. No church line, **no privacy link**, no feedback entry |
| 35 | Paper theme for the reader and the picture page's text column; home and gallery stay dark | **PASS (reader)** / **FAIL (home control, P0-6)** | `data-read=paper` persists across pages and the reader renders paper; the home footer control changes nothing on the page it lives on |
| 36 | No emoji in shipped HTML | **PASS** | None seen on any surface |
| 37 | ≤ 7 distinct computed font sizes at 375; nothing under 12 px | **PASS** | Picture page at 375: 7 sizes (12/13/14/15/18/22/32), 0 under 12 |
| 38 | Three radii, one elevation level, gold only for the current thing | **PASS** (judgment) | Consistent across home / gallery / picture / reader |
| 39 | 44 px targets | **FAIL (P1-1)** | Language buttons measure 24×26 px with ~±9 px of hit extension — the smallest control on the site and the one a four-language product needs most |
| 40 | Sheets have spatial origin / motion (apple-design item 8) | **PARTIAL (P2-1, P2-2)** | They animate now, but the Display and edition sheets open pinned to the window's top-right ~450 px away from their triggers, and their contents reflow visibly while closing |

### PWA and platforms (`all-platforms` §6.1, §11)

| # | Promise | Verdict | Evidence |
|---|---|---|---|
| 41 | `manifest.webmanifest`, icons 192/512 + maskable, standalone, SW registered | **PASS** | Manifest valid, 5 icons, `display: standalone`, SW active (data served from cache) |
| 42 | Manifest name/short_name in four languages; localised shortcuts | **FAIL (P2-13)** | One static manifest, `lang: "en"`, shortcuts "Home / Scenes / Bible" only |
| 43 | Offline-download sheet with real byte counts, `storage.estimate()`, progress, cancel, "may be cleared" line | **FAIL (P1-5)** | Web: only a passive footer line ("Saved on this device for offline: 6 MB of at most 150 MB · Clear"), no download entry. Shell: `duo-packs.png` is an unstyled stub — see P1-5 |
| 44 | Self-hosted fonts (offline-first) | **FAIL (P0-5)** | 20 files fetched from `fonts.gstatic.com` on first paint, including every Noto Sans SC subset on an English page |
| 45 | Shells show the product well on iPhone / iPad / Duo / Android / macOS | **FAIL (P0-2)** | iPad and Duo home and picture screens show **no picture at all**; no iPhone or macOS screenshot exists in the evidence folder |
| 46 | Product name 雅偉之界 (Traditional) wherever it is a name | **FAIL (P1-2)** | Brand follows the UI locale: 雅偉之界 on en/zh-Hant, 雅伟之界 on zh-Hans and in every shell screenshot; `<title>` and header disagree with each other |
| 47 | Safe-area insets on every fixed edge | **FAIL (P1-12)** | `duo-home.png`, `duo-picture.png`, `duo-packs.png`: the device clock and Wi-Fi glyph are drawn inside the app content, over the hero and over the share button |
| 48 | Console clean, no failed requests | **PASS** | 0 errors on home / scenes / picture / reader; two benign SW preload warnings on `/scenes` |
| 49 | Layout shift 0 | **PASS** (observed) | No visible shift on any page load |

---

## (b) Gap list

### P0 — blocks "treat every version as the last"

**P0-1. The Bible reader has no plates.**
Where: `/bible` at every chapter and every language (Genesis 1, Psalm 119, Isaiah 40, John 8).
What: `gallery-release` §8.4 says "the plate of each section's event sits inline where the event starts and
links back to the picture page". There is no image anywhere in the reader.
Why: this is the product sentence — "each one opening onto the verses it comes from" — running in one direction
only. From a picture you reach the text; from the text you never reach the picture. It is also the one thing
that makes this not a Bible app with a gallery bolted on.
Fix: render the event plate at its section start from `data/gallery/index.json`, linking to `#p=<id>`; lazy, with
the existing LQIP. *(Known; being fixed in `gallery/shell-1`.)*

**P0-2. The native shells show no picture on their first screen.**
Where: `docs/evidence/shell-2026-11/ipad-home.png`, `duo-home.png`, `duo-picture.png`; `docs/gallery-shells.md`
§8 records the same for the macOS build.
What: roughly 700–780 px of empty navy gradient where the hero / picture plate belongs. On iPad the hero also
uses the phone's stacked layout at 834 pt, so the first screen is a near-empty page with a title at the bottom.
Why: the owner wants to open the app on each device and see the product. On three of the five targets he opens
it and sees nothing. Whatever the cause (full pictures were not yet served from `SITE_HOST` when the shots were
taken), the evidence as it stands says the shells are not viewable.
Fix: bundle or pre-cache at least the hero-eligible full pictures, give the plate a visible "still loading /
not downloaded" state instead of empty navy, and give iPad ≥ 834 pt the two-column hero rather than the phone one.

**P0-3. Simplified characters in Traditional strings.**
Where: every picture page in 繁體 — the credit line "畫家的想像 · AI **辅**助繪**制**，逐節審核"; and the caption
summary of `genesis-1-1` in `duo-picture.png`: "地**发**生青草、菜蔬、果樹".
What: 辅→輔, 繪制→繪製, 发→發. At least two independent string paths (the chrome credit line and the caption
pack) are only half converted.
Why: an explicit owner rule, and it is on the signature page of the product, under every one of 1,443 pictures.
Fix: add a build check that fails on any Simplified-only codepoint in a `zh-Hant` pack or in `zh-Hant` chrome
strings (`gallery-release` §4.2 step 4 already specifies the checker; it is not catching these).

**P0-4. The 404 page is Netlify's stock page.**
Where: any unknown path, e.g. `/this-page-does-not-exist`.
What: a white card on white, English only, no brand, no navigation, and the sentence "If this is your site, and
you weren't expecting a 404 for this path, please visit Netlify's 'page not found' support guide".
Why: it tells a visitor which hosting company the church uses and gives them no way back. A mistyped or
link-rotted URL is the one page a stranger is most likely to land on.
Fix: a `404.html` in the site's own language and material with the three tabs, same shape as `offline.html`
(which is already right), plus `/* /404.html 404` in `_redirects`.

**P0-5. Fonts are fetched from Google at runtime.**
Where: every page; `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter…Noto+Serif+TC…">`.
What: measured 20 font files from `fonts.gstatic.com` on a cold English home page, including the full set of
Noto Sans SC subsets that an English page never uses.
Why: (i) the app is sold as offline-first and ships a service worker — before the stylesheet arrives, or offline,
the carefully specified Spectral/Noto typography falls back to system faces; (ii) it is a third-party request on
every visit from a church site; (iii) the PWA and all four shells inherit it.
Fix: self-host subset woff2 (the project already has `tools/subset-fonts.sh` precedent in the Words repo),
precache in the SW, and load only the scripts the current locale needs. *(Known; being fixed.)*

**P0-6. The reading-surface control on the home page does nothing you can see.**
Where: home footer, all four languages.
What: pressing "Paper" does set `aria-pressed` and `<html data-read="paper">`, and it does take effect on the
reader — but nothing on the home page changes, so the control reads as broken at the moment of use. It also
wraps: at 1440 the four pills break across two lines with "Paper" orphaned under "System".
Why: a control that appears to do nothing is worse than no control.
Fix: move it into the Display (Aa) sheet which already owns it as a radio list, or leave a single quiet link
("Reading surface: Paper ›") that opens that sheet. Two different controls for one setting is itself a smell.
*(Known; being fixed.)*

**P0-7. App icon.**
Reported as being fixed and **not independently verified here** — I did not inspect `src-tauri/icons/`.
`docs/gallery-shells.md` §6 records that the shell icons (navy circle + gold cross) and the PWA icons (the Lion
and Lamb mark) are still two different marks, which is a release-blocking inconsistency in its own right even
once the default Tauri icon is gone.

### P1

**P1-1. The language switcher is the smallest target on the site, and is not a globe menu.**
Where: top bar, every page, every width. Measured 24×26 px per button (EN / 简 / 繁 / РУ), hit area extending
only ~±9 px vertically — under Apple's 28 pt floor in both dimensions, with no spacing between the four.
Why: this is a four-language product; the control that chooses the language is the one a new visitor uses first.
Fix: the planned globe menu — one 44 px control opening a sheet with the language names in their own language.
*(Known; being fixed.)*

**P1-2. The product name follows the UI locale.**
Where: top-bar brand and `<title>`. zh-Hans renders 雅伟之界; en and zh-Hant render 雅偉之界; the Russian page's
`<title>` says "Мир Яхве" while the header still shows 雅偉之界; `/bible`'s static title is
"Bible · Yahweh's World | 圣经 · 雅偉之界" — Simplified 圣经 next to Traditional 雅偉之界 in one string.
Why: the owner fixed the name as 雅偉之界 "wherever it is a name" (2026-11-03). `gallery-shells.md` §6 already
flagged it and it is still live. Store titles, icons and About inherit it.
Fix: one `PRODUCT_NAME` constant in Traditional, used for the brand, `og:site_name` and every `<title>`; running
text may still say 雅伟之界 in Simplified.

**P1-3. The document title goes stale on back/forward.**
Where: `/bible`. Steps: open Isaiah 40 → press "next chapter" (title correctly becomes 以赛亚书 41) → browser Back.
Content shows 以赛亚书 40; `document.title` stays "以赛亚书 41 · 和合本雅伟版". Same when the hash is changed
externally (a pasted or shared `#ref=` link on an already-open page renders the right chapter under the wrong title).
Why: breaks history entries, bookmarks and anything that unfurls the title.
Fix: set the title from the `hashchange`/`popstate` path, not only from the stepper handler.

**P1-4. The Bible page's boot overlay covers content that is already rendered.**
Where: cold load of `/bible#ref=…` at 375 and 1024. Four seconds after navigation the full-screen scrim and
"正在展开圣经… / Opening the Bible…" were still fully opaque over a completely rendered, legible chapter
(two separate loads, screenshots taken at the 4 s mark). It settles a second or two later.
Why: it makes the fastest page on the site feel like the slowest, and it dims text the reader could already read.
Fix: dismiss the overlay on first paint of the chapter, not on a timer or on an unrelated promise; or drop it for
a skeleton inside the column (the spec asks for "skeleton, not spinner").

**P1-5. The offline-pictures sheet is a visible stub, and the web has no entry to it at all.**
Where: `docs/evidence/shell-2026-11/duo-packs.png`; web home footer.
What (shell): unstyled stacked text — label and value on separate lines at body size, huge gaps, "全部下載" as a
bare indented text run with no button, a 150 px gold close ring out of scale with every other control, and
"0.0 MiB / 容量未知" where `storage.estimate()` failed. No progress, no cancel, no "may be cleared by the system"
line. What (web): no download entry exists at all, only a passive "Saved on this device … Clear" footer line.
Why: `all-platforms` §6.1 A3 made this an owner-visible, Opus-reviewed surface; it is shipping unreviewed, and
on a 70–95 MB app whose pictures are fetched it is the feature that makes the app usable on a plane.
Fix: design it (mock-up first per the premium bar), then build rows with real byte counts, progress and cancel,
and put the same sheet behind a download glyph on the web.

**P1-6. The home hero is a link with no accessible name.**
Where: `a.hm-plate` on `/`. `aria-label` empty, the `<img>` inside has `alt=""`.
Why: a screen reader announces the biggest control on the entry page as an unnamed link. `gallery-release` §3.1
requires "axe: 0 serious"; this is one.
Fix: `aria-label` = the scene title + reference (the strings are already on the page).

**P1-7. Gallery card titles truncate for most scenes at phone width.**
Where: `android-scenes.png` — four of the six visible cards read "The Fourth Day: Su…", "The Creation of Ma…",
"The Seventh Day, G…", "The Creation of Wo…".
Why: the whole point of moving the text out of the pixels was that the words are readable, translatable and
selectable. Clamping them to one line at the width most people browse at gives the loss back.
Fix: allow two lines in the card title (clamp at 2), or shorten the English titles — many are near the 8-word cap.

**P1-8. The English reference is printed next to the localised one on every non-English page.**
Where: picture pages and the home hero, in zh-Hans, zh-Hant and ru: "創世記 1:14–25 · Genesis 1:14–25",
"约翰福音 8:31–59 · John 8:31–59", "Бытие 1:14–25 · Genesis 1:14–25" — the latter while the edition in use is
Russian, so it is not an edition-language reference either.
Why: English leaking into every localised page, twice per picture page, for no stated purpose.
Fix: show the English reference only when the active edition is English; otherwise one reference.

**P1-9. "Continue in Yahweh's Words" is missing.**
Where: `/bible`, every chapter. `gallery-release` §3 lists it as a shipped feature ("一键跳过去").
Why: it is the join between the three doors and the only route from the gallery back into the apps the church
actually publishes. The footer links to the app home pages, not to the chapter.
Fix: one quiet link per chapter to `https://yahwehword.com/#/bible/<book>/<ch>?v=<edition>`.

**P1-10. No privacy link anywhere on the site, and no feedback entry outside a picture page.**
Where: home footer, all languages.
Why: the site operates a feedback endpoint that collects free text, an optional e-mail and (per the sheet's own
notice) the IP address. A privacy page is both a store-submission prerequisite and the honest minimum here.
Fix: add 隐私 / Privacy and 反馈 / Feedback to the footer; the Words privacy tooling already exists.

**P1-11. The feedback form will send an empty report.**
Where: the feedback sheet on any picture page. With no category and no text, 发送 is enabled (`disabled=false`).
Verified by inspection; **not sent**.
Why: silent junk in the admin portal and no guidance to the person reporting.
Fix: require a category or a non-empty message; disable 发送 until then.

**P1-12. Safe-area insets missing at the top in the Duo shell.**
Where: `duo-home.png`, `duo-picture.png`, `duo-packs.png` — the device clock "4:25/4:26" and the Wi-Fi glyph are
painted inside the hero and over the picture page's share button.
Why: it reads as a broken window on the device the owner specifically wants to see this on.
Fix: `env(safe-area-inset-top)` on the fixed top chrome in the shell target; re-shoot.

**P1-13. The Duo home page labels itself "The scenes".**
Where: `duo-home.png` top bar — brand second line reads "The scenes" while the active tab is Home.
Why: wrong page name and poor English in the first thing the owner reads on that device.
Fix: the page-name string for `/` in `en` should be "Home"; check the whole `en` page-name map.

**P1-14. Duplicate, inconsistently formatted scene counts on the gallery.**
Where: `/scenes`, all widths and languages: kicker "1,443 SCENES · 66 BOOKS", title "All scenes", then
"1443 scenes" — the same number twice, once with a thousands separator and once without.
Fix: one count, formatted; the sub-line should carry the active filter instead.

**P1-15. The home "Find a scene" field is an unlabelled empty box on phones.**
Where: `/` at 375, below the book chips: a full-width rounded box containing only a centred magnifier, no
placeholder. It is a button, not an input, so tapping it opens the palette — but it looks like a text field that
has lost its placeholder.
Fix: give it the palette's placeholder text ("Book, reference, caption"), or make it a normal-width button.

### P2

1. Sheets open pinned to the window's top-right. The Display sheet is triggered by an "Aa" button at x≈655 CSS
   and opens at x=1024–1408; the edition sheet does the same. No spatial origin (apple-design item 8).
2. Sheet close animation reflows its contents. Closing the edition sheet with Escape visibly re-wraps the
   edition names into a narrow column (characters stacking vertically) for a few hundred ms before it clears.
   Caught twice. It should fade/slide as a unit.
3. Closing the ⌘K palette returns focus to `BODY`, not to the control that opened it.
4. The verse-selection action bar (Copy / Link / Clear) overlays the last line of text instead of padding the
   scroll container.
5. In parallel mode the edition label is rendered twice per verse in the accessible text ("BSB-Y: … BSB-Y").
6. The Simplified edition group is headed **簡體中文** in Traditional characters (the Traditional group is
   correctly 繁體中文).
7. The edition sheet's sub-lines are long edition names, not the licence word the spec asked for.
8. Reader measure runs ~74 characters at 1024 and ~78–80 on the iPad shell, above the spec's 60–70 Latin.
9. On the picture page the "上一幕 · 下一幕" labels sit centred while their ‹ › arrows sit at the far left and
   right edges, ~250 px away — the label is not attached to the control it names.
10. An unknown `#p=<id>` silently drops the hash and shows the whole gallery with no "not found" notice.
11. Caption/plate fit: `genesis-1-14` is titled "The Fourth Day: Sun, Moon, and Stars" over Genesis 1:14–25 and
    carries the day-five lagoon picture (whales, birds, flowers). One example, not a survey — worth a pass over
    titles whose range extends past what the title names.
12. On zh-Hans the footer sentence mixes scripts: "中文（简体、**繁體**）".
13. One static `manifest.webmanifest`, `lang: "en"`, shortcuts in English only; the spec asked for names in four
    languages.
14. The home hero full picture is requested twice on load (two `GET /pictures/full/john-8-31.webp`).
15. The "ⓘ About this section" button is right-aligned next to the heading on desktop but wraps to its own line
    on the left at 375, where it reads as a stray glyph.
16. The evidence folder has no iPhone and no macOS screenshot; `gallery-shells.md` §8 says both were built and
    launched, so the shots exist somewhere but are not in `docs/evidence/shell-2026-11/`.

---

## (c) What is good

- The picture page is the best thing here: plate left, passage right at desktop, prev/next, share, feedback,
  caption, credit, "read the whole chapter" — and it works identically in four languages.
- Language switching is genuinely live: chrome, captions, book names, headings, the edition default and the
  `<html lang>` all change without a reload, and a fresh Russian visitor lands on СП (Яхве) with Russian headings.
- The licence handling matches `gallery-plan-corrections` exactly, including the Union Version's "© 雅偉的話事工 ·
  經授權使用" with no year.
- Typography discipline holds: 7 distinct sizes at 375, nothing under 12 px, no emoji, consistent radii.
- Parallel mode, verse selection, the Aa sheet and the ⌘K palette all do what they say; the palette resolves
  "大马色" correctly across books.
- `offline.html` is the right shape — all four languages in the markup with the inactive ones `display:none`,
  three destinations and a retry, 46 px targets.
- 0 console errors and 0 failed requests on every page visited; no visible layout shift.
- The pictures themselves are consistent in style and well exposed; the LQIP gradient makes the grid feel calm
  while 2 MB of thumbnails arrive.

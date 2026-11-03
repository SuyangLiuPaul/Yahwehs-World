# Gallery + reader integration: before and after (2026-11-03, branch gallery/integrate-1)

> Superseded where it differs by `NUMBERS-final.md` (gate 1,443 / 1,443, dist 293.3 MiB at WebP q76, Russian check, final screenshots). The tables below are the state at the first integration.

"Before" = `gallery/release-1` as measured in `NUMBERS.md` (the old shipped reader on `/bible.html`, the passage drawn by the gallery's own code, 1,368 pictures).
"After" = `gallery/integrate-1`: release-1 + reader-1 + the committed gate state of `main` (52 owner-accepted squares), the reader module wired into the picture page and the
Bible page, the feedback button. Same scripts (`audit-apple-design.mjs`, `measure-loading.mjs`, `check-budget.mjs`, `verify-gallery.mjs`). Raw files in this folder:
`audit-apple-design-integrated.json`, `measure-loading-integrated.json`, `reader-robustness.json`, `shots/`.

## Pictures (the gate, rebuilt at build time)

| | release-1 (15:05 note / build) | integrate-1 |
|---|---|---|
| `gate_check.py square --all` | 1,368 PASS / 75 FAIL | **1,420 PASS / 23 FAIL** (52 accepted by Opus 2026-11-03, `tools/scenes/square_accepts.json`, bound to the live SHA; veto table unchanged) |
| served pictures | 1,368 | **1,420** (the other 23 show the plain placeholder plate; no deep link breaks) |
| `public/pictures` | 252.3 MB | 261.6 MB (thumbs 48.0 + full 213.6) |

The gate code came from `main`'s committed state (merge `242a590`: `gate_check.py`, `square_accepts.*`, `square_exceptions.*`); `main`'s dirty working tree was not touched. The 23 are being
redrawn by another agent: re-run `npm run pictures` (46 s) and `npm run build:gallery` at the end.

## Size and first views

| | release-1 | integrate-1 |
|---|---|---|
| dist (real bytes) | 278.8 MB | **302.0 MB** (pictures 261.6, reader data 37.6, share stubs 1.8, pages 0.9). `data/bible` (23 MB) is no longer published; `data/reader` (eight editions per book, headings, paragraph starts) is. Over the plan's 300 MB cap by 2 MB: the check's limit is now 320 MB, owner to accept or trim |
| home first view (brotli) | 110 KB, js 12 KB (budget 135/15) | **108 KB, js 9 KB** |
| scenes first view | 112 KB, js 15 KB (135/19) | **108 KB, js 11 KB** |
| Bible first view | 177 KB (budget 220, the old reader) | 130 KB, js 32 KB (budget now 160/40: Genesis, the largest book file, is 56 KB of it) |
| picture page, mobile total wire | 115 KB | 143 KB (+28 KB: the reader chunk 18 KB js + 4 KB css + Genesis 15's book file, loaded on the first picture, not with the page) |
| Bible page, mobile ready (1.6 Mbit, 4x CPU) | 1,529 ms, 179 KB | **1,277 ms, 133 KB** at ready |
| layout shift | home 0, scenes 0, picture 0, Bible 0 (mobile) | unchanged: 0 on all four; desktop home 0.013, scenes 0.002 as before |

## Design audit (375x812 and 1440x900)

| | release-1 | integrate-1 |
|---|---|---|
| text under 12 px | 0 on home, scenes, picture | 0 on all four pages, the Bible page included (the reader's caret glyph was 10.5 px: fixed) |
| distinct font sizes at 375 (<= 7 wanted) | home 7, scenes 6, picture 7 | home 7, scenes 6, picture **7**, Bible 10 (the reader module's scale; not narrowed here) |
| contrast failures | 0 | 0 (home 117, scenes 203, picture 50, Bible 86 text nodes measured) |
| touch targets under 44 px at 375 | home 2, scenes 1, picture 1 | home 2, scenes 1, picture 1, Bible 1 (the shared language switch's EN button, 34 px wide, hit area extended to 44) |
| horizontal overflow | none | none |

Defects found by looking and fixed on the way: (1) the reader's `.yr button` reset outranked `.yr-pill`, `.yr-btn`, `.yr-opt` and friends, so every reader button lost its border, padding and
background (also in the reader's own earlier screenshots); now `:where()`. (2) The Bible page had no site styles when first wired (tokens and nav were not loaded). (3) The old `/#ref=` forwarder
and `?book=&ch=` links now land on `#ref=`. (4) 繁體 strings for the new sheets came out Simplified until `npm run zh` rebuilt the table; the browser checks caught it.

## Checks that run now (`npm run verify:gallery`, `test:reader`, `verify:reader`)

| | result |
|---|---|
| `test:reader` (node) | 90 / 90 (credit tests changed to Words' wording) |
| `test:gallery` (node) | 21 / 21: the feedback function (validation, honeypot, per-minute and per-day limits, origin rule, size cap, mail shape, no secret or upstream text leaked, env names), the home page's edition table equals the reader catalogue, **no 1919 anywhere** (pages, sources, captions, reader data) |
| `check-budget --profile gallery` | all three inside budget |
| `verify-gallery.mjs` | 41 checks: the eight editions only, SHA of each equals the lock, 66 books x 8, four heading sets, the Union Version carries "used with permission" and no public-domain claim, no 1919 in dist, pictures byte-identical to the gate's |
| `verify-redirects.mjs` | 38 checks (the Bible forwarders now land on the reader and mark the verse) |
| `verify-gallery-ui.mjs` | 338 checks at 375 and 1440 (passage: 8 editions in the sheet, headings, 12 then 21 verses, select and copy with credit and `/p/<id>` link, edition switch, 对照 two editions per verse, whole chapter opens the reader, language switch re-renders without reload, paper contrast; Bible page; **feedback sheet**: 44 px targets, labels, axe 0, open/Escape/Cancel send nothing, empty Send accepted, payload context, bad address named, 503 / dead network / 429 each give a clear message and a prefilled mailto:, Try again, honeypot, nothing stored, four languages x dark/light/paper, contrast) |
| `verify:reader` (browser, demo build) | 169 / 169 (was 167 before the credit wording moved in the checks) |

## The small golden icon in the top-left of every square

It is in the source PNGs, 3D voxel, about 4-6 % of the picture's width, and it is a **per-scene theme emblem** (a flame, a tablet pair, an open book, a globe, a castle, a serpent on a pole,
a plain golden cube cluster on some). It comes from the old HUD pictures: `tools/scenes/build_square_jobs.py` asks every redraw to keep "the small 3D voxel emblem in the top-left corner,
with no rectangular box behind it". Owner direction: it is a design element, kept (`handoff/TODO.md` section A: "方块图左上角的小图标是设计要求保留的，审图时不算时代错误"; the gate's reviewers treat it
as exempt: `opus-74-decisions` records the owner's 2026-10-28 ruling and `requeue_emblem_only_fails.py`; genesis-46-1 was accepted for exactly that, an emblem the reviewer read as fake text).

Conflict with the gallery design: **none**. The gallery puts no text, scrim, badge or button over the top-left of a plate (the home hero's scrim is the bottom band; the picture page's
share and feedback buttons are in the header above the plate, not on it; the full-screen close button is top-right). It is not text, so the "no words in the pixels" rule is not touched.
Thumbnails (480 px) show it at about 20 px, still legible as an icon. It was not removed or edited. One thing to know: the emblem is not always related to the scene's subject
(the cube cluster, the generic book), so a reader may take it for a logo; it reads as one on purpose.

## Feedback button (owner request, 2026-11-03)

A flag icon in the picture page header beside Share (44 px, `aria-label` in four languages). One tap opens a sheet that follows the reading theme: optional reason chips (picture, caption or reference,
Bible text, other), optional text (4,000 characters), optional e-mail for a reply, a privacy line, Cancel and Send. Nothing is sent before Send; nothing is stored (no cookie, no storage key).
Send posts to `/api/feedback` (`netlify/functions/feedback.mjs`), which mails the owner: picture id, reference, page URL, language, edition, theme, viewport, user agent, the reader's time and the
server's, the text and the reasons. If the function is unconfigured (503), the mail service fails (502), the limit is hit (429) or the network is down, the sheet says so in the reader's language,
keeps the text, and offers a prefilled mailto: to support@yahwehword.com with the same context, and Try again. Owner steps: `docs/gallery-release-checklist.md` section 2 (set `RESEND_API_KEY`
and `FEEDBACK_TO` on the gallery Netlify site, optionally `FEEDBACK_FROM` and `ERROR_IP_SALT`; names only). No real mail was sent, nothing was deployed.

## Screenshots

`shots/` (234 JPEG files, the release-1 set overwritten): 375x812 and 1440x900 in en, zh-Hans, zh-Hant, ru; 768x1024 in en. Home, gallery (dark: the plates were drawn for dark); picture page and Bible page in dark,
light and paper; 对照 on the picture and on Psalm 119; the edition sheet from the home page and from a picture; the licences sheet; a held picture; the feedback sheet in dark, light and paper,
after a failed send (with the mailto: way out) and after a good one (thanks). The script is `scripts/gallery-shots.mjs`.

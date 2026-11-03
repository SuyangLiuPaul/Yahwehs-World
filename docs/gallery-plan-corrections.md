# Corrections to the gallery plan (`handoff/fable-gallery-release-2026-11-03.md`)

The plan file lives only in the main checkout (untracked there). It is **not edited from this branch**. This file holds the exact replacement text, so that whoever next touches
the plan (or reads it) takes the corrected wording from here. Line numbers are those of the plan as it stood on 2026-11-03.

## A. The Union Version licence wording (owner-relevant: the licence is not "public domain")

Source of truth: Words' record, carried unchanged in `src/reader/catalogue.gen.ts` (generated from Words `eba531d8`, `aboutLicenseCuvsYhwh`):

| language | licence note (what the licences sheet and the credit line print) |
|---|---|
| en | © Yahweh De Hua Ministry · used with permission. |
| zh-Hans | © 雅伟的话事工 · 经授权使用。 |
| zh-Hant | © 雅偉的話事工 · 經授權使用。 |
| ru | © Yahweh De Hua Ministry · используется с разрешения. |

Both editions (`cuvs-yhwh`, `cuvs-yhwh-tr`) are licence kind `permission` (chip `©`). No year is printed anywhere (a test fails the build if "1919" appears in a page, a caption or the reader data).

**Line 90** (zh-Hans row, column "Licence"). Replace `CUV public domain; church edition` with:

> church edition, © Yahweh De Hua Ministry, used with permission (Words `aboutLicenseCuvsYhwh`); chip ©, never "public domain"

**Line 91** (zh-Hant row, column "Licence"). Replace `same` with:

> same: church edition, © Yahweh De Hua Ministry, used with permission

**Line 100** (the summary sentence). Replace `every one public domain, CC0 or CC BY-SA` with:

> every one public domain or CC0, except the two Union Version editions, which are the church's own edition, © Yahweh De Hua Ministry, used with permission

(and, for this version, there are no CC BY-SA editions: the twelve church packs are out, see C.)

**Line 112** (the example credit lines). Replace `"和合本雅伟版 · 和合本，公有领域；神名改为雅伟"` with:

> "和合本雅伟版 · © 雅伟的话事工 · 经授权使用。"

(and, in English, `Chinese Union Version, Yahweh edition · © Yahweh De Hua Ministry · used with permission.`).

**Line 17** (the sentence that says what is in this version). Replace `这版放的只有**公有领域和教会自己的雅伟版**` with:

> 这版放的只有**公有领域/CC0 的版本，和教会自己的雅伟版（和合本雅伟版 © 雅伟的话事工，经授权使用）**

## B. Other numbers that moved

- §2.2 "21 editions": this version ships **eight** (owner, 2026-11-03): `bsb-yhwh`, `kjv`, `web-yhwh`, `asv-yhwh`, `cuvs-yhwh`, `cuvs-yhwh-tr`, `rst-yhwh`, `rst`.
- "1,361 pass / 82 fail" (and §5.3's 74 waiting): the gate is now **1,443 / 1,443 pass** (the 23 redraws passed; 24 owner-accepted squares were replaced by clean Higgsfield redraws).
- §5.5 "about 210 MB of pictures": measured **253.0 MiB** for 1,443 served (WebP q76, `docs/evidence/gallery-2026-11/pictures-quality-sweep.md`); `dist/` is **293.3 MiB**, inside the 300 MB cap.
- §3's feature table: the picture page, the Bible page, vertical 对照 (at most three), headings, copy with credit and the edition sheet are built (`src/reader`, wired in `src/gallery`);
  "Continue in Words", footnote popovers and sticky text size beyond the five steps follow the reader module's own list.
- Russian: complete (captions, headings from Words' Russian set, interface, `rst-yhwh` and `rst`), labelled as not read by a native speaker (`scripts/verify-ru.mjs`).

## C. Where the twelve church packs stand

Out of this version by the owner's decision (2026-11-03). When they come in, the CC BY-SA obligations in plan §2.2 (changes marked, the derived file stays CC BY-SA and downloadable) apply again.

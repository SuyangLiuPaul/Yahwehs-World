# 雅伟之界 gallery release: what a release would involve

Status: **nothing in this file has been done.** No deploy (not even a Netlify draft), no push, no key, no e-mail. Branch `gallery/integrate-1`
(local commits only). This is the list a person would work down when the owner says 「release」 and names the version
(the owner sets the version; no bump before that).

Sources: `handoff/fable-gallery-release-2026-11-03.md` §7 (the plan's checklist, updated here for what was built), `tools/release_web.sh`,
`netlify.toml`, `scripts/lib/vite-gallery-surface.mjs`, `docs/evidence/gallery-2026-11/NUMBERS-integration.md`.

## 0. What ships

Three pages from one build flag (`VITE_SURFACE=gallery`, the default of `tools/release_web.sh`): home `/`, scenes `/scenes.html` (the picture page is
`/scenes.html#p=<id>`), Bible `/bible.html` (the reader module, `#ref=`). Plus `/p/<id>` (1,443 share stubs), `_redirects`, `sitemap.xml`, `robots.txt`,
`version.json`, and **one Netlify Function**, `/api/feedback` (the feedback button on every picture). Nothing else is built: the globe, the walks, the figures,
the panorama and the labs stay in the repo and in the full surface (`VITE_SURFACE=full`).

Editions (eight, Words' bytes pinned in `src/reader/sources.lock.json`, Words `eba531d8`): `bsb-yhwh`, `kjv`, `web-yhwh`, `asv-yhwh`, `cuvs-yhwh`, `cuvs-yhwh-tr`,
`rst-yhwh`, `rst`. The twelve church packs, the licensed editions and the API.Bible online editions are **not** in this version (owner, 2026-11-03).

## 1. Before anything: the gate, the pictures, the data

1. The owner says 「release」 and the version number.
2. Mount the T7 drive. `python3 tools/scenes/gate_check.py square --all --summary`: today **1,420 PASS / 23 FAIL** (52 squares owner-accepted 2026-11-03, bound to the
   live SHA in `tools/scenes/square_accepts.json`). The 23 show the plain "still being drawn" plate until their redraws pass (another agent is redrawing them).
   Every id must be `pass` or listed in `tools/scenes/release-exclusions.json` with the owner's reason (the file does not exist yet; `--strict-pictures` is the gate).
3. `npm run pictures` (rebuilds `public/pictures/` from the passed squares and `data/gallery/pictures.json`; seconds when nothing changed). Commit `data/gallery/pictures.json`.
4. `npm run reader:data` (needs the Words checkout, default `/Volumes/androidbuild/Words-184`; verifies SHA-256 against the lock; regenerates `public/data/reader/`).
   If Words changed an edition since the lock, review the change, then `--update-lock` on purpose. `node scripts/reader-editions.mjs --check` must pass (the release script runs it).
5. `npm run gallery-data` (done by the build as well).

## 2. Netlify: sites, build mode, function

- **Sites** (already in `tools/release_web.sh`; no new site is needed): dev `20521d7e-6559-4bd1-a51e-f276f67d5986` (yahwehsworld-dev.netlify.app),
  prod `be08eb2a-6b57-4013-bb21-2729aa11e0bb` (world.yahwehword.com). Prod only with `--include-prod` and the owner's yes.
  If the owner prefers a separate site for the gallery, that is a new Netlify site plus a new row in `SITES=(...)`; the function's origin allow-list
  (`ORIGINS` in `netlify/functions/feedback.mjs`) must then name its host.
- **Build mode**: local only. Netlify CI cannot build the gallery on purpose (it has no T7 drive and no Words checkout); `release_web.sh` builds locally and deploys
  with `--no-build --dir dist --functions netlify/functions`.
- **Function dependencies**: `cd netlify/functions && npm install` once before the first deploy (it needs `@netlify/blobs` for the per-IP counters; without it the
  function still works, the per-minute brake in the instance is then the only limit).

### Environment variables the owner must set on the gallery Netlify site (names only; never put a value in the repo, a chat or a log)

Site settings, Environment variables. These are the names Words uses for its own feedback function, so the same Resend account serves both:

| Name | Needed | What it is |
|---|---|---|
| `RESEND_API_KEY` | **yes** | the Resend API key (the `re_...` value Words already uses). Without it the function answers 503 and the sheet falls back to a mailto: link. |
| `FEEDBACK_TO` | **yes** | the address the feedback mail goes to. No address is built into the code. Resend's free sandbox only delivers to the address tied to the account until a domain is verified (same note as Words). |
| `FEEDBACK_FROM` | optional | sender, e.g. `Yahweh's World Feedback <feedback@your-verified-domain>`. Default: Resend's sandbox sender. |
| `ERROR_IP_SALT` | optional | salt for the per-IP counters (so no address is ever stored). Default: the same default Words uses. |

Nothing else. No other secret, no database, no third-party script.

- **What the function does**: `POST /api/feedback`. Origin allow-list (this site's hosts; a script with no Origin passes as in Words), 12 KB cap, honeypot field `website`,
  3 a minute and 10 a day per IP (salted hash), field validation, one mail through Resend. Nothing is stored. Failure answers: 503 not configured, 502 mail service,
  429 limit; the page turns every one of them into a clear message plus a prefilled mailto: to `support@yahwehword.com`.
- **After deploy, one real test** by the owner (the only real mail): press the flag on one picture on the dev site, write a word, Send; the mail arrives at `FEEDBACK_TO`
  with the picture id, reference, page, language, edition, theme, browser and time. Until `RESEND_API_KEY` and `FEEDBACK_TO` are set the sheet shows the mailto: way out.

## 3. Build and verify (clean clone)

```
git clone <repo> && cd <repo> && git checkout <release tag/branch> && npm ci
npm run pictures && npm run reader:data
npm run build:gallery                 # reader:data, shell, zh, events, bible, gallery-data, version, tsc, vite build
npm run verify:gallery                # test:gallery, budget profile, verify-gallery, verify-redirects, verify-gallery-ui
npm run test:reader && npm run reader:demo && npm run verify:reader
node scripts/verify-gallery.mjs --strict-pictures    # every scene passed or owner-excluded
node scripts/audit-apple-design.mjs ... ; node scripts/measure-loading.mjs ...   # numbers into docs/evidence/gallery-2026-11/
node scripts/gallery-shots.mjs        # 375 / 768 / 1440, en / 简 / 繁 / ru, dark / light / paper
```

Record `du -sh dist` (measured 2026-11-03: 302 MB, over the plan's 300 MB cap because eight editions' text is 37.6 MB; the check now allows 320 MB: owner to accept
or trim, §6).

## 4. Redirects, links, sitemap

Generated into `dist/` by the build (`scripts/lib/vite-gallery-surface.mjs`), checked by `scripts/verify-redirects.mjs`:

- `_redirects`: 302 (not 301: they come back) for `/tabernacle.html /temple.html /ark.html /figures.html /figures-springs.html /plan.html /video.html /scene-assembly.html
  /elephant-preview.html /previews/*` to `/`; 301 for `/gallery` and `/pictures` to `/scenes.html`. `netlify.toml`'s own 301s for `/structures.html` etc. chain to the 302.
- Old hash links (cannot be redirected by a server): `home.html` carries the forwarder: `/#ref=...` to `/bible.html#ref=...`, `/#event=<id>` to `/scenes.html#p=<id>`,
  `/#journey=` and `/#place=` stay on the home page with a notice. `/bible.html?book=43&ch=3` becomes `#ref=John 3`.
- Grep Words and Sword for deep links into the globe (`world.yahwehword.com`, `yahwehsworld`, `#ref=`, `#event=`) before the release; fix or confirm each one lands.
- `sitemap.xml` (1,446 URLs: three pages plus 1,443 `/p/<id>`) and `robots.txt` are generated. After the release: submit the sitemap in Search Console (owner's account).
- `/p/<id>` stubs carry their own title, description and `og:image` (the plate; the logo for a held scene). Check one share (a chat unfurl) on the live site.

## 5. Retiring the old pictures host

The old merged bilingual pictures are on `https://yahwehs-scenes.netlify.app`. The gallery build serves its own `/pictures/` and `verify-gallery.mjs` fails if any page
or script still names the old host. **Do not take the old host down before the release is verified live.** After 24 hours of clean logs on prod:

1. Confirm nothing else links to it (grep both app repos and `handoff/TODO.md` §C).
2. TODO §C: take down `yahwehs-scenes.netlify.app` (owner), revoke the 10/17 API key, check the Google Cloud bill.
3. The 491 held merged pictures are retired with the whole merged set (kept on T7 as history).

## 6. Decisions and open items for the owner (none blocks the build)

1. **dist size**: 302.0 MB vs the plan's 300 MB cap (1,420 pictures 261.6 MB + 37.6 MB of Bible text). Accept 320 MB (current check) or trim (thumbnail quality, drop `rst`).
2. **The 23 held pictures**: redraws in progress; re-run `npm run pictures` and the build at the end. Release needs each `pass` or an exclusion.
3. **Russian**: captions and the reader's Russian chrome are machine-written and not read by a native speaker; the footer says so (Words' convention). Name a reader or ship as is.
4. **Union Version credit**: Words' record reads "© Yahweh De Hua Ministry · used with permission", not public domain. The reader catalogue, the licence sheet and the copy credit now say exactly that
   with the (c) chip; no year anywhere (tests: `tests/gallery/no-1919.test.ts`, `tests/reader/editions.test.ts`, `verify-gallery.mjs`).
5. **The small golden icon in the top-left of every square**: part of the picture pixels, kept by owner direction (TODO §A). See `NUMBERS-integration.md`. Nothing to do.
6. **Feedback recipient and Resend**: set `RESEND_API_KEY` and `FEEDBACK_TO` (§2). If the owner wants the notes also kept in the admin portal (as Words does), that is a later addition; this version stores nothing.

## 7. Release steps (in order, when told)

1. Owner says 「release」 + version. Set the version (D31); no bump before.
2. §1 (gate, pictures, data), §3 (clean clone build and every check green; screenshots looked at by a person: home, one picture page, the Bible page, the feedback sheet).
3. Set the env vars in §2 on the dev site first. `tools/release_web.sh` (dev only, no `--include-prod`): `version.json` read back from the live dev site, one picture's SHA read back and compared,
   the redirect table checked live, one old sermon link and one Words deep link tried, one real feedback mail sent and received by the owner.
4. Owner looks at the dev site (phone and desktop, light/dark/paper).
5. `tools/release_web.sh --include-prod` with the owner's yes. Read `version.json` back from `world.yahwehword.com`.
6. 24 hours of clean function logs (Netlify: Functions, `feedback`), then §5.
7. Tag, GitHub release notes in four languages; update `handoff/02-current-state.md` and TODO with the counts.

Rollback: deploy the previous dist from Netlify's deploy list ("Publish deploy") on the prod site; the function can be disabled by unsetting `RESEND_API_KEY` (the sheet then shows
the mailto: way out); the old host stays up until §5 step 2.

## 8. Corrections to the plan document (`handoff/fable-gallery-release-2026-11-03.md`, lives only in the main checkout, not edited from here)

- §2.2, rows `cuvs-yhwh` and `cuvs-yhwh-tr`, column Licence: "CUV public domain; church edition" should read "church edition, © Yahweh De Hua Ministry, used with permission (Words
  `aboutLicenseCuvsYhwh`); chip (c)". §2.4's example credit line "和合本，公有领域；神名改为雅伟" must go the same way.
- §2.2 "21 editions": this version ships **eight** (owner, 2026-11-03); the twelve church packs are out.
- Squares "1,361 pass / 82 fail" (and §5.3's 74 waiting): now **1,420 / 23** after the 52 owner acceptances.
- §5.5 "about 210 MB of pictures": measured 261.6 MB for 1,420 served.
- §3's feature table: the picture page, the Bible page, vertical 对照 (max three), headings, copy with credit and the edition sheet are built (src/reader, wired in src/gallery);
  "Continue in Words", footnote popovers and the sticky text size beyond the five steps follow the reader module's own list.

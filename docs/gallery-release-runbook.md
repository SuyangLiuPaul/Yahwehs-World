# 雅伟之界 gallery release runbook

**STATUS: NOT EXECUTED.** Nothing below has been run. No deploy (not even a Netlify draft), no push, no merge to `main`, no tag, no key set, no e-mail sent, no site created.
It runs only when the owner says 「release」 and names the version (the owner sets the version; there is no bump before that).
Branch: `gallery/integrate-1` (local commits). Companion files: `docs/gallery-release-checklist.md` (what ships and why), `docs/evidence/gallery-2026-11/NUMBERS-integration.md`
(measured numbers), `docs/gallery-plan-corrections.md`, `tools/release_web.sh` (the deploy script, already in the repo).

Conventions: `$REPO` is the clean clone made in step 2. `$NETLIFY` is the CLI (`tools/release_web.sh` finds it at
`~/Documents/CodingProject/SmartHome/node_modules/.bin/netlify`; restore it as the script says if it is gone). Environment-variable **names** only appear here; a value is never
written into the repo, a chat, a log or a commit.

---

## Step 0. Preconditions (nothing to do yet; check each is true)

- [ ] The owner has said 「release」 and the version number (write it here: `____`).
- [ ] The three apps are finished first (owner's order, 2026-11-03). The gallery does not go out before them.
- [ ] T7 is mounted (`/Volumes/T7`), the Words checkout is at `/Volumes/androidbuild/Words-184` (or `WORDS_ROOT` points at it), Pillow with WebP is installed.
- [ ] `python3 tools/scenes/gate_check.py square --all --summary` says **1,443 checked, 1,443 PASS, 0 FAIL**. Anything else: stop (a square must be `pass` or listed with the owner's reason in `tools/scenes/release-exclusions.json`).
- [ ] The release branch has been merged (the owner decides how: a merge into `main` is a push and is part of the release, not before it). Note: the main checkout has ~570 foreign uncommitted changes; do the release from a clean clone, never from it.

## Step 1. Choose or create the Netlify site

Two routes. Default is A; use B only if the owner wants the gallery on its own site.

**A. Use the sites already in `tools/release_web.sh` (no new site).**
- dev: site id `20521d7e-6559-4bd1-a51e-f276f67d5986`, host `yahwehsworld-dev.netlify.app`.
- prod: site id `be08eb2a-6b57-4013-bb21-2729aa11e0bb`, host `world.yahwehword.com` (only with `--include-prod` and the owner's yes).
- The function's origin allow-list (`ORIGINS` in `netlify/functions/feedback.mjs`) already names these hosts: verify with `grep -n ORIGINS netlify/functions/feedback.mjs`.

**B. A separate gallery site (owner's choice).**
1. In the Netlify UI: Add new site, Deploy manually (not "Import from Git": CI cannot build the gallery on purpose, it has no T7 and no Words checkout). Note the site id and the host.
2. Add its row to `SITES=( ... )` in `tools/release_web.sh` (`"<id>:<name>:<host>"`) and add the host to `ORIGINS` in `netlify/functions/feedback.mjs`; re-run `npm run test:gallery` (the origin test must stay green); commit both.
3. Custom domain, if any, is the owner's DNS step. Until it resolves, `verify_site` in the script must be given the Netlify host, not the custom one.

## Step 2. Clean clone, install, data, build, verify

```
git clone <repo> "$REPO" && cd "$REPO" && git checkout <release branch or tag> && npm ci
(cd netlify/functions && npm install)          # @netlify/blobs for the per-IP counters; the function still works without it (per-minute brake only)
npm run pictures                               # public/pictures from the passed squares + data/gallery/pictures.json (WebP q76, docs/evidence/gallery-2026-11/pictures-quality-sweep.md)
npm run reader:data                            # Words' bytes, SHA-256 checked against src/reader/sources.lock.json; --update-lock only on purpose
npm run build:gallery                          # reader:data, shell, zh, events, bible, gallery-data, version, tsc, vite build  (VITE_SURFACE=gallery)
npm run verify:gallery                         # test:gallery, budget, verify-gallery (300 MB cap), redirects, UI, Russian completeness
node scripts/verify-gallery.mjs --strict-pictures    # every scene `pass` or owner-excluded; zero placeholders
npm run test:reader && npm run reader:demo && npm run verify:reader
node scripts/audit-apple-design.mjs --pages /,/scenes.html,/bible.html --json docs/evidence/gallery-2026-11/audit-apple-design-final.json
node scripts/measure-loading.mjs --pages /,/scenes.html,/bible.html --json docs/evidence/gallery-2026-11/measure-loading-final.json
node scripts/gallery-shots.mjs --viewports 375x812,1440x900 --langs en,zh-Hans,zh-Hant,ru --all-themes
```
Pass criteria: every suite green; `dist/` under 300 MiB (`verify-gallery.mjs` prints it); `data/gallery/pictures.json` shows `"pass": 1443, "fail": 0` and no placeholder (1,443 distinct full-file hashes).
**A person looks at the screenshots** (home, gallery, one picture page, 对照, the feedback sheet, the Bible page; phone and desktop; dark, light, paper; en, 简, 繁, ru) before continuing.

## Step 3. Environment variables on the Netlify site (the owner sets these; names only)

Netlify UI: the site, Site configuration, Environment variables (or `netlify env:set NAME` typed by the owner at a prompt; never put a value on a command line that is logged). Set them on **dev first**.

| Name | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | yes | Resend API key (the same account Words' feedback function uses). Unset: the function answers 503 and the sheet offers a mailto: link. |
| `FEEDBACK_TO` | yes | the address feedback is mailed to. No address is built into the code. |
| `FEEDBACK_FROM` | no | sender, e.g. a name plus a verified-domain address. Default: Resend's sandbox sender (delivers only to the Resend account's own address until a domain is verified). |
| `ERROR_IP_SALT` | no | salt for the per-IP counters (no address is stored). Default: Words' default. |

Nothing else is needed: no database, no third-party script, no other secret. (Netlify's own `NODE_VERSION` and `VITE_SURFACE` are already in `netlify.toml`.)

## Step 4. Deploy to dev

```
cd "$REPO" && tools/release_web.sh          # dev only; no --include-prod; no --bump
```
The script: checks `public/data/reader` equals the pinned Words data, builds with `VITE_SURFACE=gallery`, then `netlify deploy --prod --no-build --site <dev id> --dir dist --functions netlify/functions`
and reads `version.json` back from the dev host. (`--no-build` is load-bearing: without it the CLI runs `netlify.toml`'s build and discards the local bundle.)
Do not use `netlify deploy` without `--prod` for this; the release script is the one path.

## Step 5. Checks on the live dev site (all must pass before prod)

```
H=https://yahwehsworld-dev.netlify.app
curl -fsS $H/version.json                                    # the version the owner named
curl -sI $H/pictures/full/genesis-15-1.webp | head -5       # 200, image/webp; compare its SHA-256 with data/gallery/pictures.json  (h)
curl -sI $H/p/genesis-15-1 | head -3                        # 200 (share stub; og:image is the plate)
curl -sI $H/tabernacle.html | head -3                       # 302 -> /   (not 301)
curl -sI $H/gallery | head -3                               # 301 -> /scenes.html
curl -sI $H/pictures | head -3                              # 301 -> /scenes.html
curl -sI $H/structures.html | head -4                       # 301 -> /tabernacle.html -> 302 -> /
curl -fsS $H/sitemap.xml | grep -c '<loc>'                  # 1446
curl -fsS $H/robots.txt                                     # Allow: /, Sitemap: https://world.yahwehword.com/sitemap.xml
curl -sI -X POST $H/api/feedback -H 'Origin: https://evil.example' | head -3   # 403 (origin allow-list), no mail
```
Redirect semantics beyond `curl` (hash links cannot be redirected by a server): open `$H/#ref=John%203:16` (lands on the Bible page at the verse), `$H/#event=genesis-15-1` (lands on the picture),
`$H/bible.html?book=43&ch=3` (becomes `#ref=John 3`). `scripts/verify-redirects.mjs` covers the same table against the build; this step repeats it against the live site.
Then, by a person, on a phone and a desktop: home, the gallery, one picture (all four languages), 对照 with two editions, the edition sheet, light/dark/paper, a held-nothing check (no plain "still being drawn" plate anywhere in a scroll of the gallery).
Grep Words and Sword once more for deep links into the globe (`world.yahwehword.com`, `yahwehsworld`, `#ref=`, `#event=`) and try each against the dev host.
**One real feedback mail, sent by the owner**: press the flag on a picture, write a word, Send; the mail arrives at `FEEDBACK_TO` with picture id, reference, page, language, edition, theme, browser and time.
Until `RESEND_API_KEY` and `FEEDBACK_TO` are set, the sheet shows the mailto: way out (that is expected, not a failure of the build).

## Step 6. Owner looks at dev

Phone and desktop, light / dark / paper, all four languages. Russian is labelled "not yet read by a native speaker" (home note, reader display sheet); that stays until a reader is named.

## Step 7. Deploy to prod (only with the owner's yes)

```
cd "$REPO" && tools/release_web.sh --include-prod
```
Builds the release (no dev suffix on the version), deploys dev and prod, reads `version.json` back from `world.yahwehword.com`. Repeat the Step 5 `curl` list with `H=https://world.yahwehword.com`.
Set the Step 3 variables on prod **before** this step (the prod site has its own environment).

## Step 8. Sitemap and search

- `https://world.yahwehword.com/sitemap.xml` (1,446 URLs: three pages + 1,443 `/p/<id>`) is generated by the build. Submit it in Search Console (owner's account; not something to do from here).
- One chat unfurl of one `/p/<id>` link on the live site (title, description, the plate as image).

## Step 9. Retire the old pictures host (`https://yahwehs-scenes.netlify.app`): only after 24 hours of clean prod logs

Do not take it down before the release is verified live on prod (a rollback to the previous deploy would still need it).
1. Netlify: prod site, Logs, Functions, `feedback`: 24 hours with no unexplained errors; the site's analytics show no requests still going to the old host (grep both app repos and `handoff/TODO.md` §C for the host name; the gallery build fails if any page or script names it).
2. TODO §C, by the owner: take down `yahwehs-scenes.netlify.app`, revoke the 10/17 API key, check the Google Cloud bill.
3. The 491 held merged pictures retire with the whole merged set (kept on T7 as history).

## Step 10. Tag and notes

`tools/tag_release.sh` (GitHub Release); release notes in Chinese, English and Russian (and 繁體); update `handoff/02-current-state.md` and `handoff/TODO.md` with the counts (1,443 pictures, 8 editions, 293.3 MiB). This is a push and a publication: only when told.

## Rollback

| What went wrong | What to do |
|---|---|
| The new site is broken or wrong | Netlify UI, the site, Deploys, pick the previous good deploy, "Publish deploy". Instant; no rebuild. Do the same on dev if dev is the one at fault. |
| Feedback misbehaves (spam, mail storm, wrong recipient) | Fastest brake: Netlify UI, Deploys, "Publish deploy" on the previous deploy (it has no function or the old one). Or remove `RESEND_API_KEY` in Environment variables and re-run `tools/release_web.sh` (a function reads its variables from the deploy that carries it); with the key unset the function answers 503, the sheet shows the mailto: way out and nothing is sent. The per-IP limits (3 a minute, 10 a day) and the 12 KB cap stay on in the meantime. |
| A single picture is wrong | Fix the square on T7 through the gate, `npm run pictures`, rebuild, redeploy; the file name is stable and the site revalidates (`max-age=0, must-revalidate` on non-hashed files). Do not hand-edit `dist/`. |
| An edition's text is wrong | It is Words' bytes: fix in Words, then `npm run reader:data -- --update-lock` on purpose, review the diff, rebuild, redeploy. |
| The old host is already gone and the rollback needs it | The previous deploy used the old host for pictures only if it predates the gallery surface; roll back to a deploy from this surface or later, or restore the old host from T7 history. This is why Step 9 waits 24 hours. |

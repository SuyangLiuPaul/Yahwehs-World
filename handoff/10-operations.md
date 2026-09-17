# 10 · Operations and ownership

## Repositories
- `SuyangLiuPaul/yahwehsworld` — **private**; this product. Default `main`.
- `SuyangLiuPaul/SeekSparks` — sister app; `assets/bible_*.json` are read by
  scripts via `../SeekSparks/assets/` (relative path; clone side by side).
  SeekSparks itself has **no AI features by owner decision (2026-09-07)** —
  do not propose adding any there. That decision does not bind this repo.
- `../bible-evidence` — 209 archaeology findings (remote is `YsWords.git`).
- `../yswords-data` — news pipeline and media; the `place` field for C6 lives there.

## Deploy
- Netlify site `yahwehsworld` — site id `be08eb2a-6b57-4013-bb21-2729aa11e0bb`,
  linked to the GitHub App (installation 38261963); **push to `main` builds and
  deploys**. Build: `npm run build`, publish `dist`, Node 22. Badge disabled.
- Verify a deploy by polling `GET /api/v1/sites/{id}/deploys` for `state:
  ready` with the commit sha, then load the live URL at the three viewports.

## Secrets — locations only, never values
- Netlify token: owner's password manager (Drive → PasswordManager). Never in
  the repo, never in a memory file, never printed in a log.
- GitHub: `gh` auth in the macOS keychain; `git` uses `osxkeychain`. A leaked
  classic PAT was revoked 2026-09-08; do not reintroduce tokens in remotes.
- No API keys are needed to run or build the site.

## Commands that matter
```bash
node scripts/audit-events.mjs        # every count must be 0; run before and after any data change
```
```bash
node scripts/merge-chinese-names.mjs && node scripts/build-journeys.mjs && node scripts/build-all-events.mjs && node scripts/build-events-doc.mjs && node scripts/audit-events.mjs
```
The second line is the full regeneration in dependency order. All scripts run
from the repo root and read `../SeekSparks/assets/`. `merge-chinese-names` is
idempotent (run it twice: byte-identical output); if it ever is not, that is
the bug to fix first.

## Ownership
- Product and content decisions: Paul Liu (owner). Approves events, journeys,
  Chinese names, and any change to `05-decisions.md`.
- Implementation: the agent/person given this folder.
- Review gate for authored content: opened 2026-09-14 (`07` · Review gate);
  the per-event tool (`scripts/build-review-page.mjs`) remains for whenever the
  owner sits down with a particular event.

## Commit style
Read `git log`. Each message's first line says what changed in plain words;
the body says why, with the measurements that justified it. No attribution
trailers. One concern per commit.

## When something is unclear
Prefer the honest default (D15): show the number the text gives, label what it
does not, and leave a note in `11-known-bugs.md` under "Open questions" rather
than inventing.

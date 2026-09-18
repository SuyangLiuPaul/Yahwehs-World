# 09 · Verification playbook — how to prove it works

## The referee is a screenshot

Nothing is "done" from reading code. Render it, look at it, keep the image.
Store evidence under `handoff/evidence/<phase>/<viewport>-<what>.png`.

## Viewports (always all three, both locales)

| Name | Size | Why |
|---|---|---|
| phone | 375×812 | primary audience; every regression so far showed here first |
| tablet | 768×1024 | the 900 px CSS breakpoint sits between phone and desktop |
| desktop | 1440×900 | teachers projecting |

## Commands

```bash
cd yahwehs-globe
npm ci                      # node_modules may be absent (a disk cleanup removed them once)
npm run dev -- --port 5175 --strictPort
set -o pipefail; npm run build   # tsc --noEmit && vite build; pipefail or a pipe hides failures
```

## Driving the app

- DEV: `window.__globe.openRoute('paul-1')`, `window.__globe.tickRoute(0.05)`,
  `window.__walk.tour.stop()` then set a pose. The Measures panel is DOM-only,
  in DEV and in prod alike: `#gate-measures` opens it, `#mp-c-range` is the
  cubit, `#measures-panel .mp-card` are the cards
  (`node scripts/audit-measures.mjs` sweeps all four pages that hold them).
- PROD (no handles): `document.querySelector('[data-id="paul-1"]').click()`,
  the language button (text 中文/EN), `#rplay`, `#t-goto-open`/`#t-goto-book`/
  `#t-goto-chapter`/`#t-goto-verse` for the reference picker.
- Journeys ids: `paul-1 paul-2 paul-3 paul-rome exodus-wilderness jesus-mark jacob abraham ark elijah`.

## The bar a fix has to clear

Added 2026-09-16 after several fixes shipped that had been "verified" and were
still broken when the owner opened the live site. Every one of these is a rule
written from a specific failure in this repo.

1. **Measure the symptom across the whole surface before fixing it.** A report
   names one place; the bug is usually everywhere. "Many places are still just
   a dot" became a scan of all ten journeys at 201 points each, which put a
   number on it: 37% of `paul-2` blank, 16% of `jesus-mark`, 0% of six others.
   Without a before-number there is nothing a fix can be shown to have moved.
2. **Re-run the identical scan afterwards and state the after-number.** Not a
   fresh spot check — the same scan, so the two are comparable (0% blank, all
   ten journeys).
3. **Re-run the previous fix's own check.** Fixes here have undone each other
   more than once: a larger hull ate the harbour margin that had just been
   added; the sea-gap rule could have re-beached the ship. Hold the earlier
   check as a regression test (301 sailing samples, none on a real landmass).
4. **Verify at the parameters a reader actually has.** `controls.minDistance`,
   the app's real FOV, the real camera path. Two legibility fixes shipped
   broken because they were judged from a debug camera placed at a convenient
   distance, and one from a narrowed `camera.fov` — which is a digital crop,
   not something a reader can do (see gotcha 8).
5. **Test a candidate against what it could break, before committing.** The
   coastal-buffer dilation was measured against the Aegean and the Malta
   channel, found to close both, and reverted while still uncommitted. That
   check cost minutes.
6. **Separate the symptom from the cause — one symptom here had three.**
   "Ship on land" was, in turn: a mask rasterised coarser than the coastline
   it was checked against; a chord that genuinely crosses land; and a hull
   drawn too big for its clearance. Fixing the wrong one and shipping is how a
   report comes back a third time.
7. **Derive constants, do not tune them by eye, and write the derivation into
   the comment.** `SEA_GAP_KM` comes from measured land-run lengths along real
   legs (1-31 km where the chord clips a headland, 302 km where it crosses
   Asia Minor). Legibility comes from the screen-pixel identity in D21. The
   next reader must not have to redo the measurement to dare touch the number.
8. **Say plainly what was not verified.** A seated pose reads as kneeling from
   this map's camera; that was reported as a limitation rather than described
   as a sit.

## Gotchas that produced false results before — read these

1. **Hidden browser pane ⇒ no `requestAnimationFrame`.** A JS query run while
   the page is not displayed reads pre-frame state (labels `display:none`,
   tour index stuck at 0). Take a screenshot first (it forces a frame), then
   query; or drive `tour.update(dt)` / `tickRoute` manually.
2. **`npm run build | grep | tail` masked a tsc failure** and a broken commit
   shipped. Always `set -o pipefail`.
3. **`cd repo` when already inside it fails silently** in some shells and the
   following edits go nowhere. Verify edits with `grep` after applying.
4. **`window.__globe` is DEV-only.** Production tests must go through the DOM.
5. **The globe at 4 R hides everything close.** Terrain, pills and staffage
   are only judged below 1.6 R; set the camera explicitly:
   `camera.position` from `lonLatToVec3(34, 31, 25)` (radius 100 + 25).
6. **The route does not advance without `playing`.** `tickRoute` moves `routeT`
   only while playing; click `#rplay` first or set `playing = true` in DEV.
7. **Netlify needs ~30 s after a site rename**; first navigations may 404.
8. **A miniature's apparent size does not change with zoom.** `Staffage`'s
   group scale cancels camera distance by design, so "zoom in and look" proves
   nothing about an actor's size; and narrowing `camera.fov` to inspect one is
   a crop the reader cannot perform. Judge size at `minDistance`, real FOV.
9. **A rig's bind pose is not a T-pose.** `SkeletonUtils.clone` carries the
   authored pose, and setting every bone to identity does not neutralise it —
   it destroys the spine and arms. Pose only the joints you mean; read the
   others' bind values before assuming an axis or a sign.
10. **`openRoute` builds a fresh `Route`, and fresh `PathLeg` objects.**
    Anything cached per leg must key on the `PathLeg` object itself, never on
    `journey.id` — the id repeats across two opens of the same journey and a
    cache keyed on it silently serves a stale verdict against new objects.
11. **The live rAF loop calls `staffage.update` too.** Hand-driving it from
    the console interleaves with the app's own call, which passes its own
    `routeT` and `selectedOrdinal`. Set `route.setProgress(t)` and pass the
    same `t` explicitly, and do not trust state read back a frame later.

## Checks per layer (copy into the PR)

- [ ] Labels: `[...document.querySelectorAll('.rlab')].filter(e=>e.style.display!=='none').map(e=>{const r=e.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1})` contains no `true`.
- [ ] Names: no visible label ends in ` \d` (`/\s\d+$/` over all `.rlab span`, `#t-here`, `#p-name`).
- [ ] Console: `read_console_messages onlyErrors` empty on all three pages.
- [ ] Payload: `dist/` size delta stated in the commit; `public/data` total ≤ 10 MB.
- [ ] Frame time: `renderer.info.render.calls` and a 5 s `performance.now()` sample ≥ 55 fps on the reference Android (or DevTools 4× CPU throttle on desktop).
- [ ] Both locales: switch and re-run the label and name checks.
- [ ] Attribution string present in the footer of every page.

## The dream-loop method (used for the tabernacle; use it for every visual)

1. State the target in words or an image (`06`).
2. Build.
3. Screenshot from the real camera positions a user will hit (tour stops,
   route stops), not from a flattering angle.
4. List every defect visible, most systemic first.
5. Fix systemic causes before cosmetic ones (a wrong light rig before a wrong
   colour; a wrong sphere mapping before a wrong label).
6. Repeat until a fresh screenshot has nothing new to list.

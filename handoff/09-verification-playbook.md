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
  `window.__walk.tour.stop()` then set a pose; `window.__structures.show(i, m)`.
- PROD (no handles): `document.querySelector('[data-id="paul-1"]').click()`,
  the language button (text 中文/EN), `#rplay`, `#t-play`.
- Journeys ids: `paul-1 paul-2 paul-3 paul-rome exodus-wilderness jesus-mark jacob abraham ark elijah`.

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

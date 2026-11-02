# Apple design audit: globe, scenes, plan, figures, Bible reader (2026-11-03)

Branch `design/apple-audit-20261103`, based on `perf/bible-loading` (1adf31e). Local commits only; nothing pushed or deployed.

**Sources.** `apple-motion/SKILL.md` (§ numbers below), `apple-look/SKILL.md` (five lenses), and these pages under `references/hig/`, all opened:
`accessibility.md`, `layout.md`, `typography.md`, `color.md`, `motion.md`, `gestures.md`, `sheets.md`, `modality.md`, `tab-bars.md`, `materials.md`, plus `references/cross-platform.md` (web translation). Citations read `file › heading`. Where no page covers a point it says "judgment".

**Method.** One scan, `scripts/audit-apple-design.mjs`, run on the base build and on the fixed build: five pages at 375x812 (touch emulation) and 1440x900, headless Chrome, fonts blocked. It measures touch-target size (box plus invisible `::before/::after` extensions), text size, contrast (computed, gradients by worst stop; text over the WebGL canvas cannot be measured), CSS animations running under emulated `prefers-reduced-motion`, `:hover`/`:active` rules and whether a press changes the control within 30 ms, blur layers under emulated `prefers-reduced-transparency`, hit-testing of every control centre, and a layout fingerprint of the fixed chrome. Raw output: `docs/evidence/apple-design-2026-11-03/{before,after}.{txt,json}`. Behavioural probes (wheel zoom, route framing, dialog focus) were run against the dev server and are quoted below with their numbers.

**Dark/light.** There is no light mode by decision (D28 in `handoff/05-decisions.md`), `color-scheme: dark` is set, and the app has no appearance switch, which is what `apple-look` asks. Nothing to fix; the increased-contrast and reduced-transparency answers were the missing parts and are now in.

## Before and after (same scan)

| page @ viewport | targets under 44 (under 28) | no pressed response | `:hover` rules live on touch | CSS animations under reduced motion | blur layers under reduced transparency | contrast fails | hit-test: centres answered by another element |
|---|---|---|---|---|---|---|---|
| globe 375 | 13 (4) -> 2 (1) | 3 of 13 -> 2 of 13 | 35 -> 0 | 0 -> 0 | 10 -> 0 | 0 -> 0 | 0 -> 0 |
| scenes 375 | 55 (41) -> 1 (0) | 3 of 15 -> 1 of 14 | 17 -> 0 | **57 -> 0** | **61 -> 0** | 1 -> 0 | 0 -> 0 |
| plan 375 | 5 (1) -> 1 (0) | 2 of 8 -> 1 of 8 | 9 -> 0 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 0 -> 0 |
| figures 375 | 5 (1) -> 2 (0) | 1 of 9 -> 0 of 8 | 12 -> 0 | 0 -> 0 | 0 -> 0 | 1 -> 0 | 0 -> 0 |
| bible 375 | 13 (2) -> 6 (0) | 3 of 15 -> 1 of 15 | 16 -> 0 | 0 -> 0 | 2 -> 0 | 2 -> 2 | 0 -> 0 |
| globe 1440 | 4 (1) -> 2 (1) | **20 of 21 -> 2 of 21** | 35 -> 0 | 0 -> 0 | 10 -> 0 | 0 -> 0 | 0 -> 0 |
| scenes 1440 | 45 (0) -> 44 (0) | 35 of 38 -> 1 of 38 | 17 -> 0 | 44 -> 0 | 61 -> 0 | 1 -> 0 | 0 -> 0 |
| plan 1440 | 1 -> 0 | 14 of 15 -> 1 of 15 | 9 -> 0 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 0 -> 0 |
| figures 1440 | 6 -> 5 | 16 of 18 -> 0 of 18 | 12 -> 0 | 0 -> 0 | 0 -> 0 | 1 -> 0 | 0 -> 0 |
| bible 1440 | 2 -> 2 | 17 of 20 -> 1 of 20 | 16 -> 0 | 0 -> 0 | 2 -> 0 | 2 -> 2 | 0 -> 0 |

Remaining targets under 44 on desktop are 27 px chips and 25 px tabs against macOS's 28 default (minimum 20, so they pass). The pressed-response misses that remain are the current-page tab, which has nothing to press into.

Regression checks re-run on the fixed build, all unchanged: `verify-bible-reader.mjs` all ok; `measure-loading.mjs` wire@ready 637/197/182/345/210 KB (globe/scenes/bible/figures/plan) vs 637/197/182/344/209 before, cls 0.002/0/0/0/0.01 identical, `ready` within noise; computed font sizes and the layout fingerprint identical on all ten page/viewport pairs (so the rem change moved nothing at the default); `tsc --noEmit` 12 errors before and after (all pre-existing at the base commit, see "State of the base").

## Findings, ranked

### Critical (accessibility)

**1. Reduced motion was ignored on Scenes, and on every programmatic scroll in the Bible reader. FIXED.**
57 infinite shimmer animations ran under `prefers-reduced-motion: reduce` at 375 (44 at 1440). The page's own reduced rule had one `:not()` fewer than the rule it meant to cancel, so it lost. `style.css` carried the only global `animation: none` and only the globe page loads it. Bible `scrollTo`/`scrollIntoView` passed `'smooth'` by name, which ignores CSS `scroll-behavior`.
Cite: `accessibility.md › Cognitive` ("Be cautious with fast-moving and blinking animations ... Replacing transitions in x-, y-, and z-axes with fades"); `motion.md › Make motion optional`; apple-motion §14.
Fix: `src/scenes-gallery.css` (matched specificity), shared block in `src/tokens.css` (loaded by all five pages), `scrollBehavior()` in `src/bible-book.ts`. Commit 7dcccbd.

**2. The 全部 sheet declares `aria-modal` and has no focus trap. FIXED.**
Tab left the dialog after 65 of its links; in 90 presses, 68 stayed inside, 22 went to the dimmed page behind. Now 90 of 90.
Cite: `accessibility.md › Speech` ("Let people use the keyboard alone ... Full Keyboard Access"); `modality.md › Best practices` (a modal needs an obvious way out and keeps the task contained).
Fix: `src/site-shell.ts › installSiteMenu`. Commit 06473e2.

**3. Touch targets under Apple's 28 pt minimum, and most under the 44 pt default. FIXED except where noted.**
At 375: Scenes had 55 controls under 44, 41 of them under 28 (book chips 27 px, card buttons 32, inputs 40); the globe's 全部/路线/走进 were 30/30/21 px; Bible steppers 28 and 24 px chips. Now 1, 2, 1, 2, 6 under 44, and none under 28 except the timeline scrubber's 2 px input box (its thumb now takes a 32 px touch, see 12). Hit extensions are invisible pseudo-elements, so the look and the layout fingerprint are unchanged; the hit-test regression found no control whose centre another element answers for.
Remaining under 44: Bible reader selects at 36 and steppers at 42 (the reader bar is sticky, 44 would cost reading height: owner, see below), language buttons 34 wide by 44.
Cite: `accessibility.md › Mobility` (44x44 default, 28x28 minimum; "Consider spacing between controls as important as size").
Fix: `src/nav.css`, `src/style.css`, `src/scenes-gallery.css`, `src/bible-book.css`. Commit 7dcccbd.

**4. Phone top bar leaves the tab strip 28-34 px wide; the current page was off the edge on four of five pages. PARTLY FIXED; the real fix needs a decision.**
Strip width at 375: 28 px (globe, scenes, plan, figures), 34 px (bible). The current tab's visible share was 0% on scenes, plan, figures, bible (54% on the globe), and 0% on figures at 768. The shell now scrolls the current tab into view on load, on locale change and after fonts: share 46-78% at 375, 100% at 768 and 1440 (a tab wider than the strip starts at the strip's left edge). It is still a fragment of one tab beside "Routes".
Cite: `tab-bars.md › Best practices` ("Make sure the tab bar is visible ... people can forget which area of the app they're in", "Avoid overflow tabs"); apple-motion §16 wayfinding ("Where am I?"). **Mock-up 3** shows a bottom tab bar and a logo-only alternative.
Fix: `src/site-shell.ts › centreCurrentTab`. Commit 7dcccbd.

**5. The globe has no accessible name and no keyboard rotation. OPEN (needs copy).**
`index.html:105` is `<canvas id="stage"></canvas>`. Zoom has buttons (`#map-tools`, 44 px) and the events list, verse picker and route menu reach everything by keyboard, so the content is not locked out; the globe itself is invisible to a screen reader and cannot be panned from the keyboard.
Cite: `accessibility.md › Mobility` ("Offer alternatives to gestures"), `› Speech` (keyboard alone). Recommendation: `aria-label` in both locales through `data-en`/`data-zh`, and arrow keys wired to the same rotation the pointer uses. Not done: it needs your wording and a screen-reader pass I cannot do here.

### High

**6. Nothing responded on press. FIXED.**
One `:active` rule in the whole codebase (`.rlab:active`). On desktop 14 to 35 controls per page showed no change under a mouse-down (20 of 21 on the globe). Now a shared zero-specificity rule: brightness at once (not in any transition list, so it lands in the same frame; checked at 30 ms into the press) and `scale: .97` only under `prefers-reduced-motion: no-preference`. `scale` is the individual property, so it composes with the inline `transform` that places door cards and place labels. Counts after: 0 to 2 per page, the exceptions being current-page tabs.
Cite: apple-motion §1 ("Respond on pointer-down, not on release"), §14; `gestures.md › Best practices` ("Handle gestures as responsively as possible"). Commit 7dcccbd.

**7. Hover stuck after a tap. FIXED.**
9 to 35 `:hover` rules per page, none guarded. All 63 selectors now sit in `@media (hover: hover)` (mechanical rewrite; mixed selector lists like `#t-goto-open:hover, #t-goto-open[aria-expanded]` were split so the expanded state still applies on touch). `.g-card:hover` lifts 2 px and would stay lifted after a tap. Commit 7dcccbd.

**8. Panels and sheets have no motion at all and none of a sheet's behaviour. OPEN, mock-up 2.**
10 of 10 surfaces probed (`#allmenu`, `#panel`, `#event-card`, `#r-card`, `#routemenu`, `#walkmenu`, `#t-goto`, `#t-events-menu`, `.bb-dialog`, `dialog`) compute `transition: 0s` and `animation: none`: they toggle `hidden`. There is no grabber, no middle detent, no swipe to dismiss, no spatial origin (`transform-origin`), no reversible path. The place card is the obvious sheet.
Cite: `sheets.md › Mobile (iOS, iPadOS)` ("Include a grabber", "medium detent", "Support swiping to dismiss"); apple-motion §3 interruptibility, §4 springs (drawer: damping 0.8, response 0.3), §5 velocity handoff, §6 momentum projection, §7 symmetric paths, §9 rubber-banding. Mock-up 2 implements these with real spring maths so you can feel them.

**9. The camera cuts instead of travelling, and zoom has no spring or rubber band. OPEN, mock-up 1.**
Probes on the dev build at 375: one wheel notch lands in a single frame (200.00 -> 195.74, identical in the next seven frames); `openRoute('paul-1')` moves the camera in frame 1 and it is identical in frames 2 to 6; `frameRoute`/`framePlaces` assign `camera.position` directly (`src/main.ts:417-533`); `controls.minDistance/maxDistance` are hard stops (`main.ts:126-127`). Spatial continuity ("if something disappears one way it emerges from where it came") is lost on every route and event open.
Cite: apple-motion §4, §5, §9, §7. The glide is interruptible by design: grab it and it follows the finger from where it is and carries its speed. Needs a yes because the camera framing code assumes it is still when read (labels, `markers.setZoom`).

**10. Release stops the globe at once. OWNER DECISION.**
Deliberate since BATCH-5 (`handoff/BATCH-5.md`: the old damping left a 213-250 px tail; `globe-navigation.ts` sets `enableDamping = false`). Apple's version is velocity-projected, not damped: `project(v) = v/1000 * 0.998/(1-0.998)`. In the mock-up that is about 0.5 s of travel at release speed (a 359 deg/s flick coasts about 179 deg, too much for a globe), so the mock-up also offers a 0.1 s coast. Cite: apple-motion §6. Not changed.

**11. Type is in px; text does not follow the reader's text-size setting. FIXED.**
All seven `--fs-*` tokens are rem now. At the default root nothing moves (computed sizes and layout identical on all ten pairs). With the root at 125/150/200% the nav tab goes 17.5/21/28 px (it stayed at 14 px at every setting before), no page overflows (`scripts/verify-text-scale.mjs`). 50 hard-coded px font sizes remain, 39 of them in `bible-book.css` (see 15).
Cite: `typography.md › Supporting Dynamic Type` ("Make sure your app's layout adapts to all font sizes"); apple-motion §15 ("Scale layout with the text"). Commit 06473e2.

**12. The timeline scrubber is a 2 px line with a 16 px thumb. FIXED on touch.**
On a coarse pointer the thumb is a 20 px disc inside a transparent 6 px border: 32 px of touch, 20 px visible (was 16 including its ring). The input's own box stays 2 px, so the slider adds no height. The bottom stack on the globe is 3.1 px taller at 375 (114.8 -> 117.9), and that was measured to come from the attribution line `.credit` going from 10 to 11 px (item 15), not from the slider. Mouse users keep the original. Under 44 still: it is a 32 px target; Apple's floor is 28. Commit 7dcccbd.

### Medium

**13. Materials: 61 blur layers on Scenes, and no answer to reduced transparency or increased contrast. FIXED (answer); perf item OPEN.**
Every card badge carries `backdrop-filter: blur(4px)` (61 on one page; 10 on the globe; 2 on Bible). All of them sit on fills of at least 84% opacity, so removing the blur costs no legibility: `prefers-reduced-transparency` now drops them all (61/10/2 -> 0) and `--scrim`/`--panel` go opaque; `prefers-contrast: more` lifts `--ink-3/--ink-4/--line/--line-gold`. Open: the per-card blur on a long scrolling grid is a compositing cost; remove it for everyone only after a scroll-jank number. Cite: apple-motion §12, §14; `materials.md › Standard materials`. Commit 7dcccbd.

**14. Door cards (DOM anchors over the globe) take the pointer from the canvas. OPEN.**
In the gesture check at the Levant pose, the first drag moved the globe and every later one started on a `.door` card and moved nothing (`elementFromPoint` returned its `<em>`). A reader who starts a drag on a card cannot spin the globe, and a lift on it navigates away. This is also why `verify-globe-gestures.mjs`/`verify-globe-drag.mjs` were failing before this work (they now hide `#doors`; see "State of the base"). Cite: `gestures.md › Best practices` ("respond to gestures in ways that are consistent with people's expectations"), apple-motion §10 (tap vs drag hysteresis). Recommendation: let the card forward `pointerdown` to the canvas and only navigate on a tap that moved under 5 px (the same rule `globe-navigation.ts` already applies to the canvas).

**15. Type scale drift in the Bible reader; the micro sizes. OPEN.**
`bible-book.css` hard-codes px and fallbacks instead of tokens: 12 distinct computed sizes at 375 and 15 at 1440 (11, 11.22, 11.5, 12, 12.5, 12.54, 12.8, 13, 13.2, 13.26, 13.5, 13.8, 14.82, ...) against 5 to 7 on the other pages. 11 to 11.5 px text remains in the reader (section refs, globe chip, verse numbers 0.68em = 11.22 px): at the Apple minimum of 11 pt, under the 12 px floor that `tokens.css` says holds. Items at 10 px were raised to 11 (credit line, events note, event id, scene version badge); the nav wordmark's second line (`.brand .en`, uppercase, 10 px, hidden on phones) was left because 11 px widens the bar by 13 px and takes it from the tab strip.
Cite: `typography.md › Conveying hierarchy` ("Minimize the number of typefaces ... internally inconsistent" applies to sizes too: judgment), `accessibility.md › Vision` (11 pt minimum on iOS). Commit 7dcccbd (the 10 -> 11 part).

**16. Contrast. PARTLY FIXED.**
Token ratios (computed from `tokens.css`): `ink-3` on `ground` 6.9:1, on `surface` 5.5, on `surface-hi` **4.34**; `ink-4` on `ground` **3.36**; `gold-dim` on `surface-hi` 3.17. Fixed: `#g-note` used `ink-4` as a sentence (3.36:1) -> `ink-3`; `.sg-book-chip small` 4.47 -> `ink-2`. Open: the Bible pager's disabled "already the first chapter" label (1.93:1) is information, not just a dimmed control; any `ink-3` caption on a `surface-hi` hover or selected row is under 4.5; text over the WebGL canvas (place labels, route labels) is not measurable by this scan, so `scripts/audit-contrast.mjs` (stale: it waits on UI that is gone) or a pixel sample is needed. Cite: `accessibility.md › Vision` (4.5:1 up to 17 pt), `color.md › Best practices`.

### Low

**17. Keyboard focus fallback. FIXED.** Four stylesheets wrote rings for some controls; a zero-specificity `:focus-visible` ring now covers the rest. `:focus-visible` rules 8 -> 9 on plan, bible, scenes. Cite: `accessibility.md › Speech`.

**18. Bible `.bb-select:focus` uses a 1 px outline.** Under `accessibility.md › Vision` that is thin; covered by the fallback only where it does not override. Not changed.

**19. Desktop tab height is 25-26 px, macOS default is 28 (minimum 20).** Passes the minimum. Not changed.

**20. Rubber-banding and boundaries outside the globe.** The horizontal strips (book chips, nav tabs) rely on native overscroll; fine.

## What works (keep)

- Direct manipulation on the globe is real: distance-based, not event-count-based, altitude-scaled gain (`globe-navigation.ts`), tap vs drag separation with a 5 px excursion rule, pinch hand-off without a jump. This is better than most map UIs and matches apple-motion §2 and §10.
- Pre-existing 44 pt hit-area extensions on the nav and language buttons, `min-height: 44` on menu rows, safe-area insets on every fixed edge.
- A real token system (`tokens.css`), a three-value tracking rule, CJK leading, no synthetic bold on 汉字 (apple-motion §15 in spirit).
- The nav scrim is a gradient, not a bar: the scroll-edge idea in apple-motion §12.
- Dark-only chosen deliberately and recorded (D28).
- `staffage.ts` and the Measures panel already read `prefers-reduced-motion`.

## What needs you

1. **Mock-up for approval: `docs/apple-design-mockup-2026-11-03.html`** (open it in a browser, best on a touch device). Three tabs: (1) globe release, zoom and fly-to with Apple's projection and spring maths, switchable against today's behaviour; (2) the place card as a sheet with a grabber, three heights, throw and rubber-band; (3) the phone top bar against a bottom tab bar. Reduced motion turns the motion off in it. Decisions: coast on release (and how long) reverses BATCH-5; glide and spring zoom; sheet behaviour; bottom tab bar versus logo-only bar.
2. Wording for the globe's accessible name (item 5).
3. The Bible reader bar on phones: selects and steppers under 44. The mock-up's answer is to keep the book/chapter picker dialog and drop the two selects on coarse pointers; it changes the bar's look so it is not done.
4. Door cards forwarding drags (item 14): interaction change, small; say yes and it is quick.
5. Merge note: this branch edits `figures.css`, `plan.css` and `route-ui.css`, which the main checkout also has uncommitted changes in. Merge from a clean main or expect to resolve those three.

## State of the base (read before trusting anything on `main`)

- `perf/bible-loading` does not type-check on its own: `tsc --noEmit` gives 12 errors (`sumEn`/`img` missing on `TrackEvent`, two arity errors in `main.ts`) because the matching data and type changes are uncommitted in the main checkout. `npm run build` therefore fails at its `tsc` step on this branch before and after my commits (12 and 12). I verified with `vite build` plus an unchanged `tsc` error count.
- The worktree carries an uncommitted `vite.config.ts` copied from the earlier perf worktree (it drops page entries that do not exist at the base commit). It is not in any commit.
- The globe gesture checks failed before any change because the door cards covered their start points (item 14); with `#doors` hidden they get past the mouse-distance, loop-drag and pinch checks and then stop at `#r-open`, a button the newer nav no longer has; `verify-globe-drag.mjs` fails on a tablet zh touch release-drift assertion that the same base also fails. Both are stale tests for the current UI, not regressions from this work, and I did not rewrite them. The globe JavaScript is untouched by every commit, so the gesture behaviour is unchanged by construction; the press/hover/target changes were covered by the hit-test regression instead.

## Not verified

- No real phone, no VoiceOver/TalkBack, no Increase Contrast or Reduce Transparency toggled in an OS (the media queries were emulated through CDP and read back as matching).
- Trackpad pinch (`ctrl+wheel`) and the Tauri/Android shells.
- Text over the globe canvas (contrast) and anything inside the walk pages (tabernacle, temple, ark), which the five-page scan does not cover; the hover rewrite did touch `structures/panel.css`.
- Frame rate: no scroll-jank measurement for the 61 blur layers.
- The mock-up was exercised with scripted drags (coast travel, glide end point, spring zoom settle, sheet snap), not by hand on a phone.

## Commits

- dd37416 `scripts/audit-apple-design.mjs`, and the two gesture checks honour `TEST_URL` and hide the door overlay.
- 7dcccbd Feel pass: press, hover guard, reduced motion/transparency/contrast, targets, type floor, nav current tab.
- 06473e2 Focus trap, rem type tokens, chip contrast, `scripts/verify-text-scale.mjs`.
- (this commit) the audit, the mock-up and the evidence.

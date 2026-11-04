# 03 — Devil's advocate against the unanimous "Amended C"

Written 2026-11-04 after reading the brief, the dossier, all five papers, both audits and the three trees.
Role: argue the other side as strongly as honesty allows. §8 says where the consensus is right.

---

## Recommendation: unbundle the decision; don't buy the expensive third of it today

The five papers agree on three things and present them as one. They are separable, and only one is contested:

- **(a) Words and Sword share extracted Dart packages in one workspace.** Uncontested, true, and it pays for
  itself on those two apps *whether or not World is ever Flutter*. Approve today.
- **(b) The public web stays TypeScript/HTML.** Uncontested, well-sourced, already built. Approve today.
- **(c) World's four native apps are rewritten in Flutter and the Tauri shells retired.** The only expensive
  claim, the only irreversible one, and **the only one with no measurement behind it.** Gate it on §7.

Approve (a) and (b) now; ship World 1.0 on the **fixed** TypeScript/Tauri stack; put (c) behind a three-day
measured gate. If the gate passes, do C with eyes open. If it fails, you have lost three days and gained a
shipped product — instead of pausing a finished app for a quarter on numbers that were already obsolete when
the papers were written.

---

## 1. The quality case is stale by three hours, and the defects were ours

My strongest objection, and checkable in the repo.

Every paper's quality argument rests on four numbers: 2.68 MiB of Chinese font on an English page, an 18.6 fps /
89.3 %-dropped gallery fling, a 337 ms reader frame, a 798 ms search keystroke. Gemini cites "measured 89 %
dropped frames" as the reason to reject Tauri outright. Fable's §1 lists the CJK type, jank and
"`navigator.clipboard` silently failing in WKWebView" as "the WebView's" defects.

The evidence folders in `docs/evidence/perf-2026-11-04/` are timestamped 18:02–18:22. Commit `1d13342` ("World:
perf fixes — unicode-range syntax, cache headers, grid, search index, reflow, bars, shell boot") landed at
**20:03**, drafted by one offloaded Codex worker in under an hour: 19 files, 367 insertions. It puts
`content-visibility: auto; contain: layout paint; contain-intrinsic-size` on `.sc-card`, moves the reader's
post-`innerHTML` layout reads behind a new `afterLayout()` double-rAF, precomputes a search index, and fixes the
`unicode-range` syntax and the Netlify cache headers. The papers were written 21:13–21:29. **Nobody re-ran the
harness; there is no post-fix measurement in the tree.** The audit priced its own top-five fixes at "a day's
work" and projected 18.6 → 55+ fps and 89.3 % → <1 % dropped. Most of that landed in one evening, and the
council then rejected the stack on the before numbers.

The clipboard claim is worse. `docs/gallery-shells.md:194-199` records the WKWebView silent-no-op **and its
fix** (`prefersLegacyClipboard` in `src/reader/copy.ts`); the same file's measured table shows long-press
selection, the system Copy menu and pasting reference + edition + credit line working on iOS, the Android shell
and the macOS shell. The one cited inherent-WebView defect is a closed bug in the team's own notes.

What *is* inherent, after the fixes, is short: iOS cannot style `::selection` and draws its own handles (WebKit
273951, open, unassigned); the Android system WebView is unpinnable; Tauri's protocol handler reads whole files
with no range or streaming, so a shell makes 1,443 reads to fill the grid; WKWebView is Jetsam-killed at a limit
you cannot raise. A real list — not one that justifies a quarter-long rewrite before anyone measures the fixed
build on a device.

**The framing the council never used:** we measured an unfixed implementation, found implementation defects,
fixed them, and attributed them to the platform.

## 2. Cost: 5–7 agent-weeks is the one number nobody defended

The five estimates are 28, ~53, 54, 58–95 and 25–35 agent-days — a 3.4× spread among readers of the same
dossier, which is itself the finding. Sonnet says ±40 %; Opus calls its 10-day reader "the softest number here";
Codex calls its range "planning estimates, not measured productivity". Fable's owner-facing summary says **5–7
agent-weeks** while its own table says 25–35 days and three of five independent estimates are ~50+. The owner
has been quoted the bottom of the range.

Unpriced failure modes:

- **The reader.** Opus measured Words' reader at 19,704 lines with 266 escaping import edges and rightly refuses
  to extract it — so World gets a *new* one: verse/paragraph/parallel, eight editions, headings, footnotes,
  copy-with-citation, inline plates, four languages, at the premium bar. 8–12 days for what took months is the
  biggest single risk.
- **Extraction has no published duration anywhere.** Flutter's own SDK hit circular dependencies between core
  widgets and the design libraries and had to unbundle Material/Cupertino to fix it (primary). Nobody publishes
  "extracting the design system took N weeks", so optimistic and pessimistic estimates are equally unfalsifiable.
- **The workspace is not free.** Pub workspaces force one version solve across all members (one `intl` major for
  three apps, or `pub get` fails); vendored-diamond deps are an open proposal (dart-lang/pub#4022); Melos 8
  dropped `melos.yaml` and every major has been breaking, and its own #1062 is "avoid cascading releases".
  GitHub macOS runners cost $0.062/min against a ~290-minute Team allowance, and this team cannot run
  `flutter test` concurrently.
- **A brand-new app's store cost.** Apple now promises only "50 % <24 h, 90 % <48 h"; new apps queue 2–5 days and
  a rejection restarts the clock; screenshots per device class including iPad 13" and Mac. Google Play's
  12-testers-for-14-*consecutive*-days gate is current, and 2026 added rejections for testers who install and
  never open. Sword already tripped this.
- **The pause.** World has TestFlight builds 1–3 with testers and a store record. Two stacks run in parallel for
  a quarter, C's first deliverable is the web site he already has, and this is the second reversal in two days.

## 3. The two-reader tax is the consensus's own criticism, relocated

C is preferred over A partly because a TypeScript World means "every feature written twice". C keeps the
TypeScript reader as the public site **forever** and builds a second reader in Dart — two implementations in two
languages, permanently. Fable concedes it, prescribing "UI written twice on purpose" plus a `conformance/`
fixture set. Codex alone names the condition: *C wins only if the site stays bounded.* Nothing enforces that,
and the pressure runs one way. The clone-and-own literature is unanimous in direction — copies drift, and by the
time you want to merge them the migration is judged too expensive (TRH+22, peer-reviewed). Under A there is one
reader.

## 4. The 3D plan trades a working capability for a worse one

Tauri runs the repo's three.js in-process on all four platforms today, Windows included. Under C, 3D becomes a
WebView island — and `webview_flutter` has **no Windows implementation** (Words' pubspec carries only the
wkwebview and android federated packages), so Fable's §4.5 policy is "Windows opens the 3D page in the default
browser": a stated regression on a platform in the owner's own quality criterion. `flutter_scene` is 0.24.3,
pre-1.0, breaking minors, Flutter GPU off by default on every native target, and all five papers agree it is not
yet a dependency — which makes the WebView island the plan, not a bridge. Words has also never served bundled
local content to a WebView (its four uses are media embeds), so offline asset serving to WKWebView is unproven
new work inside the step meant to de-risk 3D.

## 5. Opportunity cost

World alone has ~95 open items; Words and Sword carry roughly 150 days of owner-visible work (premium design
bar, iPhone Duo rebuild, audio Bible, NASB removal, add-ons, STEP morphology, 1.8.2 all-platform). C spends
25–95 agent-days migrating the *third* app, whose content is finished and whose measured defects were fixed this
evening. The half of C that is clearly valuable — extraction — serves Words and Sword and costs a fraction.

## 6. What the owner regrets in 12 months

- **Under A (fixed):** World feels less native than Words on Android and macOS; iOS selection handles and system
  text size never quite right; the third app shares no widget with the other two. Recoverable — the migration is
  still available, cheaper, at `flutter_scene` 1.0.
- **Under C:** the reader rebuild took double; Words 1.8.2 slipped a quarter; two readers drifted; Windows 3D
  opens a browser; one shared-package bump blocks a Words release.
- **The asymmetry is the argument.** A→C stays open. C→A does not.

## 7. When the consensus is wrong, and the gate that would show it

It is wrong if **(i)** the fixed TypeScript build meets budget on real devices, **(ii)** Flutter's free-form
selection/copy over long CJK passages with inline images is not actually better, or **(iii)** extraction costs
more than a day per package. (ii) is not idle: **neither Words nor Sword contains a single `SelectionArea` or
`SelectableRegion`** — 75 and 47 uses of `SelectableText`, which is per-widget. The apps cited as proof that
"Flutter has this right" avoid the problem by not offering drag-selection across a chapter. The relevant issues
are open: SelectableText unselectable in a ListView (#110788, since 2022), select-all under SelectionArea in a
ListView throws (#124078), no find-in-page at all (#65504, since 2020), iOS handle-drag stalls rebuilding the
IME candidate bar (#194715, 2026-10-19). The TypeScript reader gets this free from the DOM, and the team has
measured it working on three platforms.

**Three-day gate, before anything beyond (a) and (b) is approved:**

- **G1 — re-measure, 0.5 day.** Identical harness on `1d13342` plus the three remaining top fixes. *Pass:*
  gallery fling ≥55 fps at 6× CPU, <5 % dropped, worst reader frame <100 ms, search keystroke <50 ms, first-paint
  font bytes <300 KiB. **A pass voids the council's quality premise** and shifts the burden to the rewrite.
- **G2 — the same build on real devices, 1 day.** Shell on the oldest Android and an iPhone: fling, parallel
  reader, and selection/copy of a Psalm 119 range in zh-Hant and ru. *Pass:* ≥50 fps, exact copy, no WebView
  crash in ten minutes. *Fail on iOS only →* C's real case, and it is then about one platform, not four.
- **G3 — Flutter's side of the same two questions, 1.5 days.** Throwaway app: `SliverGrid` over the real 1,443
  thumbs, plus one chapter with an inline image widget inside `SelectionArea`, same two devices. *Pass:* ≥55 fps
  **and** a drag selection spanning the image boundary copies correct zh-Hant text on both. *Fail on selection →*
  C must ship a verse-tap reader, i.e. it does not beat A on the owner's actual complaint, and (c) is refused.

Decision rule: approve (c) only if G1 or G2 fails **and** G3 passes. Any other result means fix the web stack,
ship World 1.0, and revisit at `flutter_scene` 1.0.

## 8. Where the consensus is right, and which of my objections are weak

Conceded: **the workspace and shared packages for Words and Sword.** Four hand-maintained `sed` sync scripts
with `--check` guards, three pointing at `Words-182`, is indefensible, and extraction pays there regardless of
World. Also right: **the public site stays HTML**; **"fork Words and strip" is the worst option** — 12,511
lines, 130 imports, 61 Provider reads, and Sword is the live proof that forking yields a drifting twin;
**`flutter_scene` is not a dependency yet**; and **sunk cost is zero**, the premise I cannot attack.

Weak, honestly: the **two-reader tax** is softer than I made it sound — the HTML site must exist under every
option including A, so that duplication is a property of the problem, not of C. **CI cost** is real money but
small money. **Opportunity cost** cuts both ways: if the migration is right, delay makes it dearer. And **"the
defects were ours"** does not prove *no* defect is the WebView's — only that we never separated the two, which is
what G1–G3 are for. The objection I would defend to the end is the stale measurement: deciding against a stack
on numbers from a build superseded three hours earlier is not a judgement, it is an accident of timing.

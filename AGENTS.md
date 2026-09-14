# AGENTS.md

Read `handoff/README.md` first. Its rules and `handoff/05-decisions.md` bind every agent
working in this repository. Key points:

- Screenshots are the referee (`handoff/09`): 375x812, 768x1024, 1440x900, both locales.
- No satellite imagery, no NIV text, OpenBible attribution stays (`handoff/04`).
- Do not ask questions; take the honest default (D15), record assumptions in the commit.
- `set -o pipefail; npm run build` before every commit. No attribution trailers.
- Every non-generated asset gets a row in `handoff/MANIFEST-assets.md`.

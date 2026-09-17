# A prompt: build the temple

Hand this to the model that will do the work. It is a story and a commission,
not a specification. Nobody has decided how the temple should be built — that
is the job.

---

## The story so far

There is a product called **雅伟之界 · Yahweh's World** (`world.yahwehword.com`,
repo `SuyangLiuPaul/yahwehs-globe`, released v0.1.5). It is a 3D biblical
atlas, written Chinese-first, and it exists because five other Bible-map
products already exist and being a sixth one would be pointless. It is
different in four ways, and only these four:

1. **It is Chinese.** Place names follow 和合本 as the text spells them, not
   modern Mandarin renderings — 大马色 not 大马士革, 米利大 not 马耳他. 63 of
   the gazetteer's names do not exist in the Union Version at all, and every
   correction cites the verse it comes from. The divine name reads **雅伟**;
   no shipped file may contain 耶和华.
2. **It admits what is not known.** 55% of biblical places have rival
   identifications and this app says so, on the place itself, with the
   competing candidates. A route is drawn as "the stops the account names, in
   the order it names them" — schematic, never "the road they walked".
3. **It connects to what is happening now** (planned, not built).
4. **It carries archaeological evidence** — 209 items (planned, not built).

What is standing today:

- **A globe** painted in code onto a canvas — parchment land, deep indigo sea,
  gilt coastline, measured NOAA relief. No satellite imagery, ever: five
  competitors all look like satellite maps, and this one does not.
- **1,332 places, 1,443 events, 10 journeys.** Every verse of the canon's
  31,102 falls inside some event. The events are drawn as bands under a verse
  slider, on the canon's own scale, with a book-and-search menu into them.
- **照着经文的尺寸** (`/structures.html`) — five things rebuilt in three.js
  from the cubits the text states: Noah's ark, the ark of the covenant, the
  court of the tabernacle, the lampstand (two defensible reconstructions, both
  shipped, the reader chooses), the New Jerusalem. A cubit switch (common
  0.445 m / sanctuary 0.518 m / royal 0.523 m) rescales everything, a human
  figure stands beside each object, and every card ends with **「经文没有给的
  部分」** — an explicit list of what Scripture does not say.
- **走进会幕** (`/tabernacle.html`) — a first-person walk through the
  tabernacle of Exodus 26–27, generated from the counts the text gives: 60
  court pillars, 48 boards, 96 sockets, 15 bars, 10 curtains, 50 clasps. It
  has a guided tour and a dialog that names its own assumptions.
- The three pages are joined to each other **on the verses they cite** — open
  「立起会幕」 on the globe and the walk is one click away; the structure cards
  link back to the passage they measure.
- 繁體 / 简体 / English throughout, a dark palette in every condition, and
  native macOS and Android builds with an in-app update check.

## How this project works, which matters more than any feature

- **Measured, not eyeballed.** A contrast sweep measures every label on every
  page against its真实 composited background; it once found 36 failures the eye
  had passed and it now reads zero. A change is not "done" because it looks
  done.
- **The audits are the referee, and they are re-runnable.**
  `node scripts/audit-events.mjs` checks that every citation resolves, that
  every verse is covered, that no shipped JSON contains 耶和华 or a modern
  place name, that every Chinese place name actually appears in the verse cited
  for it, and that every link between the pages still lands. All counts are
  zero. If your change makes one non-zero, that is your change.
- **Decisions are written down and not reopened** (`handoff/05-decisions.md`,
  31 of them). If one must change, write the reason there first, then the code.
- **The product does not lie to look better.** A year axis was built, shipped,
  and then deleted — printing a derived date next to an attested one hands both
  the same authority. A band's width is the uncertainty, not a design choice.
  If a thing is a reconstruction, the page says so where the reader is looking,
  not in a footnote.

## What you are being asked to build

**The temple.** 圣殿.

Solomon's is measured in 列王纪上 6–7 and 历代志下 3–4 — a house 60 by 20 by 30
cubits, a porch, a most holy place of 20 cubits cubed, two cherubim of 10
cubits with wings touching wall and wall, two pillars named Jachin and Boaz
with capitals and pomegranates counted, a molten sea of 10 cubits on twelve
oxen, ten lavers on wheeled stands whose panels the text itemises. The counts
are as specific as the tabernacle's, and the app has never drawn any of them.

There is also Ezekiel's temple (以西结书 40–43), measured in more detail than
any building in Scripture and never built by anyone; and the second temple,
and Herod's, which are archaeology and Josephus rather than revelation.

**Which of these belong in this product, and how a reader is told which is
which, is yours to decide.** So is the form: a measurement card like the
others, a walk-in like the tabernacle, something this app has not done yet.
Decide it the way this project decides things — from the text, with what the
text does not say named out loud.

The bar is the tabernacle page, and the commission is to clear it. 建得好一
点：this is the house the text spends more words on than any other object in
it.

## The lines you may not cross

- Do not generate, invent or "artistically interpret" anything the text
  measures. If Scripture gives the number, the geometry comes from the number.
- Do not present a reconstruction as a reading. Where two defensible
  reconstructions exist, ship both and let the reader choose — the lampstand
  is the precedent.
- No satellite imagery. No NIV text. OpenBible attribution stays in the footer.
- 耶和华 and modern place names must stay at zero in everything shipped.
- No light mode. No printed years presented as fact. Do not reopen
  `05-decisions.md`.
- Do not hand-write a link between two parts of the app; join them on the
  verse, the way `src/bridges.ts` does.

## What "done" means here

Read `handoff/README.md` first, then `BATCH-6.md` for the current state,
`05-decisions.md` for what is settled, `06-visual-standard.md` for the visual
bar and `09-verification-playbook.md` for how this project proves things —
including every way it has produced a false pass before.

Then: the audits at zero, `npx tsc --noEmit` clean, rendered and looked at on
a phone, a tablet and a desktop, every new asset recorded in
`MANIFEST-assets.md`, and a batch document written the way `BATCH-6.md` is —
saying what you built, what you found, and what you got wrong on the way.

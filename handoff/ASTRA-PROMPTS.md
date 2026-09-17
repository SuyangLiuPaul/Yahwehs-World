# Astra prompt pack — 把 50 条额度花在刀刃上

前提：执行者（GPT-6 Astra）额度稀缺，每条消息都要是**一次性、自足、有验收标准**的
整段交付。思考、拉锯、拆解、答疑全部在便宜的模型（GPT-5.6 Sol / Opus 5 / Fable）
里做完；Astra 只收"无悬留问题的最终执行指令"。

（你贴给我的额度数字——$100 档每周 50 条、与 Sol Pro 共用——我无法核实；这套方案
按"额度稀缺"设计，额度多少都适用。）

## 三条原则

1. **一条消息 = 一个阶段的完整交付。** 不用 Astra 做探索、不用它总结文档、不问它
   "怎么做好"。它读 `handoff/`，做，验证，提交，汇报。
2. **禁止它提问。** 通用前言里写死：文档没说的按 `05-D15` 诚实默认，把假设写进
   commit 正文，继续做。它这一代爱停下来问，一问就是一条额度。
3. **输出只要三样：** commit 哈希、证据截图路径、≤10 行报告。不要复述、不要方案
   比较、不要"我建议"。

## 额度预算（按 50 条计）

| 阶段 | 内容（对应 `08-roadmap.md`） | 条数 |
|---|---|---|
| P0 | ~~清场~~ **已完成（2026-09-14），0 条** | 0 |
| P1 | 路线体验到标准：L3 L4 L5 L7 | 4 |
| P2 | 地形扩到 5W + 海域/地区名：L1 L2 | 3 |
| P3 | 装饰物：L6 | 4 |
| P4 | 事件层渲染：**全部 1,443 条**（数据已就绪、已放行）：C1 | 3 |
| P5 | ~~66 卷事件候选~~ **数据已完成（1,443 条，全书无遗漏），0 条** | 0 |
| P6 | 路线补全到 25–35 条：C3 | 3 |
| P7 | 建筑卡片补全 + 所罗门圣殿可走：C4 | 5 |
| P8 | 证据层 + 新闻层：C5 C6 | 3 |
| P9 | 中文补全 + 英文对等：C2 B7 | 2 |
| P10 | 性能与加载：L10 | 2 |
| — | **修补保留**（P0、P5 省下的 12 条并入） | 21 |

顺序就是优先级；一周不够就跨周，不要为了赶而并两个阶段进一条。

## 每次调用 Astra 之前，先在便宜模型里做的事（不花 Astra 额度）

1. `git pull`，确认 `main` 干净、上一阶段的报告已读。
2. 把 `11-known-bugs.md` 末尾的 Q1–Q3 答掉，写进 `05-decisions.md` 作 D18+
   （D16、D17 已用）。没答的决定 Astra 会替你选，选错要再花一条修。
2b. 凡涉及 `data/` 的阶段，发 Astra 之前先跑 `node scripts/audit-events.mjs`
   确认全部为 0，把这行输出贴进 prompt——这样它交回来的「仍为 0」才有基线可比。
3. 让 Sol/Opus 按下面模板生成本阶段的最终 prompt，检查三点：范围只有一个阶段、
   验收标准可测量、没有留给 Astra 的问句。
4. 把上一阶段报告里的"未完成"项挪进本阶段或修补条。

## 通用前言（每条 Astra 消息最上面原样粘贴）

```
Repository: SuyangLiuPaul/yahwehsworld (private), branch main, working tree clean.
Before touching code, read handoff/README.md, then ONLY the handoff files named in this
message. Do not summarize them back to me.
Rules: handoff/README.md §Rules apply. Do not ask me anything: where the docs are silent,
take the honest default (handoff/05-decisions.md D15), record the assumption in the commit
body, and continue. Never reopen a decision in handoff/05. Never add satellite imagery,
NIV text, or an asset without a row in handoff/MANIFEST-assets.md. The divine name is 雅伟 in
Chinese and Yahweh in English wherever the Hebrew is YHWH (handoff/05 D18); never write 耶和华
or all-caps LORD into anything that ships.
Work until the Definition of Done below is fully met. Verify exactly as handoff/09 says:
375x812, 768x1024, 1440x900, both locales, screenshots saved under
handoff/evidence/<phase>/. `set -o pipefail; npm run build` must pass before each commit. If you touch anything under
data/ or scripts/, `node scripts/audit-events.mjs` must print zero on every count before you
commit; paste its output in the report.
Commit in the style of `git log` (what + why, no attribution trailers), one concern per
commit, then push main.
Reply with ONLY: (1) commit hashes + first lines; (2) evidence file paths;
(3) a report of at most 10 lines: done / not done / assumptions taken / numbers measured
(label counts, payload delta, frame time). No prose beyond that.
```

## 阶段 prompt（前言之后粘贴）

### P0 · 清场 — 已完成，不发
B1–B6、B11–B18 已修，孤儿已删，台账已齐，审计归零（见 `11`）。这一阶段没有东西给 Astra。

### P1 · 路线体验（4 条：L3+L7 / L4 / L5 / 修补）
```
PHASE 1a — Stop pills and markers. Read handoff/06-visual-standard.md L3 and L7,
src/labels.ts, src/markers.ts.
Do L3: replace the centre-point declutter with measured-box overlap WITHOUT reducing label
density on exodus-wilderness (record the visible-pill count before and after with the
snippet in handoff/09 and put both numbers in the report); add a leader line when a pill
is anchored off-centre; pills must never render inside the bottom card's band
(visibleBand()). Do L7: when a route is open and camera < 1.8 R, non-route markers fade to
25% and lose afterglow; route stops render as flat gold discs with a dark ring.
Definition of Done: L3 and L7 tests in handoff/06 pass; before/after counts reported.
```
```
PHASE 1b — Player card. Read handoff/06 L4, index.html (#r-card), src/main.ts route UI.
Do: per-stop terrain thumbnail (160x90 offscreen render, cached, never a photo);
stopCount dots, tap-to-jump; localised stop line; touch swipe advances/rewinds a stop.
Definition of Done: card ≤ 26% of a 375x812 viewport; every control ≥ 44 px; dots track
route.reachedIndex during playback; screenshots at three sizes.
```
```
PHASE 1c — Scale bar and north arrow. Read handoff/06 L5. Implement per its rules
(great-circle 100 km at screen centre; hidden above 3 R; arrow hidden within 5° of
north-up). Definition of Done: at 1.3 R over Jerusalem the bar is within 5% of true;
rotating the globe rotates the arrow; both hidden at 4 R.
```

### P2 · 地形与地名（3 条）
```
PHASE 2a — Terrain crop extension. Read handoff/06 L1, handoff/MANIFEST-assets.md,
src/terrain.ts. Re-generate public/data/terrain-color.webp from Natural Earth
HYP_HR_SR_OB_DR + SR_HR for 5W–50E / 12N–45N, same grading intent (mean luminance ≈ 0.48,
no pixel > 0.8, 9% feathered border), update REGION in src/terrain.ts, add the manifest
row. [If D16 in handoff/05 says GEBCO: use GEBCO 2024 15" for the height/bathymetry and
NE tint; ≤ 3 MB.] Definition of Done: paul-rome fully on relief with no visible edge;
payload delta reported; L1 test passes.
```
```
PHASE 2b — Sea and region names. Read handoff/06 L2, src/labels.ts (pattern), data/.
Author data/regions.zh.json (~40 biblical-era names), label points taken from Natural Earth
geography/marine polygons. Chinese forms MUST be the Union Version's own (handoff/05 D16:
利巴嫩 not 黎巴嫩, 大马色 not 大马士革, 西乃 not 西奈), each row carrying the verse it is read
from, and never 耶和华; a region the edition never names in Chinese gets its English label
only. Render as HTML labels visible 1.3–3.0 R; route labels win collisions.
Definition of Done: exodus-wilderness at 375x812 shows 红海, 西乃, 埃及 with no overlap on
a stop pill; both locales screenshot; node scripts/audit-events.mjs still zero.
```

### P3 · 装饰物（4 条：精灵层 / 动画与密度 / 修补 ×2）
```
PHASE 3a — Staffage, sprite tier. Read handoff/06 L6 and handoff/04 (provenance).
Implement canvas-painted instanced billboards: sail, camel, tent, bird. Placement rules
and density caps exactly as L6; fade 400 ms; none above 2.2 R; nothing on a disputed
marker. Definition of Done: L6 tests (exodus stop 12 caravan+tent, paul-1 stop 3 ship);
frame time measured and reported; manifest rows added for any generated bitmap.
```

### P4 · 事件层渲染（3 条）
```
PHASE 4 — Events layer. Read handoff/07 C1 (esp. "Review gate"), src/events/schema.ts,
data/events/all-events.json (read its meta block first — meta.candidatesCleared is the
owner's clearance to render every event), src/main.ts (timeline + T table).
Render ALL 1,443 events as bands on a year-axis toggle (verse index ⇄ years): band width
= yearLate−yearEarly, hatched when dateConfidence is disputed, dotted when none, undated
events placed on the verse axis only; the 105 spine events (dateSource.kind === 'spine',
id present in seeksparks-timeline.json) visually distinct from the rest; click frames the
event's placeIds and shows summaryZh (zh) / en title (en); localise everything through T.
Do NOT author, re-date, re-summarise or change the status of any event; do NOT edit
data/events/all-events.json by hand — it is generated. If a summary must change, it goes
in data/events/summary-overrides.json and node scripts/audit-events.mjs must stay at zero.
Definition of Done: toggle works at three sizes both locales; 1,443 bands present (count
in the report); a disputed band renders hatched; clicking a band with places frames them;
audit output pasted and all zero.
```

### P5 · 66 卷事件候选 — 数据已完成，不发
1,443 条已生成、已核、已放行（`ALL-EVENTS.md`、`EVENT-REVIEW.md`）。**不要让 Astra
再写事件** —— 它会写出第二套、跟现有的打架。事件相关的工作只剩 P4 的渲染。

### P6 · 路线补全（3 条）
```
PHASE 6-k — Journeys <list of 8–12 from handoff/07 C3>. Read C3 rules,
scripts/build-journeys.mjs, ../SeekSparks/assets/bible_journeys.json (use when present,
else author with a verse per stop). Sea legs flagged; unlocatable stops break the line;
shared-coordinate camps merge with the label saying so. Definition of Done: each new
journey opens, frames, plays at three sizes; stop counts reported; zh/en names checked
with the handoff/09 name test.
```

### P7 · 建筑（5 条：卡片 ×2 / 所罗门圣殿可走 ×3）
```
PHASE 7a — Structure cards <list from handoff/07 C4>. Read src/structures/specs.ts
(format), build.ts, handoff/05 D15. Every dimension carries its verse; an "unstated"
section for what the text does not give; English parity for textEn/punchEn/unstated.
Definition of Done: cards render at three sizes; cubit switch works; no dimension without
a reference.
```
```
PHASE 7b — Solomon's temple, walkable. Read src/walk/tabernacle.ts (the generator method),
src/walk/tour.ts, 1 Kings 6–7 counts and cubits. Generate the temple from the text's
numbers; a 7–9 stop tour with facing derived, never hand-written; procedural textures only.
Definition of Done: tour verified at three sizes with screenshots from each stop; door and
veil present; frame time reported.
```

### P8 · 证据 + 新闻（3 条）
```
PHASE 8a — Evidence layer. Read handoff/07 C5, ../SeekSparks/assets/bible_evidence.json.
Join 209 findings to places (OpenBible id → name via gazetteer → manual list in
data/evidence-manual.json); spade-glyph marker class; panel never says "proves".
Definition of Done: 209 pins or a listed reason per unmatched finding; panel at three sizes.
```
```
PHASE 8b — News layer. Read handoff/07 C6. Consume a `place` field from the yswords-data
pipeline output (add the field there if absent, minimal change, separate commit in that
repo); pulsing marker with 24 h decay; legend toggle, off by default.
```

### P9 · 中文补全与英文对等（2 条）— 按 handoff/07 C2 与 B7。
### P10 · 性能与加载（2 条）— 按 handoff/06 L10 与 handoff/03 性能预算；报告首屏时间与帧率。

## 修补模板（保留的 9 条用这个）
```
REPAIR — Phase <n>. Read handoff/evidence/<phase>/ and the report below. Defects observed:
<numbered list, each with viewport + locale + what is wrong, one line>. Fix only these;
do not refactor; keep the phase's Definition of Done true. Reply per the preamble.
```

## 验证模板（不想花 Astra 额度验证时，给 Sol/Opus 用）
```
Read handoff/09-verification-playbook.md. Run the checks for Phase <n> on the live site
and report pass/fail per check with the measured values. Do not change code.
```

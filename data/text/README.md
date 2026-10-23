# data/text/：雅伟之界文字包 / The 雅伟之界 text pack

> **只用 data/text/，不要读 Sword-182/Words-182 的工作副本。**
> Read only `data/text/`. Never read the Words-182 or Sword-182 working copies. They change all the time; this pack is a fixed copy with a SHA for every file.

这是《最终方案》第三节的第 2 项交付物：经文、小标题和导语都取自 Words 的修订版，每个文件都在 `MANIFEST.json` 里记了 SHA-256、来源路径、来源 commit、授权和署名。
This is deliverable 2 of 最终方案 §三. The scripture, section titles and notes come from Words' revised texts. `MANIFEST.json` records each file's SHA-256, source path, source commit, licence and attribution.

来源 / Source: `/Volumes/androidbuild/Words-182`, branch `release/1.8.2`, HEAD `e5261ce7cd9df55823ab3921ea5e64ec764eccf2` (2026-10-23). Every file is copied from that commit with `git show HEAD:…`, not from the working tree. The builder stops if the working file differs from HEAD.

---

## 1. 有什么 / What is here

| 文件 / File | 内容 / Content | 节数 / Verses | 大小 / Bytes |
|---|---|---|---|
| `bible/cuvs-yhwh.json` | 和合本雅伟版（简体），Words 修订版 | 31,102 | 6,719,273 |
| `bible/cuvs-yhwh-tr.json` | 和合本雅偉版（繁體） | 31,102 | 6,719,276 |
| `bible/bsb-yhwh.json` | Berean Standard Bible (Yahweh) | 31,086 | 6,128,736 |
| `bible/asv-yhwh.json` | ASV 1901 (Yahweh) | 31,086 | 6,393,312 |
| `bible/web-yhwh.json` | World English Bible (Yahweh) | 31,098 | 6,280,513 |
| `bible/kjv.json` | KJV 1611/1769 | 31,102 | 7,604,330 |
| `bible/jps.json` | JPS 1917 (OT only) | 23,145 | 4,894,751 |
| `bible/brenton.json` | Brenton's English Septuagint 1851 (OT only) | 22,780 | 4,867,385 |
| `bible/rst.json` | Синодальный перевод 1876 (plain, public domain) | 31,102 | 9,445,478 |
| `bible/wlc.json` | Westminster Leningrad Codex (Hebrew) | 23,142 | 7,048,527 |
| `bible/wh.json` | Westcott–Hort Greek NT 1881 | 7,940 | 2,067,661 |
| `bible/sblgnt.json` | SBL Greek New Testament 2010 (CC BY 4.0) | 7,957 | 2,680,087 |
| `section_titles.json` | 小标题＋导语，四套（cuv、cuv-tr、english-classic、ru），每套 2,597 段 | — | 3,199,925 |
| `versification-ru.json` | 俄文 Synodal 与英文（KJV/BSB）章节编号对照 | — | ~190 KB |
| `divine_name.py` | Words 神名显示规则的移植 + 显示用的去标记函数 | | |
| `textpack.py` | 按经文出处查经文、查段落、查俄文编号 | | |
| `tools/build_textpack.py` | 唯一写这个文件包的脚本 | | |
| `tests/test_textpack.py` | 残留、编号、SHA、规则检查 | | |
| `MANIFEST.json` | 每个文件的 SHA、来源、授权、署名 | | |

总大小约 74 MB，没有超过 150 MB，所以不压缩。
Total is about 74 MB, under the 150 MB threshold, so nothing is compressed.

经文文件是 Words `assets/` 的**逐字节拷贝**，一个字都没改。
The scripture files are **byte-for-byte copies** of Words' `assets/`. Nothing in them is changed.

### 文件格式 / Format

每个经文文件都是一个数组，每节一条：`{"book", "chapter", "verse", "text", "id"}`。
Each scripture file is an array with one object per verse: `{"book", "chapter", "verse", "text", "id"}`.

**`id` 是共同的键 / `id` is the shared key:** 9 位数字 `BBBCCCVVV`，用英文（KJV）编号，书卷 1–66 按 `section_titles.json` 的 `_meta.books` 排序。`book` 字段各版本不同（中文版是中文书名，俄文版是英文书名），不要用它来对齐，要用 `id`。俄文 `rst.json` **已经**被 Words 改成英文编号，所以查俄文经文直接用英文 `id`。
A 9-digit `BBBCCCVVV` in English (KJV) numbering, books 1–66 in the order of `section_titles.json` `_meta.books`. The `book` field differs between editions (Chinese names in the CUV, English names in the Synodal), so join on `id`, not on `book`. Russian `rst.json` has **already** been renumbered to English numbering by Words, so Russian text is looked up by the English `id` too.

`section_titles.json` 的段落锚点也是英文编号，四套完全相同。
The section anchors in `section_titles.json` also use English numbering, and they are identical across the four sets.

---

## 2. 怎么用 / How to use

```python
import sys; sys.path.insert(0, "data/text")
import textpack as tp

tp.verse("cuvs-yhwh", "Psalms", 23, 1)      # '（大卫的诗。）雅伟是我的牧者，我必不致缺乏。'
tp.verse("kjv", "Psalms", 23, 1)            # 'Yahweh is my shepherd; I shall not want.'
tp.verse("kjv", "Psalms", 23, 1, raw=True)  # 'The LORD is my shepherd; …' (exactly as the file has it)
tp.section("Genesis", 18, 1, "cuv")         # {'verse': 1, 'title': …, 'context': …}
tp.section("Genesis", 18, 1, "english-classic")
tp.ru_ref("Psalms", 23, 1)                  # 'Psalms 22:1' (the Synodal number)
```

- `verse()` 默认返回**显示用文字**：先套神名规则，再去掉所有标记（见第 3、4 节）。只在要逐字核对时才用 `raw=True`。
  By default, `verse()` returns **display text**: it applies the divine-name rule and then strips all markup (§3, §4). Use `raw=True` only for byte-level checks.
- 没有这一节时返回 `None`，例如旧约专用的版本，或 BSB 省掉的 16 节（`versification-ru.json` 的 `bsbOmits`）。
  It returns `None` when the edition has no such verse, for example in an OT-only edition or for the 16 verses the BSB omits (`bsbOmits` in `versification-ru.json`).
- 导语和小标题都从 `section_titles.json` 取：中文简体 `cuv`、繁体 `cuv-tr`、英文 `english-classic`、俄文 `ru`。英文提示词用 `english-classic` 的导语。
  Titles and notes come from `section_titles.json`: `cuv` (Simplified), `cuv-tr` (Traditional), `english-classic` (English), `ru` (Russian). English prompts use the `english-classic` notes.
- 标题或导语有错，**不要在 globe 这边改**：退回 Words 的标题流水线（`tools/build_section_titles.py`、`docs/headings/`），改好以后重跑本包的构建脚本，SHA 会跟着变。
  If a title or note is wrong, **do not fix it here**. Send it back to Words' heading pipeline (`tools/build_section_titles.py`, `docs/headings/`), then rerun this pack's builder. The SHA changes with it.

重建和检查 / Rebuild and check:

```sh
python3 data/text/tools/build_textpack.py --russyn-vpl <path>/russyn_vpl.txt   # --russyn-vpl only to rebuild the Russian table
python3 data/text/tests/test_textpack.py
```

---

## 3. 神名的显示规则 / Divine-name display rule

`divine_name.py` 逐行移植了 Words 的 `lib/constants/text_patterns.dart` → `_normalizeDivineNames`。**只在显示时套用，经文文件本身不改。**
`divine_name.py` is a line-for-line port of `_normalizeDivineNames` in Words' `lib/constants/text_patterns.dart`. **It applies only at display time. The scripture files are never changed.**

| 原文 / Source text | 显示 / Shown | 说明 / Note |
|---|---|---|
| 耶和华 | 雅伟 | 简体 / Simplified |
| 耶和華 | 雅偉 | 繁体 / Traditional |
| `the LORD`, `The LORD` | Yahweh | 全大写才换，整词匹配 / all caps only, whole word |
| `LORD` (other) | Yahweh | `LORD's` → `Yahweh's` |
| `Lord` (mixed case) | 不变 / unchanged | Adonai 或 kyrios（常指耶稣） / Adonai or kyrios (often Jesus) |
| `Lord GOD` | 不变 / unchanged | GOD 不换 / GOD is not replaced |
| 俄文 Господь | 不变 / unchanged | 俄文没有规则（见第 6 节） / no Russian rule (§6) |
| 希伯来文 יהוה、希腊文 | 不变 / unchanged | |

每个版本实际显示的神名（Words 的 `edition_measurements.g.dart`）：
The divine name each edition actually shows (from Words' `edition_measurements.g.dart`):

| 版本 / Edition | 原文印的 / Printed | 显示 / Shown |
|---|---|---|
| cuvs-yhwh / cuvs-yhwh-tr | 雅伟 / 雅偉 | 雅伟 / 雅偉 |
| bsb-yhwh, asv-yhwh, web-yhwh | Yahweh（bsb 另有 110 节印 LORD / bsb has 110 more verses printing LORD） | Yahweh |
| kjv | LORD | Yahweh |
| jps | YHWH | YHWH（Words 也这样显示 / Words shows it this way too） |
| brenton | Lord（LXX 的 kyrios） | Lord |
| rst | Господь | Господь |
| wlc | יהוה | יהוה |

**globe 自己写的文字**（导语、卡片、事实卡、字幕）不是经文，不经过这个规则，要直接写名字：简体 雅伟（或 雅伟神、父神雅伟）、繁体 雅偉、英文 Yahweh、俄文 Яхве（`divine_name.APP_WRITTEN_NAME`）。耶稣从不称为雅伟。引用经文时照原版本，只套这个规则。
**Text the globe writes itself** (notes, cards, fact cards, captions) is not scripture and does not go through the rule. It writes the name directly: 雅伟 (or 雅伟神, 父神雅伟) in Simplified, 雅偉 in Traditional, Yahweh in English, Яхве in Russian (`divine_name.APP_WRITTEN_NAME`). Jesus is never called Yahweh. Scripture is quoted as the edition has it, with only this rule applied.

---

## 4. 标记与残留 / Markup and residue

旧的 globe `public/data/bible/cuvs-yhwh.json` 夹着 295 个 `<H0>`/`<G0>` 残留标签，而且比 Words 落后 106 节（该撒、希利尼、巡抚、豫备）。这个包里的 Words 版本**本来就没有** Strong's 标签：Words 不出带标签的经文，只在一个单独的层里存编号。
The globe's old `public/data/bible/cuvs-yhwh.json` carries 295 `<H0>`/`<G0>` residue tags and is 106 verses behind Words (该撒, 希利尼, 巡抚, 豫备). The Words texts in this pack have **no** Strong's tags at all. Words ships no tagged scripture; it keeps the numbers in a separate layer.

经文里仍然有的是版本**自己的**标记，`display_text()` 照 Words 的 `displayVerseText` 处理：
What the texts still carry is each edition's **own** markup. `display_text()` handles it the way Words' `displayVerseText` does:

- `<note:…>` 注释（cuvs 1,207 处、sblgnt 6,901 处）：删掉。 / `<note:…>` notes (1,207 in cuvs, 6,901 in sblgnt): removed.
- `{…}`：去掉括号，保留内容。 / `{…}`: braces removed, content kept.
- `[…]`：中文的编者标注 `[雅伟]`、`[耶稣]`、`[基督]` 显示成 `〔雅伟〕`；其他版本方括号里的词照普通文字显示（BSB 的 `[Yahweh]`、Brenton 补的 `[is]`、WH 的存疑字）。 / `[…]`: the Chinese editor's referent marks `[雅伟]`, `[耶稣]`, `[基督]` show as `〔雅伟〕`; in other editions the bracketed words read as plain words (the BSB's `[Yahweh]`, Brenton's supplied `[is]`, WH's doubtful words).
- `¶`、换行、多余空格：去掉或合并。 / `¶`, line breaks and extra spaces: removed or collapsed.

`tests/test_textpack.py::test_residue_zero` 对 12 个版本逐节检查，断言下面每一项都是 0：原文里的 `<H0>`/`<G0>` 和任何 Strong's 标签；显示文字里的 `<…>`、`<note`、`[ ]`、`{ }`、`¶`，以及 `H1234`/`G1234` 这样的编号。当前结果：**全部为 0**。
`tests/test_textpack.py::test_residue_zero` checks all 12 editions verse by verse. It asserts that each of these counts is zero: `<H0>`/`<G0>` and any Strong's tag in the raw files; `<…>`, `<note`, `[ ]`, `{ }`, `¶` and `H1234`/`G1234`-style numbers in the display text. Current result: **all zero**.

---

## 5. 俄文章节编号 / Russian versification

`rst.json` 是 Words 用 CrossWire SWORD 的 Synodal→KJV 规则改编号以后的版本（`Words-182/tools/import_rst.py`、`tools/rst/README.md`），所以查经文**不需要**对照表。对照表只用来显示俄文读者熟悉的编号，或者把俄文出处读回英文 id。
`rst.json` is the version Words renumbered with CrossWire SWORD's Synodal→KJV rules (`Words-182/tools/import_rst.py`, `tools/rst/README.md`), so text lookup **does not need** the table. Use it only to show the number a Russian reader knows, or to read a Russian reference back to an English id.

`versification-ru.json`：

- `enToRu`：英文 id → 同一卷的 Synodal `章:节` 列表（编号相同的省略；`[]` 表示没有对应的 Synodal 节）。共 2,689 条。 / English id → list of Synodal `chapter:verse` in the same book (omitted when identical; `[]` means there is no Synodal verse). 2,689 entries.
- `ruToEn`：Synodal id（同样 9 位，用 Synodal 编号）→ 英文 id。共 2,752 条。 / Synodal id (same 9-digit form, Synodal numbers) → English id. 2,752 entries.
- `ranges`：给人看的摘要，按书卷列出连续的偏移，例如诗篇 `10:1-18 → 9:22-39`、`23:1 → 22:1`、罗马书 `16:25-27 → 14:24-26`。 / A summary for people: runs of constant offset by book, e.g. Psalms `10:1-18 → 9:22-39`, `23:1 → 22:1`, Romans `16:25-27 → 14:24-26`.
- `joined`：8 个英文节在 rst 里是空的，因为 Synodal 把它们并进前一节（例如 利 14:56、诗 13:6、林后 13:13）；值是装着这段文字的那一节。 / 8 English verses are empty in rst because the Synodal joins them to the verse before (e.g. Lev 14:56, Ps 13:6, 2 Cor 13:13). The value is the verse that holds the text.
- `ruChapterVerses`：每章的 Synodal 节数。`bsbOmits`：BSB 省掉的 16 个 KJV 节。 / Synodal verse count per chapter. `bsbOmits`: the 16 KJV verses the BSB omits.

**怎么来的 / How it was built:** 把 eBible.org 的 `russyn_vpl.txt`（Synodal 编号，就是 Words 用的同一个来源）和 Words 的 `rst.json` 逐节对齐。每个 Synodal 节都恰好落在一个 rst 节里；每个 rst 节又都能由对应的 Synodal 节**完整拼回**（唯一的例外是雅歌 1:1，那是 Words 自己补的书名）。所以这张表就是 Words 实际做的编号变换，不是另外推算的。
The table aligns eBible.org's `russyn_vpl.txt` (Synodal numbering, the same source Words uses) with Words' `rst.json` verse by verse. Every Synodal verse lands in exactly one rst verse, and every rst verse is **reassembled exactly** from its Synodal verses. The one exception is Song 1:1, the book title Words supplies. So the table records the renumbering Words actually applied; it is not a separate reconstruction.

**限制 / Limits:** eBible 的 russyn 是新教正典的版式：但以理书 3 章没有希腊文增补，雅歌没有标题节。东正教印本的但 3:24 以后编号不同。
eBible's russyn uses the Protestant-canon layout: no Greek additions in Daniel 3 and no title verse in the Song. Orthodox printings number Dan 3:24 onward differently.

**测试 / Test:** `test_versification_sample_50` 取 50 个出处，其中 20 个固定（诗 3:1、10:1、23:1、51:1、60:1、116:10、147:12，玛 4:1，罗 16:25，珥 2:28，歌 1:2，约叁 1:14，民 13:1，伯 41:1，拿 2:1，林后 13:12 等），30 个随机（固定种子）。每个都检查：英文 → 俄文 → 英文能回到原处；俄文编号确实存在；rst 在这个英文 id 上有文字。`test_versification_covers_every_rst_verse` 检查空节恰好就是 `joined` 的 8 节。
`test_versification_sample_50` takes 50 references: 20 fixed ones (Ps 3:1, 10:1, 23:1, 51:1, 60:1, 116:10, 147:12, Mal 4:1, Rom 16:25, Joel 2:28, Song 1:2, 3 John 1:14, Num 13:1, Job 41:1, Jonah 2:1, 2 Cor 13:12, …) and 30 random ones from a fixed seed. For each, it checks that English → Russian → English returns to the same verse, that the Russian number exists, and that rst has text at the English id. `test_versification_covers_every_rst_verse` checks that the empty verses are exactly the 8 in `joined`.

### Words 的 rst 有一处缺字（不在这里修）/ A gap in Words' rst (not patched here)

诗篇 51、52、54、60 篇（Synodal 50、51、53、59）的标题在 Synodal 里占两节，Words 的导入脚本只留了第二节，所以 rst 的这四节是从半句开始的（例如诗 51:1 以「когда приходил к нему пророк Нафан…」开头，缺了「Начальнику хора. Псалом Давида,」）。缺的文字列在 `lostInWords`。经文文件照 Words 原样拷贝，这个问题要回到 Words 的 `tools/import_rst.py` 去修（`titles[...] = t` 会覆盖前一节标题）。
In Psalms 51, 52, 54 and 60 (Synodal 50, 51, 53, 59) the superscription takes two Synodal verses. Words' importer kept only the second, so these four rst verses start mid-sentence (Ps 51:1 begins «когда приходил к нему пророк Нафан…» and lacks «Начальнику хора. Псалом Давида,»). The missing text is listed in `lostInWords`. The scripture file is copied as Words has it. The fix belongs in Words' `tools/import_rst.py`, where `titles[...] = t` overwrites the first title verse.

---

## 6. 需要业主决定 / Owner decision

**俄文 rst 用 «Господь» 表示 YHWH。** Words 对俄文没有神名规则，所以俄文经文引文里显示 Господь（例如 诗 23:1「Господь - Пастырь мой」）。globe 自己写的俄文（`ru` 导语）用 Яхве。**默认照原样保留 Господь**，要不要改请业主决定。改的话也只能在显示规则里改（并且 Words 要一起改），不改经文文件。
**The Russian rst renders YHWH as «Господь».** Words has no Russian divine-name rule, so Russian quotations show Господь (Ps 23:1 «Господь - Пастырь мой»). The globe's own Russian text (the `ru` notes) uses Яхве. **By default Господь is kept as printed.** Whether to change it is the owner's decision. Any change would go into the display rule (and into Words with it), never into the scripture file.

---

## 7. 授权与署名 / Licences and attribution

每个文件的授权和署名原文都在 `MANIFEST.json` 的 `files.<path>.licence` / `.attribution`，措辞取自 Words 的 About 页（`lib/constants/ui_strings.dart` 的 `aboutLicense…`）和 `docs/permissions/README.md`。
Each file's licence and attribution text is in `MANIFEST.json` under `files.<path>.licence` / `.attribution`. The wording comes from Words' About page (`aboutLicense…` in `lib/constants/ui_strings.dart`) and `docs/permissions/README.md`.

- 和合本雅伟版：© 雅伟的话事工 · 经授权使用。/ © Yahweh De Hua Ministry · used with permission.
- BSB (Yahweh)、ASV (Yahweh)：经文本身是公有领域，神名恢复是雅伟的话事工的编辑成果。 / The base texts are public domain; the divine-name restoration is the editorial work of Yahweh De Hua Ministry.
- WEB、KJV、JPS 1917、Brenton、Synodal 1876、WLC、WH 1881：公有领域。 / Public domain.

### SBLGNT（必须署名 / attribution required）

SBLGNT 用 CC BY 4.0 授权（https://sblgnt.com/license/ 写的是 Creative Commons Attribution 4.0 International Public License）。这个许可证要求：凡是显示或分享这份经文，都要注明作者、版权声明、许可证链接、免责声明、来源链接，并且说明做过哪些改动。凡是显示 SBLGNT 经文的地方，都要原样附上下面这段：
SBLGNT is licensed under CC BY 4.0 (https://sblgnt.com/license/ gives the Creative Commons Attribution 4.0 International Public License). Wherever the text is shown or shared, the licence requires the creators, the copyright notice, a link to the licence, the no-warranty notice, a link to the source, and a statement of changes. Wherever SBLGNT text appears, include this notice verbatim:

> The Greek New Testament: SBL Edition (SBLGNT), edited by Michael W. Holmes. Copyright © 2010 Society of Biblical Literature and Logos Bible Software. Licensed under the Creative Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/), provided as-is without warranties; source: https://sblgnt.com/license/. Changes: supplied via Yahwehdehua with paragraph and apparatus anchors already removed upstream; Words keeps the 6,901 apparatus notes as <note:> markup; this pack's display_text() removes them and the bracket marks. No wording edits.

（Words 的 About 页用的是更短的一句：“The Greek New Testament: SBL Edition. Copyright © 2010 Society of Biblical Literature and Logos Bible Software. CC BY 4.0 (https://sblgnt.com/license/).”。上面这段在它的基础上补齐了 CC BY 4.0 要求的各项。）
(Words' About page uses a shorter line: "The Greek New Testament: SBL Edition. Copyright © 2010 Society of Biblical Literature and Logos Bible Software. CC BY 4.0 (https://sblgnt.com/license/)." The notice above adds the remaining items CC BY 4.0 requires.)

---

## 8. 不收的版本 / Excluded editions

globe 的产物会出现在网页、图片和视频里，等于再分发一次，比 app 内阅读更进一步。所以只收授权已经清楚、可以再分发的版本（依据：Words `docs/permissions/README.md`、`docs/TODO-2026-10-20.md`、雅伟之界 `07-唱反调-第三轮.md` R6）。
The globe's output appears on web pages, in images and in videos. That is a further act of redistribution, beyond reading inside the app. So the pack holds only editions whose licence clearly allows redistribution (sources: Words' `docs/permissions/README.md` and `docs/TODO-2026-10-20.md`; 雅伟之界 `07-唱反调-第三轮.md` R6).

| 版本 / Edition | 原因 / Reason | 档 / Tier |
|---|---|---|
| LEB | 可以免费赠送，但每次引用都要署名，还有数量报告义务。 / Free to give away, but every quotation needs its credit line, and there are reporting duties. | 只在 app 内 / app only |
| NET（英文） | 是业主转达的决定，不是出版方的书面授权。 / The owner relayed a decision; there is no written publisher grant. | 只在 app 内 / app only |
| CNET / CNET-tr | 来源索引记有许可，但没有书面文件。 / The source index records permission, but there is no written document. | 只在 app 内 / app only |
| CSB | 授权给 Raymond Suen 个人，只限一部指定作品，而且只在免费发行时有效；Words 也不许把它放上图片。 / Granted to Raymond Suen personally for one named work, valid only while distributed free; Words already bars it from images. | 只在 app 内 / app only |
| NASB | 授权未解决，Words 里已全面隐藏。 / Licence unresolved; fully hidden in Words. | 完全不用 / not used |
| LXX（希腊文） | 校勘本不明，授权未定（归 Peter 判断）；Words 不许上图片。 / The critical edition is unknown and the licence is undecided (Peter's call); Words bars it from images. | 完全不用 / not used |
| 吕振中 LZZ / LZZ-tr | 只有口头许可。 / Oral permission only. | 完全不用 / not used |
| rst-s（带 Strong's 的 Synodal） | RusSynodalLIO 有版权，许可申请中，只在开发分支。 / RusSynodalLIO is under copyright; permission has been requested; it exists only on a dev branch. | 完全不用 / not used |

**俄文版的来源核对 / Russian provenance check:** 本包的 `rst.json` 来自 Words 主线（`release/1.8.2`）的 `assets/rst.json`，来源是 eBible.org 的 `russyn`（1876，公有领域）。Words 的 `tools/rst/README.md`、`lib/constants/bible_versions.dart`、`edition_facts_data.dart`（provenance「eBible.org (russyn)」）都这样记。文本里没有任何 Strong's 标签（测试为 0）。带 Strong's 的版本 `rst-s` 只在没有合并的分支 `feature/russian-strongs-20261020` 上。
This pack's `rst.json` comes from `assets/rst.json` on Words' main line (`release/1.8.2`). Its source is eBible.org's `russyn` (1876, public domain), as recorded in Words' `tools/rst/README.md`, `lib/constants/bible_versions.dart` and `edition_facts_data.dart` (provenance "eBible.org (russyn)"). The text has no Strong's tags (the test counts 0). The tagged `rst-s` exists only on the unmerged branch `feature/russian-strongs-20261020`.

---

## 9. section_titles.json：Words 与 Sword 的比对 / Words vs Sword

本包拷的是 Words-182 的 `assets/section_titles.json`。它和 Sword-182 的拷贝**字节不同**（SHA 不同），但四套标题的内容**逐条相同**：两边只差在 `_meta` 里，Sword 多一个 `note` 键（同一段说明的多语言版本）。比对结果记在 `MANIFEST.json` 的 `files."section_titles.json".swordComparison`。
This pack copies Words-182's `assets/section_titles.json`. It is **byte-different** from Sword-182's copy (the SHAs differ), but the four title sets are **identical entry for entry**. The only difference is in `_meta`, where Sword has an extra `note` key (the same description in several languages). The comparison is recorded in `MANIFEST.json` under `files."section_titles.json".swordComparison`.

- Words sha256 `27fcdc7d2c39694de5f7f6ad2ea9d3a83f88b0453df46385cfb22ef23ff69e32`
- Sword sha256 `0bd26d26acf9f70ce56fd06f563f748e1769f2f0507f0d63f15b0a30fc351d5d` (Sword HEAD `45fc797a`)

四套各 2,597 段，每段都有 `title` 和 `context`。四套里都没有 祂、三位一体、位格、神性、耶和华、上帝、Trinity、Godhead（测试会查）。
Each of the four sets has 2,597 sections, every one with a `title` and a `context`. None of the sets contains 祂, 三位一体, 位格, 神性, 耶和华, 上帝, Trinity or Godhead (the test checks this).

---

## 10. 其他说明 / Other notes

- 旧的 `public/data/bible/` 没有改动，也没有删除。以后改用这个包，那三个文件就退役了，但这一步不在本次范围内。
  The old `public/data/bible/` is untouched and has not been deleted. Once the globe switches to this pack those three files are retired, but that step is outside this change.
- cuvs-yhwh 里牧师裁定的用字：凯撒 46、希腊 44、总督 43、预备 258；旧写法 该撒、希利尼、豫备 都是 0。另有 4 处「巡抚」是 Words 保留下来的（不是 globe 这边的事，照拷）。
  The pastor's rulings in cuvs-yhwh: 凯撒 46, 希腊 44, 总督 43, 预备 258. The old forms 该撒, 希利尼 and 豫备 occur 0 times. Words keeps 4 occurrences of 巡抚; they are copied as they are, since that is Words' decision.
- 《最终方案》R6 提到的 `event-text.json`（每个事件四种语言的标题、导语和经文）不在这个交付物里，要等 `depictsRef` 定了以后，用 `textpack.py` 生成。
  The `event-text.json` mentioned in 最终方案 R6 (per-event titles, notes and verses in four languages) is not part of this deliverable. It is to be generated with `textpack.py` once `depictsRef` is settled.

# 28 · 闸门 `gate_check.py`：证据格式与 2026-10-23 基线

依据：`雅伟之界_方案讨论_2026-10-23/最终方案.md` §1.5 与第三节第 1 项；06 的 M3、M4；07 的 R3。
本文件规定生成 session 要写什么、写在哪里；`tools/scenes/gate_check.py` 只按这里的字段核对。

## 1. 闸门是什么、不是什么

- **只读**：不调用任何模型，不联网，不写任何文件。JSON 和媒体只读打开；ffmpeg 抽帧经管道进内存，不落盘。
  测试 `test_gate_is_read_only` 在跑完三条线的 `--all --json` 和 `--summary` 之后，逐个文件比对大小、mtime 和 SHA。
- **它不看图**。看图由视觉审查（新对话，最好换模型）完成，结果写进 `review/<id>.json`；闸门只核对这份结果是否齐全、是否针对当前这个文件、是否全部通过。
- **用法**（在仓库根目录运行）：

```
python3 tools/scenes/gate_check.py square <id...|--all> [--json] [--summary]
python3 tools/scenes/gate_check.py still  <id...|--all> [--json] [--summary]
python3 tools/scenes/gate_check.py video  <id...|--all> [--json] [--summary]
python3 tools/scenes/gate_check.py veto-table          # 交给审查者的否决表及其 SHA
```

  - 退出码：0 = 所查的每一项都通过；1 = 至少一项不通过；2 = 用法错误。
  - `--summary` 只打印计数：各 state 的数量、每个不通过原因影响多少项（全部 / 其中 state=pass 的）、警告、`evidenceState`。这是「同一把尺」读数的一部分，每批前后各贴一次。
  - `--json` 输出 `{"summary": …, "items": [{id, kind, state, pass, reasons:[{code, detail}], warnings, evidenceState, measured}]}`；与 `--summary` 同用时只输出 summary。
  - 可选参数：`--scenes-root`（默认 `/Volumes/T7/yahwehs-globe-scenes`）、`--events`（默认仓库 `data/events/all-events.json`，用 `start`/`end` 作事件范围）、`--bible`（默认 `public/data/bible/bsb-yhwh.json`，用来确认某节经文存在）。文字包 `data/text/` 交付后可改指向那里的 BSB。
- **每条规则都会跑完**，一项可以同时有多个原因；不会在第一个错处停下。

## 2. 证据放在哪里

`S = /Volumes/T7/yahwehs-globe-scenes`。新目录由生成 session 建立；闸门不建任何目录。

| 东西 | 方块（square） | 写实剧照（still） | 视频（video） |
|---|---|---|---|
| 状态与字段 | `S/no-text-derivatives-v2/status/<id>.json`（已有） | `S/realistic-cinema-v1/manifest.json` 的 `events[]`（已有） | 同左 |
| 被审的文件 | `S/no-text-derivatives-v2/live/<id>.png` | `S/realistic-cinema-v1/images-live/<id>.jpg`（网站发布的就是这个 jpg） | `S/realistic-cinema-v1/videos-live/<id>.mp4`，或 manifest 的 `videoFile` 指向的静音版（见 §6） |
| 视觉审查 | `S/no-text-derivatives-v2/review/<id>.json`（**新**） | `S/realistic-cinema-v1/review/still/<id>.json`（**新**） | `S/realistic-cinema-v1/review/video/<id>.json`（**新**） |
| 经文事实卡 | `S/fact-cards/<id>.json`（**新**，三条线共用） | 同左 | 同左 |
| registry | `S/no-text-derivatives-v2/content-qc-registry.json`（已有，只读） | 不适用 | 不适用 |

- 事实卡按事件写一份，三条线共用：经文只有一套，分开写会两份不一致。每份审查都记下它看到的事实卡的 SHA，事实卡改了，旧审查立刻失效（`review_factcard_stale`）。
- live 目录里的 `._*` 是 exFAT 的 AppleDouble 文件，闸门按确切路径打开文件，不受影响；写 JSON 时也不要把它们当数据读。

## 3. 经文事实卡 `fact-cards/<id>.json`

```json
{
  "schema": "fact-card-v1",
  "id": "genesis-9-18",
  "verses": {"s": 1009018, "e": 1009029, "ref": "创 9:18–29", "textSha256": "<data/text 里所用经文文件的 SHA>"},
  "mustShow": [
    {"who": "挪亚 Noah", "count": 1},
    {"who": "闪和雅弗 Shem and Japheth", "count": 2},
    {"who": "含 Ham", "count": 1}
  ],
  "noPeople": false,
  "keyAction": [
    {"action": "闪和雅弗把衣服搭在肩上，给父亲盖上", "direction": "倒退着进去，背着脸 (walking backward, faces turned away)", "ref": "9:23"}
  ],
  "mustNot": ["闪和雅弗面朝挪亚", "裸露", "罗马或中世纪服饰"],
  "eraKit": "青铜时代近东游牧帐棚"
}
```

闸门核对（任一项不合 → `factcard_invalid`，detail 写出是哪一项）：
- `schema` = `fact-card-v1`，`id` = 文件名；
- `verses.s`、`verses.e`：整数，编码 `书卷×1,000,000 + 章×1,000 + 节`（与 `all-events.json` 的 `start`/`end` 同一编码）；`s ≤ e`；落在事件范围内；两节都存在于 `--bible`；
- `mustShow`：数组，每项 `who` 非空、`count` 为 ≥1 的整数或字符串 `"crowd"`；只有写了 `"noPeople": true` 才可以是空数组（例如只画天象的诗篇）；
- `keyAction`：非空数组，每项 `action` 和 `direction` 都非空（没有方向可言就写「无」，不能省）；
- `mustNot`：非空字符串数组。全局否决表里的项目不必重复，这里写本事件特有的禁忌（registry 的要求、02 里点名的错误）。
- `ref`、`textSha256`、`eraKit` 和 `count` 以外的说明字段闸门不核对，但审查者要用。

## 4. `depictsRef`、`depictsRefException`、`sectionSource`

位置：方块写在 `status/<id>.json`；剧照和视频写在 manifest 的那一条 event 里（视频与剧照同一画面，共用这两个字段）。

```json
"depictsRef": [{"s": 1009020, "e": 1009023, "label": "创 9:20–23"}],
"sectionSource": "depicts"
```

- `depictsRef`：非空数组，每段 `s ≤ e`、同一卷书、两节都存在 → 否则 `depictsref_invalid`；缺字段 → `depictsref_missing`。
- 要**看图**写：图里实际画了哪几节。可以只是事件范围的一部分，也可以是几段。
- 超出事件范围（`all-events.json` 的 `start`–`end`）→ `depictsref_out_of_range`，除非同一记录里有书面例外：

```json
"depictsRefException": {"reason": "借用 genesis-10-1 的图，业主 10/25 同意", "source": "genesis-10-1"}
```

  `reason` 必须非空。平行经文（例如福音书对观）也走这个例外。
- `sectionSource`：`"depicts"`（段落由看图写的 depictsRef 算出）或 `"provisional"`（暂用处理清单 CSV 的主段落）。缺 → `sectionsource_missing`；其他值 → `sectionsource_invalid`。闸门接受 `provisional`，但它表示段落归属还没定，交业主时要单独计数。

## 5. 视觉审查 `review/<id>.json`

```json
{
  "schema": "gate-review-v1",
  "id": "genesis-9-18",
  "kind": "square",
  "subject": {"path": "no-text-derivatives-v2/live/genesis-9-18.png", "sha256": "<被审文件的 SHA-256>"},
  "verdict": "pass",
  "veto": {
    "jesusHair":          {"answer": "pass", "note": "画面中没有耶稣"},
    "mensHair":           {"answer": "pass", "note": ""},
    "godDepiction":       {"answer": "pass", "note": ""},
    "trinityComposition": {"answer": "pass", "note": ""},
    "anachronism":        {"answer": "pass", "note": ""},
    "headCount":          {"answer": "pass", "note": "挪亚 1、闪和雅弗 2、含 1"},
    "modesty":            {"answer": "pass", "note": ""},
    "fakeText":           {"answer": "pass", "note": ""},
    "duplicatedPerson":   {"answer": "pass", "note": ""},
    "registryFix":        {"answer": "pass", "note": "两人倒退、背脸，已照 registry 改正"}
  },
  "reviewer":  {"model": "<审查模型>", "session": "<审查对话的名字或 id>", "reviewedAt": "2026-10-24T03:00:00Z"},
  "generator": {"model": "<生成模型>", "session": "<生成 session 的名字或 id>"},
  "inputs": [
    {"kind": "image",     "sha256": "<同 subject.sha256>"},
    {"kind": "factCard",  "sha256": "<fact-cards/<id>.json 文件字节的 SHA-256>"},
    {"kind": "vetoTable", "sha256": "2dcd354072740c5688f2e4775bd786a3898bbf3e314efebade4b4517ddaa24a3"}
  ],
  "notes": "可选，审查者的说明"
}
```

**否决表**（键名固定，顺序同最终方案 §1.5；全文用 `gate_check.py veto-table` 打印，原样交给审查者）：

| 键 | 内容 |
|---|---|
| `jesusHair` | 耶稣的发型 |
| `mensHair` | 男子发型（短发不过领、剪刀剪的自然发型、各人不同；不许推光、寸头、渐变、剃两侧；拿细耳人例外） |
| `godDepiction` | 神的形象（不画成人形） |
| `trinityComposition` | 三一构图 |
| `anachronism` | 时代错误：罗马或中世纪军装、纹章旗、铜管小号、希腊神庙、罗马拱桥、美洲仙人掌 |
| `headCount` | 人数（对照事实卡 `mustShow`） |
| `modesty` | 端庄 |
| `fakeText` | 假文字 |
| `duplicatedPerson` | 同一人物在画面里重复出现 |
| `registryFix` | registry 登记要求的修改有没有做到 |

- 否决表版本 `veto-v1-2026-10-23`，SHA `2dcd3540…24a3`。改动表的文字或键，SHA 就变，所有按旧表写的审查都会 `review_vetotable_mismatch`。
- **answer 的取值**：`pass` = 没有看到违规（包括「画面里根本没有这个对象」，例如没有耶稣）；`fail`；`unclear`（看不清，算不通过）。`na` 只允许用在 `registryFix`，而且只在 registry 不适用时：方块图里没有登记的事件，以及全部剧照和视频（registry 登记的是方块图的修改要求）。登记过的方块事件，`registryFix` 必须是 `pass`。
- 闸门核对：
  - 文件存在（`review_missing`），`schema`/`id`/`kind` 对（`review_invalid`）；
  - `subject.sha256` 和 `inputs` 里那张图或那段视频的 SHA 都等于当前 live 文件的 SHA（`review_sha_mismatch`）——换了文件，旧审查自动作废；
  - `verdict` = `pass`（`review_verdict_not_pass`）；
  - 十个键一个不少（`veto_incomplete`）、没有多余的键（`veto_unknown_key`）、每个 answer 合规（`veto_failed`，detail 列出 `键=答案`）；
  - `reviewer` 和 `generator` 都有非空的 `model` 和 `session`（`reviewer_identity_missing`）；两边 `session` 相同 → `reviewer_is_generator`；`model` 相同只记警告 `same_model_as_generator`（方案写的是「最好换一个模型」）；
  - `inputs` 的 kind 恰好是 `{image, factCard, vetoTable}`（视频是 `{video, factCard, vetoTable}`），不多不少不重复（`review_inputs_invalid`）。审查者看到提示词、生成方的结论或说明，就要如实写进 inputs（例如 `{"kind": "prompt"}`），闸门会因此判不通过——这正是 R3 要拦的；
  - `factCard` 的 SHA 等于事实卡文件现在的 SHA（`review_factcard_stale`），`vetoTable` 的 SHA 等于闸门里的表（`review_vetotable_mismatch`）。
- `generator` 由安排审查的人从生成记录里抄进来，不由审查者自己填。视频审查可以只看抽出的帧，inputs 里仍记视频文件的 SHA。

## 6. 各线还要的字段

**方块 `status/<id>.json`**（已有字段照旧，只新增最后四个）

| 字段 | 规则 | 不通过的原因 |
|---|---|---|
| `state` | 必须是 `pass` | `state_not_pass` |
| `root_review`、`independent_review`、`status`、`dual_review_passed` | 若存在，`state=pass` 时必须是 `pass`/`true` | `legacy_review_contradiction` |
| `live_sha256`、`candidate_sha256` | 都等于 `live/<id>.png` 的实测 SHA | `sha_unrecorded`、`sha_mismatch`、`live_file_missing` |
| `ocr_hits` | 整数 0 | `ocr_missing`、`ocr_hits_nonzero` |
| `ocr_sha256`（新） | 做 OCR 的那个文件的 SHA，必须等于现在的 live SHA | `ocr_not_sha_bound` |
| `registry_fix_verified`（新） | 事件在 registry 里时必须是 `true` | `registry_fix_unverified` |
| `registry_fix_note`（新） | 同上，非空的一句说明（改了什么、谁核的） | `registry_fix_unverified` |
| `depictsRef`、`sectionSource`（新） | 见 §4 | 见 §4 |

**剧照 manifest `events[]`**

| 字段 | 规则 | 不通过的原因 |
|---|---|---|
| `imageStatus` | `pass` | `state_not_pass` |
| `imageSha256`（新） | 等于 `images-live/<id>.jpg` 的实测 SHA | `sha_unrecorded`、`sha_mismatch`、`live_file_missing` |
| `depictsRef`、`sectionSource`（新） | 见 §4 | 见 §4 |
| `evidenceState`（新） | 只统计，不参与判定（取值按方案：`missing` → `reviewed_pass` / `reviewed_rework`，过闸门后 `complete`） | — |

**视频 manifest `events[]`**

| 字段 | 规则 | 不通过的原因 |
|---|---|---|
| `videoStatus` | `pass` | `state_not_pass` |
| `videoFile`（新，可选） | 相对 `realistic-cinema-v1/` 的路径，不能是绝对路径或含 `..`；省略时为 `videos-live/<id>.mp4`。方案要求「原片保留，静音版另存」：静音版放 `videos-silent/<id>.mp4`，这里写 `"videos-silent/<id>.mp4"` | `video_file_invalid` |
| `videoSha256`（新） | 等于上面那个文件的实测 SHA | `sha_unrecorded`、`sha_mismatch`、`live_file_missing` |
| `durationSec`（已有） | S 档 8 秒，其余 6 秒，±0.5 | `duration_missing`、`duration_out_of_tier` |
| 实测时长（ffprobe） | 同上 | `duration_measured_out_of_tier` |
| 音轨（ffprobe） | 一条都不能有 | `audio_present` |
| 首帧 vs 剧照 | 16×16 dHash 距离 ≤ 20/256，剧照取 `images-live/<id>.jpg` | `first_frame_mismatch`、`still_missing` |
| 黑边 | 首帧和中间帧都查：上下（或左右）同时有 ≥2% 的纯黑条 | `black_border` |
| 剧照本身 | 同一事件的 still 必须通过闸门 | `still_not_passed` |
| `videoEvidenceState`、`audio`、`firstFrameMatchesStill`（新，可选） | 只供汇报，闸门自己量，不读这些值 | — |

共有的：事件 id 不在 `all-events.json` 里或格式不对 → `unknown_id`；manifest 没有这一条 → `manifest_entry_missing`；状态文件缺或坏 → `status_missing`/`status_invalid`。

## 7. 有意的取舍（D15：默认取最诚实的一种，记在这里）

1. **registry 只管方块线。** `content-qc-registry.json` 登记的是方块图（merged-v3 源图）的修改要求，剧照和视频不是它的对象。登记里的经文事实（例如创 9:23 倒退）应写进事实卡的 `keyAction`/`mustNot`，由审查的 `headCount`、否决表各项去拦。
2. **同一模型只警告，不同 session 才是硬性要求**（方案：「新开一个对话做，最好换一个模型」）。
3. **视频要求它的剧照先过闸门**（方案阶段 4：首帧是「通过的剧照」）。
4. **`durationSec` 既查字段也查实测**，两者都要落在档位内。
5. **OCR 要绑定 SHA**：没有 `ocr_sha256`，旧图的 OCR 结果不能替新图作证。
6. **黑边判定**按 2026-10-23 的 T7 实测校准：真黑条整行平均亮度 ≤1、最大 ≤2；创 8:1 方舟里暗木墙平均约 10，不算黑边。判定线：98 分位 ≤16 且平均 ≤6，上下两侧都有 ≥2% 高度（或左右两侧 ≥2% 宽度）。
7. **dHash** 用 16×16（256 位），LANCZOS 缩放灰度图。实测：唯一首帧取自剧照的 `genesis-1-1` 距离 3，其余 650 段在 81–159 之间，中位数 126，门槛 20 两边都很远。
8. 闸门**不读** `Visual_QC`、`qc_verdict`、`triple_verified`、`review_evidence` 这类旧字段来放行；旧字段只会让它更严（§6 的 `legacy_review_contradiction`）。

## 8. 测试

```
python3 -m unittest tests/test_gate_check.py -v      # 仓库根目录；本机没有 pytest
```

- 30 个测试，在临时目录里造一套完整、能通过的夹具（3 个事件 × 三条线，图片用 PIL 画，视频用 ffmpeg 从剧照生成），先证明它通过，再每次只改一个字段，证明它不通过、而且原因码就是该规则的那个（变异表 119 项，覆盖 32 个原因码；视频、命令行、只读另有专项测试）。闸门共 43 个原因码，42 个有测试；没测的 `frame_grab_failed` 只在 ffprobe 读得了、ffmpeg 却解不出帧时出现，夹具造不出来。
- 没有 ffmpeg 时视频测试会跳过。

## 9. 2026-10-23 基线（同一把尺的「改前」读数）

命令：`python3 tools/scenes/gate_check.py <kind> --all --summary`，T7 只读（跑前在 scratchpad 放一个时间戳文件，跑完 `find … -newer` 在两个线目录下找到 0 个新改动的文件）。三条线都是 **0 PASS**，退出码 1。这正是预期：新的证据（事实卡、review、depictsRef、sectionSource、SHA 字段）还一份都没写。

```
gate_check square: 1443 checked, 0 PASS, 1443 FAIL (state=pass but gate FAIL: 427)
state:
  not_started                   1016
  pass                           427
failure reasons (items; all / among state=pass):
  depictsref_missing            1443 / 427
  factcard_missing              1443 / 427
  ocr_not_sha_bound             1443 / 427
  review_missing                1443 / 427
  sectionsource_missing         1443 / 427
  ocr_missing                   1093 / 77
  live_file_missing             1016 / 0
  state_not_pass                1016 / 0
  registry_fix_unverified        221 / 86
  legacy_review_contradiction     35 / 35
evidenceState (reported, not gated):
  None                          1443
```

```
gate_check still: 1443 checked, 0 PASS, 1443 FAIL (state=pass but gate FAIL: 1136)
state:
  pass                          1136
  not_started                    307
failure reasons (items; all / among state=pass):
  depictsref_missing            1443 / 1136
  factcard_missing              1443 / 1136
  review_missing                1443 / 1136
  sectionsource_missing         1443 / 1136
  sha_unrecorded                1414 / 1136
  state_not_pass                 307 / 0
  live_file_missing               29 / 0
evidenceState (reported, not gated):
  None                          1443
```

```
gate_check video: 1443 checked, 0 PASS, 1443 FAIL (state=pass but gate FAIL: 651)
state:
  not_started                    792
  pass                           651
failure reasons (items; all / among state=pass):
  depictsref_missing            1443 / 651
  duration_out_of_tier          1443 / 651
  factcard_missing              1443 / 651
  review_missing                1443 / 651
  sectionsource_missing         1443 / 651
  still_not_passed              1443 / 651
  live_file_missing              792 / 0
  state_not_pass                 792 / 0
  audio_present                  651 / 651
  sha_unrecorded                 651 / 651
  first_frame_mismatch           650 / 650
  duration_measured_out_of_tier   562 / 562
  black_border                     8 / 8
evidenceState (reported, not gated):
  None                          1443
```

**读法**（每个数字都和方案里独立核出的数对得上，说明闸门量的是对的东西）：
- 方块：`legacy_review_contradiction` 35 = 02 列出的「pass 但主审和复审都写 rework」的 35 张，名单逐个相同；`registry_fix_unverified` 86 / 221 = 06 M3 的 86 张 pass 加 135 张 not_started；`ocr_missing` 77 = 方案 e 的「77 张缺 OCR」。live 文件的 SHA 与 `live_sha256`、`candidate_sha256` 全部一致（`sha_mismatch` 为 0）。
- 剧照：`sha_unrecorded` 1,414 = images-live 里的 jpg 数（manifest 还没有 `imageSha256` 字段）；其中 1,414 − 1,136 = 278 张有文件但 imageStatus 不是 pass，数目与方案 f「278 张（徒 19 到犹大书）补进 manifest」一致；`live_file_missing` 29 张全是启示录。
- 视频：
  - 651 段全部带音轨；
  - 首帧对得上剧照的只有 1 段（`genesis-1-1`，dHash 3），其余 650 段的距离 81–159；
  - 实测时长 648 段是 8 秒，按「S 档 8 秒、其余 6 秒」有 562 段不合；manifest 里的 `durationSec`（5/7/8/10/12，旧档位）1,443 条全部不合新档位；
  - 黑边 8 段：02 的 4 段（`genesis-22-1`、`judges-5-1`、`leviticus-18-1`、`numbers-20-22`），另有 4 段带细黑条（约 21–29 像素）：`genesis-25-29`、`genesis-27-1`、`genesis-32-22`、`genesis-34-1`。`genesis-25-29`、`genesis-32-22` 已目视首帧确认；另两段的条带实测平均亮度 0–0.9、最大 ≤2，与真黑条一致。`genesis-22-1`、`genesis-32-22` 只有首帧带黑条，就是 02 说的「画幅跳变」。
- `evidenceState` 三条线都还没有这个字段（None 1,443）。

视频一次 `--all` 约 5 分半（651 段，各要算 SHA、跑 ffprobe 并抽两帧）；方块和剧照各几秒。

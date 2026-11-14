# 雅伟之界：TODO（2026-10-26 起，业主要求列入 TODO）

数据在 T7：`/Volumes/T7/yahwehs-globe-scenes/`。
三个 Antigravity 对话照最终分工在做：出图（Gemini）、审图（另一个模型，交叉审查）、视频。
规则以这些为准：`雅伟之界_方案讨论_2026-10-23/最终分工-2026-10-23.md`、handoff/27–29，以及 `tools/scenes/gate_check.py`。

**每次更新这份清单**，先跑下面三条，把读数写进「现状」：
```
python3 tools/scenes/gate_check.py still --all --summary
python3 tools/scenes/gate_check.py square --all --summary
python3 tools/scenes/gate_check.py video --all --summary
```

## 业主定下、不变的规矩
- 不重来；事件保持 1,443 个；不做新的 AI 视频；现有的 651 段逐段处理；网站先不更新。
- 教会规矩：
  - 称「雅伟」，不称 Lord；
  - 神不以人的形象出现；
  - 不出现三一的内容；
  - 男人剪短发（拿细耳人除外）；
  - 不能有时代错误，不能有纹章旗帜。
- 耶稣的样子以 10-24 21:58 那张母本为准。
- 交叉审查：画图的模型不能审自己画的图。所有图都要过闸门（gate）才算完成。
- 视频：
  - redo 先试 12 段，总量封顶 60 段；
  - Flow 的「生成」由业主亲手点；
  - 剧照过了闸门，就做慢推慢移的动态剧照。

## 现状（2026-11-14 16:17 AEDT 实测）
| 线 | 过闸门 | 还差 | 备注 |
|---|---|---|---|
| 写实剧照 | **852** / 1,443 | 591 | **已达 59.0%！** 当前 **581 张**待重画（`rework` 581；`codex-jobs/still-*.json` 共 491 个任务），**10 张**未开始（`not_started`）；`draw-loop.sh` 自动按时续画 |
| 方块可爱图 | **1,443** / 1,443 | 0 | 全部过闸门（`complete` 1,415 + `complete_owner_accepted` 28） |
| 视频（原有 651 段） | **1** / 1,443 | 1,442 | `pass` 1 段（对应剧照已过闸门）、631 段弃用（`retired`）、19 段待 redo（`redo_pending`）、792 段未开始 |
| 动态剧照（慢推慢移） | **852 段**在盘 | 跟着剧照走 | 全部 852 张过闸门剧照已配齐（`skipped_still_not_pass 591`） |
| 母本（角色/地点参考图） | **91** / 91 通过 | 0 | 角色 66 + 地点 25（`sync_reviews anchor: pass=91, rework=0, escalated_3_strikes=0`） |
| 审查队列 | **2 份待审** | — | `review-queue/*.json` 当前剩余 2 份待交叉盲审；T7 磁盘剩余 **42 GiB**（98% 已用） |
| 3D 实尺漫游与按经建形 | **全部完工过检** | 0 | **7 座实尺 3D 漫游**（摩西会幕 `/tabernacle.html`、所罗门圣殿 `/temple.html`、所罗门王宫 `/palace.html`、以西结书圣殿 `/ezekiel.html`、希律圣殿 `/herod.html`、新耶路撒冷 `/new-jerusalem.html`、挪亚方舟 `/ark.html`）+ **23 件按经建形交互 3D 结构**（新增希律圣殿主殿、所罗巴伯第二圣殿、旷野十二支派安营图、以西结书第一章水苍玉套轮异象；经文尺寸视窗 + 全景页 `/plan.html`）全部通过 `tsc --noEmit`、`verify-shell`（126/126）、`audit-events`、穿墙导览（7 座全过）、行走物理（7 座全过）、36 组面板状态、对比度、繁简字典审计（12,737 条 0 残留）、字体子集、`test:gallery`（110/110）、`verify-gallery`（43/43，299.9 MB < 300 MB）、重定向（45/45）与全站生产构建 |

## 待办

### A. 图片（出图对话 + 审图对话）
- [ ] 写实剧照：1,202 张（其中 506 张已画好并在盲审队列中，696 张已在 `codex-jobs/still-*.json` 自动出图队列中），由 `drawstill`、`drawargon`、`drawloop` 自动出图，`promote-loop.sh` 每 30 分钟自动升格并补建重画任务，`review3loop` / `reviewopus` / `reviewsonnet2` / `codex_review_loop` 自动交叉盲审，直到全部过闸门。
- [x] 方块图：1,443 / 1,443 已全部过闸门收官。
- [x] 方块图左上角的小图标是设计要求保留的，审图时不算时代错误。之前因为这个图标被判不通过的，要复审（已完成）。
- [ ] 头发、旗帜问题，能局部修就不要整张重画。
- [ ] 3 个「三次不过」的事件：业主看过后决定怎么处理。
- [ ] Codex 出图积压 2,914 个任务，没有额度，现在停着。是否续用要业主定：Monash 的额度下个月重置，或者换一个账号。

### B. 视频
- [ ] **Flow 重做第一批 4 段（业主亲手点生成）**：genesis-3-1、genesis-22-1、exodus-13-17、exodus-32-1。
  - 素材和提示词在 `雅伟之界_方案讨论_2026-10-23/Flow重做-第一批/`；
  - 现在**还没有任何 mp4**；
  - 做好后存到同一个文件夹，再把登记消息发给视频对话。
- [ ] 剩下的 redo（试点共 12 段，总量封顶 60 段）：等第一批看过效果再定。
- [ ] 剧照每过一张闸门，就跑 `motion_still.py` 做出对应的动态剧照，再验证。
- [ ] 8 段原本恢复保留的旧视频，因为头发问题没过审：业主定是弃用，还是只用开头不出问题的片段。

### C. 上线（等 A、B 大致完成后）
- [ ] 网站更新：业主说了才更新。
- [ ] 撤下 yahwehs-scenes.netlify.app；作废 10/17 的 API key，查 Google Cloud 账单（10-23 已建议业主处理）。
- [ ] Android 版：发布签名已有（`~/keys`，见 `tools/build_apk.sh`）。

### D. 以后（不在现在的范围里）
- [ ] **头显沉浸版**（Apple Vision Pro / Android XR）：业主 10-26 同意，Words 和 Sword 只做最省事的兼容，真正适合做沉浸体验的是雅伟之界，在圣地和场景里走一走。等图片和视频完成后再评估。

### E. 改成只有一个入口（业主 10-26 同意；**业主说开始才开始**，现在先专心做 Words / Sword 1.8.2）
- [ ] 目标：业主只跟 Claude 主会话说话，由它调度其他模型，取代现在的三个 Antigravity 窗口。
  - **Claude（主会话）**：总管。派活、看闸门读数、修脚本、更新这份 TODO。
  - **Gemini**（`agy` CLI，Gemini 4 Argon / 3.8 Flash，用 Google 的额度）：主力出图。
  - **另一个模型盲审**：Claude Opus 5.5 走 `agy`；或者等 Monash 额度恢复后用 Codex（gpt-6.1-sol）。出图和审图必须是不同的模型。
  - **Higgsfield**（付费，10-26 时剩 1,200 点）：只用在难图上，比如三次都没过的、耶稣的场景、多人物又要和母本一致的。**不用它做视频**，除非业主决定。
- [ ] 步骤，一次只转一条线：
  1. 试点：`agy` 在后台能不能直接出图。现在的出图窗口是在 Chrome 里用 Gemini 网页版画的；如果 `agy` 不行，出图仍要用 Chrome，而 Chrome 同一时间只能一方用。
  2. 转出图线，然后请业主关掉出图窗口。
  3. 再转审图线，最后转视频线（等它手上这批做完）。
- [ ] 2026-10-26 已核对的工具：
  - `agy` 1.3.5 能用：`agy -p` 有回答；`agy models` 列出 Gemini 4 Argon、3.8 Flash、Claude Opus/Sonnet 5.5、GPT-OSS；`--conversation <ID>` 可以接着现有的对话说。
  - `codex` 0.163.0 已配置好，10 月的额度用完了。

### F. 方块图交给 CLI（2026-10-27 业主：用 Codex + Gemini 的额度，不用 Claude 的）
- Codex 后台在画：`KIND=square tools/scenes/codex_gen_loop.sh`（nohup，日志 `codex-jobs/logs/gen-loop-square.out`）。月额度显示 0% 仍能出图（实测 1-timothy-1-1，约 2 分钟一张）；碰到上限就把任务放回、30 分钟后再试，所以 5 小时额度一重置就自动接着画。
- 队列：371 个重画 + 883 个新建（`tools/scenes/build_square_jobs.py`，原图 `non-gamified-merged-live-v3/<id>.png`，对照 fact-cards）。
- 自动接力（业主 10-27 定：慢慢来，全部定时做）：
  - Codex：后台 `codex_gen_loop.sh` 一直在，碰到额度上限就放回、30 分钟后再试。
  - Gemini：launchd `com.yahwehsworld.drawloop` 每小时看一次，没有在画就开一轮（新账号 monash，只有 Gemini 3.8 Flash，`gemini-3.8-flash-medium`）；额度空了几秒就失败，下个小时再试。脚本和日志在 `~/Library/Application Support/yahwehs-world-kick/`（`draw-loop.sh`、`draw-*.log`）。
  - 审图：10-30 21:15 和 10-31 10:30 各启动一次一次性的审图会话。
  - Copilot：`tools/scenes/copilot_claim.py` / `copilot_save.py`，由 Haiku 在 Chrome 里操作（每张新开聊天；Copilot 一张要 2 分钟以上，启示录 21-9 三次卡住）。不能定时，要手动叫起。
- Codex 画的图不能由 Codex 审；Gemini 画的图不能由 Gemini 审。

## 要业主做的（汇总）
1. 在 Flow 里生成那 4 段视频。
2. 看 3 个「三次不过」的事件。
3. 定 Codex 还用不用。
4. 定那 8 段旧视频怎么处理。
5. 网站什么时候更新。

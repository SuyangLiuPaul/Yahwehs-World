# 29 · 生成和审查分开：Antigravity 出图，`claude -p` 审图（2026-10-23）

业主定：周六（10/24）Antigravity 的 Gemini session 开工；周日下午起，`claude -p` 加入，只做独立审查。
两边不对话，只通过 T7 上的文件交接。这样：
- 审查者换了模型（Claude 对 Gemini），正是最终方案「新开对话、最好换模型」的要求，闸门不会报 `same_model_as_generator`；
- 审查者看不到提示词和生成方的结论，只看图、经文事实卡和否决表（handoff/28 §5）；
- 谁写了什么，文件里都有记录，可以事后核对。

## 1. 分工

| | Antigravity（Gemini） | `claude -p`（审查） |
|---|---|---|
| 出图、出视频、Flow、Chrome | 做 | **不做**，不碰 Chrome |
| 事实卡 `fact-cards/<id>.json`、`depictsRef` | 做 | 只读 |
| manifest、status、registry、language-layers | 做 | **不改** |
| 审查请求 `review-queue/` | 写 | 读，审完移到 `review-queue/done/` |
| 审查结果 `review/…/<id>.json` | **不写** | 写 |
| `gate_check.py` | 跑 | 跑（只读，核对自己写的审查） |

周日下午之前没有 `claude -p`：审查由 Antigravity 里**另开的一个对话**做，能选 Claude 模型就选 Claude
（据第三方介绍，Antigravity 免费层的 Claude 模型到 2026-11-02 为止），否则用 Gemini 新对话；
无论哪种，审查对话也只看图、事实卡和否决表，并且同样从 `review-queue/` 取活。

## 2. 审查请求 `S/review-queue/<kind>-<id>.json`（生成方写）

`S = /Volumes/T7/yahwehs-globe-scenes`，`kind` 是 `square`、`still` 或 `video`。

```json
{
  "schema": "review-request-v1",
  "id": "genesis-9-18",
  "kind": "square",
  "subject": {"path": "no-text-derivatives-v2/live/genesis-9-18.png", "sha256": "<文件的 SHA-256>"},
  "factCard": "fact-cards/genesis-9-18.json",
  "generator": {"model": "gemini-…", "session": "<生成 session 的名字>"},
  "requestedAt": "2026-10-24T03:00:00Z"
}
```

- 只写这几项。**不写提示词、不写自己的判断、不写「已改正」之类的说明**；写了，审查就不再是盲审。
- 写之前事实卡必须已经存在。文件先写成 `.tmp-…` 再改名，免得审查方读到半个文件。
- 同一个 id 重新出图后，删掉旧请求、写新请求（SHA 不同）。

## 3. 审查结果写在哪里（审查方写）

| kind | 路径 |
|---|---|
| square | `S/no-text-derivatives-v2/review/<id>.json` |
| still | `S/realistic-cinema-v1/review/still/<id>.json` |
| video | `S/realistic-cinema-v1/review/video/<id>.json` |

格式见 handoff/28 §5。`generator` 从请求里原样抄；`reviewer.model` 写实际模型（例如 `claude-opus-5-5`），
`reviewer.session` 写 `claude-p-<日期>-<进程号>`。写完跑
`python3 tools/scenes/gate_check.py <kind> <id>`，只看自己这一项有没有 review 相关的失败码
（`review_*`、`veto_*`、`reviewer_*`）；别的失败码（比如 state 还不是 pass）不归审查方管。

## 4. 启动 `claude -p`（业主周日下午在 Mac 的终端里跑）

先确认已登录：`claude -p "hi"` 能回话；不能就先运行 `claude` 登录一次。然后：

```
bash /Users/pliu0036/Documents/CodingProject/yahwehs-globe/tools/scenes/claude_review_loop.sh
```

脚本每轮让 `claude -p` 审最多 15 项，队列空了就等 10 分钟再看；按 Ctrl-C 停。
日志在 `S/review-queue/logs/`。它只允许 Claude 读文件、写审查结果、跑 gate_check、ffmpeg、shasum，
不允许上网、不允许碰 Chrome。

## 5. 审查方的提示词

就是 `tools/scenes/claude_review_prompt.md`，脚本每轮原样传给 `claude -p`。改审查规则只改那个文件
和 `gate_check.py` 的否决表，两边要一致（否决表一改，SHA 就变，旧审查全部作废）。

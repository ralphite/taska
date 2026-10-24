# 一致性验收：新版和旧版的差别清单

比对找到、并且人工看过截图和文字确认是真差别（不是工具误报）的，每条一个编号。状态：**open**（新版还不一样）、
**fixed**（之后某次比对一样了，写上那个提交）、**approved**（Yadong 批准了这个改变，写上在哪批的）。
每次比对的报告在 http://127.0.0.1:7355/。最近一次比对：50e7fe0（10-23 20:5x）；之后按协调者安排暂停，等“实现完了”再整体比对。

| # | 发现于 | 哪里 | 旧版 → 新版 | 状态 |
|---|---|---|---|---|
| P01 | a3e6a45 | agent 接口 | `POST /p/<项目>/api/file?name=x`：旧版回 `{"f": "f…", "name", "mime", "size"}`，新版回 404 `not found`；所以之后 `say files=f…` 报 `unknown file` | open |
| P02 | a3e6a45 | 侧栏，每一页（电脑） | Storybook 链接：旧版去 localhost:6007，新版去 localhost:6351 | open |
| P03 | a3e6a45 | 打开项目页的过程（电脑、手机） | 旧版先出现约 0.3 秒的过渡画面（侧栏只有当前项目、中间 “Select an item or type below”、底部 “New input · your agent files it”），再变成完整页面；新版直接是完整页面 | open（50e7fe0：手机上已一样，电脑上还不同） |
| P04 | a3e6a45 | 用地址直接打开事项（B533、lumina B144、I447） | 新版是简化的事项页：没有 Back to now / Archive / ··· / 上一个 / 下一个 / 全宽，没有 Proposed / P3 / Bug / Later / Part of 这些可点标签，提议卡片没有 Won’t do / Approve；批准、拒绝都做不成 | open |
| P05 | a3e6a45 | 搜索（电脑） | 搜索时旧版 Rules 标签显示匹配数（1），新版还是 51；旧版列表末尾有 “IN OTHER PROJECTS · n”，新版没有；在搜索框里按 `/`：旧版只是聚焦，新版把 `/` 打进去（`?q=%2F`）；按 Enter：旧版打开第一条，新版不动 | open |
| P06 | a3e6a45 | 搜索（手机） | 点右上角搜索：旧版出现搜索栏（Search title, text or code / Cancel），新版没反应 | open |
| P07 | a3e6a45 | 项目抽屉（手机） | 点左上角：旧版打开项目抽屉，新版没反应 | open |
| P08 | a3e6a45 | 侧栏收起再展开（电脑） | 收起后刷新，过程中的画面不同（待整体比对重新判）。~~再展开时新版多了 “All projects” 提示框和 0.12 秒的滑动~~：工具误报，旧版自己也时有时无（鼠标停 0.5 秒才出现），10-24 已更正 | open |
| P09 | a3e6a45 | 断网时发送（手机） | 网络一恢复，旧版马上发出（“Sent. Waiting for your agent · Undo · Move to…”，Inputs 标签出现 1）；新版那一刻还是 “Waiting for Taska: … · Edit”，几秒后才发出 | open |
| P10 | a3e6a45 | 首页、Documents、Activity、Deleted、Settings | 新版还没做（不在试点范围） | open |

## 旧版自己的毛病（不算差别，供参考）

- 有些 `loading="lazy"` 的图片（比如 I447 对话里的缩略图）不滚动就一直空白，Chromium 和 WebKit 都这样。

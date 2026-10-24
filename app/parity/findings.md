# 一致性验收：新版和旧版的差别清单

比对找到、并且人工看过截图和文字确认是真差别（不是工具误报）的，每条一个编号，一确认就发给实现 session（抄送协调者）。
类别：**未批准的差别**（要改回和旧版一样，或由 Yadong 批）、**待 Yadong 定**、**已批**、**旧版毛病，新版没照抄**（实现方在
app/findings.md 里记的那几条，单独标出，不算未批准的差别）。状态：open / fixed（写上提交）/ 撤回（工具误报）。
截图：先旧版后新版，点开看大图。报告在 http://127.0.0.1:7355/。

| # | 类别 | 哪里 | 旧版 → 新版 | 截图（旧 / 新） | 状态 | 发现于 |
|---|---|---|---|---|---|---|
| P01 | 未批准的差别 | agent 接口 | `POST /p/<项目>/api/file?name=x`：旧版回 `{"f": …}`，新版回 404 | | fixed（39fc6a9 前） | a3e6a45 |
| P02 | 待 Yadong 定 | 侧栏，每一页（电脑） | Storybook 链接：旧版 localhost:6007，新版 localhost:6351 | | 待定 | a3e6a45 |
| P03 | 待 Yadong 定 | 打开项目页的过程 | 旧版先有约 0.3 秒的过渡画面，新版直接是完整页面 | | 待定（手机上 50e7fe0 起已一样） | a3e6a45 |
| P04 | 未批准的差别 | 用地址直接打开事项 | 新版事项页缺按钮和标签，批准、拒绝做不成 | | fixed（39fc6a9 前） | a3e6a45 |
| P05 | 未批准的差别 | 搜索（电脑） | Rules 计数、其他项目的结果、`/` 和 Enter | | fixed（39fc6a9 前） | a3e6a45 |
| P06 | 未批准的差别 | 搜索（手机） | 点搜索没反应 | | fixed（39fc6a9 前） | a3e6a45 |
| P07 | 未批准的差别 | 项目抽屉（手机） | 点左上角没反应 | | fixed（39fc6a9 前） | a3e6a45 |
| P08 | — | 侧栏收起再展开（电脑） | “All projects” 提示框和滑动：工具误报（旧版自己也时有时无）；刷新那半条实为 P16 | | 撤回 | a3e6a45 |
| P09 | 未批准的差别 | 断网发送（手机） | 网络恢复后发得慢 | | fixed（39fc6a9 前） | a3e6a45 |
| P10 | 未批准的差别 | 首页、Documents、Activity、Deleted、Settings | 新版当时还没做 | | fixed（39fc6a9 前，细处见 P11–P15） | a3e6a45 |
| P11 | 未批准的差别 | 首页背景（电脑、手机，深浅色） | 浅色：旧版 #F4F4F5 → 新版白色；深色：旧版 zinc-900 #18181B → 新版 zinc-950 #09090B | `quick-39fc6a9/home--desk-light/000-a.png` `quick-39fc6a9/home--desk-light/000-b.png` | fixed（9e9ba96） | 39fc6a9 |
| P12 | 未批准的差别 | New input 页 “You said”（lumina #108，已移到 taska） | 旧版有一行 “→ Open taska · #474”，新版没有 | `quick-39fc6a9/home--desk-light/005-a.png` `quick-39fc6a9/home--desk-light/005-b.png` | fixed（9e9ba96） | 39fc6a9 |
| P13 | 未批准的差别 | Documents 列表的评论数 | 旧版不数挂在后来改过的文字上的评论（实现方查明）→ 新版全数（D7：1 → 3） | | fixed（9e9ba96） | 39fc6a9 |
| P14 | 未批准的差别 | 从侧栏点 Settings（电脑） | 地址 /agents → /settings，标签页标题 “Agents · …” → “Settings · …”；再点 Projects 标题不变 | | fixed（9e9ba96） | 39fc6a9 |
| P15 | 未批准的差别 | Settings 里按 Esc（电脑） | 旧版回项目列表 → 新版回进 Settings 前的页面（Deleted） | `quick-39fc6a9/sidebar--desk-light/008-a.png` `quick-39fc6a9/sidebar--desk-light/008-b.png` | fixed（9e9ba96） | 39fc6a9 |
| P16 | 未批准的差别 | 电脑刷新后的输入框 | 旧版自动聚焦（边框 zinc-300，可直接打字）→ 新版没焦点（zinc-200） | `quick-39fc6a9/sidebar--desk-light/011-a.png` `quick-39fc6a9/sidebar--desk-light/011-b.png` | fixed（9e9ba96） | 39fc6a9 |
| P17 | 未批准的差别 | 手机 Documents 页的标签页标题 | “(17) Documents · lumina · Taska” → “(17) lumina · Taska” | | fixed（9e9ba96） | 39fc6a9 |
| P18 | 未批准的差别 | 手机后退（抽屉切项目后） | 旧版回 taska 列表，再按离开 → 新版回 lumina 列表，再按回 taska | `quick-39fc6a9/sidebar--phone-light/005-a.png` `quick-39fc6a9/sidebar--phone-light/005-b.png` | fixed（9e9ba96） | 39fc6a9 |
| P19 | 未批准的差别 | 用地址打开事项时列表的滚动（电脑） | 归档视图：旧版滚到打开的那一项 → 新版停在顶部（macstudio T16…T41）；都滚时旧版多滚一点让整行露出，新版贴底（taska F220 等） | `full-39fc6a9-sweep-items-desk-light/sweep-items--desk-light/055-a.png` `full-39fc6a9-sweep-items-desk-light/sweep-items--desk-light/055-b.png` | fixed（585b67d；剩下 40–90 像素的滚动差别旧版自己也会有） | 39fc6a9 |
| P20 | 未批准的差别 | 事项页点 Later 后切到下一个（电脑） | 旧版列表马上把它收进 “9 more: 1 in Later…”，“上一个”跳过它 → 新版留一行 “B498 Moved to Later”，“上一个”回到它 | `full-39fc6a9-scenarios/item-fields--desk-light/008-a.png` `full-39fc6a9-scenarios/item-fields--desk-light/008-b.png` | fixed（729303d） | 39fc6a9 |
| P21 | 未批准的差别 | 手机用地址打开事项后按后退 | 旧版回到项目列表 → 新版离开 Taska | `full-39fc6a9-scenarios/item-fields--phone-light/008-a.png` `full-39fc6a9-scenarios/item-fields--phone-light/008-b.png` | fixed（729303d） | 39fc6a9 |
| P22 | 未批准的差别 | 发出回复后（电脑、手机） | 旧版滚到刚发的那条，带 “Undo”，0.7 秒高亮 → 新版不滚、没有 Undo、没有高亮 | `full-39fc6a9-scenarios/talk--desk-light/007-a.png` `full-39fc6a9-scenarios/talk--desk-light/007-b.png` | 电脑 fixed（729303d）；手机高亮还没有 | 39fc6a9 |
| P23 | 未批准的差别 | 用地址打开时输入框聚焦（电脑 /inputs、手机 /new） | 旧版自动聚焦（边框 zinc-300）→ 新版没有 | `batch2-585b67d/pages--desk-light/002-a.png` `batch2-585b67d/pages--desk-light/002-b.png` | open | 585b67d |
| P24 | 未批准的差别 | 空项目的 Items 标签 | “Items 0” → “Items” | `batch2-585b67d/pages--desk-light/011-a.png` `batch2-585b67d/pages--desk-light/011-b.png` | open | 585b67d |
| P25 | 未批准的差别 | 不存在的项目 /p/nosuchproject/ 的地址 | “/” → “/?none=nosuchproject”（画面一样） | | open | 585b67d |
| P26 | 未批准的差别 | 电脑 G S 进设置后按 Esc 的地址 | /p/taska/ → /p/taska/new（画面一样） | | open | 585b67d |
| P27 | 未批准的差别 | 回到项目时的视图 | 旧版记住上次的 Archive（/p/taska/archive）→ 新版回到 Active（/p/taska/new） | `batch2-585b67d/speed--desk-light/004-a.png` `batch2-585b67d/speed--desk-light/004-b.png` | open | 585b67d |
| P28 | 未批准的差别 | iPhone：回答问题后对话的滚动 | 旧版往下滚，回答过的卡片到顶 → 新版停在原处 | `recheck-729303d/talk--iphone-light/003-a.png` `recheck-729303d/talk--iphone-light/003-b.png` | open | 729303d |
| P29 | 未批准的差别（只影响读屏/控制台） | 手机设置 “Use on your phone”；D39 评论框读屏顺序；iPhone 控制台 api/view 报错 | 链接 → 按钮；顺序不同；新版多一个报错 | | open（低） | 585b67d |
| L1 | 待 Yadong 定 | 对话里的缩略图（旧版毛病） | `loading="lazy"` 的图不滚动就一直空白（Chromium、WebKit 都这样） | | 已转 Yadong | — |
| L2 | 待 Yadong 定 | Documents 侧栏列表的时间 | 实现方记的：旧版从不显示文档时间，新版照旧（改要 Yadong 批） | | 待定 | — |
| L3 | 待 Yadong 定 | 草稿卡里单击存疑词 | 实现方记的：旧版单击不打开改字框，新版照旧（改要 Yadong 批） | | 待定 | — |

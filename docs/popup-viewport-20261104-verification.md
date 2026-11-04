# 扩展弹窗底部裁切修复（2026-11-04）

[已验证] 恢复了标题／搜索／页脚内的可用高度保护，仅中间工具列表滚动；滚轮可以到达最后的“随机密码与口令”，版本与反馈同时可见。展开收起继续使用现有平滑动效。

## 原因与本轮修改

上一候选为避免自动高度反馈锁住展开过程，对 `chrome.runtime.id` 存在的界面直接跳过高度限制，漏掉了真实弹窗受到宿主高度约束的分支。本轮真实 Chrome 扩展复现中，内容放大到125%后，视口停在600px，内容与页脚却长到700px，Chrome 加入外层滚动条。这与用户截图的双滚动条／底部缺失相符。

Chrome 官方说明弹窗有最大尺寸限制：[chrome.action 文档](https://developer.chrome.com/docs/extensions/reference/api/action)。上述600／700数值来自本轮实际测量，见 baseline-ui-scale-native.json。

- `src/popup.js:14`：恢复实际可用高度保护；同时将总视觉高度控制在既有560px内，按内容缩放比例换算 CSS 高度。
- `src/popup.js:18`：等待宿主自动调整尺寸后再判定真实溢出，保留正常展开所需空间；内容比例或可用区域变化时重新测量。
- `src/popup.js:39`：观察菜单实际尺寸，覆盖展开、收起、搜索、翻译及列表变化。
- `test/e2e/popup-fold-motion.spec.js:27`：新增扩展环境受限440px、600px及125%内容放大的失败回归；检查页脚、外层大小和最后分类可达。

## 新鲜验证

| 检查 | 本轮结果 |
| --- | --- |
| 失败用例 | 旧包两项裁切回归失败；中间实现的最大视觉高度回归失败。随后修复通过 |
| `npm test` | 隔离源码371项通过，退出码0 |
| Chromium | 菜单、展开同步、平滑动效、排序、键盘、顶部导航及新增裁切回归：36项通过，退出码0 |
| WebKit | 菜单与弹窗回退：11项通过、1项原生插值增强跳过，退出码0 |
| 真实Chrome工具栏 | 普通大小及内容125%、150%、200%：展开全分类、真实鼠标滚轮到末尾、收起恢复，均有记录 |
| 外层滚动 | 上述四场景根节点滚动位置为0；根节点滚动高度不超过视口；整个展开记录没有因外层滚动条增加宽度 |
| 最后工具与页脚 | 四场景最后一项在内部列表内可见；版本和反馈在视口内 |
| 最终产物 | 最终ZIP解压后实际加载，重复125%受限场景和真实滚轮；见 final-package-125-native.json |
| 包一致性 | ZIP与可加载目录506个文件逐字节一致；MV3，权限和host_permissions没有新增 |

截图：`修复后-工具列表底部.png` 是最终 ZIP 解压后的真实 Chrome 工具栏弹窗，不是普通标签页模拟图。

命令日志附后。浏览器命令使用 `LISTOOLS_TEST_URL=http://127.0.0.1:56228 npx playwright test`，具体文件为 popup-fold-motion、menu-expansion、motion-polish、menu-sorting、header-navigation-motion；WebKit执行前两组。

## 产物

- 版本沿用1.2.4，独立候选目录，保留上一包。
- ZIP：`/Users/lili02/.codex/worktrees/redesign-v2/LisTools/releases/popup-bottom-candidate-20261104/LisTools-1.2.4-popup-bottom-fixed.zip`
- 可加载目录：`/Users/lili02/.codex/worktrees/redesign-v2/LisTools/releases/popup-bottom-candidate-20261104/LisTools-1.2.4-popup-bottom-fixed`
- SHA-256：`6fcec4164353dc56a5951ca7de62f9364828d1d3f44e10f8fceb5bb3d2bad330`
- 4768368字节，506个文件。
- 隔离源码快照：`/Users/lili02/.codex/worktrees/redesign-v2/LisTools/.superpowers/sdd/popup-viewport-20261104/source`，本轮修改文件哈希见source-sha256.json。
- 支持页仍按既有隔离规则排除；工作树的真实资源检查没有关闭。

## 验证边界

[未验证] 本轮没有重新验收全部工具算法、Edge、Firefox、Chrome120、VoiceOver或物理触屏。真实弹窗中使用的是内容缩放；另行尝试的 tabs.setZoom／默认缩放偏好没有改变该测试版工具栏弹窗的DPR，所以没有将其宣传为原生浏览器缩放验收。

测试环境曾一次拒绝打开非活动窗口的弹窗；该次没有计入通过，随后从最终ZIP重开并完成验证。

本轮临时测试服务器清理证据见cleanup.json；测试浏览器均由脚本finally退出。

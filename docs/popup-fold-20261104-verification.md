# 弹窗分类与新标签页衔接修复验收（2026-11-04）

[已验证] 本轮修复了 Chrome 工具栏弹窗分类高度瞬间跳变，以及新标签页顶栏、侧栏突然出现的问题。候选版本沿用 1.2.4。

## 本轮代码

- `src/popup.js:16`：真实扩展弹窗由 Chrome 根据内容自动调整高度，不再将上一帧 innerHeight 反馈为下一帧的高度上限；普通标签页中的弹窗预览继续受可用视口约束。
- `src/tools/shared/motion.css:31`：扩展弹窗复用原生 details 高度过渡，240ms ease-in-out 展开／收起，文字淡入 160ms；收起中的链接 inert，排序与减少动态效果保持原行为。
- `public/boot.css:19`：新标签页就绪后，完整界面一起以 220ms 淡入；原有跨文档过渡、初始化及 BFCache 规则继续复用。
- 新增 `test/e2e/popup-fold-motion.spec.js`；更新菜单测试等待展开动画完成后检查终态，首屏动画断言对应完整界面。

## 新鲜验证

| 项目 | 命令／证据 | 结果 |
| --- | --- | --- |
| 失败复现 | Playwright `popup-fold-motion.spec.js` 对旧候选包 | 2 项预期失败：高度无中间帧、完整界面无淡入；见 red.log |
| 单元 | 隔离源码 `npm test` | 371 通过，退出码 0 |
| Chromium 受影响回归 | `popup-fold-motion`、`menu-expansion`、`motion-polish`、`header-navigation-motion`、`motion`、`menu-sorting`、`redesign-v2-shell`、`payroll` | 71 通过，退出码 0 |
| WebKit | 前四组动效与菜单测试 | 21 通过、6 跳过，退出码 0 |
| 生产入口首次打开 | all-entry.json | 21 个入口逐个新开，均有中间透明度、正确就绪、无脚本异常和整页横向溢出 |
| 真实 Chrome 工具栏弹窗 | 最终 ZIP 解压后，Chrome for Testing 149.0.7827.55，`chrome.action.openPopup` | 展开 54 帧、收起 53 帧；高度连续变化，最终回到 358px；每帧页脚均在视口内 |
| 弹窗打开新工具 | 真实弹窗点击个税入口 | 新标签页正式界面完整淡入；截图、录像及透明度记录附后 |
| 扩展离线 | 最终 ZIP 解压目录，浏览器离线 | Worker 去重与下载逐字符校验通过：`头🙂\n中\n尾`；扩展 HTTP 请求为 0 |
| 构建与文件 | 隔离源码 `npm run build`，fflate 解压比对 | 退出码 0；ZIP 与可加载目录 506 个文件逐字节一致；MV3，permissions／host_permissions 均无新增 |

WebKit 的 6 项跳过分别涉及 Chromium 专有跨文档／顶层退出增强，以及尚不支持的 inert 与原生高度插值；对应基础折叠和页脚检查仍执行。它们不计为通过。

真实弹窗旧版在一个显示帧内由 358px 跳至 560px；候选包沿中间高度逐步到达最大高度，再由列表内部滚动。收起后没有保留固定空白区。快速反向点击、状态同步、搜索、排序、键盘、440px 预览视口及减少动态效果均包含在浏览器回归中。

## 产物

- 可加载目录：`/Users/lili02/.codex/worktrees/redesign-v2/LisTools/releases/popup-fold-candidate-20261104/LisTools-1.2.4-popup-fold-final`
- Chrome ZIP：`/Users/lili02/.codex/worktrees/redesign-v2/LisTools/releases/popup-fold-candidate-20261104/LisTools-1.2.4-popup-fold-final.zip`
- SHA-256：`c4d3173f8aa0aa01c7def506b52b0eb049d32dcf6bce5557bb06f4497e85355f`
- ZIP 大小：4768222 字节；文件数 506。
- 源码快照：`/Users/lili02/.codex/worktrees/redesign-v2/LisTools/.superpowers/sdd/popup-fold-20261104/source`；源码逐文件哈希见 source-sha256.json。
- 依赖清单和锁文件与上一候选源码逐字节相同；历史包及原工作树修改保留。
- 支持页仍按既有隔离构建规则排除；未关闭工作树中的真实资源校验。

## 人工查看

- `原生弹窗展开收起.webm`：通过真实弹窗 DevTools 截帧重建，固定背景画布用于对照高度变化。
- `新标签页打开.webm`：从真实弹窗打开个税页的浏览器录像，随后执行离线文本任务。
- 两张 native PNG 为真实工具栏弹窗截图，不是普通标签页模拟图。

## 未验证与边界

[未验证] 本轮未执行 Edge、Firefox、最低 Chrome 120、物理触屏、VoiceOver、商店安装或全部工具算法全量浏览器回归。Chrome 149 与当前 Chromium 自动化、WebKit 回退的结果不能代替这些环境。未改变扩展新标签页的打开习惯；Chrome 自身标签栏和窗口外框的动效由浏览器控制。

[已验证] 本轮临时浏览器已退出。临时服务器清理结果见 cleanup.json。

# 右上角与功能页面切换修复验收（2026-11-04）

已验证：右上角弹层打开/关闭及跨功能页面切换已补齐过渡。继续使用当前1.2.4版本，保留工作区修改和历史包。本轮没有Git提交、Release或商店操作。

## 反馈关闭记录

| 用户反馈 | 最终行为与验证 |
| --- | --- |
| 右上角展开没有柔和淡入 | 设置、最近打开、窄屏搜索及关联原生弹层采用180ms透明度过渡；真实打开过程有中间帧，关闭也连续淡出。 |
| 切换不同功能时闪屏 | 原实现于booting阶段取消原生过渡，已复现AbortError。支持时先保留上一屏，等待目标界面就绪，主区域70ms退出＋150ms进入，顶栏和侧栏独立保持。 |
| 新网页打开生硬 | 新标签页和普通降级路径采用220ms主内容淡入，首次正式界面保留最终翻译、任务与布局。 |
| 动效不能引入跳动 | 所有本轮入场均使用纯透明度，不改变主区域或弹层的定位包含块。固定栏、编辑器、计算器和计时操作位置重新回归。 |
| 连续操作与失败恢复 | 关闭即不可交互；快速重开正常。初始化超过350ms解除旧屏保持，沿用加载/失败恢复入口。减少动态效果关闭动画；BFCache返回保留状态。 |

源码位置：`src/tools/shared/motion.css:2`、`public/theme-init.js:23`、`public/theme-init.js:27`、`public/boot.css:17`。页面入口及模板未重构，运行依赖、权限、工具ID、计算、导出和偏好存储未改变。

浏览器能力检测后才使用过渡保持；不具备所需API的环境使用普通入场。参考：[原生过渡保持接口](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/waitUntil)、[原生新视图为实时画面](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)。

## 新鲜验证结果

| 命令或检查 | 结果 |
| --- | --- |
| `npm test` | 371通过、0失败，退出0。 |
| 隔离快照`npm run build` | 成功，退出0；仍有既有500kB分块提示，没有修改阈值。 |
| 最终目录完整Chromium | 869通过、0失败，退出0。 |
| 最终目录WebKit相关流程 | 41通过、5跳过、0失败，退出0。 |
| 最终ZIP解压后的实际Chrome扩展 | Chrome for Testing 149.0.7827.55；右上角关闭采样29帧，其中21帧为中间透明度。跨工具过渡ready成功，没有AbortError。 |
| 原生缩放 | 100%、125%、150%、200%的设置面板均在视口范围内。 |
| 离线与完整内容 | 文本Worker工作正常，Unicode下载内容逐字节正确；HTTP请求0。 |
| 逐帧画面 | 记录20帧跨工具过程，5帧为旧屏保持；顶栏采样透明度始终为1。含实际中间帧截图和录像。 |
| 产物 | 506文件；ZIP与可加载目录逐文件逐字节一致；无新增权限，无未发布支持页入口。 |
| 清理 | 本轮56220、56221、56222、56223端口均返回ECONNREFUSED（61），服务器已停止。 |

完整命令在冻结源码目录执行：

```sh
LISTOOLS_TEST_URL=http://127.0.0.1:56223 npx playwright test --project=chromium --reporter=line
```

WebKit使用相同URL，运行header-navigation-motion、motion、motion-polish、stability-iteration、language-dropdown和zoom-layout六份spec。新增`test/e2e/header-navigation-motion.spec.js`固定打开、关闭、旧屏保持、普通入场与慢启动恢复场景。语言及转换测试辅助入口改为读取`dialog.open`与`:popover-open`，避免把已经关闭但仍在淡出的画面当作可交互状态；没有放宽内容、计算、位置或导出的断言。

## 限制与未执行项

- WebKit的5个跳过场景依赖Chromium原生过渡或本轮原生关闭动画能力，不计为通过；对应Chromium场景已执行。
- 本轮未执行Edge、Firefox、最低Chrome120、Safari原生安装、VoiceOver、物理触屏或浏览器工具栏原生弹窗。
- “右上角设置/最近打开”已经在实际扩展工具页面验证，不能将其等同浏览器工具栏图标弹出的原生容器验收。
- 系统减少动态效果时按用户设置立即切换；缺少过渡保持接口时，使用普通220ms入场，不声称所有引擎视觉完全相同。

## 最终文件

- 可加载目录：`LisTools-1.2.4-smooth-opening-final`。
- ZIP：`LisTools-1.2.4-smooth-opening-final.zip`，4,768,197字节，比上一轮候选增加797字节。
- SHA-256：`8e4b7fe67d77716a57914e7bcd7ba70a0378d8d3cc04e721a7b656728b39a39e`，旁边提供`.sha256`文件。
- 录像：`右上角与页面切换.webm`。
- 本报告附源码SHA清单、最终测试日志、实际扩展报告、截图与逐帧数据。

保留原有工作区与历史包；本轮不覆盖已发布版本，不自动提交或发布。

# 对比折叠、日期跳动与计算器顺序修复

日期：2026-11-15。状态：本地修复候选，版本仍为 1.2.8；未提交 Git、未发布 Release，未覆盖此前发布包。

## 已复现并修复

1. **对比输入折叠后无法重新展开。** 原样式对所有收起的输入容器执行 `display:none`，空态和错误态又没有备用入口。现在仅在已有对比结果、且有“修改输入”入口时隐藏收起的输入容器；其他状态保留原生标题和展开箭头。鼠标、Enter、反复展开收起以及错误定位均有回归。
2. **结果区新写入的文本没有触发内容保护。** 空文本比较后直接编辑结果，原检查只读取原始输入，遗漏结果编辑器。本轮同时检查两个结果文档，导航按既有规则保护草稿。
3. **日期复选框导致结果闪空、提示顶动输入和详情收起。** 原输入事件先清空结果，再等待 350ms 自动执行，同时在页面上方插入过期提示；重建结果还丢失已展开的时间戳区域。已有结果时，日期差/工作日的包含结束日选项现在同步计算，保留时间戳节点和展开状态；状态提示移入当前任务结果区。真实日期编辑仍立即停用旧复制，错误仍定位字段。
4. **按要求调整计算器首行顺序。** `AC →（→ ）→ 删除`，标准/科学共用原按键处理，删除及计算行为不变。

主要源码：`src/diff-style.css:117`、`src/diff.js:487`、`src/dates.js:34`、`src/dates.js:68`、`src/dates.js:99`、`src/calculator.js:118`。

只修改以上四个运行时文件，复用原生 details、已有计算函数、任务控制及内容保护；没有新增依赖、权限、语言键或持久化。

## 本轮验证

证据目录：`.superpowers/sdd/diff-recovery-20261115/`。

| 检查 | 命令/范围 | 新鲜结果 |
| --- | --- | --- |
| 失败回归 | 新增 `diff-disclosure-recovery.spec.js` | 修复前 6 项失败，分别复现入口隐藏和内容保护遗漏，见 `red.log` |
| 日期失败回归 | 新增 `date-toggle-stability.spec.js` 初始集 | 修复前 3 项失败，复现详情丢失和状态不在结果区，见 `date-red.log` |
| 单元 | `node --test test/*.test.js` | 退出码 0；444 通过、0 失败，`unit.log` |
| Chromium | `LISTOOLS_TEST_URL=http://127.0.0.1:56329 npx playwright test test/e2e/date-toggle-stability.spec.js test/e2e/diff-disclosure-recovery.spec.js test/e2e/persistent-workspace.spec.js test/e2e/persistent-tools.spec.js --project=chromium --workers=2 --reporter=line --output=.superpowers/sdd/diff-recovery-20261115/chromium-results` | 退出码 0；32 通过，`chromium-final.log` |
| WebKit | 同上两个新增 spec，`--project=webkit --output=.superpowers/sdd/diff-recovery-20261115/webkit-results` | 退出码 0；13 通过，`webkit-verified.log` |
| 折叠结束补验 | `diff-disclosure-recovery.spec.js --project=chromium --project=webkit`，独立输出目录 | 退出码 0；12 通过，`disclosure-hidden.log`；这是上表用例的补跑，不能相加算作独立场景 |
| 构建 | 隔离源码中 `npm run build` | 退出码 0；仍有公共 chunk 大于 500kB 提示，见 `/tmp/listools-diff-recovery-build.log` |
| 最终扩展 | `node .superpowers/sdd/diff-recovery-20261115/extension-check.mjs` | 退出码 0；最终 ZIP 解压加载、断网、21 注册入口正常；0 页面异常、0 HTTP(S) 请求，`extension-final.log` |

Chromium 包含：390/1440px 全部工具入口、37 项转换地址、JSON 完整复制下载、PDF 页序、图片实际尺寸、中文二维码往返、常驻导航、前进后退、草稿、HMAC 清理、主题/语言、单位首次复制、日期错误恢复和计算器按键。所有入口检查不代表全部工具的所有成功态均已覆盖。

日期新增逐帧检查要求：结果不出现空帧；日期输入、复选框、主操作的布局位移不超过 1 CSS px；已展开时间戳详情节点保持。手机测试使用实际任务选择器，并区分用户主动滚动与布局位移。

真实扩展在独立 Chrome for Testing 配置中运行。两种主题分别验证 Chrome 原生 100%、125%、150%、200% 缩放，使用 `chrome.tabs.setZoom/getZoom`，共 8 组；没有用调整视口冒充缩放。各组记录与截图见 `extension/verification.json` 和 `extension/`。

测试脚本修正记录：扩大回归发现旧入口选择器把隐藏的扣除助手 h1 也算入，现改为可见标题。并行运行曾共用产物目录，导致 trace 文件 ENOENT；已隔离目录重跑，失败运行未计入通过。计算器初始化等待及手机选择器/滚动坐标也已按真实界面修正，不作为产品 Bug 计数。

## 本地产物

- `releases/1.2.8-interaction-fix-20261115/LisTools-1.2.8.zip`
- 同级 `LisTools-1.2.8/`：可加载目录。
- `SHA256SUMS`、`files.sha256.json`：包与逐文件校验。
- 包 SHA-256：`a743638890eb3e5cc75922169c1bf96156f7e03f95fd9ad042edd2bf3f885082`。
- 包大小：5,000,613 字节；509 个文件。

本候选从上次冻结的 1.2.8 源码复制，只叠加本轮四个运行时文件；支持页仍保留源码并排除安装包。此前已发布 ZIP 保留原 SHA-256，不会自动替换用户已安装的扩展。

## 未验证范围

- 本轮未执行 Edge、Firefox、最低 Chrome 120、Safari 原生安装、VoiceOver、物理触屏和微信实机。
- 不宣称完成全部工具的所有状态、所有语言母语审校或全站七档宽度的完整成功态矩阵；实际覆盖以上表为准。
- Ego Lite 提示可升级，本轮未升级，独立复现任务已关闭。临时测试服务器在验收结束后停止。

# LisTools 1.2.0 页面衔接与编辑体验验收

日期：2026-10-27。结论：**已验证**，本轮源码修改、独立候选目录与 Chrome ZIP 已交付；没有提交 Git、覆盖历史包或发布 Release。以下测试均为本轮执行，未执行项目另列。

## 产物

- 可加载目录：`releases/motion-1.2.0-20261027/LisTools-1.2.0/`
- Chrome ZIP：`releases/motion-1.2.0-20261027/LisTools-1.2.0.zip`
- SHA-256：`90bdd1dd85fdd6c03690c12c3da2e7784165deff68c2592093aacb099f8e7df5`
- ZIP 大小：4,526,485 字节；498 个文件。与上一交付 ZIP 的 4,513,318 字节相比增加 13,167 字节。
- `artifact-manifest.json` 包含逐文件大小与哈希；`source-manifest.json` 记录当前源文件哈希。
- `evidence/` 包含截图、录屏、逐帧数据和测试日志。录屏：`recordings/before/before.webm`、`recordings/after/after.webm`。

**已验证**：ZIP、可加载目录和逐文件清单全部一致，Manifest 没有新增权限；package.json 与锁文件相对本轮快照均未变化。支持页仅在隔离构建中移除，其源码和正式资源检查保留。隔离源码与工作区应用文件的差异仅为支持页排除及菜单中对应入口的移除。

## 修改与关闭项

| 状态 | 问题与实现 | 实际证据 |
| --- | --- | --- |
| 已验证 | 首屏在翻译、路由、侧栏及专注工具栏就绪后显示；编辑器仍参与布局测量 | 旧包逐帧出现“JSON 解析与美化／美化”、x=0，后变为新文案、x=256；新包正式帧始终为“JSON 解析与格式化／格式化”、x=256 |
| 已验证 | 主内容轻柔淡入，减少动态效果时关闭；不对结果数字做动画 | motion 浏览器用例、before/after 真实扩展录屏、380 组首帧检查 |
| 已验证 | 200ms 后才显示视觉运行提示，真实 busy、取消和导出限制立即生效 | 50、150、199、201、400ms 单元测试；慢任务取消、取消后迟到反馈、PDF 快速进度事件浏览器用例 |
| 已验证 | JSON 增加编辑、复制输入；撤销、重做、全选复用现有 CodeMirror 历史 | 编辑菜单、真实历史状态、选区与焦点、Esc 返回触发按钮用例；未新增编辑器实例 |
| 已验证 | 深浅主题插入光标可见，输入区显示文本指针；窄屏工具栏换行 | 暗色光标计算样式、实际截图及响应式检查 |
| 已验证 | 输入复制与结果复制分开，复制反馈不改按钮名称 | 语法错误 Unicode 输入复制；导入 4,802 行、78,182 字节 JSON，输入复制逐字相同，结果包含全部 1,200 项 |
| 已验证 | 慢初始化和脚本失败可恢复，语言失败回退英文 | 延迟模块后静态占位、3 秒重新加载入口、脚本拒绝和语言资源失败用例 |
| 已验证 | 原生弹窗页脚、分类和搜索不被启动流程破坏 | Chrome 原生工具栏弹窗：收起 358px、展开 560px，页脚在视口内，搜索与排序进入／取消通过 |

主要修改文件与定位（源码行号对应本轮读取）：

- `src/entry.js:1`：统一页面启动与幂等就绪信号；各 `pages/*.html` 接入。
- `public/theme-init.js:8`、`public/boot.css:1`：首屏主题、语言方向、静态占位、失败恢复与过渡。
- `src/i18n.js:50`：等待专注工具栏首次挂载；`src/i18n-runtime.js` 保留英文回退。
- `src/tools/shared/pending-feedback.js:1`：可取消的视觉反馈延迟；`src/tools/shared/office.js:16` 及 JSON、转换、MD5、正则、Cron、对比页接入。
- `src/main.js:20`：JSON 文字工具栏；`src/style.css:34`：光标、焦点与菜单样式。
- `vite.config.js:10` 与 50 份 `src/locales/*.json`：本地启动文案，无远程字体或运行时翻译服务。
- `test/pending-feedback.test.js`、`test/e2e/motion.spec.js`：新增回归；既有测试补充等待正式页面就绪，保留原功能断言。
- 时间戳窄屏结果的旧高度上限在本轮回归中暴露并移除，结果不再被旧 60px 高度约束裁切。

完整文件列表见 `evidence/changed-files.json`。未把原有工作区修改算成本轮新增功能。

## 验证命令与结果

命令均从项目根目录执行；浏览器测试 cwd 为本轮 `candidate-source`，`LISTOOLS_TEST_URL=http://127.0.0.1:56420` 指向冻结候选目录。Chrome 使用本机 Chrome for Testing 149.0.7827.55，Edge 使用 155.0.4283.62；WebKit 为 Playwright 环境。浏览器日志和脚本保存在 `.superpowers/sdd/motion-20261027/`。

| 状态 | 命令／检查 | 退出码与关键结果 |
| --- | --- | --- |
| 已验证 | 基线 `npm test` | 0；329 项通过 |
| 已验证 | 最终 `npm test` | 0；335 项通过，无跳过 |
| 已验证 | `npx playwright test --project=chromium --workers=3 --reporter=line` | 0；773 项通过 |
| 已验证 | Edge／WebKit：interaction-cron、interaction-text、interaction-timer、media、motion、navigation-audit、office 七组测试 | 0；116 项通过；覆盖受影响流程与所有工具入口 |
| 已验证 | 隔离源码 `npm run build` 与 `package-chrome.mjs` | 0；产出最终 ZIP；仍有构建器的大分块提示，未为此做无关重构 |
| 已验证 | `node .superpowers/sdd/motion-20261027/audit-motion.mjs` | 0；380 组，FAILURES [] |
| 已验证 | `node .superpowers/sdd/motion-20261027/verify-extension.mjs` | 0；最终 ZIP 解压后的真实扩展断网检查通过，外部请求和页面错误均为空 |
| 已验证 | `node .superpowers/sdd/motion-20261027/verify-native-popup.mjs` | 0；最终包哈希绑定，原生工具栏弹窗通过 |
| 已验证 | `node .superpowers/sdd/motion-20261027/verify-full-copy.mjs` | 0；78,182 字节长文本完整输入与结果复制通过 |
| 已验证 | `node .superpowers/sdd/motion-20261027/record-transitions.mjs` | 0；修复前 34 帧、修复后 119 帧，以及对应 WebM 录屏 |
| 已验证 | ZIP 重新读取、每文件哈希与目录比对；`git diff --check` | 0；498 文件一致，差异格式检查通过 |

响应式覆盖 320、390、768、1199、1200、1366、1439、1440、1920、2560px，19 个导航入口（18 页及 MD5 专用界面）、两主题。380 组检查的是正式帧标题、内容 x/宽度稳定与溢出，不把自动计算产生的正常高度变化当作首屏布局错误。截图含 76 张入口／主题／桌面与手机图，以及实际 200% 缩放与原生弹窗图。

真实扩展断网检查覆盖：18 页冷加载、JSON Worker 与大整数、切阿语保留输入和结果、科学计算、中文二维码 PNG 生成与识别、PDF 页数／页序、图片 JPEG 输出、200% 浏览器缩放。完整 Chrome 回归同时保护既有导航、取消、导入、结果及 BFCache 行为。

测试过程中发现并修复：快速 PDF progress 绕过反馈延迟、专注按钮晚于就绪挂载，以及 WebKit Esc 后焦点未返回编辑触发按钮。相应用例已加入最终通过的套件。旧测试在隐藏的启动阶段测量布局或发键盘事件的问题，调整为等待就绪后检查，未删除原有布局和行为断言。

## 动效证据与验证边界

**已验证**：本次实际扩展录屏中，跨文档 pagereveal 带原生 transition，但目标仍为 booting，正确跳过并在就绪后使用普通淡入；没有双重播放。冷启动、加载失败、减少动态效果和 BFCache 已有自动化覆盖。

**未验证**：上述录屏没有采集到“目标已就绪而实际使用原生跨文档动画”的分支；不得据此声称所有原生过渡路径都做过视觉验收。保底启动与淡入已验证。

**已验证**：50 语言的键与插值通过结构测试；中文和英文操作流程、德文长文案及阿语相关回归纳入本次浏览器套件。新增译文为初稿校验，并非 50 语言母语审校。

**未验证**：Chrome 120 实机、Firefox 本轮、Safari 原生扩展安装、VoiceOver、物理触屏、真实中文输入法组合输入和微信实机扫码。本轮不改变最低版本声明；上述需在相应环境补实测，不能以 WebKit 或自动化组合事件替代。

**未验证**：全部页面的每一种状态逐帧人工审阅。已经执行全量自动化、入口首帧审计及代表性实屏检查，不把所有自动截图都表述为人工逐张审校。

**已验证**：源码与历史产物保留，未新增依赖、权限或用户内容持久化。Git 提交、Release 和商店发布未执行，本轮无需用户再作发布决定。

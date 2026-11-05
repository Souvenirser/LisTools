# 跨工具切换侧栏位移修复（2026-11-05）

## 根因与修复

用户明确问题是点击不同工具后侧栏上下移动。上一轮只修正焦点、选中背景和折叠透明度，没有覆盖导致该现象的跨页样式差异。

在上一轮交付 ZIP 的资源中复现：1440×900 深色及 1920×772 浅色，两项真实跨页点击回归均失败，Cron 切换到时间戳后侧栏滚动值改变 60 CSS px。

`src/tools-style.css:25` 原 `.tool-page details` 给页面全部折叠区加上外边距，也影响了侧栏分类；时间戳、JSON 和转换页没有相同的 body 类，因而分类间距不同。`src/tools/payroll/style.css:1` 也存在类似的折叠区外边距和标题内边距作用范围过大的问题。

两份样式现在将相关选择器限制为页面 `main` 内的折叠区，使用 `:where(main)` 保留原选择器优先级，避免改变右侧内容原有样式覆盖关系。没有用动画掩盖位移，没有更改计算、文件或导航存储格式。

`test/e2e/sidebar-repeat.spec.js:42` 增加真正切换时间戳、Cron、MD5、编码、正则、JSON 和对比的回归，分别比较滚动值和全部分类标题的纵向位置。转换页既有默认路由会规范化为 `#base64`，测试等待该真实地址。

## 验证

- 旧 ZIP：新增两项跨页回归均以 60px 位移失败，日志 `red.log`。
- 初次修正后的页面几何检查覆盖 21 个注册入口，侧栏滚动、分类位置、宽高的最大差异为 0px，见 `page-geometry.json`。
- 最终 ZIP 解压后，通过本地 HTTP 加载其资源：41 项 Chromium 导航相关回归通过，退出码 0。覆盖跨页位置、当前项重复点击、排序、分类同步、弹窗和过渡，日志 `final-chromium.log`。
- 最终 ZIP 的独立连续点击记录中，9 次导航前后滚动值均为 499，分类位置保持一致，见 `final-metrics.log` 和 `final-frames.json`。
- 最终 Chrome 包 506 个文件，根目录含 manifest.json、无新增权限，ZIP 与可加载目录逐文件一致；支持页仍排除。
- 构建成功；保留既有大分块体积提示。

证据目录：`.superpowers/sdd/sidebar-navigation-20261105/`。

## 交付

ZIP：`releases/sidebar-position-fix-20261105/LisTools-1.2.5-sidebar-position-fix-20261105.zip`。

SHA-256：`725b9e8df427bc185fca41b1bd6e7c410f2ec75ee0fe8c1c99ada158a2444832`。

此候选没有覆盖已发布 v1.2.5 或此前测试包，没有提交 Git 或发布 Release。HTTP 下的真实 Chrome 页面检查不等同于原生扩展安装验收；本轮没有进行真实浏览器缩放、其他浏览器或物理设备验收。

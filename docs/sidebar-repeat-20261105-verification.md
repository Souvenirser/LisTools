# 侧栏连续点击与背景宽度修复（2026-11-05）

## 已验证问题与修改

- `src/tools/shared/menu.js:167`：当前工具的重复点击原本仍调用关闭菜单流程，焦点转到顶部搜索。普通侧栏现在提前返回；弹层和搜索结果仍保留原关闭行为。
- `src/tools/shared/menu.css:15`：原选中背景仅覆盖链接，不包含同一行的收藏按钮。现在整行承载选中和悬停背景，右边界与分类行一致，保留层级缩进和独立收藏按钮。
- `src/tools/shared/motion.css:49`：分类反复展开收起原本同时过渡高度和整组文字透明度。现在菜单只过渡高度与内容可见性，保留原生折叠、关闭期间不可交互和减少动态效果规则。
- 新增 `test/e2e/sidebar-repeat.spec.js`，覆盖当前项重复点击、整行背景和快速反向折叠。

本轮 1440×900 Chrome 复现中侧栏外框宽度未改变，分类行保持 243 CSS px；不把用户截图中的疑似宽度变化全部归因于外框缩放。实际确认的背景覆盖范围不一致已修正。

## 本轮验证

- 修改前：新增的 3 项 Chromium 用例全部按目标缺陷失败。
- 修改后：新增 3 项通过。
- `npm test`：退出码 0，371 项通过、0 失败。
- 独立构建：`npx vite build --outDir /Users/lili02/.codex/worktrees/redesign-v2/LisTools/.superpowers/sdd/sidebar-20261105/dist`，退出码 0；有既有大分块体积提示。
- 构建资源上的 Chromium 回归：`sidebar-repeat`、`menu-expansion`、`menu-sorting`、`motion-polish`、`header-navigation-motion`、`popup-fold-motion` 六个文件，共 39 项通过、0 失败。
- 最初在 Vite 开发服务上的 36 项回归中，35 项通过；慢页面用例拦截的是 `/assets/money-*.js`，开发服务不使用此构建路径，因此该用例失败。未修改测试规避；改用独立构建资源后该用例及全部相关回归通过。
- 修复后快速反向折叠逐帧记录：分类行宽度为 243 CSS px、文字透明度保持 1，记录到 17 个不同的整数高度。高度仍连续过渡，没有用关闭动画代替修复。
- `git diff --check`：退出码 0。

证据位于 `.superpowers/sdd/sidebar-20261105/`：`before.png`、`before.json`、`navigation-before.json`、`after.png`、`sidebar-after.png`、`after-frames.json`、`metrics.json`、`build.log`、`chromium.log`。

## 边界

验证针对当前工作树及其独立 HTTP 构建，未执行本轮真实扩展工具栏、原生浏览器缩放、Edge、WebKit、Firefox 或物理触屏验收。未更新版本、覆盖历史包、提交 Git 或发布 Release。其余工作区修改保留。

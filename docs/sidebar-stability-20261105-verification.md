# 侧栏连续导航复核（2026-11-05）

## 已验证的缺陷与修复

- **恢复时机过早**：旧包在受控 CSS zoom 1.25 / 1.5 下，MD5 → 时间戳时滚动值分别偏移 16 / 32 CSS px。恢复发生在顶栏 ResizeObserver 建立最终可滚动范围之前，值被当时的上限截断。现将恢复移到入口最后的尺寸测量之后、正式显示之前，跨文档使用已保存的 scrollTop；同页收藏/语言重绘仍保留原锚点恢复。
- **快速点击丢失**：旧包从 Cron 到时间戳刚就绪时，立即用鼠标坐标点击 MD5，3 次均未导航，仍停留时间戳。只给过渡伪元素设置 pointer-events 无法解决浏览器快照阶段的命中限制。本次保留旧画面等待初始化，目标就绪即释放原生快照，然后只对 main 作 150ms 淡入；侧栏不参与淡入，也不继续挡住点击。

本次未改计算、Worker、导出格式、菜单偏好键或依赖；保留工作区及历史包。支持页仍只在隔离候选构建中排除。

## 证据与覆盖

证据目录：`.superpowers/sdd/sidebar-md5-20261105/`。

- `red.log`：两项缩放回归先失败；`rapid-red.log`：连续点击回归先失败 3 次。
- 最终包运行 `sidebar-repeat/sidebar-scroll/menu-expansion/menu-sorting/header-navigation-motion/popup-fold-motion`：**47 passed，退出码 0**，见 `final-chromium.log`。
- 其中三个视口（1440×900、1920×772、2048×1054）各覆盖开发工具全部 **42 个有向组合，共 126 次导航**；逐次核对滚动值及四个分类位置，门槛不超过 1 CSS px。包含有/无收藏、分类全部/部分展开、立即连续点击；另外覆盖刷新、后退、前进。
- 单元测试：**371 passed / 0 failed，退出码 0**，见 `final-unit.log`。
- 所有 21 个注册入口另外检查页面初始化与侧栏位置，见 `all-entry-audit.json`；这是入口检查，不代表所有业务流程全量验收。
- 实际 Chrome 的本地 HTTP 测试页（2048×1054，devicePixelRatio 2.5），使用直接坐标鼠标点击 MD5 ↔ 时间戳四次：滚动值均为 126.4000015258789，时间戳行 y 均为 691.6000366210938。没有使用会自动居中目标的 locator 点击作为位移证据。
- 对照截图：`screenshots/md5.png` 与 `screenshots/timestamp.png`。

### 纠正调查中的误判

浏览器自动化 locator 曾在导航前主动滚动目标，出现 88px 位移。诊断日志和直接鼠标点击对照已确认，这一条不能作为插件缺陷证据；未将其计入修复通过数。

## 产物

- ZIP：`releases/sidebar-stability-20261105/LisTools-1.2.5-sidebar-stability-20261105.zip`。
- 可加载目录：同目录下 `LisTools-1.2.5-sidebar-stability-20261105/`。
- SHA-256：`e7e816f4f3a28a47fab444ab500221163f3f88035bedb6ecb4f87aa201a413bc`。
- 4,768,584 bytes；506 文件。ZIP 与目录逐文件相同；Manifest v1.2.5，permissions / host_permissions 无新增。
- 构建退出码 0；仍有既有大分块体积提示。

## 未验证与边界

真实用户扩展地址的读取被浏览器工具协议策略拒绝，因此本轮实际 Chrome 走查为最终包的本地 HTTP 资源，不冒充实际扩展加载验证。原生 100% / 125% / 150% / 200% 缩放未完整执行；CSS zoom 回归与文字缩放检查不等于原生缩放验收。未运行本轮 Edge、Firefox、WebKit 或物理触屏检查。

未提交 Git、未发布 Release，未覆盖已发布包。

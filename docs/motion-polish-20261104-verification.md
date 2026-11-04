# LisTools 页面切换与折叠精修验收（2026-11-04）

已验证：本轮源码修改和候选包检查完成。保留当前1.2.4版本、既有工作区修改和历史包；没有Git提交、Release或商店操作。

## 本轮改动及关闭记录

| 项目 | 结果与依据 |
| --- | --- |
| 页面侧栏、转换目录和设置折叠 | 支持的引擎采用180ms原生高度过渡和120ms透明度过渡；连续反向点击仍保存最终状态。 |
| 同页任务切换 | 工作内容100ms淡入，覆盖个税页面；不改变业务执行时机。相同任务、首次初始化不播放，输入和结果不重建。 |
| 窄屏工具菜单跳位 | 打开前完成位置计算；首帧不再先出现在(0,0)后移动。减少动态效果下同样稳定。 |
| 关闭分类时键盘焦点丢失 | 立即让关闭内容不可交互，方向键排除收起中的链接；原生Enter→Tab和方向键回归通过。 |
| 新展开的字段无法立即聚焦 | 内容可见性在首帧即可生效；QR容量恢复、工作日错误定位、单位复制与菜单焦点恢复回归通过。 |
| 受限弹窗页脚短暂越界 | 工具栏弹窗只淡入内容，不插值改变自身高度；HTTP预览不临时移除高度约束。逐帧440px高度用例通过。 |
| 候选包失效的支持页入口 | 隔离快照刷新后重新排除未发布入口；保留工作区支持页源码和原始资源检查。所有入口检查没有support.html链接。 |

源码位置：`src/tools/shared/motion.css:1`、`src/tools/shared/task-guide.js:20`、`src/tools/shared/menu.js:186`、`src/tools/shared/menu.js:218`、`src/popup.js:16`；样式入口为`src/style.css:7`和`src/popup.css:3`。转换箭头改为旋转，并遵循减少动态效果。新增`test/e2e/motion-polish.spec.js`；原布局测试等待动画后的真实几何条件，未降低原标准。

继续沿用已有跨文档页面淡入。没有SPA改造、业务算法修改、结果延迟、新增依赖、扩展权限或用户内容存储。`package.json`和锁文件与上一份源码快照逐字节一致。

原生过渡按能力检测启用；WebKit当前测试环境不支持所需完整能力，保留正常的原生折叠。参考：[Chrome原生折叠说明](https://developer.chrome.com/blog/styling-details?hl=en)、[inert样式语义](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interactivity)。

## 本轮运行证据

| 验证 | 结果 |
| --- | --- |
| `npm test`（当前工作树） | 371通过，0失败；命令退出0。 |
| `npm run build`（隔离快照） | 成功，退出0；保留既有大于500kB分块警告，没有调整阈值掩盖。 |
| 完整Chromium回归 | 862通过，退出0。该运行对应功能冻结候选；随后仅修正打包隔离中的支持页入口。日志`frozen-chromium.log`。 |
| 最终ZIP对应目录定向回归 | Chromium76通过，WebKit74通过，合计150通过、2跳过、0失败，退出0。覆盖动效、菜单展开/排序/滚动、日期、QR、五险一金/个税、缩放布局和弹层。 |
| 最终包逐页检查 | 22入口、明暗主题、七种宽度；296组尺寸检查，0整页横向溢出、0页面脚本错误。另记录两项折叠内选择器检查。弹窗只检查适用的固定宽度。 |
| 原生Chrome缩放与离线扩展 | 最终ZIP解压实际加载；6页面×100%/125%/150%/200%，24项通过；侧栏断点正确。离线文本Worker完成，下载Unicode完整字节正确，HTTP请求0。 |
| 编辑检查 | 本轮已有文件`git diff --check`退出0。 |
| 最终包校验 | 506文件，ZIP与可加载目录逐字节一致；无新增权限和未发布支持页。 |
| 临时进程 | 56216、56217已关闭，socket connect_ex均为61（ECONNREFUSED）。 |

浏览器：页面测试Chrome156.0.8078.76，原生扩展及缩放Chrome for Testing149.0.7827.55。视口为320、390、768、1366、1440、1920、2560 CSS px。`layout-audit.json`仅证明这些空态布局与脚本检查；真实业务状态以浏览器流程用例和扩展测试为证，不将空态扫描等同全部功能通过。

命令：在隔离快照中以`LISTOOLS_TEST_URL=http://127.0.0.1:56217 npx playwright test --project=chromium --reporter=line`运行完整回归；最终定向命令选择motion-polish、menu-expansion、menu-sorting、sidebar-scroll、payroll、stability-iteration和zoom-layout七份spec，并指定`--project=chromium --project=webkit`。日志、源码SHA清单和扩展报告随本报告提供。

## 未验证与兼容性缺口

- 2项跳过分别是WebKit触屏拖动场景、需要原生关闭动画能力的Tab场景。Chromium对应场景已验证。WebKit英文测试环境原生Tab遍历分类的策略存在差异，即使关闭动效也一样；不计为通过。
- 真实工具栏弹窗尝试打开失败：测试窗口无法成为活动窗口。已执行固定尺寸弹窗页面、逐帧页脚和扩展加载检查；未把这些替代为真实工具栏弹窗验收。
- 本轮未执行Edge、Firefox、最低Chrome120、Safari原生安装、VoiceOver、物理触屏和微信实机测试。
- 没有新增文案，因此未新增翻译资源；现有语言结构检查包含在单元测试中，不声称完成50语言母语审校。

## 产物

- ZIP：`LisTools-1.2.4-motion-candidate-verified.zip`，4,767,400字节。
- SHA-256：`1905c42642414de37b2bcabc0ec46e121806e7d16191be2a3c0ef0365a297524`。
- 可加载目录：`LisTools-1.2.4-motion-candidate-verified`。
- 与上一次五险一金/个税候选相比，压缩包增加974字节。该对比仅反映两份实际ZIP，原历史包未覆盖。
- `交互演示.webm`：实际候选包页面切换、QR生成及任务切换、转换分类收起展开、文本处理和计时暂停/继续。
- screenshots：最终包逐页截图、24张原生缩放截图和代表性成功态；`motion-frames.json`记录一次真实分类折叠逐帧高度。

后续Git提交、版本升级、Release和商店发布均等待明确指令。真实工具栏弹窗及上述设备缺口仍需对应环境验证，不宣称“绝对无Bug”。

# 编码与转换 / Cron 连续切换闪屏修复

## 本轮确认

用户进一步明确症状为“整个页面闪一下”。上轮以侧栏坐标为主的验收不能证明没有闪屏。

对上次交付包的正常原生路径反复点击 120 次，没有发现侧栏坐标位移。但在不支持 `ViewTransition.waitUntil` 的回退路径中，24 次点击有 23 次采样捕获到整页淡入。随后将验收改为同时检测 body、顶栏、侧栏和 main 的逐帧透明度：三条路径的新增回归均先失败。正常原生路径也存在 main 从透明开始显示的问题。

根因位于 `public/boot.css`：冷启动/回退路径给 body 播放 0→1 的动画，普通原生路径则给 main 播放同样的 0→1 动画。每次跨文档切换都可能重新让已经就绪的内容消失。

## 修改

- `public/boot.css`：取消整页 body 淡入。固定框架保持不透明；main 仅进行 150ms、0.96→1 的轻微透明度衔接，正文始终可读。不新增位置、高度或缩放动画。
- `test/e2e/navigation-flash.spec.js`：新增编码与 Cron 连续往返逐帧检查，覆盖正常原生、缺少 waitUntil、无原生过渡三条路径，每条 20 次点击。
- `test/e2e/header-navigation-motion.spec.js`、`test/e2e/popup-fold-motion.spec.js`：将旧的“整页必须先淡隐”断言改为“框架始终可见、主内容不闪空、减少动态效果仍有效”。

没有更改导航地址、滚动恢复、收藏、分类偏好、计算、Worker、文件算法或依赖。

## 验收证据

证据目录：`.superpowers/sdd/navigation-flash-20261105/`。

- `red.log`：本轮三项闪屏回归先失败；回退路径可见 body 透明度为 0。
- `record-metrics.json`、`videos/before.webm`、`videos/after.webm`：各录制 10 次直接坐标点击。修复前记录到 body 为 0 或约 0.24；修复后 body 全为 1、main 最低 0.96。
- `final-chromium.log`：**50 项通过、0 失败，命令退出码 0**。导航、重复切换、排序、展开状态、滚动和弹窗回归。闪屏专项覆盖三条路径共 60 次点击；另外保留三个视口下开发工具全部 126 次有向导航检查。
- `final-unit.log`：371 项单元通过，0 失败，命令退出码 0。
- `candidate/build.log`：构建成功，保留既有大分块提示。

HTTP 浏览器测试加载的是最终 Chrome ZIP 对应的同一目录；封包时已校验 ZIP 和目录逐文件一致。本轮没有把能力模拟称作实际旧版 Chrome 测试，也没有执行真实扩展协议下验收、原生缩放矩阵或其他浏览器验收。

## 产物

`releases/navigation-flash-fix-20261105/LisTools-1.2.5-navigation-flash-fix-20261105.zip`

SHA-256：`d5a32d561c496ab82e591f5474be263e2a038efd52aa2734b0f4871408dc694b`。

506 文件、4,768,518 bytes，权限没有新增，支持页继续排除。可加载目录位于 ZIP 同级、同名目录。保留之前所有候选包和工作区修改；没有提交 Git 或发布 Release。

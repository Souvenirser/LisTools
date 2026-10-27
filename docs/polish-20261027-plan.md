# LisTools 全站体验精修实施计划（已批准）

目标：操作可达、结果可信、视觉统一。保留当前1.2.0、18实际页面、MD5界面、37转换及所有WIP/旧包。新增运行时/开发依赖0；零新增权限、网络服务及用户内容持久化。不提交Git、不发布Release、不上传商店。支持页仅隔离构建排除，源检查保留。

## 任务与所有权

1. 数据工作区：粗略对比标记、空模式idle；转换可操作错误码、结构化原因提示、字符集参数、正反向示例。由data组拥有diff/convert及其核心和新增测试。
2. 日常/安全：密码错误字段及底栏、办公计算局部错误、日期/抽签结果定位、单位空项/live、金额前导零、计时重复说明。由daily组拥有这些页面和核心/局部CSS/新增测试。
3. 文件/文本：查找词字段错误、结果复用10MiB限制、保守URL边界、QR设置摘要/容量恢复、图片字段错误、PDF页数/范围错误/文件名。由files组拥有这些页面和核心/局部CSS/新增测试。
4. 公共整合：导航关键词/去重/排序、regex有效flags、speed状态核对、JSON工具栏去重验证、共享接口与50语言由root拥有。
5. 验收交付：新基线，全量unit和Chromium，Edge/WebKit新场景及全部入口，实际最终ZIP离线扩展，截图、SHA、报告、原WIP/历史5包保护、停止临时进程。

## 决策/接口

- 预算不加大：diffLines maxEditLength2000/300ms；inline既有20ms、长行阈值16384保持。已知主动回退汇总到ready.coarse可选boolean；total仍供导航。UI称差异块/粗略对比，说明可能包含未变内容；不宣称coarse=false绝对精确。两侧空时切模式idle，显式比较仍支持空文本。
- 转换错误新增可选reasonCode/params，结果可选notices[{code,params}]并保留legacy。已知CSV列数/表头/JSON单元格/XML保序结构映射可操作文案，未知通用+details，不解析中文原文。Hex退化提示必须描述当前charset和原始字节下载。
- URL: [手册](https://e.test/a_(b))→https://e.test/a_(b)；裸https://e.test/a(b).→https://e.test/a(b)；无query/hash裸链接句末集合.,;:!?，。；：！？、可移除；有query/hash保留原文；%xx和平衡括号、尖括号内部原值保留。输入不修改，提取后再去重。
- >10MiB输出禁用用作输入，复制/下载完整保留；刚好10MiB允许。金额.5/+.5/-.5只补前导0，千分位/Decimal规则不变。
- 显式错误定位字段/展开details，自动不抢焦点；已有showError和actionArea/revealSection复用。抽签查看结果不能重抽；所有定位不改hash、不执行。
- 相同请求重跑、暂停继续关键控件≤1CSSpx；显式展开/错误定位允许重排，后台不强滚。保留16px正文、14px辅助、18pxregex和现有断点/主题/彩色键/蓝红测速。
- root负责所有locale；各实现组先生成i18n片段通知root合并EN/zh，其他48语言后统一。不得互改共享office/workspace等；需要改动通知root。

## 验收

每个缺陷RED→GREEN，真实Worker/下载字节/焦点/行为断言。密码3/0/空类别手机可修正，办公空/NaN/0分母就地可见，抽签原结果不变；完整37转换和18页旧行为回归。320/390/768/1366/1440/1920/2560px，明暗、zh/en/de/ar、200%缩放、完整复制导出、long末尾。50语言结构/插值+原值保留不等于母语审校。Firefox/最低Chrome/Safari/VoiceOver/物理触屏/微信按实际记录，不冒充通过。输出独立目录ChromeZIP+sha+源指纹+逐文件清单+截图+问题关闭报告；所有临时服务收尾。

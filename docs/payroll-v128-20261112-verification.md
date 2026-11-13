# LisTools v1.2.8 本轮实施与验收记录

日期：2026-11-12。状态：**界面与逻辑改造已实施；20城政策门槛未完成，整版验收未完成，不生成正式 Chrome ZIP。**

## 交付边界

- 当前工作区、package.json、package-lock.json、public/manifest.json 版本为1.2.8；保留原有未提交修改。
- 本轮没有提交、推送、创建 Release、上传商店或覆盖 releases 下的历史包。
- 新增运行时依赖0，开发依赖0；Manifest权限与本轮改前快照相同。
- `ui-build` 是内部验证构建，不能视为已经通过政策验收的发行目录；未从正式ZIP解压验收，因为正式ZIP被门槛禁止。
- 源码归档单独标为 source，不是Chrome上传包。正式 `LisTools-1.2.8.zip` 和正式可加载目录待政策门槛全部关闭后再生成。

## 已实施

| 区域 | 本轮变更 | 证据位置 |
| --- | --- | --- |
| 城市选择 | 选项、选中值只有城市名；无省份标题/政策段落；隐藏别名搜索；初次为空，语言更新保留选择；选项16px | `src/tools/payroll/ui.js:19`；`test/e2e/payroll-v128.spec.js` |
| 缴费表单 | 月份紧凑同行；城市、工资、公积金比例为主要输入；预设、自定义、不缴纳；保留独立草稿、实际基数、单位独立比例及分项设置 | `src/insurance.js:16` |
| 缴费结果 | 个人/单位优先的四项指标，直接显示四列明细与合计；单位成本在表尾；复制和完整TXT/CSV；表格项目列随金额滚动，只有表头吸顶 | `src/insurance.js:100`；`src/tools/payroll/style.css` |
| 工资个税 | 简化快速预估；先展示到手和本月税额；高级任职假设保留；工资条核对按本月/此前累计分区；三种减除口径保留 | `src/tax.js:20` |
| 年终奖/年度 | 保留原计算接口和任务地址；年度同薪直接消费输入；任一预测月或缺实际月份时，核心返回refund=null，界面、复制、CSV不提供年度退补结论 | `src/tools/payroll/tax.js:75`；`src/tax.js:87` |
| 结果保护 | 城市真实select变更正常使结果失效并刷新深圳条件；搜索Enter不提交；当前任务按自己的草稿判断同值，其他任务的隐藏草稿不会误清结果 | `src/tax.js:101`；`src/tax.js:133` |
| 补充公积金 | 明确填写住房基数时，补充公积金使用该住房基数；不再错误使用社保公共基数 | `src/insurance.js:86` |
| 语言 | 新payroll128命名空间23项界面标签覆盖50语言；机器翻译草稿，未冒称50语言母语审校 | `src/locales/*.json` |
| 正式包门槛 | 核对20城、2026年1—11月、未关闭缺口及政策文件SHA；失败则在写ZIP前终止，无绕过开关 | `scripts/payroll-release.js:6`；`scripts/package.js:13` |

上述路径行号为本轮读取位置；最终文件快照及SHA见 [source-manifest.json](payroll-v128-evidence/source-manifest.json)。

## 先失败、后修复的回归

1. 城市分组/长政策文案、结果明细隐藏、住房不缴纳/自定义恢复、搜索Enter、预测退款、同值失焦：初轮6项失败，修后通过。
2. 月份行被旧flex方向拆成两行；公积金超范围错误定位隐藏控件；住房基数4000/公共10000时补充部分误用公共基数：3项先失败再通过。
3. 个税真实select事件被错误过滤：选上海仍保留北京结果，深圳条件未显示。新增工资/年度两模式回归通过。
4. 11个实际月也可能给出全年退款；同薪结果被其他任务草稿变更误清：新增核心/浏览器回归通过。
5. 城市选项实际14px、表格body行头继承吸顶造成项目名堆叠：先固定失败，再局部修正。
6. 福建工伤候选使用7月生效：按本轮读取的官方原文改为8月起，保持reference；未补造7月旧值。

本轮测试中的公开示例金额仅为夹具，不是用户工资数据。界面输入、结果仍只保存在页面内存。

## 运行记录

| 检查 | 结果 | 日志 |
| --- | --- | --- |
| 本轮改前 `npm test` | 退出0，412项通过 | `.superpowers/sdd/payroll-v128-20261112/baseline.log` |
| 最终 `npm test` | 退出0，417项通过 | [单元日志](payroll-v128-evidence/unit-final-accepted.log) |
| Chrome受影响6个文件 | 退出0，102项通过（含七档宽度、两主题、中英德阿、成功态及助手axe扫描） | [Chrome日志](payroll-v128-evidence/chrome-verified.log) |
| WebKit新增回归 | 退出0，15项通过 | [WebKit日志](payroll-v128-evidence/webkit-verified.log) |
| 内部Vite构建 | 退出0；有既有大chunk体积提示，未据此重构无关代码 | [构建日志](payroll-v128-evidence/build-frozen.log) |
| 原生扩展断网/缩放 | Chrome for Testing149.0.7827.55，实际setZoom/getZoom核对100/125/150/200%，明暗两主题，共8组；工资/年度/缴费结果无整页横溢出，页面错误0，HTTP请求0 | [扩展记录](payroll-v128-evidence/extension-check.json) |
| 完整TXT/CSV下载 | 从内部扩展实际下载，核对完整条件、金额、月份及policyVersion；文件字节及哈希见记录 | 同上 |
| `node scripts/package.js` | **退出1，预期阻止正式出包；不是构建通过** | [门槛日志](payroll-v128-evidence/package-gate.log) |

复现命令使用 `LISTOOLS_TEST_URL=http://127.0.0.1:56284 npx playwright test ... --project=chromium`。本轮六个文件为：`payroll-v128`、`payroll-stability-next`、`insurance-usability`、`insurance-usability-layout`、`tax-usability`、`tax-usability-layout`。并行浏览器用独立 `--output`，避免trace目录互相清理。

中途失败也保留：旧直接页面测试未适配常驻iframe/折叠区，已迁移原财务场景；两个浏览器曾共用产物目录造成3项context.close的ENOENT，隔离后重跑；原生缩放探针曾混用外层boundingBox与iframe宽度，修正为同坐标系后验证。没有把这些失败计入最终通过数。

## 政策门槛：未完成

“完整闭合0城”表示本轮严格的**全险种、当前及历史逐段、费率/固定额/扣费通道/取整依据**尚无一城全部关闭，不表示所有现有参数均错误。已有零散官方依据和京沪个人端实现，也不等于20城完整交付。

- [逐城审核表](payroll-policy-v128-audit.json)：全部20城及缺口；verifiedMonths保持空，未将研究线索当正式核验。
- [东部研究记录](payroll-v128-evidence/research-east.md)、[内地研究记录](payroll-v128-evidence/research-inland.md)及相应JSON：保留逐条来源和未验证项。研究记录未被主任务逐条独立复核，不能据此自动升级生产参数。
- 主任务本轮独立读取的原文：
  - [北京2026社保基数](https://banshi.beijing.gov.cn/zcjd/202608/t20260831_428682.html)：支持7月起上下限；不单独证明各费率和取整完整性。
  - [福建闽人社文〔2026〕10号](https://rst.fujian.gov.cn/zw/zfxxgk/zfxxgkml/zyywgz/ldgx/202607/t20260716_7178672.htm)：7月10日印发、次月起工伤基数4579—22893。厦门/福州候选生效月已改8月并补来源，仍为reference、verifiedAt=null；7月缺证继续拒绝。
  - [苏州缴存实施细则第八条](https://www.wujiang.gov.cn/zgwj/c112414/202501/c4d1e493970648c6803e33248d59045d.shtml)：双方分别见角分进元；现有候选已为up，未重复改动或升级核验。
- 现有城市验证标记没有提升；政策版本更新为2026-11-12以记录本轮候选时间纠正。未补造其余月份或费率。

下一步必须按审核表逐项取证、录入分段并做独立算例，才能填写verifiedMonths、更新绑定SHA并关闭正式包门槛。单元/浏览器回归通过不能替代政策核验。

## 截图与源产物

- [城市：改前](payroll-v128-evidence/insurance-before-city.png) / [改后](payroll-v128-evidence/insurance-after-city.png)
- [个税：改前](payroll-v128-evidence/tax-before.png) / [改后100%](payroll-v128-evidence/tax-100.png)
- [缴费100%](payroll-v128-evidence/insurance-100.png)、[125%](payroll-v128-evidence/insurance-125.png)、[150%](payroll-v128-evidence/insurance-150.png)、[200%](payroll-v128-evidence/insurance-200.png)
- [个税125%](payroll-v128-evidence/tax-125.png)、[150%](payroll-v128-evidence/tax-150.png)、[200%](payroll-v128-evidence/tax-200.png)

改前截图是用本轮修改前保存的相关源码重建，其他源文件与本轮工作树一致；不是旧Release复装截图。对照采集Chrome157.0.8103.51、1440×900、100%；缩放截图来自实际扩展Chrome for Testing149，图像是原生像素，缩放记录中的有效CSS宽度另列。内部构建逐文件校验见 [internal-build-manifest.json](payroll-v128-evidence/internal-build-manifest.json)。

## 未执行与风险

- **20城政策及2026历史段未完成**：正式发行阻塞项。
- Edge应用本机不存在，未执行；Firefox、最低Chrome120、Safari原生安装、VoiceOver、物理触屏、微信实机本轮未执行。
- 未运行全站所有历史浏览器文件；本轮只运行直接受影响的财务与布局回归。
- 50语言完成键/插值结构检查，未完成所有语言母语审校。原生缩放为中文明暗检查，中英德阿通过响应式实际布局检查；未把其他语言原生缩放冒称完成。
- 内部扩展运行不等于正式ZIP验收；未验收最终ZIP、正式可加载发行目录和对应全站Worker矩阵。
- 默认dist曾被一次测试构建重生成；源码和releases历史包未被覆盖，后续测试都指定本轮独立ui-build目录。
- Ego任务空间在后段已不存在，停止操作该空间；未新建空间绕过，后续截图由独立的无登录测试Chrome采集。

测试服务和本轮浏览器进程在报告收尾时停止；不结束用户自己的浏览器。

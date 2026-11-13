# 五险一金易用性修复验收（2026-11-11）

**已验证：本轮界面与复现问题已修复，1.2.7独立候选已生成；没有提交Git、发布Release或更改版本。** 旧包和原工作区修改保留。本报告不宣称20城政策核验完成。

## 交付与绑定

- Chrome ZIP：`LisTools-1.2.7.zip`，4,964,772字节，509个文件。
- SHA-256：`e39f326de320ac99b40bbdbbf7b601ae0731c302569ed674a4194d1b148c9727`。
- 可加载目录：`LisTools-1.2.7/`；ZIP解压内容与目录逐文件一致，Manifest V3，无新增权限。
- 构建使用隔离源码快照，记录在`proof/source-sha256.json`；只有快照排除未发布支持页入口、安装包资源及生产支持入口。原工作区支持源码和资源缺失检查保留。
- `LisTools-source-1.2.7.zip`为本轮结束时的工作区源码归档，保留支持页源码及原有检查；它不是Chrome安装包。
- 新增运行时/开发依赖均为0。package.json与锁文件与前一轮个税交付快照逐字一致。
- 对比上一轮个税候选ZIP（4,919,962字节），本轮变化+44,810字节；这是完整候选包的体积变化。

## 关闭的问题与流程

| 项目 | 本轮结果 | 回归证据 |
|---|---|---|
| 公积金联动 | 联动时单位比例只读，读取也以个人为准；独立设置仍可用 | 原失败用例转绿 |
| 无关税额草稿 | 附税关闭不读取其校验；附税失败保留本批缴费及导出，不含旧税额 | 原失败用例、TXT检查 |
| 公共基数错误 | 使用公共值的错误关联公共字段；单项覆盖仍关联单项 | 原失败用例 |
| 城市搜索Enter | 只选择城市，不提交空工资；搜索本身不清结果 | 原失败用例与有效结果保护 |
| 缺证城市恢复 | 错误定位城市控件，不把用户带到不可编辑的费率 | 新增失败回归转绿 |
| Enter计算后失焦 | 同值失焦和重复执行保留结果节点、按钮位置；真实修改失效 | 新增失败回归转绿 |
| 无障碍成功态 | 页面main关联标题，避免与工作台main混淆；助手弹层单独扫描 | axe失败后修复并转绿 |
| 已选城市过长 | 选择框仅城市名称，下拉选项和就近说明仍显示当月状态 | 新增失败回归转绿 |
| 测试月份漂移 | 模拟12月先复现两项误报；计算夹具固定11月，默认月独立验证 | 独立最终审查发现，RED→GREEN |

默认输入保留城市、月份、工资、公积金比例。实际基数、分项、参保开关、单位比例、补充缴费、自定义、三种附税口径、完整TXT/CSV及原有计算均保留。城市/手动模式草稿仅在页面内存，切换不相互污染；个人比例空白必须确认，单位未知保持未知。结果以个人扣款为主，公积金入账标明不是到手现金，单位成本单独展开。附税复用已有扣除助手，合计不叠加。

金额显示、计算和导出读取同一份结果；显示带千分位，导出保留原始数值与条件。上海单位未知费率不显示成0；没有已核验政策的城市不使用候选参数自动计算。

## 新鲜验证记录

| 命令/范围 | 本轮结果 |
|---|---|
| `npm test` | 退出0，412/412 |
| `LISTOOLS_TEST_URL=http://127.0.0.1:56274 npx playwright test test/e2e/insurance-usability.spec.js test/e2e/insurance-usability-layout.spec.js test/e2e/tax-usability.spec.js test/e2e/tax-usability-layout.spec.js --project=chromium` | 退出0，75/75 |
| 相同保险两文件，`--project=webkit` | 退出0，38/38 |
| `node .superpowers/sdd/insurance-usability-20261111/check-locales.mjs` | 退出0，50语言新增32项键、非空及插值一致 |
| `npm --prefix .superpowers/sdd/insurance-usability-20261111/source run build` | 退出0；原有大chunk提示保留，非构建失败 |
| `node .superpowers/sdd/insurance-usability-20261111/package-chrome.mjs` | 退出0；ZIP/目录内容、权限、支持页排除检查通过 |
| `node .superpowers/sdd/insurance-usability-20261111/extension-check.mjs` | 退出0，最终ZIP解压实际加载Chrome for Testing 149.0.7827.55；离线计算、语言、下载、既有文本Worker与完整Unicode字节检查通过；记录的HTTP(S)请求与pageerror均为空 |
| `git diff --check` | 退出0 |

保险响应式覆盖320、390、768、1366、1440、1920、2560px及明暗主题；成功态、明细展开及导出可达，无整页横向溢出。1366×768主输入与执行可见。中文、英文、德文和阿语检查有效输入保留、结果、弹层及焦点恢复；自动扫描覆盖成功态和助手。

原生缩放为`chrome.tabs.setZoom/getZoom`实际设置100%、125%、150%、200%，不是缩放视口的替代。实际浏览器外窗1440×900，100%内容视口1440×813；两主题共8组记录在`extension-verification.json`。额外核对结果右边界不超过iframe宽度。截图用Chrome原生协议捕获物理视口，避免自动化CSS裁剪。缩放导致正常上下排列时，允许页面滚动，执行/查看结果沿用现有机制。

## 截图与源码范围

`screenshots/`含原生缩放、明暗空态、结果明细、附税助手、部分成功、四语言、七宽度截图。`insurance-before-planning-baseline.png`来自本轮修复前已采集的规划走查，当前修复前副本与它对应；不是对最终包重新拍摄的旧页面。其余after截图绑定本报告Chrome ZIP。无跨工具视觉改版。

本轮产品源码主要涉及`src/insurance.js`、`src/tools/payroll/ui.js`、`src/tools/payroll/style.css`、`src/tax.js`中的金额格式化复用，以及50语言的insuranceEase命名空间。计算核心、税率、政策数据和Worker协议未重写。

## 取舍与未完成项

1. 复用现有金额格式化到共享UI：若出错会影响两页显示，因此已同时跑个税回归；运算与税率不变。
2. 附税继续按同薪、同个人扣除累计预估：不代表真实逐月工资单，需精确历史核对时使用独立个税页。
3. 政策标记不随UI改版升级：缺证城市不能直接自动试算，未知单位成本不冒充0。20城官方政策完整核验仍未完成，原清单见`docs/payroll-policy-coverage.md`。

Edge定向启动失败：本机`/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`不存在，记录在`proof/edge.log`，不计通过。Firefox、最低Chrome120、Safari原生安装、VoiceOver、物理触屏、真实工具栏弹窗和微信实机未执行；本轮未修改这些入口。50语言结构通过不等于母语审校，新增非中文翻译为机器初稿。没有宣称全站无Bug或政策全部正确。

一次独立最终审查未发现本轮重要产品缺陷，测试日期依赖意见已修复；无未处理的次要审查意见。临时进程清理另记于交付核对文件。

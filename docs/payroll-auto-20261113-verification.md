# 城市自动缴费与逐月到手工资验收记录

日期：2026-11-13。版本：1.2.8。交付类型：独立本地候选包，未提交 Git、未发布 Release。

## 已验证的改动

- 工资个税默认北京、城市试算；工资输入驱动个人缴费预览。普通公积金采用当前匹配规则允许的最高比例，用户可以修改，用户已修改的比例不会被换城市静默覆盖。
- 各险种与公积金独立匹配月份、基数上下限和舍入；实际基数覆盖、零公积金和手填模式保留。
- 全年逐月工资、现金缴费、社保、公积金、个税与到手金额直接展示在两张主卡片下方，包含合计。未知手填分项显示“—”，现金缴费仍可核对。
- 普通预估拒绝不合理手填缴费；特殊现金扣款必须明确确认并填写可扣除额。工资条实际累计模式继续区分现金与可扣除额，不套用普通预估的现金上限。
- 年度同薪默认城市估算并直接使用输入工资；同条件重算保持结果节点与阅读位置。
- 修复 WebKit 中失焦时重复替换按钮文字导致“核对工资条”首次点击丢失。补充公积金自定义项继续标为参考试算。
- 新增错误及可访问文案补齐现有 50 语言。新增运行时及开发依赖为 0。

## 核对算例

使用北京参考/适用规则、2026-11、自 1 月起同薪、月薪 20,000、公积金个人 12%、专项附加扣除 0：个人社保 2,103.00，个人公积金 2,400.00，合计 4,503.00；11 月个税 1,049.70，到手 14,447.30。

逐月到手：1—3 月各 15,182.09；4 月 14,762.93；5—12 月各 14,447.30。全年工资 240,000.00，个人缴费 54,036.00，到手合计 175,887.60。以上是同薪、相同扣除条件推演，不是真实工资单。

月薪 100,000 时同一组北京规则的个人缴费上限算例为 8,181.54，其中公积金 4,362.00。不同险种使用各自上下限，不以一个合计上限替代分项计算。

## 本轮运行证据

证据目录：`.superpowers/sdd/payroll-auto-20261113/`。

| 命令/流程 | 结果 | 证据 |
| --- | --- | --- |
| `node --test test/*.test.js` | 退出码 0；444 通过、0 失败 | `final-unit.log` |
| `LISTOOLS_TEST_URL=http://127.0.0.1:56328 npx playwright test --project=chromium test/e2e/payroll-audit-round2.spec.js test/e2e/payroll-auto.spec.js test/e2e/payroll-handover-20261113.spec.js test/e2e/payroll-recovery-20261113.spec.js test/e2e/tax-usability.spec.js` | 退出码 0；63 通过 | `final-chromium.log` |
| Chromium：reference、stability-next、v128、tax-usability-layout、usability-audit-round3 定向集 | 退出码 0；68 通过，含宽度、主题、语言及成功态 axe 检查 | `extended.log` |
| 最终按钮修正后：`LISTOOLS_TEST_URL=http://127.0.0.1:56328 npx playwright test --project=chromium test/e2e/payroll-auto.spec.js test/e2e/tax-usability.spec.js` | 退出码 0；29 通过 | `final-refresh.log` |
| `LISTOOLS_TEST_URL=http://127.0.0.1:56328 npx playwright test --project=webkit test/e2e/payroll-auto.spec.js test/e2e/payroll-recovery-20261113.spec.js` | 退出码 0；24 通过 | `final-webkit.log` |
| 隔离候选目录执行 `npm run build` | 退出码 0；构建和打包完成；有 chunk 体积提示 | `/tmp/listools-payroll-auto-build.log` |
| `node .superpowers/sdd/payroll-auto-20261113/extension-check.mjs` | 退出码 0；最终 ZIP 解压目录实际加载、离线、8 组主题/真实缩放检查通过 | `extension-final.log`、`extension/extension-check.json` |
| ZIP 完整性与逐文件校验 | 509 个文件字节一致；Manifest 与根目录一致；版本 1.2.8；支持页排除 | `files.sha256.json`、`SHA256SUMS` |
| 冻结生产源码与当前源文件比对 | 253 文件一致；无漂移；忽略说明中的两处隔离构建入口调整 | `source-files.sha256.json` |

真实扩展浏览器为 Chrome for Testing 149.0.7827.55，使用单独临时配置目录，未操作用户浏览器配置。明暗主题分别以 `chrome.tabs.setZoom/getZoom` 核验 100%、125%、150%、200%，没有使用视口替代缩放。离线检查包含税额与全年表、完整 CSV、五险一金封顶和 JSON Worker 大整数；采集到 0 页面异常、0 HTTP(S) 请求。

失败记录保留：新增功能先有失败回归；首次 WebKit 检查发现按钮点击缺陷，修复后 24 项通过。首次扩展检查脚本试图点击成功态下按规则隐藏的执行按钮，属于测试脚本问题；改为先计算、再逐档缩放验证结果保留后通过。失败运行不计入通过数。短屏场景改前已通过，仅列保护回归。

## 源码和产物边界

主要文件：`src/tax.js`、`src/insurance.js`、`src/tools/payroll/{policy,ui,tax-input,style}.js/css`、50 个语言文件、定向单元与浏览器测试。未改政策目录数据；严格政策解析及原参考快照接口保持。

支持页源码和真实资源检查仍留在工作区。隔离候选只移除支持页构建入口、动态导入与生产资源要求，未全局关闭根目录检查；未覆盖历史包。

ZIP：`releases/1.2.8-auto-payroll-20261113/LisTools-1.2.8.zip`，5,000,496 字节。

SHA-256：`5ad401b9b0cc69b8bbf9db98e2dc5d914ed85053535e47138da8501155ba1f75`。

可加载目录：同级 `LisTools-1.2.8/`。`files.sha256.json` 是扩展文件清单；`source-files.sha256.json` 是冻结候选源码清单。验收说明和截图位于包的同级目录，不混入扩展 ZIP。

## 未验证和限制

- 本轮没有完成 20 城官方政策闭合。规则优先采用现有适用月的已核验分项，其余按已有参考规则试算并保留参考标记；不得将此包宣传为 20 城官方核验完成。
- 扩展实际验证覆盖本轮关键流程，不能代替全站所有成功态。Edge 本机未安装；Firefox、Chrome 120、Safari 原生安装、VoiceOver、物理触屏和微信实机本轮未执行。
- 50 语言结构检查通过不代表 50 语言母语审校完成；中文、英文及德文/阿语代表性布局有定向覆盖。
- 低工资仍可能因城市最低基数形成负现金结余；界面保留真实计算值并提示，不将负数伪造为零。
- 这是本地候选，未进行商店上传、Git 提交或 Release 发布。

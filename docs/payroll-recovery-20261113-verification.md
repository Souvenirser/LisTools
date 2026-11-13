# v1.2.8 财务页面错误恢复补查

日期：2026-11-13。**已验证：本轮复现并修复4类错误定位问题，7个失败场景均恢复正常，另检查手机明暗主题及实际下载。未验证：全站全部成功态、实际扩展和原生缩放；20城政策完整核验仍未完成。**

## 问题关闭清单

| 问题 | 修前复现 | 最小修改 | 修后验证 |
| --- | --- | --- | --- |
| 工资/年度城市模式公积金比例标错位置 | 工资填7.5%，错误落到工资栏；年度填7.5%或非数字，落到城市控件，实际比例未标错 | 城市计算适配将已有比例错误关联当前任务的公积金比例；年度逐月适配保留这一目标 | 工资、年度、非数字3个场景，改回7%均恢复结果，原工资不丢 |
| 逐月城市模式把工资错误标成缴费错误 | 第2月工资填非数字，标记第2月缴费金额 | 按实际错误字段保留工资来源及月份 | 自动展开第2月，聚焦工资输入；修正后全年收入240000元 |
| 手动固定费用把错误标成费率错误 | 个人/单位固定额填非数字，错误标在对应费率输入 | 在现有活动项目读取过程中复用amount校验，并传固定额输入ID；空固定额仍按0处理 | 两侧分别覆盖；填回5元后个人205元或单位705元，导出恢复 |
| 上海补充公积金单位比例越界标到个人 | 个人2%、单位6%时，个人输入被错误标红 | 已有1%—5%范围检查逐侧报告，不改范围与计算规则 | 错误只关联单位；改回2%后住房合计900元 |

生产改动仅在[五险一金读取](../src/insurance.js:84)、[补充比例定位](../src/insurance.js:86)、[个税城市适配](../src/tax.js:56)和[逐月适配](../src/tax.js:59)。新增[浏览器回归](../test/e2e/payroll-recovery-20261113.spec.js:13)。[本轮补丁](payroll-v128-evidence/recovery-20261113/source-changes.patch)以本轮开始时工作区为基线，不包含此前大批未提交修改。

计算核心、城市政策JSON、依赖、锁文件及Manifest与本轮开始快照逐字节相同。没有调整税率、取整、政策核验状态或存储方式；没有新增文案或依赖。

## 新鲜验证记录

| 验证 | 命令与结果 | 证据 |
| --- | --- | --- |
| 单元基线 | `npm test`，425/425通过，退出0 | [基线](payroll-v128-evidence/recovery-20261113/unit-baseline.log) |
| 失败回归 | `npx playwright test test/e2e/payroll-recovery-20261113.spec.js --project=chromium`；先6个失败，再单独复现逐月工资1个失败，均退出1 | [六场景](payroll-v128-evidence/recovery-20261113/recovery-red.log)、[工资场景](payroll-v128-evidence/recovery-20261113/salary-red.log) |
| 最终单元 | `npm test`，425/425通过，退出0 | [日志](payroll-v128-evidence/recovery-20261113/unit-final.log) |
| Chrome流程 | `LISTOOLS_TEST_URL=http://127.0.0.1:56288 npx playwright test test/e2e/payroll-recovery-20261113.spec.js test/e2e/payroll-v128.spec.js test/e2e/tax-usability.spec.js test/e2e/payroll-stability-next.spec.js --project=chromium --workers=3`，57/57通过，退出0 | [日志](payroll-v128-evidence/recovery-20261113/chromium-final.log) |
| WebKit流程 | 同一测试地址，运行recovery和payroll-v128两个文件，`--project=webkit --workers=2`，29/29通过，退出0 | [日志](payroll-v128-evidence/recovery-20261113/webkit-final.log) |
| 内部构建 | 使用现有Vite配置在内存中排除未发布支持页入口，构建至独立ui-build，退出0 | [日志](payroll-v128-evidence/recovery-20261113/build-fixed.log) |
| 正式打包门槛 | `node scripts/package.js`，退出1，明确为20城政策核验未完成；政策SHA与审核表一致 | [日志](payroll-v128-evidence/recovery-20261113/package-gate.log) |

上述浏览器测试通过本地HTTP加载本轮构建，不代表实际Chrome扩展验收。内部构建没有修改Vite源码，也没有关闭正式支持页资源检查。

本轮新增11个浏览器用例：7个错误恢复场景、320/390px乘明暗主题4个手机场景。手机检查字段和说明均在纵向64—844px范围内，根页面无横向溢出；TXT实际字节包含全年工资、住房比例及手动固定费条件。原有流程同时覆盖城市空值、语言切换、草稿隔离、附税部分成功、三种扣除口径、重复执行、年终奖及下载。

手机补查第一次失败属于测试断言使用了错误的导出字段：用单项结果的employeeRate验证条件快照，而现有合同使用rates.housing.employee。读取实际结果结构后修正测试断言，没有修改导出格式。这次失败不计作产品缺陷；[原始日志](payroll-v128-evidence/recovery-20261113/phone.log)保留。

## 可复查画面与源码

- [修前：固定额错误落在费率](payroll-v128-evidence/recovery-20261113/fixed-fee-before.png)
- [390px深色：修后固定额与提示可见](payroll-v128-evidence/recovery-20261113/fixed-fee-390-dark.png)
- [390px浅色](payroll-v128-evidence/recovery-20261113/fixed-fee-390-light.png)、[320px深色](payroll-v128-evidence/recovery-20261113/fixed-fee-320-dark.png)、[320px浅色](payroll-v128-evidence/recovery-20261113/fixed-fee-320-light.png)
- [本轮源码哈希](payroll-v128-evidence/recovery-20261113/source-manifest.json)

已实际查看390px深色修后截图，固定额输入和错误说明位于当前画面，固定操作栏没有遮住该输入。其余画面已由几何回归检查并留存截图，未逐张人工审阅。自动测试与截图均不代表物理触屏或辅助技术人工验收。

## 保留的缺口与交付边界

- 20城2026年1—11月完整政策门槛仍未满足，本轮没有以代码测试代替政策证据；详见[审核表](payroll-policy-v128-audit.json)。正式`LisTools-1.2.8.zip`仍不存在。
- Edge实际应用路径不存在，本轮未执行；Firefox、Safari原生、VoiceOver、物理触屏、真实浏览器缩放和实际离线扩展未执行，不计通过。
- 本轮未全面重跑其他工具、37项转换、全部七档宽度或50语言人工审校；没有声称全站无Bug。
- 本轮交付为工作区源码、局部补丁、截图与报告。此前源码归档是当时快照，未覆盖，不包含本轮新改动；未新增正式安装包、提交Git或发布Release。
- 本轮临时HTTP服务器在验证结束后停止；用户浏览器和其他服务不受影响。

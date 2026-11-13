# v1.2.8 草稿覆盖与年度预测标记修复

日期：2026-11-13。**已验证：本轮修复两类逻辑问题，8个失败场景已转为通过；最终单元425项、Chrome70项、WebKit42项通过。未完成：20城完整政策核验及正式安装包。**

## 本轮关闭的问题

| 问题 | 修前复现 | 修复与保护项 |
| --- | --- | --- |
| 年终奖导入静默覆盖扣除草稿 | 年度工资留空，仅填写个人缴费、专项扣除、其他扣除、大病医疗或应税调整之一，再导入估算，5个场景均未确认就被覆盖 | 用已有financialDraft比较整组比较条件；任一条件改变均先确认，取消时不写任何字段；空白未修改表单直接导入 |
| 切换年份后继续使用旧预测标记 | 空逐月草稿、已有逐月草稿、工资页共享年份3条路径，切到2027年后1月等仍未标为预测 | 复用同薪估算已有的年份/月数规则；仅在合法年份真正变化时刷新12个预测标记。金额与扣除草稿保留，同一年内的手动选择不被反复重设 |

主要改动：[年度标记](../src/tax.js:118)、[导入保护](../src/tax.js:148)、[初始条件快照](../src/tax.js:154)、[新增回归](../test/e2e/payroll-handover-20261113.spec.js)。没有新建缓存、通用状态框架或新计算引擎。

覆盖确认文案统一为“这将覆盖已填写的计算参数，是否继续？”，供原有逐月填充和年终奖导入共用，不再错误地把年终奖条件称作“逐月参数”。50份语言文件仅修改`payroll.annualFillConfirm`一项，其余键、占位符和原有格式保持不变。结构与中英德阿实际对话框已验证，50语言母语审校未执行。

## 新鲜验证

| 命令或场景 | 实际结果 | 证据 |
| --- | --- | --- |
| `npm test`，实施前/后 | 两轮均425/425通过，退出0 | [基线](payroll-v128-evidence/handover-20261113/unit-baseline.log)、[最终](payroll-v128-evidence/handover-20261113/unit-final.log) |
| 新增定向Chrome回归 | 修前8失败、1通过；修后9/9通过，均保留完整日志 | [先失败](payroll-v128-evidence/handover-20261113/handover-red.log)、[通过](payroll-v128-evidence/handover-20261113/handover-green.log) |
| Chrome最终流程 | `LISTOOLS_TEST_URL=http://127.0.0.1:56289 npx playwright test test/e2e/payroll-handover-20261113.spec.js test/e2e/payroll-recovery-20261113.spec.js test/e2e/payroll-v128.spec.js test/e2e/tax-usability.spec.js test/e2e/payroll-stability-next.spec.js --project=chromium --workers=3`；70/70通过，退出0 | [日志](payroll-v128-evidence/handover-20261113/chromium-final.log) |
| WebKit受影响流程 | 同测试地址，handover、recovery、payroll-v128三个文件，`--project=webkit --workers=2`；42/42通过，退出0 | [日志](payroll-v128-evidence/handover-20261113/webkit-final.log) |
| 内部Vite构建 | 退出0，仅供本地HTTP回归；在内存中排除未发布支持页，没有修改正式Vite配置或关闭资源检查 | [日志](payroll-v128-evidence/handover-20261113/build-fixed.log) |
| 保护范围 | 税额核心、五险一金页面、城市JSON、依赖、锁文件、Manifest与开始快照一致；缴费核心与前批已验证哈希一致；50语言其余JSON内容一致 | [源码哈希](payroll-v128-evidence/handover-20261113/source-manifest.json)、[本批补丁](payroll-v128-evidence/handover-20261113/source-changes.patch) |
| 正式包门槛 | `node scripts/package.js`退出1，原因为20城政策未闭合，未生成正式ZIP | [日志](payroll-v128-evidence/handover-20261113/package-gate.log) |

本轮新增13个浏览器用例：5个不同扣除草稿的取消/确认、1个空表单控制、3个年份路径及4个语言确认。测试时钟固定为2026-11-13，避免换月导致预测标记期望漂移；所用Playwright实际安装版本为1.64.1。

最终流程还覆盖前批的手机320/390px明暗主题错误恢复、完整TXT下载、三种扣除口径、城市选择、部分成功、草稿隔离及重复执行。没有将重复运行次数相加为通过数。

## 结果与限制

[2027年预测结果截图](payroll-v128-evidence/handover-20261113/future-year-result.png)已实际查看，显示年度条件、金额及不能形成退补税结论的提示。TXT实际字节同时核对了2027年份和全部月份的预测标记，未混入旧的`predicted: false`。该画面使用测试金额，不是政策算例核验。

只读代码复核未提出本批阻断问题；主任务另行核对差异和执行测试，没有用审查者结论代替验收。核心税率、金额算法、既有结构化导出和政策核验状态未变。

未执行本轮实际扩展离线加载、原生100%/125%/150%/200%缩放、Edge、Firefox、Safari原生安装、VoiceOver、物理触屏及全部其他工具流程，不计通过。50语言没有母语审校。本地HTTP测试不能代替这些验收。

本轮交付为工作区源码、补丁、截图与报告。旧源码归档及已发布版本保留原样；正式`LisTools-1.2.8.zip`仍未生成，未进行Git提交、Release或商店发布。临时HTTP服务器在收尾时停止。

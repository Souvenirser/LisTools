# v1.2.8 政策补证与数据修正续报

日期：2026-11-12。**已验证：下述候选数据修正、未知基数提示和回归已经完成。未完成：20城全部险种及2026年1—11月政策闭合，正式Chrome ZIP和发行目录仍未生成。**

本续报只覆盖本轮增量；[上一批界面报告](payroll-v128-20261112-verification.md)与旧源码归档仍保留，不将其测试计为本批通过。

## 本批修正

| 区域 | 已实施 | 限制 |
| --- | --- | --- |
| 西安医保 | 现有7—11月候选的单位合计费率从8%改为7%，对应减征后的基本医保6%加生育1%；12月独立保留名义8%，不外推阶段减征。个人2%及大额1.6/6.4不变 | 7%为两份官方文本合读推导；医疗独立基数未闭合，两段min/max置为null，仍为reference，自动试算继续拒绝 |
| 西安政策详情 | 未取得的医保范围显示现有本地化“未确认”，不显示三险4737—23685，也不把未知显示为0—∞ | 对已核验且确实无上下限的记录，保留原有展示；不更改计算算法 |
| 福州生育 | 7月起生育另列单位0.7%、个人0，采用4579—22893基数；删除错误的免费合并标记 | 仍为reference；不是完整福州政策通过。医保8%与生育0.7%分别列示，不重复加到医疗记录中 |
| 上海住房 | 增加1—6月2690—37302、两侧各5%—7%的候选记录；7月仍采用原37731上限 | 历史住房记录仍reference；未补造上半年其他险种，resolvePolicy仍拒绝缺项月份 |
| 南京住房 | 增加1—6月2660—41400候选；两侧金额分别到元四舍五入；7月仍42400上限 | 历史住房仍reference；不是整城或历史半年自动试算开放 |
| 南京、苏州五险基数 | 在现有记录补入苏人社发〔2026〕30号省厅原通知，审核表单列其2026全年5025—25127依据 | 全年基数不能证明全年费率；没有把当前候选费率回填1—6月 |

实际代码：[保险提示](../src/insurance.js:62)、[城市数据](../src/tools/payroll/cities.json)、[政策回归](../test/payroll-policy.test.js:54)、[浏览器回归](../test/e2e/payroll-v128.spec.js:20)。显示和计算继续复用既有模块，没有新增依赖、权限或用户数据存储。

## 本轮主任务实际核实的依据

| 官方来源 | 对应结论 | 证据边界 |
| --- | --- | --- |
| [西安医保局减征说明](https://xdz.xa.gov.cn/zwgk/jbmsbz/shbz/1995686261241171969.html)与[市政府医保问答](https://www.xa.gov.cn/gk/zcfg/zcjd/zcwd/shbx/636a1abef8fd1c4c212759a3.html) | 单位基本7%降6%，从2025-12起12个月；名义8%包含生育1%；大额8元按80/20分担 | 专项减征优先于通用名义问答；6+1为组合推导；不据此确认医疗缴费基数 |
| [福州2026年7月生育指南](https://ybj.fuzhou.gov.cn/zwgk/zczn/202607/P020260713389546778449.pdf)与[7月医保基数通知](https://ybj.fuzhou.gov.cn/zwgk/tzgg/202607/t20260701_5341143.htm) | 单位生育0.7%、个人不缴；医保含生育基数4579—22893 | 主任务实际阅读扫描版第1页，非仅搜索摘要；[原PDF](payroll-v128-evidence/policy-followup-fuzhou-maternity-202607.pdf)及[页图](payroll-v128-evidence/policy-followup-fuzhou-maternity-page1.png)已保留 |
| [上海2025住房年度通知](https://www.shzfgjj.cn/html/newxxgk/zcwj/gfxwj/228051.html) | 2025年7月起2690—37302，两侧各5%—7%整数；在2026年7月新年度切换前适用 | web抓取超时后以HTTPS读取正文，按实际gb2312字符集解码，[读取文本](payroll-v128-evidence/policy-followup-shanghai-housing-2025.txt)保留；不是仅凭标题年份外推 |
| [南京2025年度通知](https://gjj.nanjing.gov.cn/zwgk/tzgg/202507/t20250703_5600265.html)、[2026年1月最低基数通知](https://gjj.nanjing.gov.cn/zwgk/tzgg/202601/t20260105_5757440.html)、[缴存实施细则](https://gjj.nanjing.gov.cn/zcfg/jcl/202104/t20210428_2900146.html) | 上半年41400上限、1月已调整2660下限；两侧分别到元四舍五入 | 不沿用旧2490下限，不把7月42400提前使用 |
| [江苏省厅四部门基数原通知](https://jshrss.jiangsu.gov.cn/art/2026/10/8/art_77277_11838872.html) | 全省2026-01—12五险基数5025—25127，补差可至年底 | 法定属期与实际补差现金月份分开；不证明费率或逐人金额舍入 |
| [上海2026—2027长护办法](https://www.shanghai.gov.cn/202602bgtwj/20260122/83a46aaeed2448e4a54666ceb3d663df.html) | 职工医保基数0.5%从医保统筹基金按季内部调剂，办法覆盖2026—2027 | 不再增加一份个人或单位工资现金缴费；该条不证明其他所有费用为零 |
| [福州2026年10月长护新方案](https://www.fuzhou.gov.cn/zfxxgkzl/szfbmjxsqxxgk/szfbmxxgk/fzsrmzf/zfxxgkml/xzfggzhgfxwj/202610/P020261026561843661602.pdf) | 0.3%新筹资标准明确自2027-01起；单位0.15%从原医保8%中调整 | 没有提前套入本轮2026政策；2026旧筹资和过渡通道仍待闭合 |

研究者的补充线索分别存于[京沪](payroll-v128-evidence/policy-followup-east.md)、[天津与西安](payroll-v128-evidence/policy-followup-inland.md)、[江苏浙江](payroll-v128-evidence/policy-followup-jiangzhe.md)。这些研究文件的局部“已验证”不代表主任务已独立复核全部字段，也不代表城市通过。

## 新鲜验证记录

| 命令或检查 | 本批结果 | 证据 |
| --- | --- | --- |
| `node --test test/payroll-policy.test.js` | 初轮12项中3项失败，分别复现西安费率、福州合并和历史住房缺段；修后12通过。审查补充未知范围回归再现1失败，最终13通过，退出0 | [先失败记录](payroll-v128-evidence/policy-followup-regression-red.log)；测试文件含独立金额期望 |
| `npm test` | 最终421项通过，退出0 | [最终单元日志](payroll-v128-evidence/policy-followup-unit-final.log) |
| `LISTOOLS_TEST_URL=http://127.0.0.1:56286 npx playwright test test/e2e/payroll-v128.spec.js --project=chromium --workers=2` | 最终16项通过，退出0；含未知范围提示、城市空值、搜索Enter、附加公积金、草稿与退款条件 | [Chrome日志](payroll-v128-evidence/policy-followup-chromium-final.log) |
| 同上，`--project=webkit` | 最终16项通过，退出0 | [WebKit日志](payroll-v128-evidence/policy-followup-webkit-final.log) |
| 独立增量Vite构建 | 退出0，仅输出本轮内部policy-ui-build；保持支持页源码及正式构建检查，未生成发行包 | [构建日志](payroll-v128-evidence/policy-followup-build-final.log) |
| 政策记录检查 | 20城无同险种区间重叠；原已核验记录逐字段不变；没有reference升级 | 主任务读取修改前快照逐项比较，退出0 |
| 本地化 | 50份语言资源均已有非空payroll.unknown；本轮无需新增键 | Node断言退出0；不代表母语审校 |
| `node scripts/package.js` | 退出1，明确由20城政策门槛拒绝；不是“打包通过” | [门槛日志](payroll-v128-evidence/policy-followup-package-gate.log) |

审查发现的未知范围问题先用浏览器复现，再改数据与界面，未以视觉遮挡掩盖错误。[改前截图](payroll-v128-evidence/policy-range-before.png)及[失败日志](payroll-v128-evidence/policy-review-red.log)保留。审查另两项建议已落实到相邻回归：区间匹配必须唯一，医保和生育一起验算，避免只验证单条费率。

首次未提权的Chrome运行15项全部因浏览器启动受沙箱限制而失败，页面未运行，不计作产品通过或产品缺陷；在许可的本地测试环境重新运行后取得上述最终结果。PDF系统OCR调用失败后改为实际读取渲染页图，没有使用失败OCR输出作为政策证据。

## 包与剩余缺口

- 当前政策文件SHA-256为`8f8a460f6d82c735b632f26f66318d5be02f2e301b56a4796b2f5cb83cf7a03c`，已绑定[审核表](payroll-policy-v128-audit.json)。
- 完整闭合仍为0/20城：这是所有险种、当前与历史、固定费用通道和取整均满足的严格门槛，不表示所有现有字段错误。审核表单列了已闭合字段，verifiedMonths没有填写虚假的通过月份。
- 仍有失业降费有效期、部分城市医疗独立基数、长护/大额现金与账户通道、社保分项取整及历史缺段等问题；不能用开源候选或“未找到收费”替代官方依据。
- 前一批`LisTools-1.2.8-source.tar.gz`保持原SHA不变。本批仅生成另名源码归档，**不是可加载扩展或Chrome上传包**；正式`LisTools-1.2.8.zip`仍不存在。
- [本批关键文件清单](payroll-v128-evidence/policy-followup-source-manifest.json)与数据、界面增量diff单独保存，不覆盖上一批快照。

本批没有重新执行完整21入口、37转换、七宽度、原生缩放、离线实际扩展、Edge、Firefox、Safari原生、VoiceOver、物理触屏或微信验收；没有将上一批证据冒充本批通过。正式包门槛闭合后仍需绑定最终产物重跑约定验收。

本轮不提交Git、不发布Release、不上传商店；保留工作区和历史包。临时HTTP服务器及测试进程在收尾时回收。

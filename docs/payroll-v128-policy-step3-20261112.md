# v1.2.8 第三批政策修正与比例校验

日期：2026-11-12。**已验证：广州生效区间修正、公积金整数比例校验和补充公积金错误定位已完成本批回归。未完成：20城2026年1—11月全字段政策闭合，正式Chrome ZIP和可加载发行目录尚未生成。**

本报告只说明本批增量；不把上一批测试或截图计为本批验收。

## 已实施

| 项目 | 修改与证据 | 兼容边界 |
| --- | --- | --- |
| 广州历史下限 | 住房和失业候选的最低基数拆为2026年7—8月2500元、9月起2680元；避免将后公布的下限提前套入7月 | 全部保持reference；不因此开放广州整城自动试算，不升级失业上限或费率 |
| 公积金比例 | 北京、上海、广州住房数据增加1个百分点的步长；城市模式校验个人、单位两侧 | 显式手动参数保留小数比例；无该可选字段的旧规则按原方式处理；不新增依赖或状态框架 |
| 上海补充公积金 | 沿用住房规则的整数步长；个人/单位比例错误关联到各自输入，修正后可正常生成结果与导出 | 新校验暴露出的字段映射问题先用浏览器复现，再修正；不把错误定位到工资栏 |
| 官方来源 | 补入北京医保总负担及个人3元通道、上海住房取整、苏州医保/生育与长护划转证据 | 直接原文与组合推断分别记录，不把局部字段证据升级为整城通过 |

主要代码：[缴费比例校验](../src/tools/payroll/contributions.js:23)、[字段定位](../src/insurance.js:122)、[数据与来源](../src/tools/payroll/cities.json)、[回归](../test/payroll-policy.test.js:91)。原工作区修改、工具能力和历史包保留。

## 本批官方证据

| 来源 | 采用结论 | 限制 |
| --- | --- | --- |
| [广州2026住房年度通知](https://gjj.gz.gov.cn/gg/tzgg/content/post_10879601.html)及其[工作指引](https://gjj.gz.gov.cn/attachment/8/8042/8042764/10879601.docx) | 7月起下限2500、上限41697；5%—12%整数；两侧分别按元四舍五入 | 原通知、DOCX实际读取；不能据此确认广州其他险种 |
| [广州公积金中心9月调整解读](https://gjj.gz.gov.cn/gkmlpt/content/10/10983/post_10983432.html) | 9月起下限2680；8月及以前欠缴仍可按原基数处理 | 适用于既有缴存者，不只新开户；不提前用于7月 |
| [广东失业保险条例](https://rsj.gz.gov.cn/zcfg/flfg/content/post_10241930.html)与[广州9月最低工资通知](https://www.huadu.gov.cn/zzzs/bmts/content/post_10982678.html) | 失业最低基数随当地最低工资，9月下限随之变化 | 组合推断；未取得2026费率续期和上限完整证据，仍reference |
| [北京2026缴存指南](https://gjj.beijing.gov.cn/web/zwfw5/386727/386730/386733/387178/index.html) | 5%—12%整百分数 | 本批直接核对，不能将“在范围内”当成允许小数 |
| [上海2025年度问答](https://www.shzfgjj.cn/html/newxxgk/zcjd/228183.html) | 2026年1—6月两侧各自取元再求和；普通公积金5%—7%整数 | HTTPS原文按声明字符集解码；不是搜索摘要 |
| [上海当前业务资料包](https://www.shzfgjj.cn/images/ywzlb.pdf) | 20261106更新版含2026普通5%—7%、补充1%—5%整数要求及当年限额表 | 下半年逐侧取元由通用办法、图文和表值合读推断；不冒充2026年度问答逐字结论 |
| [北京2025—2026投资指南](https://sw.beijing.gov.cn/zwxx/swxx/202605/P020260512520283489932.pdf) | 当年表列单位医保9.8%、个人2%加3元 | 已读取PDF第122页；总率包含关系和工资代扣通道为前后正式条文组合推断，详见研究附录 |
| [苏州长期医保通知](https://www.suzhou.gov.cn/szsrmzf/bmwj/202312/520891b6afe947829a4fd939c7f82fa7.shtml)、[医保业务表](https://ybj.suzhou.gov.cn/szybj/zgylbx/202509/abe0e40b1d8c478d9a5a753f5521c365.shtml)、[2026长护问答](https://ybj.suzhou.gov.cn/szybj/chxi/202601/936bd897d64a467f90dda67bb1286a82.shtml) | 不含园区：单位医保7%、生育0.8%，个人2%及每月现金5元；长护个人24元/年从账户划转、单位84元/年从已缴医保划转 | 长护不重复增加工资现金或单位成本；旧业务表的2025基数不移作2026基数；特殊账户不足分支未验证 |

研究附录：[北京](payroll-v128-evidence/policy-step3-beijing-close-3.md)、[沪](payroll-v128-evidence/policy-step3-shanghai-close-3.md)、[江苏](payroll-v128-evidence/policy-step3-jiangsu-rates-3.md)。研究者结论未独立回读的部分只作线索，未据此修改数值；本批主任务实际采用的证据及推断边界以本表和[审核表](payroll-policy-v128-audit.json)为准。[响应/PDF哈希](payroll-v128-evidence/policy-step3-source-evidence.json)记录了实际读取文件，临时目录PDF不包含在源码归档中。

## 新鲜验证

| 命令/检查 | 本批实际结果 | 证据 |
| --- | --- | --- |
| `node --test test/payroll-policy.test.js` | 广州先出现2个失败；整数步长先出现1个失败；修后17项全部通过，退出0 | [广州失败](payroll-v128-evidence/policy-step3-red.log)、[步长失败](payroll-v128-evidence/policy-step3-rate-red.log)、[通过](payroll-v128-evidence/policy-step3-rate-green.log) |
| 补充公积金焦点浏览器回归 | 新校验后先复现错误未关联对应输入，退出1；补映射后两侧均可定位、修正后恢复结果 | [失败](payroll-v128-evidence/policy-step3-focus-red.log)、[修前截图](payroll-v128-evidence/policy-step3-supplemental-focus-before.png) |
| `npm test` | 最终425/425通过，退出0 | [日志](payroll-v128-evidence/policy-step3-unit-final.log) |
| `LISTOOLS_TEST_URL=http://127.0.0.1:56287 npx playwright test test/e2e/payroll-v128.spec.js --project=chromium --workers=2` | 最终18/18通过，退出0 | [日志](payroll-v128-evidence/policy-step3-chromium-final.log) |
| 同一测试文件 `--project=webkit` | 最终18/18通过，退出0 | [日志](payroll-v128-evidence/policy-step3-webkit-final.log) |
| 两项新增回归截图 | 2/2通过，退出0；截图检查了错误和恢复后结果 | [日志](payroll-v128-evidence/policy-step3-screenshots.log)、[错误定位](payroll-v128-evidence/policy-step3-housing-rate-error.png)、[恢复后金额](payroll-v128-evidence/policy-step3-housing-rate-corrected.png) |
| 内部Vite构建 | 退出0；仅用于HTTP浏览器回归，未作为发行目录交付 | [构建日志](payroll-v128-evidence/policy-step3-build-final.log) |
| 数据一致性 | 政策SHA与审核表一致；20城同险种无重叠；没有reference升级；原verified数值未改，仅补来源/步长 | 审核表仍blocked，所有verifiedMonths为空 |
| `node scripts/package.js` | 退出1，原因为政策未闭合；不是SHA不匹配。没有生成正式ZIP | [门槛日志](payroll-v128-evidence/policy-step3-package-gate.log) |

内构建只在内存中移除未发布支持页入口，未改Vite源码、未关闭正式构建的支持页资源检查。无新依赖、权限或用户数据存储。代码只读复核未提出本批增量的阻断问题；该复核不能代替浏览器或政策验收。

## 尚未完成的门槛

- **完整通过仍为0/20城。** 这是全险种、全历史月段、固定费用通道及取整全部闭合的严格结果，不表示全部现有字段都错。不能由425项测试通过推成20城政策通过。
- 北京社保逐人逐险金额取分与汇总规则；上海单位失业2026执行期、社保取分及上半年其他险种；苏州失业续期、住房历史段；广州其他险种、上半年住房及特殊缴存规则，仍有缺口。其余城市逐项见审核表。
- 新取得的北京、上海、苏州局部证据不用于开放缺证城市。广州仍拒绝未核验的自动计算，保留明确手动参数能力。
- 本批未重跑全部21入口、37转换、七宽度、原生100%/125%/150%/200%缩放、实际离线扩展、Edge、Firefox、Safari原生、VoiceOver、物理触屏或微信验收。前批结果不冒充本批通过。
- 没有新增文案；现有本地化错误复用。不以此声称完成50语言母语审校。

## 交付边界

本批更新源码、审核表、问题关闭记录及证据；源码归档名称含`source-policy-step3`，**不是Chrome安装包**。已发布版本和旧归档保持不变，正式`LisTools-1.2.8.zip`与正式可加载目录仍未生成。没有提交Git、发布Release或上传商店。临时HTTP服务器和测试进程在收尾时回收。

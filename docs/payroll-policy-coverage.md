# 20 城政策覆盖清单

最近补查：2026-11-06；20城交付门槛仍未完成，详细差异与缺口见 [本轮复核记录](payroll-policy-review-20261106.md)。下表为原有自动可用状态，不能作为本轮完整政策重验通过证明。

原核验日：2026-11-03。此清单区分城市可选与政策核验完成，不能将目录覆盖视为政策正确性验收。未核验、缺失月份必须使用用户明确确认的自定义值，不能静默沿用。

| 城市 | 当前个人端 | 单位端 | 已核验项目 / 6 | 剩余项 |
|---|---|---|---|---|
| 北京 | 原有2026当前段个人试算保留 | 基准工伤费率试算 | 原有标记6 | 2026当年失业0.5%证据已补；完整精确政策重验未完成 |
| 上海 | 2026-07—12 可试算 | 缺失费率，不显示为零 | 6 | 单位失业费率待核对时以未确认显示 |
| 广州 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 深圳 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 杭州 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 南京 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 苏州 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 宁波 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 成都 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 重庆 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 天津 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 武汉 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 长沙 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 合肥 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 郑州 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 西安 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 济南 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 青岛 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 厦门 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |
| 福州 | 需确认自定义参数 | 需官方复核或自定义 | 0 | pension、medical、unemployment、maternity、injury、housing |

## 已确认的上游差异

- 福建养老/失业：闽人社文〔2026〕13号，养老自2026-01，失业自文件印发次月2026-10，4579—22893。旧候选上下限不能沿用。
- 苏州市区普通公积金下限采用社保最低基数5025，特殊减缴/园区条件不能混用。
- 西安大额医疗8元的分担：单位6.4、个人1.6，不能只扣个人端后漏掉单位端。
- 天津个人大额医疗2023文件按季首月21、其他月22；2026未完成复核，不能把260/12当成当地实际月扣。
- 上海2026个人失业0.5%已见当年官方指南；单位0.5%续期未取得完整依据，值为null，单位合计/成本不输出0。

## 来源（按城市及险种保留）

### 北京

- [京人社发〔2026〕7号：2026社保缴费基数](https://banshi.beijing.gov.cn/zcjd/202608/t20260831_428682.html)

- [北京市商务局2026投资服务：社会保险费率](https://sw.beijing.gov.cn/zwxx/swxx/202605/P020260512520283489932.pdf)

- [北京市2026住房公积金缴存标准](https://www.beijing.gov.cn/fwcj/jiage/zxfb/69c68d72e6316310852dceac.html)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 上海

- [上海市2026社保缴费基数](https://rsj.sh.gov.cn/tgsgg_17341/20260818/t0035_1443203.html)

- [2026年继续阶段性降低职工医保费率](https://www.shanghai.gov.cn/gwk/search/content/921e047144694b61b6df8ca0c5ef2cfc)

- [沪公积金管委会〔2026〕3号](https://www.shanghai.gov.cn/gwk/affairs/content/0064@f3d788ec72e9404ebcbf3d27fda98435)

- [上海市2026新就业形态服务指南：个人8%、2%、0.5%](https://www.shanghai.gov.cn/nw17239/20260913/37398bbb63ad4fffa64e0b9deb0f6afc.html)

- [2026工伤基准费率](https://rsj.sh.gov.cn/tjfbz_17568/20260127/t0035_1438278.html)

- [单位养老16%，其他费率须结合后续有效期复核](https://rsj.sh.gov.cn/tdjjf_17554/20250120/t0035_1430072.html)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 广州

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 深圳

- [深圳医保局2026年度医保基数和费率](https://hsa.sz.gov.cn/fzlm/znts/cnyc/content/post_12568243.html)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 杭州

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 南京

- [苏人社发〔2026〕30号：全省2026社保基数](https://www.js.gov.cn/art/2026/10/9/art_60095_11839273.html)

- [宁金管规〔2026〕2号：公积金基数](https://gjj.nanjing.gov.cn/zwgk/tzgg/202607/t20260717_5878580.html)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 苏州

- [苏人社发〔2026〕30号：全省2026社保基数](https://www.js.gov.cn/art/2026/10/9/art_60095_11839273.html)

- [苏州市2026公积金基数及比例（市区，不含特殊园区）](https://www.suzhou.gov.cn/szsrmzf/zwgg/202607/501539493f89439aa33768e34a069914.shtml)

- [苏州市区职工医保、生育费率及5元共济基金](https://ybj.suzhou.gov.cn/szybj/zgylbx/202401/9c566a5376914921b85ed2ac9a5eb8eb.shtml)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 宁波

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 成都

- [四川省2026三项社会保险缴费基数](https://chinajob.mohrss.gov.cn/c/2026-09-11/602828.shtml)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 重庆

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 天津

- [天津2026社保基数：9月起](https://www.tj.gov.cn/sy/tjxw/202608/t20260823_7356881.html)

- [天津职工大额医疗按季度首月21元、其余月22元（2023答复，2026待复核）](https://www.teda.gov.cn/contents/220/29200.html)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 武汉

- [武汉职工医保及生育合并费率](https://ybj.wuhan.gov.cn/zwgk_52/ybdt/mtdt/202202/t20220214_1922074.shtml)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 长沙

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 合肥

- [安徽省2026社会保险基数上下限](https://rsj.huaibei.gov.cn/gzdt/gfxwj/58052711.html)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 郑州

- [2026河南社保缴费基数（7月起）](https://www.zgwg.gov.cn/contents/65386/472924.html)

- [郑公积金〔2026〕18号](https://zzgjj.zhengzhou.gov.cn/zxindt/10197372.jhtml)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 西安

- [西安市2026职工医保费率及大额医疗8元分担](https://www.xa.gov.cn/gk/zcfg/zcjd/zcwd/shbx/636a1abef8fd1c4c212759a3.html)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 济南

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 青岛

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 厦门

- [闽人社文〔2026〕13号：养老及失业基数](https://rst.fj.gov.cn/zw/ztzl/zxzt/sbhm/zxsl/zcfg/202610/t20261008_7221778.htm)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

### 福州

- [闽人社文〔2026〕13号：养老及失业基数](https://rst.fj.gov.cn/zw/ztzl/zxzt/sbhm/zxsl/zcfg/202610/t20261008_7221778.htm)

- [福州市2026医保基数（7月起）](https://ybj.fuzhou.gov.cn/zwgk/tzgg/202607/t20260701_5341143.htm)

- [MIT开源候选值，未完成官方复核](https://github.com/weante/city-salary/blob/8abd9cdd797aab008d410feb5690d4ee072d33cc/skills/city-salary/assets/calculator.html)

## 历史月份与期限

北京已补齐2026年1—6月与7—12月分段；其他城市的当前核验范围不构成2026全年完整覆盖。自动年度计算逐月匹配；缺少任何月份即要求实际缴费，不用当前参数乘12。候选from/to仅用于阻断范围外调用，不代表待核验值已具法定效力。后续仍须逐城完成基数、费率、固定附加、长期护理、生育合并、取整、参保类型与历史区间的官方复核。

## 交付结论

目录20城；当前可直接试算的个人参数为北京、上海。北京单位端采用一类工伤基准试算；上海单位失业费率保持未知。其余18城未完成整套政策核验，默认禁止直接按候选参数生成结果，必须由用户明确确认自定义参数。此项不计作20城政策全部验收通过。

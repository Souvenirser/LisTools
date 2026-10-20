# 开源组件

| 组件 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| [vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) | 3.13.0 | ISC | 文本/树形视图、搜索、展开折叠与大文档渲染 |
| [lossless-json](https://github.com/josdejong/lossless-json) | 4.3.1 | MIT | 解析和序列化时保留数字精度及原始数字表示 |
| [Microdiff](https://github.com/AsyncBanana/microdiff) | 1.6.0 | MIT | JSON 结构差异、字段路径与新增/删除/修改分类 |
| [CodeMirror Merge](https://github.com/codemirror/merge) | 6.12.2 | MIT | 双栏、行内差异高亮、未变化行折叠；配合 CodeMirror 6 的 JSON 语言、搜索与虚拟渲染组件 |
| [JsDiff / diff](https://github.com/kpdecker/jsdiff) | 9.0.0 | BSD-3-Clause | 文本按行比较，减少大文本稀疏变化被合成整块的情况；行内高亮继续使用 CodeMirror |
| [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) | 3.3.1 | MIT | Diff 的严格 JSON visitor，原始数字 token 与错误位置；禁用注释和尾逗号 |
| [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) | 1.0.6 | MIT | 时间戳双向转换、IANA 时区、毫秒精度及夏令时歧义拒绝；使用局部 implementation 入口 |
| [Radix Colors](https://github.com/radix-ui/colors) | 3.0.0 | MIT | 语义配色使用 Slate、Blue、Teal、Green、Amber、Red 色阶 |
| [i18next](https://github.com/i18next/i18next) | 26.4.2 | MIT | 本地语言包、语言切换、参数插值与英文回退 |
| [Vite](https://github.com/vitejs/vite) | 8.3.4 | MIT | 本地开发与构建 |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.2 | MIT | 扩展 ZIP 打包及转换工作台的同步流压缩 |

| [@scure/base](https://github.com/paulmillr/scure-base) | 2.4.0 | MIT | Base 系列与 Hex 字节编码 |
| [entities](https://github.com/fb55/entities) | 8.1.0 | BSD-2-Clause | HTML/XML 实体 |
| [jsesc](https://github.com/mathiasbynens/jsesc) | 3.1.0 | MIT | JSON/Unicode 字符串转义 |
| [@kayahr/text-encoding](https://github.com/kayahr/text-encoding) | 2.2.0 | MIT | 传统字符集编码及本地映射表 |
| [yaml](https://github.com/eemeli/yaml) | 2.9.1 | ISC | YAML AST 与自定义无损数值标量 |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | 5.11.2 | MIT | XML 保序结构、校验与构建 |
| [PapaParse](https://github.com/mholt/PapaParse) | 5.7.0 | MIT | CSV/TSV 解析与序列化 |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) | 2.4.0 | MIT | 摘要、分块 MD5 与 HMAC-MD5 |
| [crc-32](https://github.com/SheetJS/js-crc32) | 1.2.2 | Apache-2.0 | CRC32 校验 |
| [change-case](https://github.com/blakeembrey/change-case) | 5.4.4 | MIT | 命名风格转换 |
| [decimal.js](https://github.com/MikeMcl/decimal.js) | 10.6.0 | MIT | 高精度单位计算 |
| [colord](https://github.com/omgovich/colord) | 2.10.0 | MIT | 含 alpha 的颜色转换 |
| [Cloudflare Speedtest](https://github.com/cloudflare/speedtest) | 1.14.2 | MIT | 手动 HTTP 测速；关闭测量与结果上报、凭证及 TURN 阶段 |
| [Croner](https://github.com/hexagon/croner) | 10.0.1 | MIT | 离线 Cron 日期计算；仅创建暂停实例，不执行任务 |
| [cRonstrue](https://github.com/bradymholt/cRonstrue) | 3.32.0 | MIT | Cron 自然语言说明 |
| [Nano ID](https://github.com/ai/nanoid) | 6.0.2 | MIT | 基于 Web Crypto 的均匀字符采样与词表索引 |
| [regexpp](https://github.com/eslint-community/regexpp) | 4.12.2 | MIT | JavaScript 正则语法错误定位；匹配与替换使用浏览器原生 RegExp |
| [EFF Large Wordlist](https://www.eff.org/dice) · Joseph Bonneau | 2016-07-18 | CC BY 4.0 | 本地 7776 词口令词表；原词表保留不改，随扩展附署名及完整许可 |

构建会把实际打包依赖的许可证正文写入 `dist/THIRD_PARTY_LICENSES.md` 并包含在 ZIP 中；打包脚本补齐 Worker 独占依赖的许可。依赖版本由 package-lock.json 固定。

LisTools 的 Li 字母图标为本项目原创几何字母标识。

转换依赖的间接组件（包括 fast-xml-builder、@nodable/entities 等）由锁文件固定；打包脚本递归收集 Worker 依赖的许可证及 NOTICE。npm 包遗漏的许可正文保存在 [licenses/](./licenses/README.md)，构建不联网。上游版权署名按许可证完整保留。

## v1.3.0 新增工具依赖

| 组件 | 固定版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| [math.js](https://github.com/josdejong/mathjs) | 15.2.0 | Apache-2.0 | 表达式与高精度单位计算 |
| [qrcode](https://github.com/soldair/node-qrcode) | 1.5.4 | MIT | 二维码生成 |
| [jsQR](https://github.com/cozmo/jsQR) | 1.4.0 | Apache-2.0 | 二维码识别 |
| [Cropper.js](https://github.com/fengyuanchen/cropperjs) | 2.3.0 | MIT | 裁剪、旋转与翻转交互 |
| [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) | 2.0.2 | MIT | 图片压缩；禁用库内 Blob/CDN Worker |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | MIT | PDF 读写与页面操作 |
| [nzh](https://github.com/cnwhy/nzh) | 1.0.14 | BSD-2-Clause | 人民币简繁大写 |

Playwright 为开发测试依赖，不进入扩展运行时。打包许可收集按实际依赖目录解析并区分同名不同版本，收集实际使用的嵌套依赖；构建不联网。面试邀请功能及其专用依赖 ics 已移除。

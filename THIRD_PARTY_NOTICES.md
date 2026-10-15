# 开源组件

LisTools 为独立项目，不包含 FeHelper 源码。

| 组件 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| [vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) | 3.13.0 | ISC | 文本/树形视图、搜索、展开折叠与大文档渲染 |
| [lossless-json](https://github.com/josdejong/lossless-json) | 4.3.1 | MIT | 解析和序列化时保留数字精度及原始数字表示 |
| [Microdiff](https://github.com/AsyncBanana/microdiff) | 1.6.0 | MIT | JSON 结构差异、字段路径与新增/删除/修改分类 |
| [CodeMirror Merge](https://github.com/codemirror/merge) | 6.12.2 | MIT | 双栏、行内差异高亮、未变化行折叠；配合 CodeMirror 6 的 JSON 语言、搜索与虚拟渲染组件 |
| [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) | 3.3.1 | MIT | Diff 的严格 JSON visitor，原始数字 token 与错误位置；禁用注释和尾逗号 |
| [Vite](https://github.com/vitejs/vite) | 8.3.4 | MIT | 本地开发与构建 |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.2 | MIT | 构建时生成扩展 ZIP |

构建会把实际打包依赖的许可证正文写入 `dist/THIRD_PARTY_LICENSES.md` 并包含在 ZIP 中；打包脚本补齐 Worker 独占依赖的许可。依赖版本由 package-lock.json 固定。

LisTools 的 Li 字母图标为本项目原创几何字母标识。

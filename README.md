# LisTools

开源的 Chrome 开发者工具箱。提供 JSON 解析、美化和双栏差异对比，复用开源编辑器、解析器与差异组件。

项目采用 [MIT 许可证](./LICENSE)，欢迎通过 [Issue](https://github.com/Souvenirser/LisTools/issues) 反馈问题，通过 Fork 和 Pull Request 提交改进，详见 [贡献指南](./CONTRIBUTING.md)。

## 安装到 Chrome

需要 Chrome 120 或更新版本。

1. 从 [Releases](https://github.com/Souvenirser/LisTools/releases/latest) 下载 `LisTools-1.0.0.zip` 并解压到固定目录。
2. 在 Chrome 地址栏打开 `chrome://extensions`，开启右上角的 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择解压后直接包含 `manifest.json` 的目录。
4. 固定 LisTools 图标，点击后打开工具箱，左侧可切换工具。

GitHub 的 **Source code** 压缩包是源码，需要按下文构建后加载 `dist/`。本项目目前通过 GitHub 分发扩展包，尚未上架 Chrome 应用商店；手动安装的版本需要自行下载更新并在扩展管理页重新加载。

## 在 IntelliJ IDEA 中开发

使用 Node.js 22.12+ 或 24+（本地验证环境为 Node.js 26）。先获取源码：

```bash
git clone https://github.com/Souvenirser/LisTools.git
cd LisTools
```

在 IDEA 中选择 **Open** 打开项目目录，在项目终端运行：

```bash
npm ci
npm run dev
```

打开终端显示的本地地址即可开发。项目不依赖 Java、Maven 或 Gradle，不需要提交 `.idea` 配置。

## 首版功能

- 粘贴 JSON、导入或直接拖入本地文件，美化、压缩、2/4 空格缩进、自动美化。
- 文本和树形视图、节点展开/折叠、全部展开/折叠、全文搜索。
- 复制全文、下载完整 JSON；折叠和视图切换不会截断导出内容。
- 大整数、长小数、指数与负零保留原始数字表示；错误给出行列和输入定位。
- 解析任务运行于 Worker，新输入会取消旧任务；错误或空输入不会残留上一次结果。
- 全部资源打包到扩展本地；不上传、不存储输入，不申请网页访问权限。

编辑器使用虚拟渲染，屏幕上的 DOM 行数不代表数据总量。树形视图的大数组分段展示，点击组件的更多项提示可继续浏览；超长字符串也可继续展开。文本视图支持完整搜索。全文复制和下载始终使用完整结果。

超过 2,000 个节点或 100 万字符的结果，在树形视图点击「全部展开/折叠」会自动切换到文本视图执行。开源组件的树形视图不对完全展开的全部节点做虚拟渲染，这样可以避免大量 DOM 卡住页面；树形单分支展开保持可用。

“合并”按收起/折叠节点实现。当前不包含两份 JSON 的数据合并、二维码或时间戳模块。

JSON 文件可拖到工作台任意位置，松开后自动读取并美化。文件导入不受「自动美化」开关影响，该开关仅控制键入/粘贴时的自动处理。拖入时显示落点提示，离开或松开后自动收起；一次支持一个文件。文件内容仍使用相同的严格 JSON 解析器校验，非法内容显示错误位置。

## JSON 对比

从左侧「JSON 对比」进入。左右两侧可粘贴、导入或分别拖入文件；两侧文件读取完成后自动对比。键入后点击「开始对比」，或按 Cmd/Ctrl + Enter。顶部显示差异总数及新增、删除、修改数量，原值标红、新值标绿，行内变化加深标色。

使用「上一处 / 下一处」或输入差异编号后按 Enter 定位，旁边显示 JSON Pointer 字段路径。默认收起未变化行，取消勾选可浏览全文；两侧都支持搜索与节点折叠。修改输入会清除旧结果，计算期间可以取消，交换左右会重新对比。

计数按 JSON 字段路径：一个值变化算一处，新增或删除整个节点各算一处。忽略排版及对象键顺序，数组按索引比较，插入/移动元素可能使后续多个索引产生差异。大整数和长小数按精确数值比较，`1`、`1.0`、`1e0` 相同；结果按统一键顺序展示，等价数值沿用首次遇到的写法。

结构比较和文本 diff 均在 Worker 执行，虚拟编辑器按可见区域渲染。复杂文本差异有计算预算，可能合并为较粗的高亮块；顶部字段计数仍然精确。输入、解析树、格式化文本和差异位置都需占用内存，不承诺无限大小或任意深度。本次公开版本的验证范围见 [发布验证记录](./docs/release-verification.md)。

## 构建和加载 Chrome 扩展

```bash
npm test
npm run build
```

构建输出：

- `dist/`：可直接加载的 Chrome Manifest V3 扩展。
- `releases/LisTools-1.0.0.zip`：根目录包含 manifest.json 的扩展发布包。

Chrome 打开 `chrome://extensions`，开启开发者模式，点击 **加载已解压的扩展程序**，选择本项目的 `dist`。固定 LisTools 图标，点击图标打开 JSON 工作台。无需使用 Chrome 的“打包扩展程序”功能。

本地更新代码后重新运行 `npm run build`，再在 Chrome 扩展管理页点击 LisTools 的重新加载按钮。未来发布商店时持续使用同一个扩展条目、递增 package.json 与 manifest.json 的版本并上传新的 ZIP，现有用户才能收到该条目的更新。GitHub 本身不会自动更新商店用户。

## 大文件边界

采用开源编辑器现有的大文档与折叠实现，没有退回无法折叠的纯文本容器。格式化文本超过 50 × 1024 × 1024 个字符单元时会显示组件的大文件提示，用户可选择树形视图。该提示按字符长度判断，不按输入文件字节数判断，也不是性能保证。实际可处理大小依赖设备内存、结构和字符串长度。异常深的 JSON 仍受解析器递归限制。

输入要求为严格 JSON：不接受注释和尾逗号；重复键会报错，避免字段被静默覆盖。UTF-8 文件可直接导入。

## 项目结构

```text
src/main.js                  工作台及浏览器交互
src/tools/json/core.js       无损解析与序列化
src/tools/json/controller.js 可取消的任务生命周期
src/tools/json/worker.js     Worker 入口
src/diff.js                  JSON 对比页面与双栏编辑器
src/tools/json-diff/core.js  严格解析、精确结构比较与 Worker 文本 diff
src/tools/json-diff/         对比 Worker 与可取消控制器
public/manifest.json        Chrome 扩展清单
public/background.js        图标点击入口
test/                       核心与任务切换回归
docs/                       公开示例截图与发布验证记录
```

后续工具可放到 `src/tools/`，复用工作台导航。开源来源与许可证见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

本次公开版本的验证范围见 [发布验证记录](./docs/release-verification.md)。

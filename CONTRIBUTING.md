# 参与 LisTools

欢迎反馈问题、改进文档和提交代码。项目采用 MIT 许可证，贡献代码也按该许可证分发；使用第三方代码时请保留其许可证和来源说明。

## 反馈问题

使用工具页或工具栏弹窗底部的“问题反馈 ↗”，在 GitHub 登录并提交反馈表单。也可以直接访问 [Issues](https://github.com/Souvenirser/LisTools/issues)。工具、版本和界面语言由插件预填；请说明问题或建议，并按需补充复现步骤、预期结果、浏览器版本和操作系统。

反馈、附件及提交者的 GitHub 账号会公开显示。请使用可公开的脱敏或合成样例，不要上传公司内部资料、账号密码、密钥、真实业务数据或个人敏感信息。插件不会自动附加输入内容、文件或日志。

维护者将 `.github/ISSUE_TEMPLATE/feedback.yml` 合并到默认分支 `main` 后启用表单，并在仓库设置 **Watch → Custom → Issues**，在个人通知设置中开启 Watching 的 On GitHub 和 Email。请使用授权测试账号手动提交合成反馈验证 Issue 和通知；自动化测试不向 GitHub 发布内容。

## 提交代码

1. Fork [Souvenirser/LisTools](https://github.com/Souvenirser/LisTools)，克隆自己的 Fork 并新建分支。
2. 使用 Node.js 22.12+ 或 24+，运行 `npm ci` 和 `npm run dev`。
3. 复用现有模块或合适的开源组件，只修改当前问题需要的内容。新增依赖时同步更新锁文件和第三方组件说明。
4. 修复问题或改变功能时增加对应回归测试，运行 `npm test` 和 `npm run build`。
5. 按 README 在目标浏览器加载构建后的 `dist/`，检查受影响的功能；跨浏览器修改运行 `npm run test:cross-browser`，Edge 使用 `npm run test:edge`。在 Pull Request 中分别写明页面、实际扩展安装及签名的验证结果。
6. 提交到自己的分支，向本仓库 `main` 发起 Pull Request，由维护者审核合并。

请提交源码、测试和必要文档。`node_modules/`、`dist/`、`releases/`、IDE 配置、本地环境变量和原始验收数据不提交。

## 扩展约束

JSON 输入仅在本地处理，不上传或自动保存；资源随扩展打包，保持 Manifest V3 和现有 CSP。涉及权限或数据处理方式的变化，请先在 Issue 说明用途。发布前保持 `package.json` 和 `public/manifest.json` 版本一致。

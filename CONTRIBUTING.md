# 参与 LisTools

欢迎反馈问题、改进文档和提交代码。项目采用 MIT 许可证，贡献代码也按该许可证分发；使用第三方代码时请保留其许可证和来源说明。

## 反馈问题

在 [Issues](https://github.com/Souvenirser/LisTools/issues) 提供 Chrome 版本、LisTools 版本、复现步骤、预期行为和实际结果。使用可公开的最小 JSON 样例，请勿上传真实业务数据、密钥或个人信息。

## 提交代码

1. Fork [Souvenirser/LisTools](https://github.com/Souvenirser/LisTools)，克隆自己的 Fork 并新建分支。
2. 使用 Node.js 22.12+ 或 24+，运行 `npm ci` 和 `npm run dev`。
3. 复用现有模块或合适的开源组件，只修改当前问题需要的内容。新增依赖时同步更新锁文件和第三方组件说明。
4. 修复问题或改变功能时增加对应回归测试，运行 `npm test` 和 `npm run build`。
5. 在 `chrome://extensions` 加载构建后的 `dist/`，检查受影响的功能；在 Pull Request 中写明改动原因和实际验证结果。
6. 提交到自己的分支，向本仓库 `main` 发起 Pull Request，由维护者审核合并。

请提交源码、测试和必要文档。`node_modules/`、`dist/`、`releases/`、IDE 配置、本地环境变量和原始验收数据不提交。

## 扩展约束

JSON 输入仅在本地处理，不上传或自动保存；资源随扩展打包，保持 Manifest V3 和现有 CSP。涉及权限或数据处理方式的变化，请先在 Issue 说明用途。发布前保持 `package.json` 和 `public/manifest.json` 版本一致。

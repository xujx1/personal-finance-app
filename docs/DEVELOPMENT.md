# 开发与验证

**中文** · [English](DEVELOPMENT.en.md) · [文档导航](README.md)

## 环境与启动

建议 Node.js 24 与 npm，依赖以 `package-lock.json` 为准。`package.json` 声明最低 Node 22.13.0；测试使用原生 SQLite 和 TypeScript，优先采用已验证的 Node 24 环境。

```sh
npm ci
npm run dev:local
```

UI 默认 `http://127.0.0.1:5173`，API 默认 `http://127.0.0.1:5174`。数据放在 `.sites-runtime/local-qa/`；默认复用最近的 `simulated-*.sqlite`，首次创建空模拟账本。该适配器的身份是模拟管理员，不验证生产登录，不能部署到公网。

需要独立演示时显式指定新文件名，避免复用已有开发账本：

```sh
LOCAL_QA_DATABASE=qa-docs-example.sqlite npm run dev:local
```

当前 ChatGPT + MCP 流程不需要旧站内模型或搜索 Key。确需运行时配置时，从空值 `.env.example` 创建自己的本地文件，不提交实际值。正式所有者、数据库与附件加密配置见[部署资源](DEPLOYMENT-RESOURCES.md)。

## 检查命令

| 命令 | 范围 |
| --- | --- |
| `npm test` | 全部 Node 单元、接口和服务端测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 打包通用工作流安装器并构建正式工程 |
| `npm run test:e2e:local` | ChatGPT迁移本地浏览器用例，结构化AI输出为样本 |
| `npm run test:e2e:onboarding` | 独立建档浏览器用例 |
| `npm run test:e2e:approval-sharing` | 预算分享、本人审批与家庭隔离 |
| `npm run test:e2e:mcp-amend` | 同ID续改与执行安排 |

浏览器脚本需要 Chrome 和 Playwright，默认读取 `work/calendar-qa/node_modules`。可将已有模块目录作为参数传入，例如 `npm run test:e2e:onboarding -- /absolute/path/to/node_modules`。不要把个人路径或依赖缓存提交进仓库。

网络、监听端口或浏览器受限时记录 `blocked` 或 `not_run`，不要把旧截图当新通过。本轮实际执行情况见[校验记录](PUBLIC-DATA-REVIEW-2026-11-13.md)。

## 安全定向检查

```sh
node --test tests/source-export.test.mjs tests/migration-security.test.mjs tests/family-route.test.mjs tests/family-api-isolation-v15.test.mjs tests/financial-privacy.test.mjs tests/mcp.test.mjs tests/attachments.test.mjs tests/backup.test.mjs
```

这些是隔离测试，不能认证生产 D1、边缘身份、真实第二账号或 ChatGPT 客户端。`scripts/export-source.py` 提供源码打包白名单与环境值清空，但不识别任意文档中的个人内容；GitHub直接公开Git仓库也不经过这个导出器。

## 部署边界

生产使用 Sites 的受信任身份、家庭权限与 D1 绑定。应用读取平台认证头；自部署时须配置可信认证边缘并清除客户端伪造头，不能仅暴露应用服务。本地 QA 身份和 `local/server.mjs` 不属于生产认证方案。

使用现有部署的合法项目身份，私下保存元数据；不要覆盖为文档示例或复用别人的数据库。使用增量迁移，不重写已应用迁移。发布后另验匿名、非成员、移除成员、跨家庭读取/写入与本人审批，不向生产写测试流水。

本次维护只更新文档及演示图片，不修改业务逻辑、数据库、部署访问范围或发布状态。

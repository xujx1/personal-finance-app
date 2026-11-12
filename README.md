# 家庭财务中心

同一Sites站点的Vinext / React / TypeScript / D1项目。现行开发分支为`codex/chatgpt-mcp-skills`。AI消费、投资、图片理解、周期归并和月度AI总结由ChatGPT及Skill完成；MCP提供受控财务查询和六类待核对草稿，网站保留编辑、家庭审批、真实记账和展示。资产页支持基金股票首次买入、增持和清仓，按实际成交与手续费同步银行现金；不执行银行券商交易。

先读docs/requirements-chatgpt-mcp-2026-11-12.md（当前迁移）、docs/requirements-consolidated-2026-11-12.md（全量业务规则）和docs/CHATGPT-MCP-SKILLS.md（使用与接续）。旧阶段文档在顶部注明历史，不作为当前配置要求。

开发使用Node24、锁文件依赖。验证：`npm run typecheck`、`npm test`、`npm run test:e2e:local`。E2E需要Chrome和Playwright，默认查找work/calendar-qa/node_modules，可通过脚本位置参数指定已有Playwright目录；不需要模型或搜索Key，测试使用独立qa-*.sqlite。`npm run skills:sync`同步内置Skill备份和安装器源。

站点：https://xu-family-finance-20261111.shady-gnat-0277.chatgpt.site。保持同一project_id和原访问范围，使用Sites原生发布；local/server.mjs的模拟身份仅用于本机，不能用作公网服务。源码包不含数据库、密钥、用户截图或依赖缓存。

# 家庭财务中心

同一Sites站点的Vinext / React / TypeScript / D1项目。现行开发分支为`codex/chatgpt-mcp-skills`。AI消费、投资、图片理解、周期归并和月度AI总结由ChatGPT及Skill完成；MCP提供受控财务查询和六类待核对草稿，网站保留编辑、家庭审批、真实记账和展示。资产页支持基金股票首次买入、增持和清仓，按实际成交与手续费同步银行现金；不执行银行券商交易。

新增 Codex 一条 npx 命令安装六个动态 Skill 入口；生活日历直接取消并同步预算取消，保留真实付款与历史。周期 MCP 支持完整流水归并及人工核对。

最新支持家庭自定义资产类型、目标下拉增删和头像账户菜单，详见docs/requirements-asset-types-2026-11-12.md；真实ChatGPT新会话验收见docs/CHATGPT-NEW-CHAT-TEST.md。

先读docs/requirements-npm-calendar-2026-11-12.md（最新增量）、docs/requirements-chatgpt-mcp-2026-11-12.md（当前迁移）、docs/requirements-consolidated-2026-11-12.md（全量业务规则）和docs/CHATGPT-MCP-SKILLS.md（使用与接续）。旧阶段文档在顶部注明历史，不作为当前配置要求。

开发使用Node24、锁文件依赖。验证：`npm run typecheck`、`npm test`、`npm run test:e2e:local`。E2E需要Chrome和Playwright，默认查找work/calendar-qa/node_modules，可通过脚本位置参数指定已有Playwright目录；不需要模型或搜索Key，测试使用独立qa-*.sqlite。`npm run skills:sync`同步内置Skill备份和安装器源；`npm run skills:pack`生成只含通用入口的公开npm包，build时自动生成。`npm run test:e2e:npm-calendar`验证安装、取消及周期全链路。

站点：https://xu-family-finance-20261111.shady-gnat-0277.chatgpt.site。保持同一project_id和原访问范围，使用Sites原生发布；local/server.mjs的模拟身份仅用于本机，不能用作公网服务。源码包不含数据库、密钥、用户截图或依赖缓存。

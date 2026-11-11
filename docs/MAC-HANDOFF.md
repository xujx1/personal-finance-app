# Mac接续开发：先读这份

交接日期：2026-11-11。用户已明确今天停止代码开发，只更新文档和源码快照；从Mac打开后按最新需求继续，不要回到早期原型重做。

## 本包是什么

- 当前完整项目快照，包含应用、服务端、数据库DDL/迁移、测试、方案和接续说明；不是“所有功能已完成”的发布版。
- 正式工程：Sites Vinext、React19、TypeScript、Cloudflare D1。离线开发适配器：Node原生SQLite + React页面 + 同一服务端领域逻辑。
- 本包不带真实账本、截图、附件原文、API密钥、OAuth凭据、node_modules或本地缓存。
- 现有Site project_id保存在`.openai/hosting.json`，继续使用同一个Site；不要创建第二个Site。
- 目前尚未正式发布，没有已验证可访问的线上版本。

## 阅读顺序

1. `docs/requirements-latest.md`：最后确认的产品口径。
2. `docs/superpowers/plans/2026-11-11-execution-checklist.md`：60条跟踪项，包含开发/验证/交付项及后续细化，不是60个互不重叠的独立页面。
3. `docs/TECHNICAL-DESIGN-v2.md`：统一AI节点、清单预算、流式输出、公网身份/家庭隔离、历史弹窗及数据库设计。
4. 本文件的验证边界与未完成事项，然后再读代码。

早期README和在线方案可能记录第一阶段旧状态。以包内最新文档为准；“单独持仓研究面板”“手工记一笔”“自动财务依据卡片”不再是最终设计。

## 在Mac本地启动

建议Node 24（当前验证版本24.19.0）及可访问npm的网络。先解压到个人目录，不依赖公司的D盘目录。

```sh
cd /你的个人目录/personal-finance-app
node --version
npm ci
npm test
cp .env.example .env.local
```

仅按需要编辑`.env.local`，不要提交真实值。兼容API需要NEW_API_BASE_URL/NEW_API_MODEL/NEW_API_KEY；视觉需要另配NEW_API_VISION_MODEL；联网研究可用TAVILY_API_KEY或受支持的ChatGPT Web搜索。

本地SQLite开发路线：

```sh
node local/start.mjs --modules "$PWD/node_modules"
```

UI为http://127.0.0.1:5173，API为http://127.0.0.1:5174。默认从`.sites-runtime/local-qa`复用最近的`simulated-*.sqlite`，第一次自动创建空模拟账本。这个目录不在源码包中。

注意：本地适配器在Windows用预装Vite5/React18验收；Mac安装的是正式锁文件中的Vite8/React19，因此这条适配器启动路线也需要实际复验，不能假定已跨平台验证。如果不兼容，按下面正式框架路线排查，不把Windows路径硬编码进代码。

正式框架路线：

```sh
npm run db:generate
npm run typecheck
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_personal_ledger.sql
npm run dev
```

迁移命令只针对本地D1。当前环境没有完成正式typecheck/build，Mac需要先验证这些命令。不要重写已应用的0000迁移或把local/server.mjs作为公网生产入口；它使用本地模拟身份。

### 可选本地QA依赖

若正式依赖的本地适配器不兼容，可在本机另建仅放第三方依赖的目录：

```sh
mkdir -p "$HOME/pfc-qa-deps"
cd "$HOME/pfc-qa-deps"
npm init -y
npm install vite@5.4.21 react@18.3.1 react-dom@18.3.1 lucide-react@0.300.0
cd /你的个人目录/personal-finance-app
node local/start.mjs --modules "$HOME/pfc-qa-deps/node_modules"
```

这不会替换正式Sites依赖，也不需要复制PanWatch业务源码。

## 当前验证结果

| 验证 | 已知结果 | 边界 |
| --- | --- | --- |
| `npm test --silent` | 本次交接前重跑107项通过、0失败 | Node/SQLite、注入网络响应；不是外部服务联通证明 |
| `local/assistant-split-e2e.mjs` | 最近9项通过、0页面异常 | 使用明确API夹具；包括总览简化、去手工记账、后台依据卡片隐藏 |
| `local/full-e2e.mjs` | 最近11项通过、0页面异常 | 隔离SQLite与模拟模型；含预算付款退款、预付款、变现转账、图片历史核对、资产目标、计划提醒和加密恢复；晚于该次验证的新流式改动未重新跑整链路 |
| `local/history-e2e.mjs` | 0通过/1失败（首断言） | 预先写好的新需求用例；历史弹窗尚未实现，不是已通过测试 |
| TS/TSX语法检查 | 最近检查107个文件无语法错误 | 检查时间早于最后新增stream/expense-plan文件；不等于完整typecheck |
| 正式Vinext/React19构建、托管D1、真实OAuth/模型/行情 | 未通过完整验证 | npm访问EACCES、源仓库连接失败；模型和OpenAI实际出站请求未到HTTP鉴权层 |

浏览器验证脚本当前默认Chrome channel和Windows已装依赖路径由CLI传入。Mac需安装Playwright和Chrome，或之后调整浏览器启动配置；脚本没有自动跨平台浏览器安装器。

## 今天最后的未完成改动：优先做

1. **AI投资统一主交互**：当前仍是资产登记主表单 + 独立ResearchWorkspace；最新要求是一个问题入口，理财研究、查预算、持仓和行情都成为内部节点，并stream输出。
2. **消费自动分类与可编辑清单**：`src/domain/expense-plan.mjs`及3项领域测试已完成；尚未接到UI、研究结构化返回和最终AI审批。当前页面类别仍手选，旅行生成后仍直接继续评估，没有最终清单编辑确认。
3. **旅行/购物节点**：行程、交通/住宿/餐饮等数量单价联动，购物规格和比价引用；调整清单后重算，再AI复核并本人确认预算。
4. **历史评估弹窗**：目前仍在页面底部展示历史列表。按history-e2e实现建议区上方按钮、小弹窗、每页5条、模糊搜索、选中恢复、Esc和焦点管理。
5. **流式整链路**：消费SSE和OAuth只读工具协议已有测试，但当前投资研究路由还是完整JSON；补齐统一工具、超时、取消和中断回归。

不要把上述文档中的最终目标误当成现有实现。用户要求的所有新预算只能从AI助手进入；规则测算不能当AI批准。现金流水不恢复手工“记一笔”，银行余额不通过随意校正扣减。

## 代码定位

| 文件 | 职责 |
| --- | --- |
| components/FinanceApp.tsx | 导航、总览、资产/贷款、预算列表、流水和设置的接线 |
| components/AdvisorPanel.tsx | 消费/资产登记输入、建议结果、已开始接入的SSE客户端 |
| src/server/advisor-http.ts | 可信账本参数、模型预算重算、配额、结构校验、SSE响应 |
| src/server/financial-tools.ts | 当前5个只读财务工具；预算/持仓/行情统一工具待补 |
| src/server/research-http.ts | 兼容API+搜索或ChatGPT Web研究草稿；目前不是最终单入口交互 |
| src/domain/expense-plan.mjs | 类别预识别与旅行/购物清单精确合计，尚未接入主流程 |
| src/server/finance-store.ts | 核心命令、原子入账、版本/幂等和文档保存 |
| src/server/finance-extensions.ts | 转账/资产买卖、周期规则、图片确认、预付款、目标和提醒等扩展 |
| src/server/chatgpt-service.mjs | OAuth注册/刷新、目录、Responses流和只读工具循环 |
| src/server/image-http.ts | 视觉候选提取与去重，不直接记账 |
| src/server/backup-service.ts | 一致性加密导出与新dataset原子恢复 |
| src/server/attachment-http.ts | 明确保存的小票据加密上传/下载 |
| src/server/jobs.ts | 周期检查与站内提醒；正式调度还需配置 |
| db/ledger.sql | 不可变过账、按币种平衡、现金非负及命令守卫 |

## 凭据与真实数据

- 现有API key没有进入源码包。在Mac重新安全配置，不能从本包恢复密钥。
- ChatGPT OAuth加密密钥和附件密钥均为32字节base64url。可在个人电脑生成，再只写本机安全配置，例如：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

本地官方回调为http://127.0.0.1:5173/auth/callback；公网网站的客户端与授权限制见技术方案，不把本机回调直接当远程服务回调。

- 代码包只带模拟测试数据，不带你今天本机实际维护的数据库。需要迁移本机账本时，另用站内加密备份功能，在本人确认下迁移。
- 本次不读取或导出用户真实本地账本，也不把API key塞进压缩包。若迁移已有票据，附件密钥必须另行安全保留；财务备份不会导出运行时凭据。

## 后续必须复核的风险

- 附件同key重试时随机IV可能造成命令指纹冲突；按文件hash核查原结果，避免重复保存。
- 研究提案key要绑定请求指纹；题目改变不能复用上一个问题的提案。
- 定投的份额/成本核实尚未完善，目前不允许直接开启定投资产的自动过账。
- 用户新增目标已经保存，但目标对消费与投资建议的完整约束/说明还需并入最终分析节点。
- 公网多家庭模式仅有方案，当前硬编码personal账本没有多租户隔离。保持Site私有，不能直接开放陌生用户。
- 一些旧E2E脚本仍面向早期手工新增方式，可能已过时；以新需求更新脚本，不能为让旧脚本通过而恢复已取消入口。

## 给Mac Codex的接续提示词

> 请接续此个人家庭财务项目，不重新建站。先读取docs/MAC-HANDOFF.md、requirements-latest.md、TECHNICAL-DESIGN-v2.md和执行清单。代码快照仍有未完成项，不要把技术方案当作已实现。先重跑npm test，再按最新R02/R07–R12完成统一AI节点、自动分类、可编辑清单与预算联动、投资流式查询、历史弹窗。每项先复现/写测试，再实现、验证并打标。原有Site项目ID保持不变；不恢复手工新增资产/预算或记一笔，不公开财务数据，不复制公司VOC资产，不做真实银行/股票交易。真实模型/搜索/视觉/OAuth先在本机安全配置并单独验收，最后由新session GPT-6.1 Sol审核后再考虑发布。

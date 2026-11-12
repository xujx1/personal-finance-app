# ChatGPT财务工作流使用与接续

日期：2026-11-12。当前分支：codex/chatgpt-mcp-skills。

## 使用方式

1. 网站使用ChatGPT账号登录并加入原家庭。ChatGPT会话选择已连接的家庭财务中心插件，必要时新开会话刷新工具目录。
2. ChatGPT先读get_skill_bundle，按家庭当前维护的流程工作，再读取财务。消费、投资、图片和月总结均在ChatGPT会话分析，搜索与图像能力取决于当前ChatGPT工具。
3. 用户希望保存时，通过submit_finance_draft保存对应草稿。网页各业务页可编辑、确认或拒绝；消费预算还需有效家庭登录成员逐人审批。MCP没有直接审批、支付、交易或任意SQL工具。
4. 实际收支须已到账/支付，明确资金成员及银行账户；历史已含余额须匹配银行asOf及snapshotDate，不再改现金。研究、月总结和周期草稿不代表实际付款。

## Skill站内维护

打开ChatGPT工作流页。管理员可编辑五份说明并保存新版本；其他成员只读且可以下载。恢复历史会另建版本，原历史及审计保留。正文不提供脚本上传、认证配置或权限扩大能力。

下载Skill与Codex安装包，解压后可先阅读skills目录里的五个SKILL.md，再在解压目录运行`python3 install.py`。默认装入CODEX_HOME/skills，未设置时为~/.codex/skills；可用`--target 临时目录`试装。安装器先验证固定路径、大小和SHA256，更新前备份原有目录，拒绝符号链接和被改包。它不联网、不安装MCP、不修改凭据，也不自动授权。需要回退本地安装时，从输出backup目录把对应旧Skill目录还原，重新开启Codex会话。

站内更新会影响get_skill_bundle下次读取及新下载包；不会自动改已安装的Codex文件，也不会直接更新ChatGPT客户端插件包。Codex下载重装后开启新会话；ChatGPT使用已连接插件的最新工具读取说明，插件自身Skill打包更新则须走客户端支持的安装流程。

## 六类草稿与页面

|kind|核对与展示入口|采用后的效果|
|---|---|---|
|budget|预算与大型支出、生活日历|费用重算、家庭审批，同ID更新重开审批，不扣现金|
|cashflow|现金流水|实际确认后记相应账户一次，已含余额历史不改银行现金|
|asset|资产与贷款|本人确认已有持有事实后开账，不等于购买|
|investment|研究记录|结论、详情、来源只读保存，不交易|
|monthly_review|月度报告|指纹一致才能确认；后来依据变化显示过期，不改账|
|recurring|周期收支|只采用服务器多月候选，证据变化拒绝旧稿，autoPost=false|

## MCP查询

保留get_financial_context、list_finance_drafts、list_research_requests及submit_research_proposal；新增list_transactions、get_monthly_review_context、get_recurring_candidates、get_skill_bundle、list_reviews。总计十工具（包含submit_finance_draft），不存在代审批、支付或直接交易工具。

list_transactions每页最多100，固定revision与筛选，持续nextCursor直到complete=true；空筛选页也可能有下一页。所有Minor字段为分/美分，草稿金额为元/美元十进制字符串。月度依据包含完整分录、memberCashflow现金口径、memberJournalActivity收入费用口径、预算实付/消费、目标和当前预测，两种成员口径不能相加。forecast及rules金额为CNY分；未核实真实生活费与库存不填零冒充已核实。

## 运行配置与旧服务

站点不再使用NEW_API_BASE_URL、NEW_API_MODEL、NEW_API_KEY、NEW_API_VISION_MODEL、TAVILY_API_KEY、AI_ADVISOR_DAILY_LIMIT。保留D1绑定DB、Sites原生登录、现有家庭管理员身份配置，以及按旧票据需求保留的ATTACHMENT_KEY。身份登录不等于套餐推理授权；本站没有套餐推理代理，也不再需要自行购买模型/搜索服务配置。

旧/api/advisor、/api/investment、/api/research、/api/images、/api/chatgpt及旧推理回调返回迁移提示；旧消费/投资/图片模型模块保留历史测试，未接入当前生产入口。既有预算、研究和账目不删除。腾讯/基金报价与汇率接口仍是确定性数据展示。

## 验证边界

npm test验证领域、权限与接口；test:e2e:local使用真实HTTP处理器、SQLite与浏览器，ChatGPT输出为明确结构化样本。样本验证草稿落库/审批/展示，不能证明真实搜索、价格库存、识图精度、投资质量或ChatGPT客户端授权已完成。双家庭与撤权按隔离库验证，生产只读比对。历史v30真实场景与127项矩阵只代表旧阶段，保留未覆盖边界。

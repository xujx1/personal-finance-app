# ChatGPT财务工作流使用与接续

日期：2026-11-12。当前分支：codex/chatgpt-mcp-skills。

## 使用方式

1. 网站使用ChatGPT账号登录并加入原家庭。ChatGPT会话选择已连接的家庭财务中心插件，必要时新开会话刷新工具目录。
2. ChatGPT先读get_skill_bundle，按家庭当前维护的流程工作，再读取财务。消费、投资、图片和月总结均在ChatGPT会话分析，搜索与图像能力取决于当前ChatGPT工具。
3. 用户希望保存时，通过submit_finance_draft保存对应草稿。网页各业务页可编辑、确认或拒绝；消费预算还需有效家庭登录成员逐人审批。MCP没有直接审批、支付、交易或任意SQL工具。
4. 实际收支须已到账/支付，明确资金成员及银行账户；历史已含余额须匹配银行asOf及snapshotDate，不再改现金。研究、月总结和周期草稿不代表实际付款。

## Skill站内维护

打开ChatGPT工作流页。管理员可编辑五份说明并保存新版本；其他成员只读且可以下载。恢复历史会另建版本，原历史及审计保留。正文不提供脚本上传、认证配置或权限扩大能力。

站点显示一条安装命令，可直接让Codex执行：

```sh
npx --yes https://xu-family-finance-20261111.shady-gnat-0277.chatgpt.site/downloads/family-finance-skills-1.2.0.tgz install
```

需要Node.js 20或更新版本。默认装入CODEX_HOME/skills，未设置时为~/.codex/skills；可追加`--target 临时目录`或`--dry-run`。安装器先完整校验六个固定入口的大小和SHA256，再安装；更新前备份被替换的SKILL.md，拒绝目标符号链接，不改其他Skill、MCP认证或凭据。重新打开Codex会话后加载入口。备份路径会显示在命令输出中，恢复对应SKILL.md即可回退。

公开npm包只含六个通用入口。使用入口先调用get_skill_bundle取得对应id的最新家庭正文，故站点维护后下次读取即可使用新说明；入口本身升级才需重新运行安装。正文、历史版本和完整ZIP备份仍需家庭认证。下载完整正文备份后，仍可解压运行`python3 install.py`固定某个历史版本；该方式不会自动读取后续正文，重新运行npm命令可恢复动态入口。网站不会直接修改ChatGPT客户端插件文件。

网站已移除复制请求和提示词输入框。日历选日、调整原预算、月报选月等场景点击“交给ChatGPT”，会先保存家庭内的任务，再打开ChatGPT；在已连接家庭财务中心的会话中说明“继续网站中准备的任务”。Skill读取list_research_requests并确认对应任务，不自动执行其他旧请求。私人任务不拼接到外链；保存回执丢失时查询原命令结果，不重复新增。

实现依据：[npm exec官方文档](https://docs.npmjs.com/cli/v11/commands/npm-exec)、[npm pack官方文档](https://docs.npmjs.com/cli/v11/commands/npm-pack)。本站提供真实URL包，不需要发布到用户的npm账号。

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

## 基金股票实际买入与清仓

资产页点击记录基金买入/记录股票买入，可选已有持仓或首次买入；已有资产后也有买入、卖出/赎回、清仓按钮。填实际成交额及手续费，明确所选成员银行账户。买入扣成交额加费用；清仓按成交额减费用到账，服务器取全部账面及已知份额。确认之前会显示当前和记账后现金；成交未发生或赎回未到账不要确认。同币种收付，不自动换汇，清仓历史可再买入。新增实际买入不能用ChatGPT已有资产开账草稿替代，否则不会正确反映银行现金。

## 生活日历取消

在当天安排卡片点击取消计划，核对后确认同时取消日历计划与预算。预算与大型支出显示同一计划为已取消，释放预留，未来预测不再计算该预算。实际付款、预付款和流水不变，不自动退款；已到账退款须在对应原付款或预付款处单独核对。默认日历隐藏取消项，“显示已取消”可查历史。只有家庭管理员可以取消；普通成员仍可查看和本人审批。

## 从流水沉淀周期收支

已开通get_recurring_candidates和list_transactions。让ChatGPT使用周期收支工作流，先完整读取真实流水，再说明按成员、账户归并出的多月候选。用户同意保存时只提交recurring草稿，网站采用后为每期待核实规则，autoPost=false。原人工工资、公积金和贷款规则不覆盖，不追补历史扣款。

2026-11-12生产只读核验：17条全量已过账历史中没有INCOME/EXPENSE/PAYMENT，故候选为0；已有四条人工规则仍在。至少两个不同月份的相似真实到账或消费记录出现后，才有足够证据生成候选。

## 家庭资产类型与真实会话验收

资产类型在资产与贷款的管理入口维护；服务端默认14类，首次维护保存家庭版本。get_financial_context.assetTypes给出当前家庭的真实ID与baseCategory，已有资产草稿可传assetTypeId。设置页可下拉选择类型或组合、增删目标；头像查看当前账户和退出。新自选目标只按所选范围计算，MCP返回目标分项与准确进度，不把全部非房产资产当作该目标完成额。

完整ChatGPT客户端验收请按CHATGPT-NEW-CHAT-TEST.md新开会话，区分真实模型/搜索与隔离结构化测试。

## 第一次建立家庭财务档案

在ChatGPT选择家庭财务中心，说“帮我建立家庭财务档案，先读取已有数据，按步骤问我”。工作流先了解现有记录，再逐段询问成员昵称、余额和贷款日期、类别、个人目标、固定收支；历史可以稍后补。每段保存为草稿，在网页核对采用后再继续依赖它的下一段。无需先制作JSON或提供完整流水。

配置草稿使用kind=setup，限members/asset_types/goals/recurring；它不创建登录关系、不授予权限、不产生现金分录。固定工资从未来规则开始，不能将约数当已到账；真实零余额银行账户可登记，未知不能填零。已有数据不初始化覆盖。

首次空家庭首页有建档入口；已有家庭从账户菜单的工作流集成继续。npm1.2.0安装六个入口，已安装旧五入口的Codex可重新执行该命令升级。ChatGPT连接读取最新工作流正文；工具列表缓存未刷新时，重新开启已连接应用的会话再使用新增setup草稿类型。

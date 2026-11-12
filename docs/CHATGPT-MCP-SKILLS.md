# ChatGPT家庭财务工作流使用指南

适用日期：2026-11-12；v60及后续本轮修订。当前版本使用研究记录集中核对、七个工作流入口和13个MCP工具。旧阶段验收记录仅作历史参考。

## 从哪里开始

1. 网站使用ChatGPT账号登录并加入自己的家庭；ChatGPT会话连接“家庭财务中心”应用。新增工具未出现时，重新开启已连接应用的会话。
2. 每次财务任务先读取`get_skill_bundle`中的最新工作流，再读取`get_financial_context`，核对成员、账户、金额单位和`data_revision`。分析、搜索和图片理解在ChatGPT中完成，能力取决于当前会话可用工具。
3. 首次建档可说“先读取已有数据，按步骤帮我建立家庭财务档案”。网站账户菜单提供家庭管理、目标设置、工作流集成；已有记录不会被初始化覆盖。
4. 用户要求保存时，调用`submit_finance_draft`，然后通过`list_finance_drafts`回读。七类草稿统一在网站“研究记录”展开、核对、采用或拒绝。提交成功只代表草稿已保存。
5. 预算采用后仍须所有有效家庭登录成员分别审批；审批通过才进入正式生活日历。现金流水、资产和周期规则须经过本人网站核对。MCP不提供代审批、付款或证券交易工具。

日历选日、调整原预算等场景点击“交给ChatGPT”后，在已连接会话说明“继续网站中准备的任务”。此时读取`list_research_requests`并确认对应任务；不自动执行其他旧请求。私人资料不拼接到外链。

## 七类草稿集中核对

以下各类的待核对入口均为“研究记录”；表中列出采用后的业务效果。

| kind | 内容与采用后的效果 |
| --- | --- |
| `budget` | 消费清单、价格依据、行程及准备事项；核对后发起家庭审批，全部同意才进入正式预算及日历，不扣现金。以`planId`修订正式预算会重新审批。 |
| `cashflow` | 已实际到账或支付的人民币收支；核对成员、真实账户、日期、金额和余额覆盖后恰好一次记账，可关联原预算或抵扣原预付款，详见下文。 |
| `asset` | 已持有资产的开账登记；确认持有事实后保存，不代表新购买。实际证券买卖使用网站专用入口。 |
| `investment` | 研究结论、详情、来源与后续事项；保存研究记录，不交易。 |
| `monthly_review` | 基于服务器月报的总结；提交及采用都校验`basisFingerprint`，依据改变须重读，不改账。 |
| `recurring` | 引用服务器多月候选及真实流水证据；核对后保存待核实规则，默认`autoPost=false`，不追补历史。 |
| `setup` | 首次建档或补全配置，限`members`、`asset_types`、`goals`、`recurring`；不创建登录关系、不授予权限、不产生现金分录。 |

已有`PENDING`草稿继续修改时，先读回原`id`、`payload`和`draftVersion`，再用`update_finance_draft`按同ID、同类型完整替换；同时传`request_id`、`expected_revision`、`expected_draft_version`，最后再次回读。不能更换原`planId`、建档`section`或周期`candidateId`。已采用或拒绝的草稿不可原地改写。版本冲突时重新读取；回执不明确时核对原请求结果，避免重复新增。

预算价格须区分引用报价、用户报价、计算、预留和未知。外部报价保留URL、时间、摘录及条件，仍标明本站未核验；变更商家、规格或计价条件后重新核价。未知不填0元冒充免费。出行前读取`get_memberships`，核对权益日期、人数及条件，已购卡成本不重复计入本次新增花费。

## 将实际消费关联原预算

使用`kind=cashflow`，金额是本次真实消费，不是预算总额。须提供`type=expense`、真实`accountId`、匹配的`cashMemberId`、人民币元字符串`amount`、真实`date`、`note`和`balanceIncluded`。贷款本金、证券买入及银行转账使用网站各自专用入口。

- **实际直接付款**：传本家庭已审批、未结束预算的`planId`。在研究记录核对原计划、预算、实付/消费、本次金额及付款账户；确认发生后才生成关联`PAYMENT`并更新相应账户和计划执行。
- **历史已经含在余额内**：`balanceIncluded=true`，并传与银行账户登记`asOf`一致的`snapshotDate`；核对历史覆盖范围后不重复扣银行现金。
- **抵扣已付预付款**：同时传`planId`和原`PREPAYMENT`交易ID `prepaymentId`，账户须为原计划原付款账户，金额不得超过未消费、未退款部分。使用`balanceIncluded=false`，确认后只冲减预付资产，不再次扣银行。计划已结束或待重审时仍可结算已有预付款，但不能新增现金扣款。

原计划关联在续改及网站核对中固定。审批依据变化会拒绝旧草稿，须重读后续改。未来日期、错误成员、其他家庭计划、错误预付款及疑似重复流水均会拒绝；重复采用同一草稿不会再次记账。贷款实际还款、证券成交和预付款退款继续在网站专用入口核对。

## 查询“我的审批单”

`list_my_approvals`只读查询服务器认证身份所在家庭，不接受客户端指定用户或家庭。

| scope | 查询范围 |
| --- | --- |
| `pending_for_me` | 默认，待本人审批 |
| `initiated_by_me` | 本人发起 |
| `processed_by_me` | 本人当前意见或历史审批操作 |
| `all` | 本家庭全部 |

支持`status`、`query`、计划日期`from/through`及`plan_id`筛选，`limit`为1–20，使用`offset`分页。首页记录`data_revision`和`household_revision`；后续页同时固定`expected_revision`、`expected_household_revision`及原筛选。账本或家庭成员变化后从首页重读。

结果包含计划名称、日期、人民币分`budgetMinor`、当前状态/版本、本人意见、家人确认进度、历史操作和`approvalUrl`。旧版同意不代表当前版本批准。打开链接仍须登录并通过家庭权限核验；查询不会代替本人审批，也不产生草稿、付款或账务变化。

## Codex安装七个通用入口

账户菜单 → 工作流集成提供当前安装命令：

```sh
npx --yes https://xu-family-finance-20261111.shady-gnat-0277.chatgpt.site/downloads/family-finance-skills-1.3.0.tgz install
```

安装七个入口：`family-finance-approvals`、`family-finance-onboarding`、`family-finance-consumption`、`family-finance-investment`、`family-finance-images`、`family-finance-monthly`、`family-finance-recurring`。已装旧五/六入口时重新执行命令升级。

需要Node.js 20或更新版本。默认安装到`CODEX_HOME/skills`，未设置时为`~/.codex/skills`；可追加`--target 临时目录`或`--dry-run`。安装器校验固定文件大小和SHA256，覆盖前备份并拒绝符号链接，不改MCP认证或凭据。重新开启Codex会话加载入口。

公开包只含通用入口；每次使用通过`get_skill_bundle`读取最新家庭正文。入口自身升级才需要重新安装。网站已移除Skill维护、下载与备份UI，仅保留必要使用入口及安装命令；既有私有正文、版本和归档API保留作历史兼容，仍受家庭认证保护，不是当前网站操作步骤。固定历史正文安装保留当时版本，不自动跟随最新正文。

## 当前13个MCP工具与金额约定

| 用途 | 工具 |
| --- | --- |
| 工作流及家庭依据 | `get_skill_bundle`、`get_financial_context`、`get_memberships` |
| 网站任务及草稿 | `list_research_requests`、`list_finance_drafts`、`submit_research_proposal`、`submit_finance_draft`、`update_finance_draft` |
| 流水、月报及周期依据 | `list_transactions`、`get_monthly_review_context`、`get_recurring_candidates`、`list_reviews` |
| 本人审批查询 | `list_my_approvals` |

`list_transactions`每页最多100条，沿`nextCursor`、相同筛选及`expected_revision`读到`complete=true`；空筛选页仍可能有下一页。只代表本站完整已过账记录，不代表完整银行账单。`list_reviews`可读取已核对研究、月总结及`monthly_report_archive`不可变月报归档，分页锁定账本版本；年度汇总不能把同月多个版本重复相加。

草稿及目标输入金额使用元/美元十进制**字符串**，如`"12345.67"`；不传JSON数字。读取金额按`units`和字段说明，`Minor`为分/美分，`forecast`和周期规则金额为人民币分。月度`memberCashflow`是现金口径，`memberJournalActivity`是收入费用口径，二者不能相加。开账、转账、贷款本金和证券买卖本金不能当收入或收益；缺失生活费、汇率和历史预测如实标未知。

## 历史兼容与验证边界

旧站内模型、搜索和图片推理入口已退役，不需要`NEW_API_*`、`TAVILY_API_KEY`或旧AI额度配置。保留数据库、原登录与家庭权限、确定性行情/汇率及附件安全能力；既有账目不删除。行情缓存和外部引用不保证可成交价格、库存或收益。

本地接口及浏览器测试使用隔离账本和明确结构化样本，验证草稿、核对、审批、权限与记账链路；不能代替真实ChatGPT客户端、搜索、图片识别或投资质量验收。真实会话按`CHATGPT-NEW-CHAT-TEST.md`另行验证，生产仅做授权范围内核对，不写测试流水。

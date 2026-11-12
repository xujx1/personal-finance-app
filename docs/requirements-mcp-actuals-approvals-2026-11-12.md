# ChatGPT关联实际消费及审批查询

## 关联实际消费

沿用`submit_finance_draft`的`kind=cashflow`。实际消费草稿可增加`planId`，关联本家庭已审批、未结束的原预算；仅`type=expense`，不把贷款本金、证券买入或银行转账记为消费。金额为本次真实消费，非预算总额。须提供真实`accountId`、匹配的`cashMemberId`、人民币元字符串`amount`、真实`date`、`note`与`balanceIncluded`。

原计划关联在续改及网页核对中固定。提交只保存待核对草稿；研究记录展开后核实原计划名称、原预算/实付/消费及本次金额、日期、资金账户。确认实际发生后才生成关联`PAYMENT`，更新计划实付、现金流水和对应家庭成员账户。审批依据变化拒绝旧草稿，必须重新读取并续改；已采用草稿重复请求不再记账。

历史已含余额时`balanceIncluded=true`且`snapshotDate`等于账户登记的`asOf`，不重复扣现金。原酒店预付款已支付、现在只是消费抵扣时，增加`prepaymentId`（原`PREPAYMENT`交易ID），同计划同原付款账户且不超过未消费/未退款金额；`balanceIncluded=false`，只冲减预付资产，不再次扣银行。计划结束或待重审时，仍可核对已有预付款的消费结算，不能新增现金扣款。

草稿必须回读确认；重复账户、金额、日期及说明的流水拒绝再次入账。未来日期、错误付款成员、其他家庭计划及错误原预付款均拒绝。真实贷款还款、证券买入和预付款退款继续使用网站现有专用入口。

## 我的审批单

新增只读MCP `list_my_approvals`，认证身份由服务器决定，不接受user_id/household_id/dataset_id。

- `scope`：`pending_for_me`默认待我审批；`initiated_by_me`我发起；`processed_by_me`本人当前意见或历史审批操作；`all`本家庭全部。
- 可用`status`、`query`、计划日期`from/through`、`plan_id`筛选，`limit`1–20，`offset`分页。
- 首页返回`data_revision`和`household_revision`；后续页固定`expected_revision`与`expected_household_revision`及原筛选。账本或家庭成员变化须从首页重读。
- 返回名称、日期、`budgetMinor`（人民币分）、当前状态/版本、本人意见、待本人标志、家人确认进度、本人历史操作及`approvalUrl`。旧版本意见不代表当前版本批准，未知历史发起人不猜测。
- 链接仍须登录及本家庭访问校验；查询不代审批，不产生付款、草稿或任何账务变动。

## 工作流及安装

新增`family-finance-approvals`；消费与图片说明补充原预算实际消费、付款归属、余额覆盖与预付款抵扣。七个通用入口包升级为`1.3.0`，站点“工作流集成”提供一键命令；使用时读取服务器最新正文。旧五/六个历史包、家庭定制正文及安装备份保留，不把新功能变成改权限或密钥配置。

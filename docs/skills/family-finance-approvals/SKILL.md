---
name: family-finance-approvals
description: "用户查询家庭财务中心待我审批、我发起、我已处理的消费预算审批单、查看家人确认进度或打开审批详情时使用。只查询，不代审批。"
---

# 我的家庭预算审批

1. 使用已连接家庭财务中心，先调用list_my_approvals。用户只说“我的审批单”时默认scope=pending_for_me；“我发起”用initiated_by_me，“我已处理”用processed_by_me，“家庭全部”用all。不能将资产归属成员当审批身份，不能传user_id、household_id或dataset_id切换他人/其他家庭。
2. 可传query关键词、status、from/through计划发生日期、plan_id精确编号。limit最多20；读取nextOffset翻页时固定expected_revision=data_revision、expected_household_revision=household_revision与筛选，complete=true才算读完；冲突从首页重读，不用单页冒充全部。
3. 按名称、计划日期、金额、当前审批版本、本人是否待确认、家人进度呈现；budgetMinor为人民币分，显示除以100。myPastActions仅是本人历史操作，旧版本意见、已取消或完成的计划均不能冒充当前正式批准。initiator为null时说明原始发起资料未知，不把家庭共用或资产所有人推定为发起人。
4. 给出服务器返回的approvalUrl供本人登录查看和确认；链接不授予权限，不转成邀请链接，不附凭据。查询不修改数据，不能调用不存在的approve工具、网页代点或用新草稿绕过他人审批。无待办就明确无待办，不扩大到全部家庭列表来凑结果。
5. 如需查询关联计划实际付款，读取get_financial_context的planSummaries及list_transactions完整分页核对；审批通过不等于已经付款。实际消费通过cashflow草稿携带真实planId提交，在研究记录核对后才入账。

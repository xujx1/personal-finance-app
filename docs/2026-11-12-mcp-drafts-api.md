# ChatGPT MCP 财务草稿接口（2026-11-12）

本站 `/mcp` 可让已登录 ChatGPT 的家庭管理员提交分析结果。MCP 只保存草稿；网页中的本人核对与家庭审批才决定是否形成账本记录。所有读取、草稿、请求回执与正式记录均采用当前家庭的数据集与权限检查，不暴露站点模型密钥或登录凭据。

## 工具与边界

- `get_financial_context`：读取账本版本、资产/现金/负债、财务成员、预算、周期收支与储蓄目标。账户及原始预算金额是最小币种单位，CNY 为分，USD 为美分；储蓄目标通过 `totalTargetYuan`、`bucketTargetsYuan`、`monthlyTargetYuan` 提供主币单位十进制字符串，例如四类目标总额 `"4000000.00"` 元，而不是四亿元。`planningContext` 使用 `CNY_yuan`，明确区分当前生效收入与包括未来规则的预计收入；预计收入不等于已到账现金。`units` 明确区分各字段。用户手工记录不是实时行情。
- `list_research_requests`：读取待研究请求。
- `submit_research_proposal`：保存餐饮、旅行、购物、理财研究；支持结构化 `expenseDraft`（费用、行程、比价）。该研究流程保持原有行为。
- `submit_finance_draft`：将外部分析保存为待网页核对的财务草稿。
- `list_finance_drafts`：读取当前家庭的待处理与已处理财务草稿。

不存在 MCP 预算批准、记账批准、付款、买入、卖出或任意命令执行工具。普通家庭成员可读取，不能提交或采用草稿；预算进入家庭审批后，成员只能以自己的登录身份逐人审批。

## 通用提交

`submit_finance_draft` 参数：

```json
{
  "request_id": "unique-client-request-1",
  "expected_revision": 12,
  "kind": "budget",
  "payload": {}
}
```

先读取 `get_financial_context.data_revision`。`request_id` 限字母、数字、下划线、短横线，长度 1–60；同一标识同一内容可原样重试，返回原结果。同标识不同内容拒绝，过期账本版本拒绝。金额必须是主币单位的十进制字符串，例如 `"300.00"` 元；不能用数字类型、分单位、负数或超过两位小数。

提交返回 `{ "ok": true, "id": "草稿ID" }`。草稿保存于普通账本文档：

```json
{
  "id": "草稿ID",
  "kind": "financial_draft",
  "payload": {
    "kind": "budget",
    "status": "PENDING",
    "payload": {},
    "source": "ChatGPT/MCP，外部分析待本人核对",
    "submittedBy": "登录主体",
    "createdAt": "ISO时间"
  }
}
```

## 消费预算与行程

```json
{
  "name": "示例周末亲子游",
  "category": "国内旅行",
  "date": "2026-12-05",
  "end": "2026-12-06",
  "budget": "300.00",
  "ownerMemberId": "family",
  "analysis": "ChatGPT 对资金安排、储蓄目标与预算影响的分析。",
  "note": "示例数据，待本人核对。",
  "expenseDraft": {
    "kind": "travel",
    "costContract": "flat_items_v2",
    "items": [
      {"id":"tickets","itineraryId":"day1","name":"示例门票","quantity":"2","unitPrice":"150.00","selected":true,"category":"门票","sourceType":"scenario_estimate"}
    ],
    "itinerary": [
      {"id":"day1","date":"2026-12-05","time":"10:00","title":"示例博物馆","notes":"参考安排"}
    ],
    "comparisons": []
  }
}
```

`analysis` 必填；`budget` 必须严格等于所选费用的数量乘单价合计，行程日期须在起止日期内。价格引用仅是外部提供的数据：即使自称已经检索，也会降级为未核验估算，比价不会保存成本站核验价格。网页核对后形成待家庭审批计划，记录费用与行程；所有当前有效登录成员各自确认后才成为正式预算。该路径直接使用用户在 ChatGPT 完成的分析，不再强制调用本站付费模型；采用预算不会扣现金或记实际消费。

## 实际现金流水

```json
{
  "type": "expense",
  "accountId": "当前家庭人民币现金账户ID",
  "cashMemberId": "该账户的财务成员ID",
  "amount": "10.00",
  "date": "2026-11-12",
  "note": "已经支付的示例餐费",
  "analysis": "可选分析",
  "balanceIncluded": false
}
```

只接受 `income` / `expense`。网页须另勾选已实际到账或支付，并明确确认尚未包含在当前登记余额。不能记录未来日期；日期必须晚于该现金账户的 `metadata.asOf` 余额核实日期；成员须与现金账户归属一致；不支持通过该工具转账、退款、贷款还款或资产交易。若历史流水已含余额，应使用现有图片历史流水核对流程，不得再次扣款。现金不足时，草稿状态与分录一并回滚。

## 已有资产新增登记

```json
{
  "name": "示例已有股票",
  "category": "stock",
  "currency": "USD",
  "amount": "100.00",
  "ownerMemberId": "user:实际家庭成员主体",
  "asOf": "2026-11-12",
  "owned": true,
  "market": "US",
  "code": "DEMO",
  "note": "示例已有持仓，尚未入库。",
  "analysis": "外部分析与登记依据。"
}
```

支持 `cash`、`term_deposit`、`fund`、`stock`、`property`、`loan`、`other`，币种仅 `CNY` / `USD`。只新增实际已持有资产或已有贷款本金的开账记录，不能修改既有账户；不产生投资买入，也不扣银行现金。网页必须勾选实际持有，核实日期不能在未来。可选字段：`market`、`code`、`quantity`、`price`、`cost`、`bank`、`startDate`、`annualRate`、`maturityDate`、`rate`、`monthly`、`day`。定期存款必须具备银行、起存日期、年利率和到期日期。同名称（忽略大小写与首尾空格）、类型、币种与财务归属的已有账户，会拒绝重复登记并提示前往资产列表核对修改；不同名称或不同归属仍可登记。

## 网页确认与拒绝

公开 `/api/finance` 只对当前家庭管理员开放以下命令，且保留既有 `key` / `revision` 请求回执和版本保护：

```json
{
  "action": "mcp.draft.accept",
  "body": {
    "draftId": "草稿ID",
    "confirmed": true,
    "reviewedPayload": {},
    "actualConfirmed": true
  }
}
```

`reviewedPayload` 是本人在网页修改后实际确认的同类型内容；现金流水和已有资产强制要求 `actualConfirmed:true`。预算只需 `confirmed:true`，随后调用原家庭审批机制。不能传入伪造审批人、审批结果、状态或其他未允许字段。草稿处理、正式记录和审计在同一数据库批次中提交。重复采用已采纳草稿会返回原目标，不再次创建记录；拒绝的草稿不能再采用。

拒绝：`mcp.draft.reject`，body 为 `{ "draftId":"草稿ID", "reason":"可选理由" }`。拒绝保留原稿、拒绝人、时间与理由，不删除历史。采纳保留 `reviewedPayload`、`acceptedBy`、`acceptedAt`、`destinationId`、`destinationKind`（`plan` / `transaction` / `account`）。

## 本轮验证

`tests/mcp-drafts.test.mjs` 覆盖：家庭逐人审批、保留费用与行程、外部报价降级、伪造字段、只读提交、跨家庭ID、伪造登录操作人、版本冲突、请求重放与内容冲突、数字金额拒绝、实际事实确认、未来/无效/余额已覆盖日期、账户归属、余额不足的原子回滚、已有持仓开账、拒绝审计、重复采用与查询期间移除成员。与既有 MCP、家庭、成员归属和创建入口测试合计 36 项通过；TypeScript 检查通过。运行日志位于 `work/finance-v16/`。

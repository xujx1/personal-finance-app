# 关键案例库

[中文](KEY-CASES.md) · [English](KEY-CASES.en.md) · [产品手册 / Manual](PRODUCT-MANUAL.md) · [图文版 / Illustrated edition](product-demo.html)

这40项是可维护的关键业务案例，不是40个已执行通过的演示。每项均保存前置数据、步骤、预期账务、失败判据及自动化定位。数据为独立合成示例，与截图中的旧测试数值无须相同。

P0指权限、资金、归属、重复记账或不可变历史等关键边界；P1指展示与辅助规划等重要路径。手工状态均not_run。本轮仅重跑20个既有测试文件，144项通过，不能据此宣称这40项的每个组合或真实客户端均已验收。详见[校验记录](manual/VERIFICATION.md)。

## 索引

| ID | 级别 | 案例 | 手工状态 |
| --- | --- | --- | --- |
| [C01](#c01) | P0 | 已有余额开账不当收入 | not_run |
| [C02](#c02) | P0 | 重复登记和重复采用 | not_run |
| [C03](#c03) | P0 | 快照日期与未来实际 | not_run |
| [C04](#c04) | P0 | 预算全流程不自动扣现 | not_run |
| [C05](#c05) | P0 | 本人逐人审批不能代签 | not_run |
| [C06](#c06) | P0 | 变更预算重审和旧版拒绝 | not_run |
| [C07](#c07) | P0 | 实际消费关联原预算 | not_run |
| [C08](#c08) | P0 | 已含余额历史不二扣 | not_run |
| [C09](#c09) | P0 | 实付—预付—消费—退款闭环 | not_run |
| [C10](#c10) | P0 | 响应丢失后安全重试 | not_run |
| [C11](#c11) | P0 | 余额不足全回滚 | not_run |
| [C12](#c12) | P0 | 取消保留实际款项与安全刷新 | not_run |
| [C13](#c13) | P0 | 家庭隔离覆盖读取与写入 | not_run |
| [C14](#c14) | P0 | 只读成员仅提交本人意见 | not_run |
| [C15](#c15) | P0 | 移除成员使旧会话与在途写入失效 | not_run |
| [C16](#c16) | P0 | 邀请生命周期与最后管理员 | not_run |
| [C17](#c17) | P0 | 记账档案不授予登录权限 | not_run |
| [C18](#c18) | P0 | 同ID续改、双版本与已处理只读 | not_run |
| [C19](#c19) | P1 | 类型性质、引用与停用边界 | not_run |
| [C20](#c20) | P0 | 目标单位、自由组合与去重 | not_run |
| [C21](#c21) | P0 | 买入加费用与清仓净回款 | not_run |
| [C22](#c22) | P0 | 成员、币种和家庭账户错配 | not_run |
| [C23](#c23) | P0 | 还贷模拟与实际本息分离 | not_run |
| [C24](#c24) | P0 | 未来首期、暂停与规则合计 | not_run |
| [C25](#c25) | P0 | 同月改扣款日不重复执行 | not_run |
| [C26](#c26) | P0 | 月度收入、费用、现金与净值分开 | not_run |
| [C27](#c27) | P0 | 归档不可变与总结依据过期 | not_run |
| [C28](#c28) | P0 | 完整分页与版本一致性 | not_run |
| [C29](#c29) | P0 | 养老金内部交易不当外部充值 | not_run |
| [C30](#c30) | P0 | 养老金不能借快照或归属解锁 | not_run |
| [C31](#c31) | P1 | 会员有效期、人数及增量成本 | not_run |
| [C32](#c32) | P0 | 报价、旧快照和缺汇率不改账 | not_run |
| [C33](#c33) | P1 | 隐私默认隐藏但编辑值仍敏感 | not_run |
| [C34](#c34) | P0 | 附件上传成功、失败与未知结果 | not_run |
| [C35](#c35) | P0 | 本站连接不冒充另一个会话安装 | not_run |
| [C36](#c36) | P0 | 图片只生成候选并排重 | not_run |
| [C37](#c37) | P0 | 预算合计、报价条件和未知不造0 | not_run |
| [C38](#c38) | P1 | 投资研究与复核不执行交易 | not_run |
| [C39](#c39) | P0 | 同币种内部转账不当收入 | not_run |
| [C40](#c40) | P1 | 清零归档保留历史与重新持有 | not_run |

<a id="c01"></a>

## C01 · P0 · 已有余额开账不当收入

**前置数据：** 独立空家庭A；演示银行A已有1000元，余额日D-1；D为演示当天。

### 操作步骤

1. 提交owned=true的已有资产草稿。
2. 采用前查看正式账户；再在网站核对持有、成员和日期后采用。
3. 查资产、现金流水和月报。

**预期结果：** 采用前不建正式资产；采用后银行1000元、开账记录存在，不多出1000元收入或第二次充值。

**失败判据：** 把开账当工资收入，或已持有余额采用后翻倍。

**自动化定位：** [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs) / [mcp-drafts.test.mjs](../tests/mcp-drafts.test.mjs)

**操作章节：** [M03](PRODUCT-MANUAL.md#m03)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S01](assets/workflows/01-onboarding.png)


<a id="c02"></a>

## C02 · P0 · 重复登记和重复采用

**前置数据：** C01已采用；保存原草稿ID与原请求。

### 操作步骤

1. 重试同一采用请求。
2. 读取原结果和账户数；再尝试把同一已有资产作为新草稿登记。

**预期结果：** 原请求不重复创建资产/分录；新的疑似重复登记需拒绝或核对，不能仅靠改名称绕过。

**失败判据：** 第二账户、双倍余额或两份开账。

**自动化定位：** [mcp-drafts.test.mjs](../tests/mcp-drafts.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**操作章节：** [M03](PRODUCT-MANUAL.md#m03)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c03"></a>

## C03 · P0 · 快照日期与未来实际

**前置数据：** 银行余额日D-1；实际未覆盖的新付款10元；另准备D+1的未发生付款。

### 操作步骤

1. 用D记录已发生付款，核对日期与快照关系。
2. 把日期改D+1或不匹配的已覆盖历史日期，尝试保存。

**预期结果：** 合法当前事实可核对；未来实际和覆盖冲突拒绝，银行不因失败变化。

**失败判据：** 未来事件提前扣款，或历史跨快照二次扣。

**自动化定位：** [plan-actual-date.test.mjs](../tests/plan-actual-date.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**操作章节：** [M03](PRODUCT-MANUAL.md#m03)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c04"></a>

## C04 · P0 · 预算全流程不自动扣现

**前置数据：** 银行1000元；预算300元；两位有效登录成员。

### 操作步骤

1. 提交预算草稿，回读。
2. 网站采用并提交审批。
3. 两人分别同意，再检查日历和银行。

**预期结果：** 提交、采用、审批与排期后银行均1000元，实际流水无300元消费；全体同意后才出现正式计划。

**失败判据：** 预算一保存就少钱，或待批即当正式计划。

**自动化定位：** [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs) / [approved-plan-calendar.test.mjs](../tests/approved-plan-calendar.test.mjs)

**操作章节：** [M10](PRODUCT-MANUAL.md#m10)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S03](assets/workflows/03-budget-review.png) / [S04](assets/workflows/04-share-approval.png) / [S05](assets/workflows/05-approved-calendar.png)


<a id="c05"></a>

## C05 · P0 · 本人逐人审批不能代签

**前置数据：** A管理员、B家人；300元待批预算。

### 操作步骤

1. A核对并同意后读取B待审批。
2. A尝试指定B身份代同意；B再以自身账号确认。

**预期结果：** A不能代B；B本人同意前不正式。身份来自服务器，不从参数指定。

**失败判据：** 传入他人ID即能同意，或一票当全体同意。

**自动化定位：** [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs) / [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**操作章节：** [M10](PRODUCT-MANUAL.md#m10)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S04](assets/workflows/04-share-approval.png)


<a id="c06"></a>

## C06 · P0 · 变更预算重审和旧版拒绝

**前置数据：** 已批准300元v1，修改为320元v2。

### 操作步骤

1. 通过原计划ID修改费用并采用新版。
2. 用v1审批参数重试。
3. 按v2重新完成全部成员确认。

**预期结果：** 原计划ID不变；v1意见不批准v2，旧请求拒绝；新版未全同意前不能新增实际付款。

**失败判据：** 改价沿用旧审批或另建一份正式计划。

**自动化定位：** [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs) / [mcp-amend.test.mjs](../tests/mcp-amend.test.mjs) / [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**操作章节：** [M10](PRODUCT-MANUAL.md#m10)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c07"></a>

## C07 · P0 · 实际消费关联原预算

**前置数据：** 已审批预算300元；银行1000元；真实已付120元，未含余额。

### 操作步骤

1. 提交带原planId的120元cashflow草稿。
2. 网站核对成员、账户、日期和未包含，确认实际付款后采用。
3. 查看原计划、流水和银行。

**预期结果：** 草稿阶段银行1000；采用后银行880，恰好一笔关联原计划的付款，不能扣预算总额300。

**失败判据：** 扣300、关联错计划、草稿提交已扣现。

**自动化定位：** [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**操作章节：** [M11](PRODUCT-MANUAL.md#m11)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S06](assets/workflows/06-actual-expense-review.png) / [S07](assets/workflows/07-recorded-cashflow.png)


<a id="c08"></a>

## C08 · P0 · 已含余额历史不二扣

**前置数据：** 银行快照余额1000元，日D-1已包括此前20元消费。

### 操作步骤

1. 提交该历史流水，选择已包含并匹配snapshotDate。
2. 网站采用；重读银行及历史业务金额。
3. 再把覆盖日改错，尝试采用。

**预期结果：** 银行保持1000；记录历史消费20且本次现金变化0；错误覆盖拒绝。

**失败判据：** 银行变980，或把历史金额也抹成0。

**自动化定位：** [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**操作章节：** [M11](PRODUCT-MANUAL.md#m11)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S06](assets/workflows/06-actual-expense-review.png)


<a id="c09"></a>

## C09 · P0 · 实付—预付—消费—退款闭环

**前置数据：** 独立银行1000元；批准预算300元；各步均D实际发生且不含快照。

### 操作步骤

1. 直接付款120元。
2. 预付款50元。
3. 从该预付款确认消费30元。
4. 将尚未消费20元退款记回原银行。
5. 分别核对银行、预付资产和实际消费，重试同一消费请求。

**预期结果：** 银行依次880→830→830→850；预付资产0→50→20→0；最终实际消费150。重复消费不再扣现、不再冲预付。

**失败判据：** 消费时再扣30、退已消费部分、退到别人的账户或重试重复消耗。

**自动化定位：** [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs) / [ledger.test.mjs](../tests/ledger.test.mjs) / [extensions.test.mjs](../tests/extensions.test.mjs)

**操作章节：** [M11](PRODUCT-MANUAL.md#m11)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S06](assets/workflows/06-actual-expense-review.png) / [S08](assets/workflows/08-adopted-mobile.png)


<a id="c10"></a>

## C10 · P0 · 响应丢失后安全重试

**前置数据：** 1000元银行付款10元；原请求key已知。

### 操作步骤

1. 在隔离故障测试中模拟服务端成功但响应丢失。
2. 先按原key查询结果，再重试同一个原请求。
3. 检查账户、交易数与原回执。

**预期结果：** 最终银行990且一笔付款；结果不明不能直接换key新增。

**失败判据：** 多扣一次、自动生成新key重放或只凭页面无提示判失败。

**自动化定位：** [http.test.mjs](../tests/http.test.mjs) / [store.test.mjs](../tests/store.test.mjs) / [attachments.test.mjs](../tests/attachments.test.mjs)

**操作章节：** [M11](PRODUCT-MANUAL.md#m11) / [M18](PRODUCT-MANUAL.md#m18)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c11"></a>

## C11 · P0 · 余额不足全回滚

**前置数据：** 银行50元；尝试实际付款60元或买入50元另收1元费。

### 操作步骤

1. 提交并确认该操作。
2. 比较操作前后账户、计划、交易和审计业务状态。

**预期结果：** 拒绝；现金仍50，无半笔分录、无新持仓、无错误已付状态。

**失败判据：** 银行负数、先建资产后报错或计划已付但流水没有。

**自动化定位：** [ledger.test.mjs](../tests/ledger.test.mjs) / [security-trades.test.mjs](../tests/security-trades.test.mjs)

**操作章节：** [M11](PRODUCT-MANUAL.md#m11)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c12"></a>

## C12 · P0 · 取消保留实际款项与安全刷新

**前置数据：** 批准计划有20元实际付款、30元未消费预付。

### 操作步骤

1. 取消当前计划版本。
2. 查看正常列表、显示已取消和原流水。
3. 模拟取消成功后刷新失败，再刷新核对。

**预期结果：** 未用预算预留释放；20付款和30预付历史不删除；取消不自动退款，也不因刷新失败再次取消。已有预付按实际消费/退款结算。

**失败判据：** 取消恢复现金、删除付款，或结果已成功却重放写入。

**自动化定位：** [calendar-cancel.test.mjs](../tests/calendar-cancel.test.mjs) / [cancellation-ui.test.mjs](../tests/cancellation-ui.test.mjs)

**操作章节：** [M12](PRODUCT-MANUAL.md#m12)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S05](assets/workflows/05-approved-calendar.png)


<a id="c13"></a>

## C13 · P0 · 家庭隔离覆盖读取与写入

**前置数据：** 家庭A/B各有独立演示账号，A有私密计划与账户。

### 操作步骤

1. 用B打开A计划链接、猜账户ID并访问财务、报告、附件及MCP。
2. 尝试提交对A资源的草稿或写入。
3. 用未登录身份重测读取。

**预期结果：** 无A的名称、金额、票据或记录泄露，写入拒绝；未认证通常401，已认证无权通常403或不暴露资源的响应。

**失败判据：** 知道ID就能读、MCP绕过家庭范围、错误信息携带余额。

**自动化定位：** [family-api-isolation-v15.test.mjs](../tests/family-api-isolation-v15.test.mjs) / [family-route.test.mjs](../tests/family-route.test.mjs) / [mcp.test.mjs](../tests/mcp.test.mjs)

**操作章节：** [M01](PRODUCT-MANUAL.md#m01) / [M18](PRODUCT-MANUAL.md#m18)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c14"></a>

## C14 · P0 · 只读成员仅提交本人意见

**前置数据：** 家人B只读，但在待批预算成员集中。

### 操作步骤

1. B读家庭并尝试改资产、规则、目标、采用草稿及修改会员。
2. B打开预算并提交自己的同意。

**预期结果：** 一般写入拒绝；本人预算意见允许。不能因为只读而取消其本人投票，也不能因可投票开放财务写入。

**失败判据：** 审批权限与一般写入混用。

**自动化定位：** [family-api-isolation-v15.test.mjs](../tests/family-api-isolation-v15.test.mjs) / [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs)

**操作章节：** [M01](PRODUCT-MANUAL.md#m01)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c15"></a>

## C15 · P0 · 移除成员使旧会话与在途写入失效

**前置数据：** B已加载家庭；准备在写入前由A移除B。

### 操作步骤

1. B保留旧页面和请求版本。
2. A移除B，B刷新、查询与提交旧写入。
3. 隔离测试将移除插在读取与最终提交之间。

**预期结果：** 撤销权限后后续读取/最终写入拒绝，不能靠旧快照继续；既有历史和原归属保留。

**失败判据：** 仅页面隐藏但旧请求仍可保存，或移除时删历史资产。

**自动化定位：** [family-api-isolation-v15.test.mjs](../tests/family-api-isolation-v15.test.mjs) / [family.test.mjs](../tests/family.test.mjs)

**操作章节：** [M01](PRODUCT-MANUAL.md#m01)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c16"></a>

## C16 · P0 · 邀请生命周期与最后管理员

**前置数据：** 独立邀请链接，仅在隔离环境测试。

### 操作步骤

1. 正常接受一次后再次使用；另测撤销、过期与错误token。
2. 已在别家身份尝试加入；当前管理员尝试直接退出。
3. 转移管理给有效成员再退出。

**预期结果：** 邀请不可重复/撤销后不可用；不误合并家庭；不能留下无管理员家庭；不改变个人资产所有权。

**失败判据：** 重复加入、撤销无效、转管理顺带转资产。

**自动化定位：** [family.test.mjs](../tests/family.test.mjs) / [family-route.test.mjs](../tests/family-route.test.mjs)

**操作章节：** [M01](PRODUCT-MANUAL.md#m01)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c17"></a>

## C17 · P0 · 记账档案不授予登录权限

**前置数据：** 新增昵称“演示成员乙”，尚无登录账号关联。

### 操作步骤

1. 保存昵称并给演示资产设置归属。
2. 检查家庭登录成员与预算投票名单。
3. 随后显式关联已加入账号，核对历史归属。

**预期结果：** 仅有昵称不会发邀请、授予读取或增加投票人；关联按规则保留历史，不凭同名自动合并资产。

**失败判据：** 建昵称即能登录/投票，或关联偷偷转归属。

**自动化定位：** [member-ownership.test.mjs](../tests/member-ownership.test.mjs) / [member-ownership-http.test.mjs](../tests/member-ownership-http.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**操作章节：** [M01](PRODUCT-MANUAL.md#m01)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c18"></a>

## C18 · P0 · 同ID续改、双版本与已处理只读

**前置数据：** PENDING预算草稿v1；保留原request_id与全局版本。

### 操作步骤

1. 回读后以同ID、同类型完整替换payload。
2. 用旧draftVersion或旧全局revision重试；尝试改planId或类型。
3. 采用后再尝试原地续改。

**预期结果：** 合法续改版本递增、回读一致；旧版本、关联更换与已处理续改拒绝，不产生第二份草稿。

**失败判据：** 丢字段、误改关联、旧稿覆盖新稿或采纳后重写历史。

**自动化定位：** [mcp-amend.test.mjs](../tests/mcp-amend.test.mjs)

**操作章节：** [M13](PRODUCT-MANUAL.md#m13)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S03](assets/workflows/03-budget-review.png)


<a id="c19"></a>

## C19 · P1 · 类型性质、引用与停用边界

**前置数据：** 自定义银行性质类型“演示备用金”，被账户或目标引用。

### 操作步骤

1. 改显示名称后读余额。
2. 尝试将性质改为股票或停用仍被引用的类型。
3. 移除合法引用后再按允许规则维护。

**预期结果：** 改名不改账；性质固定，引用中的类型不能停用，跨家庭类型ID拒绝。

**失败判据：** 改名改变账务性质、旧持仓变现金或停用破坏目标。

**自动化定位：** [custom-asset-types.test.mjs](../tests/custom-asset-types.test.mjs)

**操作章节：** [M05](PRODUCT-MANUAL.md#m05)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S11](assets/workflows/11-asset-type-editor-mobile.png)


<a id="c20"></a>

## C20 · P0 · 目标单位、自由组合与去重

**前置数据：** 演示现金1000元、其他类型200元；现金目标2000元。

### 操作步骤

1. 只勾现金并保存目标2000元。
2. 读取完成额和进度，再把同一类型选进第二目标。
3. 新增一个类型，检查是否自动进原目标。

**预期结果：** 当前1000元、进度50%，不是按分误读或把其他200元也算入；重复范围拒绝，新类别不自动加入。

**失败判据：** 100倍/10000倍金额错误、范围交叉、未选资产冒充完成额。

**自动化定位：** [goal-combinations.test.mjs](../tests/goal-combinations.test.mjs) / [asset-goal-amount-contract.test.mjs](../tests/asset-goal-amount-contract.test.mjs)

**操作章节：** [M06](PRODUCT-MANUAL.md#m06)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c21"></a>

## C21 · P0 · 买入加费用与清仓净回款

**前置数据：** 银行1000元；新演示基金买300元、费5元、3份；后全部卖330元、费5元。

### 操作步骤

1. 首次实际买入并查看现金、持仓及交易种类。
2. 清仓时核对全部3份与账面，再确认净到账。
3. 显示清零账户并重试原清仓。

**预期结果：** 银行1000→695→1020；买入为真实交易而非开账；清仓持仓清零但历史存在，重试不再加325元。

**失败判据：** 忘手续费、清仓回账面金额代成交、删除历史或重复到账。

**自动化定位：** [security-trades.test.mjs](../tests/security-trades.test.mjs) / [security-trade-impact.test.mjs](../tests/security-trade-impact.test.mjs)

**操作章节：** [M07](PRODUCT-MANUAL.md#m07)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S12](assets/workflows/12-liquidation-mobile.png)


<a id="c22"></a>

## C22 · P0 · 成员、币种和家庭账户错配

**前置数据：** 人民币持仓、美元银行、另一成员现金与另一家庭账户。

### 操作步骤

1. 分别用错币种、错成员或外国账户ID记录买卖/充值/付款。
2. 检查错误前后所有相关余额。

**预期结果：** 错配拒绝且全回滚，不自动换汇、不猜现金归属、不跨家庭写。

**失败判据：** 悄悄替换付款账户或隐式换汇。

**自动化定位：** [security-trades.test.mjs](../tests/security-trades.test.mjs) / [member-ownership-http.test.mjs](../tests/member-ownership-http.test.mjs) / [pension.test.mjs](../tests/pension.test.mjs)

**操作章节：** [M05](PRODUCT-MANUAL.md#m05) / [M07](PRODUCT-MANUAL.md#m07)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c23"></a>

## C23 · P0 · 还贷模拟与实际本息分离

**前置数据：** 银行1000元、贷款本金5000元；实际还本金100元、息10元。

### 操作步骤

1. 运行两种提前还贷模拟并保存未来预算，检查余额。
2. 银行实际发生后记录本金100和利息10。
3. 检查银行、贷款、月报与剩余备款。

**预期结果：** 模拟/预算不改余额；实际后现金890、贷款4900；本金不是费用，利息10另列。

**失败判据：** 模拟扣款、110全减本金、100本金计消费或部分还款误关计划。

**自动化定位：** [money.test.mjs](../tests/money.test.mjs) / [approved-plan-calendar.test.mjs](../tests/approved-plan-calendar.test.mjs) / [plan-actual-date.test.mjs](../tests/plan-actual-date.test.mjs)

**操作章节：** [M08](PRODUCT-MANUAL.md#m08) / [M15](PRODUCT-MANUAL.md#m15)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c24"></a>

## C24 · P0 · 未来首期、暂停与规则合计

**前置数据：** 100元月收入，首期D+1；另有暂停规则。

### 操作步骤

1. 保存后看常规月合计与本月排期。
2. D前检查到期，再暂停并检查。
3. 对照月报实际与预计。

**预期结果：** 常规月卡可显示启用规则，但首期之前不生成实际；暂停不生成新的到期项；不补历史收入。

**失败判据：** 首期未来却提前增现金，或规则月合计当已到账。

**自动化定位：** [recurring-monthly-link.test.mjs](../tests/recurring-monthly-link.test.mjs) / [recurring-safety.test.mjs](../tests/recurring-safety.test.mjs)

**操作章节：** [M14](PRODUCT-MANUAL.md#m14) / [M15](PRODUCT-MANUAL.md#m15)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S14](assets/workflows/14-recurring-rule-mobile.png) / [S15](assets/workflows/15-recurring-monthly-overview.png)


<a id="c25"></a>

## C25 · P0 · 同月改扣款日不重复执行

**前置数据：** 同一月规则已有待核实或已确认事项。

### 操作步骤

1. 把每月日期改为本月另一天。
2. 再次检查到期、确认或补执行，并重试原请求。

**预期结果：** 同规则同月份不能生成第二笔业务；已确认金额从待预计中移除，不重复加实际或预计。

**失败判据：** 改日期造两笔工资或同一还贷重复扣。

**自动化定位：** [recurring-monthly-link.test.mjs](../tests/recurring-monthly-link.test.mjs) / [recurring-safety.test.mjs](../tests/recurring-safety.test.mjs)

**操作章节：** [M14](PRODUCT-MANUAL.md#m14)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c26"></a>

## C26 · P0 · 月度收入、费用、现金与净值分开

**前置数据：** 独立演示开账；收入200、消费50、还贷本金100息10，另有内部转账。

### 操作步骤

1. 按真实专用入口分别记录。
2. 打开月报与总览实际积累，展开原币和成员。
3. 再增加未发生周期收入，比较预计。

**预期结果：** 业务收入200、消费/利息费用60；还贷本金不是费用，开账/转账不当收入，未发生收入不混实际。现金变化与净资产变化可不同。

**失败判据：** 净资产增加全当收益，或贷款本金当生活费并重扣。

**自动化定位：** [monthly-report.test.mjs](../tests/monthly-report.test.mjs) / [monthly-accumulation-v15.test.mjs](../tests/monthly-accumulation-v15.test.mjs)

**操作章节：** [M04](PRODUCT-MANUAL.md#m04) / [M08](PRODUCT-MANUAL.md#m08) / [M14](PRODUCT-MANUAL.md#m14) / [M15](PRODUCT-MANUAL.md#m15) / [M16](PRODUCT-MANUAL.md#m16)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S13](assets/workflows/13-monthly-archive.png) / [S15](assets/workflows/15-recurring-monthly-overview.png)


<a id="c27"></a>

## C27 · P0 · 归档不可变与总结依据过期

**前置数据：** 某月已保存v1；准备一份以旧指纹为依据的总结。

### 操作步骤

1. 补一笔该月真实演示支出。
2. 对比最新预览、v1与新保存v2。
3. 尝试采用旧指纹总结，再重读生成新稿。

**预期结果：** v1不变，新预览/v2反映新分录；旧总结拒绝或要求重读，年度不把v1+v2重复累计。

**失败判据：** 新流水改写v1、旧总结无提示继续用或年度重复。

**自动化定位：** [monthly-report-archive.test.mjs](../tests/monthly-report-archive.test.mjs) / [monthly-archive-http.test.mjs](../tests/monthly-archive-http.test.mjs) / [mcp-drafts.test.mjs](../tests/mcp-drafts.test.mjs)

**操作章节：** [M16](PRODUCT-MANUAL.md#m16)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S13](assets/workflows/13-monthly-archive.png) / [S16](assets/workflows/16-monthly-second-version.png)


<a id="c28"></a>

## C28 · P0 · 完整分页与版本一致性

**前置数据：** 超过单页上限的演示流水，夹有不匹配筛选行。

### 操作步骤

1. 固定筛选及版本读第一页并沿nextCursor读到complete=true。
2. 空筛选页仍检查nextCursor。
3. 在翻页间新增分录或改家庭成员，再用旧版本继续。

**预期结果：** 不中途漏页、不把最近几条当完整银行历史；版本冲突从首页重读，月报/周期归并不能混两个版本。

**失败判据：** 空页即结束、汇总最近100条、旧新页混算。

**自动化定位：** [mcp.test.mjs](../tests/mcp.test.mjs) / [recurring-history-v15.test.mjs](../tests/recurring-history-v15.test.mjs) / [monthly-report.test.mjs](../tests/monthly-report.test.mjs)

**操作章节：** [M13](PRODUCT-MANUAL.md#m13) / [M14](PRODUCT-MANUAL.md#m14) / [M16](PRODUCT-MANUAL.md#m16)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c29"></a>

## C29 · P0 · 养老金内部交易不当外部充值

**前置数据：** 普通银行1000；养老金现金200、产品0；演示年度额度已满。

### 操作步骤

1. 账户内买产品100，费0。
2. 全部赎回净额110。
3. 用内部资金再买产品50，费0，读取银行及年度实缴。

**预期结果：** 养老金现金200→100→210→160，产品0→100→0→50，总资产200→200→210→210；普通银行始终1000，年度实缴不变。

**失败判据：** 额度满禁止内部投资、赎回进普通银行或账户总额加底层双算。

**自动化定位：** [pension-investment.test.mjs](../tests/pension-investment.test.mjs) / [pension-classification.test.mjs](../tests/pension-classification.test.mjs)

**操作章节：** [M06](PRODUCT-MANUAL.md#m06) / [M09](PRODUCT-MANUAL.md#m09)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c30"></a>

## C30 · P0 · 养老金不能借快照或归属解锁

**前置数据：** 有确认缴费及内部交易的演示养老金。

### 操作步骤

1. 尝试删实缴重开额度、改成普通类型、转归属或借成员别名合并。
2. 提交早于最近交易的快照；将个人计划年龄当自动解锁。

**预期结果：** 绕过拒绝，余额/缴费/归属/历史保持；分类维护不能变成提款。

**失败判据：** 改一个字段即可提现或覆盖新交易事实。

**自动化定位：** [pension.test.mjs](../tests/pension.test.mjs) / [pension-investment.test.mjs](../tests/pension-investment.test.mjs)

**操作章节：** [M09](PRODUCT-MANUAL.md#m09)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c31"></a>

## C31 · P1 · 会员有效期、人数及增量成本

**前置数据：** 独立演示双人年卡，已购成本600元；3位成人；额外车费40元为待核价参考。

### 操作步骤

1. 按演示日期保存权益，再分别选有效、过期、未激活和停用日期/状态。
2. 让规划读取权益，列出覆盖2人、第三人和车费的待核事项。

**预期结果：** 600不再加为本次新增消费，不因维护扣银行；未覆盖人和车费仍列，未知票价不填0；过期权益不冒充优惠。

**失败判据：** 重复算购卡成本、默认全员免费、凭未知酒店等级给折扣。

**自动化定位：** [memberships.test.mjs](../tests/memberships.test.mjs)

**操作章节：** [M17](PRODUCT-MANUAL.md#m17)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c32"></a>

## C32 · P0 · 报价、旧快照和缺汇率不改账

**前置数据：** 演示证券有存储数量/单价/账面；另有缺汇率外币账户。

### 操作步骤

1. 刷新最新可用行情，模拟过期、失败或币种不符。
2. 比较存储快照算术与新参考市值。
3. 查看汇总和当前现金。

**预期结果：** 保留原快照、来源时间和未折算提示，不默认为1:1，不把参考价格当成交或现金，不自动补差调账。

**失败判据：** 刷新行情改真实持仓/余额，或缺汇率仍给完整净值。

**自动化定位：** [position-snapshot.test.mjs](../tests/position-snapshot.test.mjs) / [valuation-boundaries.test.mjs](../tests/valuation-boundaries.test.mjs)

**操作章节：** [M04](PRODUCT-MANUAL.md#m04) / [M07](PRODUCT-MANUAL.md#m07)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c33"></a>

## C33 · P1 · 隐私默认隐藏但编辑值仍敏感

**前置数据：** 独立演示家庭，含金额与长说明。

### 操作步骤

1. 首次进入检查主卡、列表、说明和研究。
2. 显示金额、跨栏目、再刷新。
3. 打开编辑/核对表单，检查原值提示并避免共享。

**预期结果：** 刷新默认隐藏、页面内选择按设计保留，敏感展示不漏在说明中；表单原值不是安全脱敏。

**失败判据：** 上次显示状态持久化成默认明文，或小字/提示漏金额。

**自动化定位：** [financial-privacy.test.mjs](../tests/financial-privacy.test.mjs)

**操作章节：** [M04](PRODUCT-MANUAL.md#m04) / [M18](PRODUCT-MANUAL.md#m18)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S01](assets/workflows/01-onboarding.png) / [S07](assets/workflows/07-recorded-cashflow.png)


<a id="c34"></a>

## C34 · P0 · 附件上传成功、失败与未知结果

**前置数据：** 独立计划，合成1KB PDF；原请求key固定。

### 操作步骤

1. 预览但不确认，检查尚未存储；确认后保存并看清空选择。
2. 模拟保存成功但刷新失败，以及响应丢失后重试。
3. 换文件前核对原请求状态；测试伪装类型、超限和跨家庭下载。

**预期结果：** 明确确认才上传；重试不多存，选择正确重置；不泄露附件，非法文件拒绝。

**失败判据：** 预览即上传、失败后丢文件无法重试、响应不明重复保存。

**自动化定位：** [attachments.test.mjs](../tests/attachments.test.mjs)

**操作章节：** [M18](PRODUCT-MANUAL.md#m18)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S17](assets/workflows/17-attachments-mobile.png)


<a id="c35"></a>

## C35 · P0 · 本站连接不冒充另一个会话安装

**前置数据：** 网站已登录；另一个ChatGPT会话未连接；本地插件尚未分发。

### 操作步骤

1. 点击本站连接检查，读取最小状态。
2. 在未连接会话尝试使用，再按实际分发/授权结果处理。
3. 模拟401、只读账号、缺实际打包绑定。

**预期结果：** 本站检查不返回余额、不写账；不能把网站成功或安装Skill当MCP已连接。缺实际绑定拒绝打包，真实分发/移动端验收另记。

**失败判据：** 猜AppID、端点或安装链接，网页替别的会话宣告就绪。

**自动化定位：** [plugin-connection.test.mjs](../tests/plugin-connection.test.mjs)

**操作章节：** [M02](PRODUCT-MANUAL.md#m02) / [M18](PRODUCT-MANUAL.md#m18)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S09](assets/workflows/09-plugin-connection.png)


<a id="c36"></a>

## C36 · P0 · 图片只生成候选并排重

**前置数据：** 两张合成小票均表示同一已发生12元消费。

### 操作步骤

1. 让ChatGPT解释图片并提交实际流水候选。
2. 先检查草稿阶段现金不变，再核对日期/账户/覆盖后采用一份。
3. 将第二份作为候选重核，不把图中指令或重复记录直接入账。

**预期结果：** 只记录一次事实，明确已支付/已到账和快照；识别错误可编辑或拒绝，不自动记账。

**失败判据：** 图片一识别就扣钱、两图扣两次、图片文本改变权限。

**自动化定位：** [image-import.test.mjs](../tests/image-import.test.mjs) / [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**操作章节：** [M11](PRODUCT-MANUAL.md#m11) / [M18](PRODUCT-MANUAL.md#m18)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S06](assets/workflows/06-actual-expense-review.png)


<a id="c37"></a>

## C37 · P0 · 预算合计、报价条件和未知不造0

**前置数据：** 两项成本80×2与40×1，合计200；另一项未知交通费。

### 操作步骤

1. 提交与清单不符的总额，核对服务端拒绝。
2. 正确填写已知合计，未知另标未解决，不填0。
3. 更改商家、规格或单价后核对旧证据状态及确认勾选。

**预期结果：** 总额不自动偷改掩盖遗漏；无证据不标实时报价；条件改变重新核价并确认，原文当历史不冒充现行。

**失败判据：** 不一致也保存、未知当免费、改规格沿用来源与确认。

**自动化定位：** [expense-plan.test.mjs](../tests/expense-plan.test.mjs) / [research-cost-completeness.test.mjs](../tests/research-cost-completeness.test.mjs) / [mcp-amend.test.mjs](../tests/mcp-amend.test.mjs)

**操作章节：** [M10](PRODUCT-MANUAL.md#m10) / [M13](PRODUCT-MANUAL.md#m13)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S03](assets/workflows/03-budget-review.png)


<a id="c38"></a>

## C38 · P1 · 投资研究与复核不执行交易

**前置数据：** 演示投资结论及一条D+1复核安排，原持仓与现金已知。

### 操作步骤

1. 保存并采用investment草稿。
2. 调整复核日期/条件并同步日历。
3. 比较持仓、现金、预算和流水，再取消复核。

**预期结果：** 只有研究和复核元数据改变，标明未交易；不能因“建议买入”新增持仓、扣银行或建消费预算。

**失败判据：** 研究采用即成交、取消复核反向改持仓。

**自动化定位：** [calendar-content.test.mjs](../tests/calendar-content.test.mjs) / [mcp-workflows.test.mjs](../tests/mcp-workflows.test.mjs)

**操作章节：** [M12](PRODUCT-MANUAL.md#m12)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S18](assets/workflows/18-investment-followup-calendar.png)


<a id="c39"></a>

## C39 · P0 · 同币种内部转账不当收入

**前置数据：** 银行A1000元、B500元，均CNY；已发生A→B200元。

### 操作步骤

1. 从A行内部转账选择B及对应成员，记录200元。
2. 检查两边余额、总现金和月报，重试原请求。

**预期结果：** A800、B700，总现金1500不变；有双方记录，不当收入或消费，重试不重复。

**失败判据：** 一边变更、转账当收益、跨币种暗换汇。

**自动化定位：** [member-ownership-store.test.mjs](../tests/member-ownership-store.test.mjs) / [extensions.test.mjs](../tests/extensions.test.mjs)

**操作章节：** [M05](PRODUCT-MANUAL.md#m05) / [M11](PRODUCT-MANUAL.md#m11)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。


<a id="c40"></a>

## C40 · P1 · 清零归档保留历史与重新持有

**前置数据：** 一份已全部卖出的演示持仓，保留原买卖流水。

### 操作步骤

1. 确认普通持有列表隐藏，勾“显示清零与归档账户”。
2. 查旧持仓/交易；允许时对同账户重新买入。
3. 尝试归档非零资产或删除历史。

**预期结果：** 历史不删除，正常重买不伪造第二份开账；未满足归档条件拒绝，旧交易仍可追溯。

**失败判据：** 清仓删流水、重买丢成本历史、归档抹非零资产。

**自动化定位：** [security-trades.test.mjs](../tests/security-trades.test.mjs) / [store.test.mjs](../tests/store.test.mjs)

**操作章节：** [M05](PRODUCT-MANUAL.md#m05) / [M07](PRODUCT-MANUAL.md#m07)

手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。

**截图：** [S10](assets/workflows/10-assets-desktop.png)

## 新增与回归记录规范

发现问题先定位已有ID；新边界新增ID，不因改标题重排旧编号。执行时记录源码版本、环境、账号角色、独立数据集、实际操作、实际结果、通过/失败/受阻、原截图与日志位置。失败修复应追加复测记录，保留原失败，不把预期值复制成实测值。不要把本地模拟身份结果标成生产OAuth/真实家人验收。

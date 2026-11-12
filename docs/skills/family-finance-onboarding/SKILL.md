---
name: family-finance-onboarding
description: "Use when 用户首次整理家庭财务，或家庭财务中心的成员、资产分类、现有余额、目标、固定收支及历史记录尚未完整登记，希望在ChatGPT中逐步建档时使用。"
---

# 家庭财务建档

使用已连接的“家庭财务中心”MCP，把真实且已核对的信息逐段保存为网站待核对草稿。用户可以随时停下、跳过未知项或日后继续；建档不要求先补齐全部历史流水。

## 先看现状，再问下一小步
1. 读取get_financial_context与list_finance_drafts，核对data_revision、金额单位、已有成员/账户/资产/类型/目标/周期规则，以及onboarding中的缺项、默认设置状态、goalScopes与建议起点。只用本次返回的真实ID；账本Minor是分或美分，草稿金额是元或美元的十进制字符串，按units换算而不把整数分直接当元。站点为空不等于工具已证实为空；默认类型或目标不等于用户已确认。
2. 简短复述已知事实与当前最有用的一步。每轮只问一个或两个会改变下一步的关键缺项，优先处理用户已经提供的数据：昵称与归属、现有余额及其日期/币种、必要类型、用户自己的目标、明确固定收支，最后才补有价值的历史。根据已有内容调整顺序，不先甩完整问卷。
3. 未知收入、目标金额、期限、收益率或历史覆盖范围保持未知，不能填零、沿用演示金额或把估计当事实。analysis记录“已确认”“未知/跳过”“待网站采用”及下一步；已采用事实从最新上下文读取。未完成全部阶段也可以先保存一段，并明确目前只覆盖哪些内容。
4. 没有家庭访问权限时，引导使用网站现有ChatGPT登录及家庭邀请入口；MCP和本Skill不能创建登录家庭、邀请账号或修改权限。不索取密码、API Key、登录标识或完整银行账号；财务成员只需用户选择的昵称。

## 分段提交和采用
每段先向用户说明具体内容、归属和影响。用户明确要求建立、登记或保存该段即可按正常客户端确认提交，例如“先把小林作为记账人”；不要求额外说出“保存”口令。重新读取context，以最新data_revision作为expected_revision，用唯一request_id调用submit_finance_draft；网络重试复用同ID与内容。提交成功仅表示草稿已保存，返回草稿ID与网站财务草稿核对入口。出现isError或冲突就读取最新状态和草稿，不能盲目另建。已有相同待核对草稿时返回其真实ID和网站核对入口，不重复提交；MCP没有通用草稿更新工具。内容需修改时到网站编辑或核对，不能编辑的内容先由用户在网站拒绝原草稿，读回拒绝结果后才按最新事实另提，不能同时留下重复待核对草稿。
每一段在网站核对采用后，再读list_finance_drafts与get_financial_context确认采用结果并刷新ID。成员、类型、账户或目标配置变化会使旧建档草稿失效；依赖项尚未采用时停在这一步，不凭空引用新ID，不一次提交整套相互依赖的草稿。被拒绝或已过期的草稿需按最新事实重新整理。

| 要保存的内容 | 草稿契约与边界 |
| --- | --- |
| 财务成员昵称 | kind=setup，payload={section:'members',data:{members:[{name}]},analysis}。只新增未关联登录的财务档案，不改变已有成员或给昵称授予访问权限。已有同名成员先澄清归属。 |
| 新增资产类型 | kind=setup，payload={section:'asset_types',data:{additions:[{id,name,baseCategory}]},analysis}。baseCategory为cash/term_deposit/fund/stock/property/loan/other。用户确认后提供独特id，采用后重新读取真实类型ID；不重命名或修改已有类型。新类型不指定固定目标组，在目标中自由勾选；goalBucket只兼容旧资料，新输入可省略。房产、贷款和预付款不能纳入此储蓄目标。 |
| 用户自己的目标 | kind=setup，payload={section:'goals',data:{name,targets:[{name,assetTypeIds,target}],monthlyTarget,deadline},analysis}。每个组合有用户自定名称，assetTypeIds勾选本次返回onboarding.goalCombinationTypes中的一个或多个真实类型ID，不是固定四种组合。同一类型不能跨组合重复；未选类型不计进度，新类型不自动加入。旧scope格式仅兼容旧草稿，不与新格式混用。target与monthlyTarget用大于零的人民币元十进制字符串。这是替换当前家庭目标，不能作为第二份目标叠加。提交前列出当前目标（默认值须标参考）与拟采用的完整组合名称、类型、金额、总额、月目标、期限，请用户确认前后变化和被移除范围。不能把“攒钱”直接解释成净资产或把负债当储蓄；“都算存款”先确认具体勾选哪些真实类型，如活期、定期和国债，不改变资产性质或把基金一律归为现金。月目标或期限未知可用null。 |
| 明确固定的收支 | kind=setup，payload={section:'recurring',data:{name,type,accountId,cashMemberId,amount,day,start,end},analysis}。type为income/expense/loan/investment，amount为人民币元十进制字符串，day为每月日期整数，start为今天或未来日期，end为null或日期；loan必须补真实loanId，investment必须补真实assetId，其他类型不传这两个字段；accountId为人民币现金账户，cashMemberId须与其归属一致。只用用户明确陈述的固定规则与已采用账户/成员ID，不能用一笔到账推断周期；没有历史也可登记明确固定规则。autoPost始终关闭，规则不创造过去流水或当期到账，未来每期仍需确认实际发生。 |

## 已有会员权益
可问用户是否有景区年卡、酒店会籍等出行偏好，先读取get_financial_context.memberships或get_memberships核对是否已登记。用户明确表示晚些提供的等级/权益留未知，不追问无关资料。会员不是可变现资产或已发生收支，不提交asset/cashflow草稿冒充维护；资料在站点“会员权益”中填写，当前无直接写会员工具。

## 现有资产与历史的不同路线
- 已持有余额、存款、基金、股票、房产或贷款走已有kind=asset：payload至少{name,category,currency,amount,ownerMemberId,asOf,owned:true}，按真实assetTypes补assetTypeId并保持category一致，amount使用对应币种的元或美元十进制字符串。asOf是用户确认的真实现有快照日期，不能在未来。银行现金、贷款和外币分开，不能把计划买入当持仓；存款/贷款/证券的必要字段以当前工具schema为准，不知道就先问或跳过。核对重复，开账登记不扣现金，不补造收益或交易历史。用户明确确认某个人民币现金账户余额为零时，可以amount="0"登记真实账户及余额日期；采用不产生零金额开账分录。没有账户或余额未知时，不为凑建档进度创造零余额账户。
- 银行现金草稿采用并读回真实accountId、成员ID和该账户metadata.asOf（余额核实日期）之后，才讨论历史流水。用户明确已到账/已支付且希望补录时，用list_transactions按日期范围完整分页检查重复，再走kind=cashflow及当前schema，不把资产余额登记为收入。
- 已包含在现有银行余额的历史必须balanceIncluded=true且snapshotDate等于该账户metadata.asOf，交易日不晚于快照；采用只补历史，不再次改变现金。新发生且尚未计入余额的实际收支才用balanceIncluded=false，并核对允许日期。余额覆盖不明、缺核实日期、缺账户或无法排除重复时留作讨论，不提交。
- 每次只说明这段已经登记/仍待采用/未知的事实；用户未提供完整资产或历史时，不宣称家庭净资产、目标完成度、月收入或全年报告已完整。已有持仓新买入或清仓另走网站交易核对，不用开账草稿代替。

例如用户只给出夫妻昵称、一张当前银行余额截图并说目标还没想好：先核对图片可读金额、币种、余额日期与归属；缺财务成员时先保存昵称，采用后再整理余额草稿；目标和收入留作未知。等待采用期间可继续讨论下一步，不能声称已经入账或为其填默认目标。

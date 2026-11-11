# 家庭按成员管理资产、预算与收支

用户已授权直接开发，不逐项确认。沿用同一家庭可见、管理员写入的权限，新增归属分类，不把记账成员当登录授权。

## 决策与约束
- 资产、预算有成员归属，可为家庭共用或具体成员，页面按成员筛选。
- 家庭管理可以创建仅用于记账的成员档案（例如尚未登录的家人），可关联已经加入本家庭的ChatGPT成员；关联不新增访问权限。档案存为当前账本financial_member文档，无新外部配置。
- 收支的资金归属以实际选定的收付款账户为准，明确显示成员、账户及币种；不能选B成员却静默扣A账户。记账人actor与资产所有人分开。
- 转账保留转出/转入双方归属，退款继承原实际账户；预付款不得混合不同所有人。周期、图片确认及资产交易同样绑定明确现金账户。
- 每笔新流水保存当时的账户归属快照。资产重分配前固化其历史流水，后续归属改变不改写历史；旧数据能由明确账户推定，否则待确认，不凭名字猜。
- 保留当前18项正式账户及全部余额，不能创造家人资产或模拟正式扣款；线上只检查现有本人归属，A/B全链路使用隔离测试。

## 共享接口
state.householdMembers: [{userId,displayName,active,role}]，服务端按真实householdId查询（只读）。
state.financeMembers: [{id,name,kind:'family'|'user'|'person'|'unknown',userId?,active,selectable,aliases?:string[]}]。
ID: family=家庭共用，user:<subject>=真实成员，person:<uuid>=记账档案，unknown=未能确认。linkedUserId关联后保留userID别名以兼容旧数据。
新账户/计划metadata或payload: ownerMemberId,ownerLabel，ownerSubject保留兼容，不能作为客户端授权条件。
流水metadata.accountOwners: [{accountId,accountName,memberId,memberName,currency,category,amountMinor}]，金额符号来自真实分录；metadata.recordedBy仅表示实际记账人。展示选择现金parties优先，没有现金时展示资产/贷款；跨成员转账两边都可筛到。
写入可选cashMemberId（明确选择的资金成员），若提供必须与accountId或fromId对应的实际账户归属一致；toMemberId匹配转入账户。旧请求省略时由账户推导，不能信任客户端ownerLabel。
member.save: {id?:person:<uuid>,name,linkedUserId:null|subject}；关联仅当前家庭active成员，同一用户不重复绑定。

## 文件分工
根代理：src/domain/member-ownership.mjs及测试，FamilyPanel/新MemberManagement，文档与最终发布。
后端：finance-store/finance-extensions、snapshot目录与历史固化、全部写路径，相关测试。
界面：FinanceApp/AdvisorPanel/FinanceTools/PlanDetails/ImageImport/新MemberControls，筛选与账户选择，独立CSS。

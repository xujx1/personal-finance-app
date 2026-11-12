// Public bootstrap metadata only. Never import the family's maintained bodies here.
export const SKILL_CLI_VERSION='1.3.0';
export const SKILL_CLI_PATH='/downloads/family-finance-skills-'+SKILL_CLI_VERSION+'.tgz';
export const SKILL_ENTRIES=[
 ['family-finance-approvals','我的审批单','查询待我审批、我发起和已处理的家庭预算审批，查看当前版本与家人进度。只读查询，不代审批。'],
 ['family-finance-onboarding','家庭财务建档','用户首次整理家庭财务，或成员、资产类型、余额、目标及周期收支尚未完整登记时使用。'],
 ['family-finance-consumption','消费规划与记账','规划旅行、餐饮或购物，调整预算，将已发生消费关联原预算提交待核对记账，区分直付与预付抵扣。'],
 ['family-finance-investment','投资研究','结合家庭账本研究投资、持仓与换仓问题，向家庭财务中心保存研究草稿。'],
 ['family-finance-images','图片识别与记账','识别用户提供的账单或资产截图，核对真实账户、余额覆盖与重复后提交财务草稿。'],
 ['family-finance-monthly','月度总结','读取家庭财务中心月报依据，解释实际收支、资产变动与目标差值，保存月度总结草稿。'],
 ['family-finance-recurring','周期收支','从家庭财务中心历史流水归并多个不同月份的收支，核对周期候选并提交待核对规则草稿。'],
];
export const skillInstallCommand=origin=>'npx --yes '+new URL(SKILL_CLI_PATH,origin).href+' install';
export function bootstrapSkill([id,title,description]){
 return `---\nname: ${id}\ndescription: ${description}\n---\n\n# 家庭财务中心 · ${title}\n\n这是通用入口，不含家庭资料。使用已经连接的“家庭财务中心”MCP：\n\n1. 调用 get_skill_bundle，选取 id=${id} 的最新工作流正文，并按正文完成本次任务。不能只凭此安装时的入口推测完整字段。\n2. 用户当前明确指令优先。只有用户要求继续网站中准备的任务时才调用 list_research_requests；让用户确认对应任务，不自动执行其他旧请求。\n3. 读取 get_financial_context，核对真实成员、账户、金额单位和 data_revision。按最新正文需要调用 list_my_approvals查询本人审批、list_transactions 完整分页、get_monthly_review_context 或 get_recurring_candidates。\n4. 保存前按用户授权调用 submit_finance_draft，仅保存草稿。预算须站点家庭成员本人审批，实际流水与周期规则须在站点核对；不能代审批、付款或执行股票交易。\n5. MCP 未连接或无法读取当前正文时停止财务写入并说明缺失连接，不索取密钥、密码或私人账本外链。只检索非私人关键词，不把家庭账本送到搜索。\n\n网站维护正文的更新会在下一次 get_skill_bundle 时读取；入口本身升级可重新运行安装命令。此包不负责登录或连接 MCP，也不修改权限。\n`;
}

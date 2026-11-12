# 账户菜单、周期收支与月度报告

用户已授权直接改版与测试，不逐项确认。沿用现有分支、站点、MCP和家庭权限。

## 有效要求

- D001：账户菜单顺序为家庭管理、目标设置、工作流集成、退出登录。前三项从侧栏移除，业务页面仍保留；家人和管理员权限不变。
- D002：工作流集成只保留npm一键安装及必要使用入口，隐藏Skill维护、版本、下载和备份UI，不删除原私有工作流或扩大下载权限。
- D003：周期收支移除顶部ChatGPT/历史归并说明空卡片。默认展示规则与待核实概览，新增/编辑在对话框中完成；候选仅按需打开。实际确认和自动记账授权不删除，调整为紧凑分组布局。
- D004：月报是安全的HTML报告页，移除顶部ChatGPT使用提示，保留真正待核对草稿。按原币展示收入、已确认费用、现金变化、重要流水、大额支出、下月预测和月积累；详细核账折叠。不直接渲染模型任意HTML。
- D005：每月可保存不可变、带版本的报告，包含结构化数字、完整月流水及已核对AI总结、预测与资料限制；后续账目变化不改写旧版，可另存新版。保存不记账，保护家庭隔离。支持MCP读取历史报告供以后年度总结。
- D006：月报Skill按本月收支/大额事件/目标差值/下月预测写结构化总结，网页按统一报告版式渲染；不造价格、不将资产转换当收入，不把当前预测冒充历史当时预测。

## 冻结报告契约

新增src/server/monthly-report-document.ts：
- buildMonthlyReportDocument(db,state,month,context?)返回schemaVersion:1, month, asOf, sourceRevision, basisFingerprint, fingerprint, ledger(原buildMonthlyReport结果), memberCashflow, memberJournalActivity, monthlyAccumulation, goal, flows(完整list_transactions月记录、frozen accountOwners及cashChanges[{accountId,accountName,memberId,memberName,currency,amountMinor}]), nextMonth({month,available,asOf,reason,opening,income,fixed,planned,pending,closing,unknown}), aiReview(最新同月已核对monthly_review，含id及stale标记或null), coverage。
- fingerprint不含sourceRevision/生成时间；依据、实际月流水、选中AI总结变化则变。当前月预测取现有当前asOf预测的下个月行，历史月无当时快照就标不可重建，不造历史预测。
- extendMonthlyReports(c)处理monthly.report.save body={month,expectedFingerprint}，重算并验指纹；新增documents.kind=monthly_report_archive，payload={month,version,fingerprint,createdAt,sourceRevision,document}。同指纹重复不另存版本，不修改旧版；不创建现金分录；未来月份禁止。
- 私有GET/api/reviews?month返回原上下文加document和archives索引；?archive=id只返回该月本家庭指定版本完整document。publicSnapshot仅返回归档元数据索引，避免每个页面发送全部历史流水。
- 现有list_reviews增加kind=monthly_report_archive，工具总数不变；旧monthly_review草稿协议和核对保留。

## 任务

- [x] 报告核心与归档测试先失败，再实现；覆盖完整历史超过300条、同月多版、不可变、旧指纹、币种、历史预测、家庭隔离。
- [x] 导航与工作流UI简化。
- [x] 周期收支表格/对话框改版，保留核对授权。
- [x] HTML报告页面、归档查看、月报Skill调整与接口接入。
- [x] 端到端、独立审查、修复，原站点发布与只读验证；不向生产写测试月报。
- [x] 汇总最新需求和验收记录。

## 独立审查与验证

- 报告核心和周期改版分别由实现代理完成，并由独立审查代理核对范围、权限与数字。发现归档可被通用写入覆盖和过期规则误计两个P2，均补充回归并修复，定向复查通过。
- 569项代码/接口测试通过；六套浏览器测试60项全部通过，未出现页面脚本错误和意外外网调用。浏览器账本为隔离夹具，不冒充真实ChatGPT新会话推理或正式财务交易。
- 归档保留完整资产侧账户快照；网页流水主表优先展示实际现金账户，资产侧细节可通过归档结构化数据查看。本轮不扩张交易操作范围。

## 发布结果

v38已发布成功，环境修订16、MCP可用。原生MCP月报返回reportDocument及17条全量当前月记录；Skill包含月报归档/年度取版规则。生产前后账本修订均48，18账户及余额、预算、周期规则、目标未变化。已只读核对默认脱敏、账户菜单、一键安装、周期表与月报页。

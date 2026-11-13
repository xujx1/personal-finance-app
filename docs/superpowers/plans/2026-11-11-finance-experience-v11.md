# 18项体验修订实施计划
Spec: docs/superpowers/specs/2026-11-11-finance-experience-v11-design.md
Constraints: 使用现有API Key；保留家庭权限、原始资产、历史和实际入账确认；不编造月度目标、工资日期、银行交易或行情。

1. 资产/总览布局：定期、页签总额、清仓隐藏、行情刷新与状态；移除日历嵌入和提醒入口。
2. 家庭分类资产目标：分类匹配、总/月目标进度、设置简化，未知值明确。
3. AI交互：自动分类、去手填初始清单；自然语言旅行信息；真实节点与结果；安全HTML；下方分页模糊历史。
4. 周期与识别：核查初始化和扣减；基于真实资料提供待核对规则；图片草稿确认端到端幂等测试。
5. 集成测试、真实接口/页面验收、复核、生产发布及更新交付清单。

Meaningful tests: valuation/currency/zero-quantity, term-interest/date validation, goal-bucket/no-property/month boundaries, streamed node order and no raw private dumps, HTML injection, history pagination/search, no duplicate periodic/image posting, real market parsers. Full unit/type/build + UI E2E.

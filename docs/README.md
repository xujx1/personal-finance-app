# 文档导航

**中文** · [English](README.en.md) · [项目首页](../README.md)

## 从这里开始

| 目的 | 文档 |
| --- | --- |
| 了解项目 | [项目说明](../README.md) |
| 完整产品操作演示（18章） | [产品手册](PRODUCT-MANUAL.md) |
| 关键业务案例（40项） | [案例库](KEY-CASES.md) |
| 单文件图文演示、搜索及打印 | [中英文HTML](product-demo.html) |
| 快速上手 | [简明指南](USER-GUIDE.md) |
| 本地运行、测试与构建 | [开发与验证](DEVELOPMENT.md) |
| 隐私、权限与公开资料边界 | [数据安全](../SECURITY.md) |
| 本轮检查与遗留风险 | [公开资料安全校验](PUBLIC-DATA-REVIEW-2026-11-13.md) |
| 截图来源与适用范围 | [截图目录](assets/workflows/README.md) |
| 文档和翻译维护 | [贡献约定](../CONTRIBUTING.md) |

## 需求与接口

[当前需求摘要](requirements-latest.md)用于定位；[完整需求](requirements-consolidated-2026-11-12.md)保留 R001–R127 编号。下表中的后续修订覆盖相应旧条款。实现与验收应同时核对代码；历史版本号和通过数量不代表本轮结果。

| 主题 | 需求或契约 |
| --- | --- |
| ChatGPT / MCP / 工作流 | [迁移需求](requirements-chatgpt-mcp-2026-11-12.md)、[工具与七类草稿](CHATGPT-MCP-SKILLS.md)、[新会话检查](CHATGPT-NEW-CHAT-TEST.md) |
| 插件接入（本地实现） | [安装与授权需求](requirements-plugin-installation-2026-11-13.md)、[验证及外部依赖](VERIFICATION-PLUGIN-INSTALLATION-2026-11-13.md) |
| 实际支出与审批 | [实际消费与审批](requirements-mcp-actuals-approvals-2026-11-12.md)、[草稿续改](requirements-mcp-amend-and-execution-2026-11-12.md) |
| 建档与成员 | [建档](requirements-onboarding-2026-11-12.md)、[成员归属](2026-11-12-member-ownership.md) |
| 资产与目标 | [自定义类型](requirements-asset-types-2026-11-12.md)、[自由组合](requirements-goal-combinations-2026-11-12.md)、[分类排序](requirements-asset-category-order-2026-11-12.md) |
| 证券与养老金 | [交易核对](requirements-security-trades-2026-11-12.md)、[养老金](requirements-pension-2026-11-12.md)、[账户内投资](requirements-pension-investment-2026-11-12.md)、[底层分类](requirements-pension-classification-2026-11-12.md) |
| 展示与报告 | [记录筛选](requirements-record-filters-2026-11-12.md)、[导航与归档](requirements-report-navigation-2026-11-12.md)、[验收修复](ACCEPTANCE-FIXES-2026-11-12.md) |
| 周期、日历、会员 | [安装与取消](requirements-npm-calendar-2026-11-12.md)、[周期月报联动](VERIFICATION-RECURRING-MONTHLY-2026-11-12.md)、[会员需求](requirements-memberships-2026-11-12.md) |

## 历史材料

`requirements-*.md` 是需求；`plans/`、`superpowers/` 和技术设计含不同阶段方案；`VERIFICATION-*`、`INDEPENDENT-REVIEW-*` 是各次记录；`archive/` 是历史摘要。日期相同不代表口径相同，优先从当前摘要及专项修订定位。

旧站内模型、搜索 Key、推理 OAuth 配置和发布回执不是当前安装要求。历史路径可能只存在于原开发环境。公开资料删减不修改数据库，也不消除 Git 旧提交。

核心公开指南提供双语；历史需求、详细 MCP 契约和测试报告暂保留中文。英文导航明确标注这些链接，不宣称整库或应用 UI 已全部翻译。

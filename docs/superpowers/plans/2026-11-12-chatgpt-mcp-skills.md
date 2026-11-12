# ChatGPT MCP Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将所有AI工作迁到ChatGPT，提供完整MCP草稿链与可维护、可安装的Skill包。

**Architecture:** 复用家庭隔离、原子命令和financial_draft。新增受控查询与非财务结果草稿，月总结通过服务器依据指纹防过期。Skill从服务器默认目录加载并支持管理员版本覆盖，下载包通过独立安装器校验安装。

**Tech Stack:** TypeScript/React、Cloudflare D1、原生JSON-RPC MCP、Node测试、隔离SQLite/Playwright。

**Spec:** docs/requirements-chatgpt-mcp-2026-11-12.md

## Global Constraints

- 保留家庭隔离、原个人归属、审批与幂等；不写生产演示数据，不操作银行证券。
- 网站不依赖或调用NEW_API_*、TAVILY_API_KEY；旧数据不删除。
- 月度数字来自全量分录；金额单位明确、原币分开。
- Skill不能增加权限；只有管理员维护，不自动执行下载内容。

## Review Focus

- 分页跨版本与跨家庭引用拒绝，不能漏读300条以外的流水。
- 月总结提交后账目变化必须识别过期；纯草稿写入不能误使依据失效。
- 更新已有计划不得生成第四预算或静默保留旧审批。
- 恢复Skill历史创建新版本，不能覆盖审计或安装器；路径/包篡改拒绝。
- 退役入口、手机核对、无模型配置情况下全链运行。

### Task 1: 受控MCP依据读取
Files: src/server/mcp-queries.ts、src/server/mcp-http.ts、tests/mcp-workflows.test.mjs。
- [x] 写分页/成员/月份/全量月数据/稳定指纹/跨家庭拒绝测试并确认RED。
- [x] 实现list_transactions、get_monthly_review_context、get_recurring_candidates和严格参数/版本校验。
- [x] 定向测试GREEN，权限在结果组装后再核对。

### Task 2: 完整外部草稿链
Files: src/domain/mcp-draft.mjs、src/server/mcp-draft.ts、src/server/mcp-draft-schema.ts、src/domain/mcp-draft-ui.mjs。
- [x] 写月总结指纹/投资只读/周期证据/原预算更新审批与重试测试RED。
- [x] 扩展investment、monthly_review、recurring草稿；保持现有budget/cashflow/asset约束。
- [x] GREEN：仅核对后写目标记录，月报/研究无分录，周期autoPost=false。

### Task 3: Skill维护与安装包
Files: src/domain/skill-catalog.mjs、src/server/skill-http.ts、components/SkillPanel.tsx、app/api/skills/route.ts、scripts/install-finance-skills.py、tests/skill-bundle.test.mjs。
- [x] 版本/授权/恢复/下载及安装器路径和哈希篡改测试RED。
- [x] 实现5个聚焦工作流、默认备份、管理员版本化维护、可校验ZIP与安全快速安装。
- [x] GREEN并在临时目录真正安装、更新和恢复检查；不改本人的Skill安装配置。

### Task 4: 网站核对与展示迁移
Files: components/FinanceApp.tsx、components/McpDraftInbox.tsx、components/MonthlyReport.tsx、components/FinanceTools.tsx、新ExternalReviewPanel.tsx、旧AI路由。
- [x] 浏览器用例覆盖旧入口移除、图片路径提示、草稿核对、月总结/投资展示及手机布局。
- [x] 用ChatGPT结果页/工作流页替换站内AI入口，保留各业务核对；旧AI路由410，不再调用模型。
- [x] 移除有效配置中的模型Key；更新旧错误提示及预算修改入口。

### Task 5: 端到端与交付
- [x] 无任何模型/搜索Key的隔离HTTP+SQLite+浏览器全链，含双成员审批/外家庭拒绝/重复提交/旧月报/Skill安装。
- [x] npm test、typecheck和生产构建通过；3项独立缺陷及成员费用口径修复后回归。
- [x] 当前需求、使用说明、测试报告完成；29页Word逐页渲染核验，脱敏源码与部署运行代码校验一致。
- [x] 同一站点v31发布成功、环境16，六项旧模型配置移除；原18账户、预算和实付完全相同，真实下载安装包校验通过。

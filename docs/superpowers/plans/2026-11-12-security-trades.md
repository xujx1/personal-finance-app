# 基金股票买入与清仓 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基金/股票首次买入、增持和清仓同步调整选定银行现金。
**Architecture:** 复用asset.trade原子复式分录与幂等，独立交易服务及核对弹窗；无AI、无真实交易下单。
**Tech Stack:** TypeScript/React/D1/Node/SQLite/Chrome。
**Spec:** docs/superpowers/specs/2026-11-12-security-trades-design.md

## Global Constraints
- 保留个人归属与家庭隔离、同币种收付、实际事实确认；不操作银行券商。
- 清仓金额来自完整账面、已知数量；收益与资产转换分开，不重复扣手续费。

## Review Focus
- 新持仓失败不残留，重试不二次扣款。
- 基金8位小数份额与股票零持仓重买。
- 数量未知不能误称总量，清仓不能只把页面隐藏。
- 跨家庭、只读、币种/成员及快照日期保护。

### Task 1 后台记账
- [x] 写首次买入/增持/全量清仓/币种成员/日期/余额不足/重复请求用例并确认失败。
- [x] 提取asset-trade服务并实现mode与新持仓，定向回归通过。
### Task 2 页面交互
- [x] 增加基金/股票直接买入、清仓及首次买入入口；现金影响预览、实际确认和数量说明。
- [x] 真实HTTP/SQLite/浏览器验证首次买入、增持、清仓、历史重买、手机和只读边界。
### Task 3 验收交付
- [x] 独立复核、完整测试、类型检查、生产构建；更新需求/使用说明。
- [x] 生产构建与原站v32发布成功；修订46及18账户、预算、实付未变，修改保存在当前开发分支。

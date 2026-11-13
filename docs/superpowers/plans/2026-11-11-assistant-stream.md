# Assistant API Streaming Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, preserving autonomous execution requested by user.

**Goal:** 使用现有API Key修复真实流式生成、后台财务依据及可调整消费清单。
**Architecture:** research SSE与advisor/investment复用增量协议；提供方结构化参数与诊断独立；公开检索词服务端生成；清单行程关联在领域层与编辑器一致维护。
**Tech Stack:** Existing TypeScript/React, Worker/D1, native fetch SSE.
**Spec:** docs/superpowers/specs/2026-11-11-assistant-stream-design.md

## Global Constraints
保留家庭权限、个人归属、真实资产及预算确认；不输出隐藏推理链；不替换用户API配置或切换OAuth；来源和金额不得伪造，未完成输出不入库；正式站当前入口public但财务只限成员。

## Review Focus
- 200后TimeoutError、断流和输出截断不能被当成功或统一格式错误。
- 搜索自动词不能泄露账本或完整私人问题。
- 取消请求或成员被移除后不得保存草稿。
- 修改行程和数量后总额与审批清单必须一致。
- 模拟流通过不代表真实千问流通过。

### Task 1: 流协议与提供方诊断
Files: research-http.ts, chat-completions-stream.mjs, provider-generation.mjs, research-stream tests.
- [x] 红色测试：research首段先于最终结果；200后超时、千问参数和截断诊断。
- [x] 实现SSE封装、请求超时/参数、流进度与安全诊断。
- [x] 红绿验证及既有测试通过。

### Task 2: 内部研究和公开检索词
Files: public-research-query.mjs, research-http.ts, investment-http.ts, advisor-http.ts.
- [x] 自动关键词与敏感数据隔离测试；补充来源/结构化反馈测试。
- [x] 用明确实体生成查询，财务节点继续后台执行，scope和幂等保持。
- [x] 兼容已有显式关键词及OAuth流适配。

### Task 3: 流式界面和清单联动
Files: AdvisorPanel.tsx, InvestmentPanel.tsx, ExpenseDraftEditor.tsx, expense-plan.mjs.
- [x] 行程关联费用删除、数量单价重算的红色测试。
- [x] 消费研究改Accept SSE并显示增量文本，移除技术节点/财务依据铺陈；搜索词不再要求用户填写。
- [x] 投资保留单一问题流，不展示节点列表；行程和清单编辑联动、重新核对。
- [x] 隔离浏览器验证两阶段流式、编辑、比价和确认门禁。

### Task 4: 复核、正式发布与真实场景
- [x] 独立复核，重要问题红绿回归；完整测试、类型与构建。
- [x] 复用当前Sites原受众，发布确切源码版本。
- [x] 旅行与证券研究的真实服务请求：观察首段、最终清单或结论、保留时间及来源；不审批预算或交易。
- [x] 更新需求与验收记录、源码交付包。

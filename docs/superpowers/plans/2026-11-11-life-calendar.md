# 生活日历 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有财务中心按月或周查看旅行与餐饮安排，突出周末，并打开原计划详情。

**Architecture:** 新增只读日历投影和独立 React 组件，复用现有 plan 文档。日历不创建预算，不改变账本，不推测未提供的逐日行程或三餐。导航增加“生活日历”，详情复用 PlanDetails。

**Tech Stack:** React、TypeScript、现有 CSS、Node test，无新增生产依赖。

**Spec:** 用户在本聊天确认的“整月／本周、突出周末、当天安排、进入原计划”方案；本文件同时记录该小功能设计。

## Global Constraints

- 日期按 Asia/Shanghai 的业务日期；每周从周一开始。
- 新计划仍经 AI 消费助手；日历仅查看。预算是整项预算，不按天重复汇总。
- 默认不显示取消计划，可显式查看；保留已完成记录与待确认预算状态。
- 跨日旅行每天显示，逐日明细仅来自已保存的 itinerary。缺少日期明确列为未排期。
- 保留用户已有 .gitignore 修改；使用 codex/life-calendar 分支，暂不发布整个未验收应用。

## Review Focus

- 跨月、跨年、闰日与不同时区不能错位。
- 多天计划只投影可见区间，不遍历任意长日期范围。
- 无效日期不可静默排到今天；取消项默认隐藏。
- 同日多个计划可同时查看；没有逐日明细时不能虚构活动或餐次。
- 手机端不横向溢出；详情跳转仍指向对应原计划，查看不得写账。

## Task 1: 日历投影

**Files:** src/domain/life-calendar.mjs、tests/life-calendar.test.mjs。
**Interface:** buildLifeCalendar(plans, {anchor, view, kind, includeCancelled}) 返回 days 与 unscheduled；shiftCalendarDate(anchor, view, direction) 返回业务日期。

- [x] 先写跨月周末、闰日、范围截断、多计划/取消/分类/未排期、明细日期及无副作用测试，观察缺失模块失败。
- [x] 实现有界的日期投影与导航，运行该测试文件通过。

## Task 2: 视图与接线

**Files:** components/LifeCalendar.tsx、components/FinanceApp.tsx、app/globals.css。
**Consumes:** Task 1 的 days、unscheduled。

- [x] 实现月/周、上期/下期/今天、月份跳转、分类及取消状态筛选。
- [x] 点击日期展示当天全部计划和已保存明细；未提供明细明确说明；打开原计划详情；AI消费入口可带日期。
- [x] 运行完整 Node 回归；用隔离 API 夹具验证桌面、手机、跨月、筛选、详情和无写入。

## Task 3: 验证与交接

- [x] 类型检查与本地构建，区分既有错误和本次错误；复核 diff。
- [x] 更新执行清单，记录实测结果和未覆盖边界，不把本地验收称为 Sites 发布。

## 执行记录

- 基线 npm test：107/107 通过。
- 用户确认该展示方向，直接在当前指定项目继续；新功能使用分支，不另开工作目录。

- 日历领域测试：先观察缺失模块失败，完成后6项通过。年份边界问题经独立复核提出，补反例观察失败再修复。
- UI回归捕获首页对未排期null日期排序的报错，已修正；9项日历端到端检查通过，0异常/0写请求。
- 全量113项测试与正式构建通过；typecheck当前/原HEAD均31项既有诊断，新日历无诊断。
- Ruling: 此次只完成已授权的展示增量，不推进独立AI/三餐编辑流程，不发布整个尚未验收的财务应用。
- 保留为未提交的本地分支改动，便于用户直接审阅；用户原有.gitignore改动未覆盖。

# 流程截图 / Workflow screenshots

[产品手册](../../PRODUCT-MANUAL.md) · [English manual](../../PRODUCT-MANUAL.en.md) · [关键案例](../../KEY-CASES.md) · [清单 / Manifest](manifest.json)

## 证据范围 / Evidence scope

本目录18张图均为已有本地浏览器或组件验收产物，逐张检查、原样复制，没有新拍或改画界面。图片来自不同用例，不是一组连续生产操作。数据是隔离模拟家庭或独立组件，不证明生产登录、真实AI/银行交易或手机插件安装。来源报告没有日期时保持未知，不把复制日期当拍摄日期。

These 18 images are existing local browser/component artifacts, inspected and copied unchanged. Separate scenarios are not a continuous production session. Data uses isolated demo households/components and does not verify production sign-in, real AI/banking, or mobile installation. Missing original dates remain unknown.

新采集受TCP监听EPERM及Chrome沙箱启动SIGABRT限制。应用隐私模糊不是对真实截图的安全脱敏保证。原报告仅在开发work目录；表中套件数量是历史来源，不是本轮新通过。

New capture was blocked by TCP listen EPERM and sandbox Chrome SIGABRT. App privacy blur does not certify real-image redaction. Original reports remain under the development work directory; their suite counts are historical provenance, not new passes.

| ID | 流程 / Step | 来源时间 UTC / Date | 原套件P/F / Historical P/F |
| --- | --- | --- | --- |
| [S01](01-onboarding.png) | 建档 / Onboarding | 2026-11-12T10:14:12.766Z | 15/0 |
| [S02](02-workflow-integration.png) | 工作流接续（旧六入口）/ Handoff (older six-entry screen) | 2026-11-12T10:14:12.766Z | 15/0 |
| [S03](03-budget-review.png) | 预算草稿核对 / Budget draft review | 2026-11-12T13:53:31.063Z | 6/0 |
| [S04](04-share-approval.png) | 分享审批入口 / Share approval entry | 2026-11-12T11:00:53.034Z | 9/0 |
| [S05](05-approved-calendar.png) | 已批准计划日历 / Approved calendar plan | 2026-11-12T10:31:49.001Z | 17/0 |
| [S06](06-actual-expense-review.png) | 实际流水核对 / Actual cashflow review | 2026-11-12T10:31:49.001Z | 17/0 |
| [S07](07-recorded-cashflow.png) | 现金流水 / Cashflow | 2026-11-12T10:14:38.464Z | 11/0 |
| [S08](08-adopted-mobile.png) | 已采用草稿 / Processed drafts | 2026-11-12T13:50:33.873Z | 4/0 |
| [S09](09-plugin-connection.png) | 本站连接检查（本地）/ Site connection (local) | 未记录 / not recorded | 未记录 / not recorded |
| [S10](10-assets-desktop.png) | 资产和持仓行操作 / Assets and holdings | 2026-11-12T06:51:54.327Z | 10/0 |
| [S11](11-asset-type-editor-mobile.png) | 家庭类型维护 / Asset types | 2026-11-12T08:50:08.919Z | 16/0 |
| [S12](12-liquidation-mobile.png) | 清仓净回款 / Liquidation proceeds | 2026-11-12T06:51:54.327Z | 10/0 |
| [S13](13-monthly-archive.png) | 月报已保存版本 / Monthly archive | 2026-11-12T10:16:19.944Z | 6/0 |
| [S14](14-recurring-rule-mobile.png) | 新增周期规则 / Recurring rule | 2026-11-12T10:16:19.944Z | 6/0 |
| [S15](15-recurring-monthly-overview.png) | 月报中的周期与预测 / Recurring report | 2026-11-12T10:53:20.699Z | 4/0 |
| [S16](16-monthly-second-version.png) | 月报后续版本 / Later report version | 2026-11-12T10:16:19.944Z | 6/0 |
| [S17](17-attachments-mobile.png) | 附件独立组件 / Attachment component | 未记录 / not recorded | 9/0 |
| [S18](18-investment-followup-calendar.png) | 未交易的投资复核 / Investment follow-up | 2026-11-12T10:29:30.989Z | 5/0 |

## 版本差异 / Differences

- S02为旧六入口和本机命令，当前本地连接界面见S09。 / S02 is the old installer; S09 is current local connection UI.
- S03来源为未入库专项脚本，不承诺一条命令重现或完整采用证据。 / S03 has an untracked focused source script, not full adoption evidence.
- S04只显示分享；S05选中12日、批准计划在14–15日，底部待批候选文案为旧版。 / S04 shows sharing; S05 has historical pending-candidate footer text.
- S06为已含余额历史；S08只显示处理状态。 / S06 is covered history; S08 is processing status.
- S09仅本地实现，不证明另一ChatGPT会话已连接。 / S09 is local-only, not another chat’s connection status.
- S10页顶草稿箱为旧布局；当前统一在研究记录。 / S10 retains a historical draft panel.
- S13/S16是归档不同版本；S15不是独立预测页。 / S13/S16 are separate archives; S15 is not the forecast page.
- S17为组件画面，S18为投资复核，不是付款或交易。 / S17 is component-level; S18 is a follow-up, not trading.

## 尚缺的清洁截图 / Missing clean screenshots

家庭完整邀请/第二真实账号、目标、贷款、养老金、会员、独立预测及年度预算仍缺来源完整的清洁截图。部分既有样本沿用个人参数来源，故不复制公开。文字步骤已覆盖，截图缺口不标通过。

Clean images are still needed for full invitation/real second identity, goals, loans, pensions, memberships, dedicated forecasts, and annual budgets. Some existing samples reuse personal-input provenance and are excluded. Written instructions exist; screenshot gaps are not passes.

刷新使用独立合成数据，记录源码、脚本、日期和环境，同步双语手册与哈希。 / Refresh using independent synthetic data and source/script/date/environment metadata; update both manuals and hashes.

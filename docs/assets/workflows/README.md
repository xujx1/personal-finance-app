# 流程截图 / Workflow screenshots

[中文指南](../../USER-GUIDE.md) · [English guide](../../USER-GUIDE.en.md) · [完整清单 / Full manifest](manifest.json)

## 来源与边界 / Provenance and limits

这些图片来自2026-11-12的已有本地Chrome验收，逐张检查后原样复制。数据为隔离模拟家庭，身份与ChatGPT结构化内容为测试输入；应用HTTP/SQLite/浏览器为实际运行。图片来自不同场景，不拼接为连续真实用户流程。原报告仅在开发工作目录，本表与清单保留其元数据；不将原报告结果计入本轮通过数。

Images were captured during existing local Chrome checks on 2026-11-12 and copied unchanged after visual inspection. Household data, identities, and structured AI content are synthetic test inputs; HTTP/SQLite/browser execution is real. Separate scenarios are not one continuous production session. Original reports remain in the development work directory; this inventory preserves their metadata, not newly executed evidence.

本轮重新采集因本地TCP监听EPERM受阻，没有新截图。图片不证明生产Sites登录、生产D1、实际ChatGPT推理/搜索/图片识别、跨设备安装或银行交易。原图中的隐私模糊是应用自身效果，未用图像工具补画或修改。

New capture was blocked by local TCP listen EPERM. Images do not verify production Sites identity/D1, actual ChatGPT inference/search/vision, cross-device installation, or banking. Privacy blur is the application’s own display; images were not redrawn or edited.

| ID | 流程 / Step | 原报告时间 UTC / Original report | 原套件通过/失败 / Historical suite P/F |
| --- | --- | --- | --- |
| [S01](01-onboarding.png) | 建档 / Onboarding | 2026-11-12T10:14:12.766Z | 15/0 |
| [S02](02-workflow-integration.png) | 工作流接续（旧六入口）/ Handoff (older six-entry screen) | 2026-11-12T10:14:12.766Z | 15/0 |
| [S03](03-budget-review.png) | 预算草稿核对 / Budget draft review | 2026-11-12T13:53:31.063Z | 6/0 |
| [S04](04-share-approval.png) | 分享审批入口 / Share approval entry | 2026-11-12T11:00:53.034Z | 9/0 |
| [S05](05-approved-calendar.png) | 已批准计划日历 / Approved calendar plan | 2026-11-12T10:31:49.001Z | 17/0 |
| [S06](06-actual-expense-review.png) | 实际流水核对 / Actual cashflow review | 2026-11-12T10:31:49.001Z | 17/0 |
| [S07](07-recorded-cashflow.png) | 现金流水 / Cashflow | 2026-11-12T10:14:38.464Z | 11/0 |
| [S08](08-adopted-mobile.png) | 已采用草稿 / Processed drafts | 2026-11-12T13:50:33.873Z | 4/0 |

## 已知版本差异 / Known differences

- S02展示旧版六入口及本机安装地址。当前有七个业务入口，插件接入另有本地改动；不要从图片复制安装命令。 / S02 shows an older six-entry installer and localhost URL. There are now seven business entries and additional local plugin changes; do not copy its command.
- S03为长草稿专项界面，含采用后的状态提示，不独立证明整个采用请求。原专项脚本未入库，不能承诺一条命令重现同图。 / S03 includes post-adoption feedback in a long-draft scenario. Its focused script was not tracked; a one-command reproduction is not claimed.
- S04仅展示分享弹窗，不是家人已同意的证据。 / S04 shows sharing, not completed consent.
- S05选中12日，批准计划在14–15日。底部待审批候选描述为旧文案，现行待批预算不进入正式日历。 / S05 selects the 12th; the approved plan is on the 14th–15th. Its pending-candidate footer is historical; pending budgets do not enter the formal calendar.
- S06为历史已含余额示例，不是新付款或关联预付款截图。 / S06 illustrates history already covered by a balance, not a new payment or prepayment settlement.
- S07金额隐藏；S08仅展示处理状态。两图均不能单独证明余额数值及幂等。 / S07 hides amounts; S08 shows processing status. Neither alone proves balances or idempotency.

## 刷新规则 / Refresh rules

只从新建隔离家庭重新拍摄，明确脚本、源码版本、日期及测试数据，不复用个人账本；更新图片后同步中英文指南与manifest哈希。涉及真实登录、生产读写或客户端验证的证据须另行授权并脱敏，不能用演示图替代。

Refresh from a new isolated household, recording the script, source revision, date, and synthetic inputs. Update both guides and manifest hashes. Real sign-in, production operations, and client acceptance require separate authorized, sanitized evidence.

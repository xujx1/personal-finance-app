# 产品手册与案例校验 / Product documentation verification

日期 / Date：2026-11-13，Asia/Shanghai。源码基线 / Source baseline：`e291b5a`及当前未提交工作树 / plus the current uncommitted worktree. 仓库在写作期间有并行更新；最终按该基线重跑相同测试集。 / The repository changed concurrently during authoring; the same checks were rerun against this final baseline.

## 交付内容 / Deliverables

- 18个模块章节，覆盖当前源码13个导航/账户菜单入口；中英文逐步操作、预期结果、异常和案例关联。 / 18 chapters covering all13 navigation/account-menu entries, with bilingual steps, outcomes, exceptions, and linked cases.
- 40个关键案例，保存独立合成数据、步骤、预期账务变化、失败判据、测试定位；手工执行状态均为not_run。 / 40 cases with independent synthetic data, steps, expected accounting, failure criteria, and test references; all manual statuses are not_run.
- 18张已检查的既有隔离演示/组件截图，附来源与哈希；新增10张，前8张保留。 / 18 reviewed historical isolated/demo component images with provenance/hashes; ten added to the earlier eight.
- 双语Markdown手册与案例库，以及内嵌全部图片的单文件HTML，可离线看图、切换语言、搜索案例和打印。 / Bilingual Markdown manuals/case libraries plus standalone HTML embedding all images, supporting language switching, search, enlargement, and printing.

## 自动化证据 / Automated evidence

本轮执行以下20个既有测试文件：**144通过、0失败、0跳过**。这仅说明这些自动化检查在执行时工作树上通过，不等于40项手工示例、全部组合、生产OAuth、真实第二账号或移动端插件安装已通过。

The following20 existing files were executed: **144 passed,0 failed,0 skipped**. This verifies those automated checks on the worktree at execution time, not all40 manual examples/combinations, production OAuth, a real second identity, or mobile plugin installation.

```sh
node --test tests/onboarding-setup.test.mjs tests/family-api-isolation-v15.test.mjs tests/family-approval-v15.test.mjs tests/mcp-amend.test.mjs tests/mcp-plan-actuals.test.mjs tests/security-trades.test.mjs tests/pension-investment.test.mjs tests/pension-classification.test.mjs tests/recurring-monthly-link.test.mjs tests/recurring-safety.test.mjs tests/monthly-report-archive.test.mjs tests/monthly-report.test.mjs tests/goal-combinations.test.mjs tests/custom-asset-types.test.mjs tests/memberships.test.mjs tests/position-snapshot.test.mjs tests/financial-privacy.test.mjs tests/attachments.test.mjs tests/plugin-connection.test.mjs tests/calendar-cancel.test.mjs
```

## 文档结构与数据核对 / Structure and data checks

构建校验双语步骤数量、ID唯一、案例全部关联章节、引用测试文件存在、18张图片哈希。另核对Markdown本地链接和锚点、HTML ID/图片/语言区、内嵌脚本语法，以及主要示例账务算术。

The build checks bilingual step parity, unique IDs, chapter links for every case, existing test paths, and all18 image hashes. Additional checks cover local Markdown links/anchors, HTML IDs/images/language panels, inline-script syntax, and central example arithmetic.

| 示例 / Example | 预期核算 / Expected arithmetic |
| --- | --- |
| C09 实付/预付/冲抵/退款 / Settlement cycle | 银行1000→880→830→830→850；最终预付0、实际消费150 / bank1,000→880→830→830→850, prepaid0, actual consumption150 |
| C21 买入/清仓 / Purchase/liquidation | 银行1000−300−5＋330−5＝1020 / cash1,000−300−5＋330−5＝1,020 |
| C23 还贷 / Loan payment | 银行1000−100−10＝890；贷款5000−100＝4900 / cash890, debt4,900 |
| C29 养老金内部投资 / Internal pension trading | 内现金200→100→210→160，产品0→100→0→50；普通银行及缴费不变 / internal cash200→100→210→160, products0→100→0→50, ordinary bank/contributions unchanged |
| C39 内部转账 / Transfer | A1000−200＝800，B500＋200＝700，总额1500 / A800, B700, total1,500 |

最终静态检查：14份本轮Markdown、855个本地目标、390个明确锚点均有效；HTML中18张内嵌原图哈希一致，118个ID唯一，脚本语法通过且无外部脚本/样式依赖。18章中英文各90个操作步骤，40项案例各112个步骤。五组核心账务示例算术已核对。

Final static checks:14 revised Markdown files,855 local targets,390 explicit anchors,18 verified embedded images,118 unique HTML IDs, valid script syntax, and no external script/style dependencies. Each language has90 operation steps and112 case steps. Five central accounting examples were checked arithmetically.

## 未执行与缺口 / Not run and gaps

新浏览器采集尝试因Chrome在沙箱中启动SIGABRT而失败；此前本地端口监听也被EPERM拒绝。未绕过限制，未拍摄新生产图。HTML交互已做静态结构与脚本语法检查，未完成本轮浏览器视觉验收。

New capture failed with sandbox Chrome SIGABRT; earlier local TCP listening was denied with EPERM. Restrictions were not bypassed and no new production images were captured. HTML structure/script syntax were checked statically; a new browser visual acceptance run was not completed.

家庭完整邀请/真实第二账号、目标、贷款、养老金、会员、独立预测与年度预算仍缺适合公开的清洁截图。部分旧图有个人参数来源，故未复制。相关入口和操作均写入手册，截图缺口没有标成通过。旧Git提交和原测试夹具资料风险继续见[安全校验报告](../PUBLIC-DATA-REVIEW-2026-11-13.md)。

Clean images remain missing for full invitations/real second-user access, goals, loans, pensions, memberships, dedicated forecasts, and annual budgets. Older personal-input-derived samples were excluded. Their operations are documented; image gaps are not passes. Existing history/fixture privacy findings remain in the [security review](../PUBLIC-DATA-REVIEW-2026-11-13.md).

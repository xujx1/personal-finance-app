# Fresh independent final implementation audit — 2026-11-11

Scope: current working tree on codex/life-calendar, requirements-latest and remaining-features plan; independent inspection of consumption draft normalization/editor/advisor and acceptance gates, finance commands, investment delegation/read tools, OAuth service, cash aggregation/planning and source exporter. No production database, .env, credentials or real user records accessed. No code changed. This is a focused final risk audit, not a claim that every source line or all 60 checklist items have been independently validated. Existing test counts reported by the coordinating agent are not independently rerun here.

## Important findings

### P1 — Mortgage comparison changes the baseline even when prepayment is zero

Location: `components/PlanningPanels.tsx:35` (also `src/domain/planning.mjs:5`).

With a known monthly payment, the baseline always uses reduce_term, whereas the default scenario uses reduce_payment and discards that monthly payment. An inconsistent entered remaining term therefore produces a different schedule without any prepayment. The result labels the difference as the interest effect of the proposed repayment, which can materially mislead a financing decision.

Independent executable reproduction (pure function, no database): principal 10000000 minor units, rate 3%, months 120, payment 120000 minor units, prepayment 0. Baseline: 94 months, interest 1227563; scenario: 120 months, interest 1587291. UI reports an interest difference of -359728 despite zero action.

Fix: establish one consistent baseline from payment and term (reject or explicitly reconcile inconsistent bank inputs); compare both scenarios under that baseline. Zero prepayment should preserve the baseline schedule and interest. Add a component/domain regression with a known payment and inconsistent term.

### P2 — Unified investment assistant cannot itself fetch latest holding quotes

Location: `src/server/financial-tools.ts:12–22`, `src/server/investment-http.ts:41–44`.

get_market_quotes only reads runtime_cache and explicitly says it did not request latest quotes. The investment handler eagerly executes these cached readers and delegates research; no quote adapter refresh occurs. A fresh user with registered holdings receives unavailable quotes, and an old cached price stays old until the user separately refreshes the asset page. This is a remaining local functional gap against the requested unified assistant with latest-price/market internal nodes, not an external credentials blocker. Source/date labels correctly avoid pretending the cache is live.

Fix: expose a bounded read-only quote refresh through the unified investment flow, with timeout, cancellation, per-symbol failures, cached fallback explicitly marked stale and original source/date retained. Verify a fake adapter call from the investment request, not just from the separate assets page.

## Gates and boundaries inspected

- Consumption quantities and minor-unit amounts are recomputed server-side; reviewed drafts are attached to immutable advice and acceptance reads that stored draft. Advice requires model approval, current dataset/revision and unexpired approval. Existing reviewed plan dates/budget and selected item identity/amount cannot be silently changed through ordinary plan update/detail routes.
- Research proposal normalization restricts item/comparison URLs to actual accepted source URLs. OAuth research first sends only the explicit public search keywords to web-enabled inference and then sends private financial context to a separate web:false inference. This is a meaningful privacy separation; real-provider behavior remains unvalidated here.
- Investment SSE wraps a cancellation signal through readers, delegated fetch/inference and final result checks. Tools are bounded read-only functions. No automatic trading path found in reviewed flows.
- OAuth refresh uses a lease plus encrypted compare-and-swap and deliberately persists rotated credentials independently of caller cancellation. No real token rotation exercised.
- Monthly actual cashflow is derived from complete posted cash-account entries, independent of the display limit of 300 transactions, with currency separation and opening/adjustment columns.
- Exporter includes local/ source while excluding runtime directories, database and credential suffixes, environment values and symlinks. Its own header correctly states that reviewed source is a prerequisite: the allowlist does not prove arbitrary source prose/images contain no personal data or hardcoded secrets. A complete staged export content review and manifest validation must precede shipping.

## Separate external and deployment validation gaps

Do not mark the full checklist complete. Actual model/search/vision credentials and OAuth client setup/authorization are absent according to the coordinating agent, so real provider responses, search quality and citations, vision accuracy, quota behavior and refresh-token rotation remain unaccepted. No independent real provider connectivity was attempted. Earlier ECB/US quote connectivity and unavailable fund 000001 results are coordinator evidence, not reproduced here.

Hosted D1 migrations/binding, object storage, owner identity, private access, scheduler operation, production build/runtime smoke checks and rollback remain deployment acceptance work. Use the existing owner-private empty Site only; no actual finance data, screenshots or credentials should enter a Site/source artifact. This audit does not authorize public sharing, data import or deployment and did not inspect or mutate the Site.

Recommendation: address the two local findings, rerun targeted regressions and required final checks, review the exact export artifact, and retain explicit external acceptance blockers. No Critical defect established in the reviewed scope; deployment readiness is not established by this audit.

## Fix verification addendum

Both reported local findings are resolved in the subsequently reviewed working tree.

- P1: `compareMortgageScenarios` now compares the same mode and assumptions on both sides. Reduce-payment uses the entered term/annuity on both sides and explicitly labels the recorded monthly payment as reference; reduce-term uses the same recorded (or estimated) payment on both sides. PlanningPanels delegates to this function and describes the assumptions. The original zero-prepayment reproduction is now covered by exact equal-schedule assertions for both modes; positive-prepayment regressions also conserve principal.
- P2: Investment now invokes the bounded market handler before reading quote facts, passes the request cancellation signal, reads the refreshed cache, and carries refresh status/message into model facts. The regression starts with stale BABA 1.00, asserts one mocked quote request and model facts containing 102.72. Market refresh retains the existing 30-holding bound, 5-minute cache and per-source timeout; failed refreshes remain explicitly stale/unavailable.

Independent verification: `node --test tests/planning.test.mjs tests/investment-http.test.mjs` — 21 passed, 0 failed. Inspected the implementation and component wiring; no code changed outside this report. This addendum closes these two findings only. The external-provider, deployment and exact-export review boundaries above remain; it does not assert all-source audit, all-checklist completion or production readiness.


## 最新页面与月报独立复核

新上下文只读复核识别5项重要问题：总览报价币种不匹配、审核快照记账日期未采用核实日期、新报表金额未受隐藏开关遮盖、CNY周期规则误选外币贷款、预测页残留历史月表。已逐项修复并用单元/接口或浏览器回归验证；另修正汇率日期字段。最终206项测试、17项完整E2E、23项专项页面检查、类型检查与构建通过。正式服务依赖不由本地结果替代。

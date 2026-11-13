# Key case library

[中文](KEY-CASES.md) · [English](KEY-CASES.en.md) · [产品手册 / Manual](PRODUCT-MANUAL.en.md) · [图文版 / Illustrated edition](product-demo.html)

These forty cases are maintainable business scenarios, not forty newly passed demonstrations. Each preserves data, steps, expected accounting, failure criteria, and automation references. Independent synthetic example values need not match historical screenshots.

P0 marks access/fund/ownership/idempotency/history boundaries; P1 important display or planning paths. Every manual status is not_run. This revision reran twenty existing test files with144 passing tests; that does not certify all combinations or real-client scenarios here. See [verification](manual/VERIFICATION.md).

## Index

| ID | Priority | Case | Manual status |
| --- | --- | --- | --- |
| [C01](#c01) | P0 | Opening balances are not income | not_run |
| [C02](#c02) | P0 | Duplicate registration and adoption | not_run |
| [C03](#c03) | P0 | Snapshot dates and future actual events | not_run |
| [C04](#c04) | P0 | Budget lifecycle does not auto-debit cash | not_run |
| [C05](#c05) | P0 | Every member approves for themselves | not_run |
| [C06](#c06) | P0 | Budget edits require reapproval | not_run |
| [C07](#c07) | P0 | Link actual payment to its budget | not_run |
| [C08](#c08) | P0 | Covered history is not debited twice | not_run |
| [C09](#c09) | P0 | Payment–prepayment–consumption–refund cycle | not_run |
| [C10](#c10) | P0 | Safe retry after a lost response | not_run |
| [C11](#c11) | P0 | Insufficient funds roll back completely | not_run |
| [C12](#c12) | P0 | Cancellation preserves actuals and recovers refresh | not_run |
| [C13](#c13) | P0 | Household isolation on reads and writes | not_run |
| [C14](#c14) | P0 | Read-only members submit only their own opinion | not_run |
| [C15](#c15) | P0 | Removal revokes stale sessions and in-flight writes | not_run |
| [C16](#c16) | P0 | Invitation lifecycle and administrator transfer | not_run |
| [C17](#c17) | P0 | Bookkeeping profiles grant no sign-in access | not_run |
| [C18](#c18) | P0 | Same-ID amendment, version checks, processed immutability | not_run |
| [C19](#c19) | P1 | Asset-type nature, references, and disabling | not_run |
| [C20](#c20) | P0 | Goal units, combinations, and deduplication | not_run |
| [C21](#c21) | P0 | Purchase plus fees and liquidation net proceeds | not_run |
| [C22](#c22) | P0 | Member, currency, and household mismatches | not_run |
| [C23](#c23) | P0 | Loan simulation versus actual principal and interest | not_run |
| [C24](#c24) | P0 | Future first occurrence, pause, and rule totals | not_run |
| [C25](#c25) | P0 | Changing the day does not duplicate a monthly occurrence | not_run |
| [C26](#c26) | P0 | Separate income, expense, cashflow, and net worth | not_run |
| [C27](#c27) | P0 | Immutable archive and stale review basis | not_run |
| [C28](#c28) | P0 | Complete pagination with consistent versions | not_run |
| [C29](#c29) | P0 | Pension internal trading is not external contribution | not_run |
| [C30](#c30) | P0 | Pension restrictions survive snapshots and ownership edits | not_run |
| [C31](#c31) | P1 | Membership validity, party coverage, incremental cost | not_run |
| [C32](#c32) | P0 | Quotes, snapshots, and missing FX do not post | not_run |
| [C33](#c33) | P1 | Privacy defaults hide display, not edit values | not_run |
| [C34](#c34) | P0 | Attachment upload success, failure, uncertain result | not_run |
| [C35](#c35) | P0 | Site connection does not certify another chat | not_run |
| [C36](#c36) | P0 | Images create reviewable, deduplicated candidates | not_run |
| [C37](#c37) | P0 | Exact cost totals, quote conditions, and unknowns | not_run |
| [C38](#c38) | P1 | Research and follow-up do not trade | not_run |
| [C39](#c39) | P0 | Same-currency transfers are not income | not_run |
| [C40](#c40) | P1 | Clearing/archiving preserves history and re-entry | not_run |

<a id="c01"></a>

## C01 · P0 · Opening balances are not income

**Prerequisites and data：** Independent empty household A; demo bank A has CNY1,000 as of D-1; D is the demo date.

### Steps

1. Submit an owned existing-asset draft.
2. Inspect formal accounts before adoption, then confirm ownership/member/date on the website.
3. Inspect assets, cashflow, and the monthly report.

**Expected result：** No formal asset before adoption. Afterwards bank cash is1,000 with an opening record, not1,000 of income or a second top-up.

**Failure criteria：** Opening counted as wages, or the existing balance doubled after adoption.

**Automation references：** [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs) / [mcp-drafts.test.mjs](../tests/mcp-drafts.test.mjs)

**Manual chapters:** [M03](PRODUCT-MANUAL.en.md#m03)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S01](assets/workflows/01-onboarding.png)


<a id="c02"></a>

## C02 · P0 · Duplicate registration and adoption

**Prerequisites and data：** C01 adopted; retain its draft ID and request.

### Steps

1. Retry the same adoption request.
2. Read the original result/account count, then attempt a second registration of the same holding.

**Expected result：** The original request creates no additional asset/journal. A suspicious duplicate registration must be rejected or reviewed, not bypassed by renaming.

**Failure criteria：** A second account, doubled balance, or duplicate opening.

**Automation references：** [mcp-drafts.test.mjs](../tests/mcp-drafts.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**Manual chapters:** [M03](PRODUCT-MANUAL.en.md#m03)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c03"></a>

## C03 · P0 · Snapshot dates and future actual events

**Prerequisites and data：** Bank snapshot D-1; an uncovered actual payment10; a separate unperformed payment on D+1.

### Steps

1. Record the actual event on D with correct snapshot coverage.
2. Attempt D+1 or a mismatched covered-history date.

**Expected result：** A valid actual event can be reviewed; future actuals and inconsistent coverage are rejected without cash changes.

**Failure criteria：** Premature debit or a second debit across a snapshot.

**Automation references：** [plan-actual-date.test.mjs](../tests/plan-actual-date.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**Manual chapters:** [M03](PRODUCT-MANUAL.en.md#m03)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c04"></a>

## C04 · P0 · Budget lifecycle does not auto-debit cash

**Prerequisites and data：** Bank1,000; budget300; two active signed-in members.

### Steps

1. Submit and read back a budget.
2. Adopt it for approval.
3. Have both members agree, then inspect calendar and cash.

**Expected result：** Cash stays1,000 throughout submission/adoption/approval/scheduling, with no300 expense. A formal plan appears only after all agree.

**Failure criteria：** Cash debited on budget save, or pending budget treated as formal.

**Automation references：** [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs) / [approved-plan-calendar.test.mjs](../tests/approved-plan-calendar.test.mjs)

**Manual chapters:** [M10](PRODUCT-MANUAL.en.md#m10)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S03](assets/workflows/03-budget-review.png) / [S04](assets/workflows/04-share-approval.png) / [S05](assets/workflows/05-approved-calendar.png)


<a id="c05"></a>

## C05 · P0 · Every member approves for themselves

**Prerequisites and data：** Administrator A and member B; pending budget300.

### Steps

1. After A agrees, inspect B’s pending approval.
2. Attempt to approve as B from A, then have B approve using their own identity.

**Expected result：** A cannot vote for B. The plan remains pending until B agrees; identity is server-derived.

**Failure criteria：** Client-specified identity votes, or one vote treated as unanimous.

**Automation references：** [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs) / [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**Manual chapters:** [M10](PRODUCT-MANUAL.en.md#m10)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S04](assets/workflows/04-share-approval.png)


<a id="c06"></a>

## C06 · P0 · Budget edits require reapproval

**Prerequisites and data：** Approved300 version1, amended to320 version2.

### Steps

1. Amend costs under the original plan ID and adopt.
2. Retry approval with v1 parameters.
3. Complete all approvals for v2.

**Expected result：** Plan ID stays the same. Old opinions do not approve v2; stale requests fail, and new payments are blocked until renewed approval.

**Failure criteria：** Old approval survives a price change, or a duplicate formal plan is created.

**Automation references：** [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs) / [mcp-amend.test.mjs](../tests/mcp-amend.test.mjs) / [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**Manual chapters:** [M10](PRODUCT-MANUAL.en.md#m10)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c07"></a>

## C07 · P0 · Link actual payment to its budget

**Prerequisites and data：** Approved budget300; bank1,000; actual uncovered payment120.

### Steps

1. Submit a120 cashflow draft linked to the original planId.
2. Confirm member/account/date/uncovered status and actual payment on the website.
3. Inspect the plan, transaction, and bank.

**Expected result：** Cash remains1,000 at draft stage, then880 after adoption with exactly one linked payment; do not debit the300 budget.

**Failure criteria：** Debits300, links the wrong plan, or debits during draft submission.

**Automation references：** [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**Manual chapters:** [M11](PRODUCT-MANUAL.en.md#m11)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S06](assets/workflows/06-actual-expense-review.png) / [S07](assets/workflows/07-recorded-cashflow.png)


<a id="c08"></a>

## C08 · P0 · Covered history is not debited twice

**Prerequisites and data：** Bank snapshot1,000 on D-1 already covers a prior20 expense.

### Steps

1. Submit the historical event as covered with the matching snapshot date.
2. Adopt and inspect bank balance and historical business amount.
3. Attempt an inconsistent coverage date.

**Expected result：** Cash stays1,000; historical expense20 is recorded with zero current cash movement. Inconsistent coverage is rejected.

**Failure criteria：** Cash falls to980, or the historical business amount is erased.

**Automation references：** [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**Manual chapters:** [M11](PRODUCT-MANUAL.en.md#m11)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S06](assets/workflows/06-actual-expense-review.png)


<a id="c09"></a>

## C09 · P0 · Payment–prepayment–consumption–refund cycle

**Prerequisites and data：** Independent bank1,000; approved budget300; each event actually occurs on D and is not snapshot-covered.

### Steps

1. Pay120 directly.
2. Prepay50.
3. Consume30 from that prepayment.
4. Refund the unused20 to the original bank.
5. Check cash/prepaid/consumption at each step and retry the same consumption request.

**Expected result：** Cash880→830→830→850; prepaid asset0→50→20→0; final actual consumption150. Retry neither debits cash nor consumes prepaid funds twice.

**Failure criteria：** Consumption debits cash again, consumed funds are refunded, refund goes elsewhere, or retry consumes twice.

**Automation references：** [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs) / [ledger.test.mjs](../tests/ledger.test.mjs) / [extensions.test.mjs](../tests/extensions.test.mjs)

**Manual chapters:** [M11](PRODUCT-MANUAL.en.md#m11)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S06](assets/workflows/06-actual-expense-review.png) / [S08](assets/workflows/08-adopted-mobile.png)


<a id="c10"></a>

## C10 · P0 · Safe retry after a lost response

**Prerequisites and data：** Bank1,000 pays10; retain the original request key.

### Steps

1. In an isolated fault test, let the server succeed while dropping the response.
2. Query the original key, then retry the same request.
3. Inspect balance, transaction count, and receipt.

**Expected result：** Final cash990 with one payment. An uncertain result is not permission to create a new key.

**Failure criteria：** Second debit, silent replay with a new key, or treating missing UI feedback as definite failure.

**Automation references：** [http.test.mjs](../tests/http.test.mjs) / [store.test.mjs](../tests/store.test.mjs) / [attachments.test.mjs](../tests/attachments.test.mjs)

**Manual chapters:** [M11](PRODUCT-MANUAL.en.md#m11) / [M18](PRODUCT-MANUAL.en.md#m18)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c11"></a>

## C11 · P0 · Insufficient funds roll back completely

**Prerequisites and data：** Bank50; try payment60 or a purchase50 plus fee1.

### Steps

1. Submit and confirm the operation.
2. Compare accounts, plan, transactions, and business audit state before/after.

**Expected result：** Reject; cash remains50 with no partial journal, new holding, or false paid status.

**Failure criteria：** Negative cash, orphan holding, or paid plan without a transaction.

**Automation references：** [ledger.test.mjs](../tests/ledger.test.mjs) / [security-trades.test.mjs](../tests/security-trades.test.mjs)

**Manual chapters:** [M11](PRODUCT-MANUAL.en.md#m11)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c12"></a>

## C12 · P0 · Cancellation preserves actuals and recovers refresh

**Prerequisites and data：** An approved plan has20 paid and30 unused prepaid.

### Steps

1. Cancel the current version.
2. Inspect normal/cancelled views and original transactions.
3. Simulate successful cancellation with failed refresh, then refresh again.

**Expected result：** Unused reserves release;20 paid and30 prepaid history remain. No automatic refund or repeat cancellation; existing prepaid funds remain settleable by actual consumption/refund.

**Failure criteria：** Cancellation invents cash, deletes payments, or replays a successful write.

**Automation references：** [calendar-cancel.test.mjs](../tests/calendar-cancel.test.mjs) / [cancellation-ui.test.mjs](../tests/cancellation-ui.test.mjs)

**Manual chapters:** [M12](PRODUCT-MANUAL.en.md#m12)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S05](assets/workflows/05-approved-calendar.png)


<a id="c13"></a>

## C13 · P0 · Household isolation on reads and writes

**Prerequisites and data：** Separate demo households A/B; A owns a private plan and account.

### Steps

1. As B, open A’s plan URL and request A’s account/finance/report/attachment/MCP data.
2. Attempt drafts or writes referencing A’s resources.
3. Repeat reads anonymously.

**Expected result：** No A names, amounts, receipts, or records leak; writes fail. Anonymous access normally gets401; unauthorized authenticated access gets403 or a nonrevealing response.

**Failure criteria：** ID knowledge grants access, MCP bypasses scope, or errors leak balances.

**Automation references：** [family-api-isolation-v15.test.mjs](../tests/family-api-isolation-v15.test.mjs) / [family-route.test.mjs](../tests/family-route.test.mjs) / [mcp.test.mjs](../tests/mcp.test.mjs)

**Manual chapters:** [M01](PRODUCT-MANUAL.en.md#m01) / [M18](PRODUCT-MANUAL.en.md#m18)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c14"></a>

## C14 · P0 · Read-only members submit only their own opinion

**Prerequisites and data：** Member B is read-only and included in the pending approval set.

### Steps

1. As B, read the household and attempt financial/rule/goal/draft/membership changes.
2. Submit B’s own budget opinion.

**Expected result：** General writes fail while B’s own opinion succeeds. Voting permission neither disappears with read-only status nor expands into financial write access.

**Failure criteria：** Approval and general-write permissions are conflated.

**Automation references：** [family-api-isolation-v15.test.mjs](../tests/family-api-isolation-v15.test.mjs) / [family-approval-v15.test.mjs](../tests/family-approval-v15.test.mjs)

**Manual chapters:** [M01](PRODUCT-MANUAL.en.md#m01)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c15"></a>

## C15 · P0 · Removal revokes stale sessions and in-flight writes

**Prerequisites and data：** B has loaded the household; A removes B before commit.

### Steps

1. Keep B’s stale page/request.
2. Remove B, then retry refresh/read/write.
3. In an isolated test, remove membership between initial read and final commit.

**Expected result：** Subsequent reads/final writes fail after revocation; stale snapshots grant nothing. Prior history/ownership remain.

**Failure criteria：** UI hides data but stale requests still save, or removal deletes assets.

**Automation references：** [family-api-isolation-v15.test.mjs](../tests/family-api-isolation-v15.test.mjs) / [family.test.mjs](../tests/family.test.mjs)

**Manual chapters:** [M01](PRODUCT-MANUAL.en.md#m01)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c16"></a>

## C16 · P0 · Invitation lifecycle and administrator transfer

**Prerequisites and data：** Independent invitation tokens used only in isolation.

### Steps

1. Accept once, reuse, then test revoked/expired/invalid tokens.
2. Try joining from another existing household and direct administrator departure.
3. Transfer management to an active member before leaving.

**Expected result：** No token reuse or revoked access, no accidental household merge, no ownerless household, and no asset ownership transfer.

**Failure criteria：** Reuse, ineffective revocation, or asset ownership moving with management.

**Automation references：** [family.test.mjs](../tests/family.test.mjs) / [family-route.test.mjs](../tests/family-route.test.mjs)

**Manual chapters:** [M01](PRODUCT-MANUAL.en.md#m01)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c17"></a>

## C17 · P0 · Bookkeeping profiles grant no sign-in access

**Prerequisites and data：** New nickname “Demo member B”, without a linked sign-in identity.

### Steps

1. Save the nickname and assign demo asset ownership.
2. Inspect signed-in members and approval voters.
3. Explicitly link an existing household identity and inspect historical ownership.

**Expected result：** A nickname sends no invitation, grants no read access, and adds no voter. Explicit linkage preserves history without name-based automatic asset merging.

**Failure criteria：** Nickname grants login/voting, or linking silently changes ownership.

**Automation references：** [member-ownership.test.mjs](../tests/member-ownership.test.mjs) / [member-ownership-http.test.mjs](../tests/member-ownership-http.test.mjs) / [onboarding-setup.test.mjs](../tests/onboarding-setup.test.mjs)

**Manual chapters:** [M01](PRODUCT-MANUAL.en.md#m01)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c18"></a>

## C18 · P0 · Same-ID amendment, version checks, processed immutability

**Prerequisites and data：** Pending budget draft v1; retain its request/global version.

### Steps

1. Read back and replace the complete payload under the same ID/type.
2. Retry stale draft/global versions and attempt changing planId/type.
3. Attempt amendment after adoption.

**Expected result：** Valid updates increment versions and read back consistently. Stale versions, reassociation, and processed edits fail without creating a duplicate.

**Failure criteria：** Dropped fields, changed associations, stale overwrite, or edited processed history.

**Automation references：** [mcp-amend.test.mjs](../tests/mcp-amend.test.mjs)

**Manual chapters:** [M13](PRODUCT-MANUAL.en.md#m13)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S03](assets/workflows/03-budget-review.png)


<a id="c19"></a>

## C19 · P1 · Asset-type nature, references, and disabling

**Prerequisites and data：** Custom cash-nature type “Demo reserve” referenced by an account or goal.

### Steps

1. Rename and inspect balances.
2. Attempt switching accounting nature to stock or disabling a referenced type.
3. After removing legitimate references, perform allowed maintenance.

**Expected result：** Renaming does not post. Nature is fixed, referenced types cannot be disabled, and foreign household IDs fail.

**Failure criteria：** Renaming changes accounting, holdings become cash, or disabling breaks goals.

**Automation references：** [custom-asset-types.test.mjs](../tests/custom-asset-types.test.mjs)

**Manual chapters:** [M05](PRODUCT-MANUAL.en.md#m05)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S11](assets/workflows/11-asset-type-editor-mobile.png)


<a id="c20"></a>

## C20 · P0 · Goal units, combinations, and deduplication

**Prerequisites and data：** Demo cash1,000 and another type200; cash-only goal2,000.

### Steps

1. Save a2,000 goal selecting cash only.
2. Read current value/progress, then select cash in another goal.
3. Create a new type and check the original goal scope.

**Expected result：** Current1,000 and progress50%; no minor-unit scaling error or inclusion of the other200. Duplicate scope fails; new types are not added automatically.

**Failure criteria：** Scaling errors, overlapping scopes, or unselected assets inflating progress.

**Automation references：** [goal-combinations.test.mjs](../tests/goal-combinations.test.mjs) / [asset-goal-amount-contract.test.mjs](../tests/asset-goal-amount-contract.test.mjs)

**Manual chapters:** [M06](PRODUCT-MANUAL.en.md#m06)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c21"></a>

## C21 · P0 · Purchase plus fees and liquidation net proceeds

**Prerequisites and data：** Bank1,000; buy demo fund300 plus fee5,3 units; later liquidate330 minus fee5.

### Steps

1. Record the first purchase and inspect cash/holding/type.
2. Liquidate the complete3 units after checking the carrying amount.
3. Show cleared accounts and retry the same sale.

**Expected result：** Cash1,000→695→1,020. Purchase is a trade, not an opening. Liquidation clears holdings while preserving history; retry does not credit another325.

**Failure criteria：** Missing fees, crediting carrying value instead of proceeds, deleted history, or duplicate cash.

**Automation references：** [security-trades.test.mjs](../tests/security-trades.test.mjs) / [security-trade-impact.test.mjs](../tests/security-trade-impact.test.mjs)

**Manual chapters:** [M07](PRODUCT-MANUAL.en.md#m07)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S12](assets/workflows/12-liquidation-mobile.png)


<a id="c22"></a>

## C22 · P0 · Member, currency, and household mismatches

**Prerequisites and data：** A CNY holding, USD bank, mismatched member cash, and a foreign household account.

### Steps

1. Attempt trades/contributions/payments with a wrong currency/member or foreign account ID.
2. Compare all balances before/after rejection.

**Expected result：** Reject and roll back mismatches; no automatic FX, guessed ownership, or cross-household writes.

**Failure criteria：** Silent account substitution or implicit FX conversion.

**Automation references：** [security-trades.test.mjs](../tests/security-trades.test.mjs) / [member-ownership-http.test.mjs](../tests/member-ownership-http.test.mjs) / [pension.test.mjs](../tests/pension.test.mjs)

**Manual chapters:** [M05](PRODUCT-MANUAL.en.md#m05) / [M07](PRODUCT-MANUAL.en.md#m07)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c23"></a>

## C23 · P0 · Loan simulation versus actual principal and interest

**Prerequisites and data：** Bank1,000; loan principal5,000; actual principal repayment100 plus interest10.

### Steps

1. Run both simulation modes and save a future budget; inspect balances.
2. After actual payment record principal100 and interest10.
3. Inspect cash, debt, report, and remaining funding.

**Expected result：** Simulation/budget leave balances untouched. Actual cash890, debt4,900; principal is not expense and interest10 is separate.

**Failure criteria：** Simulation posts, all110 reduces principal, principal becomes expense, or partial payment closes the plan.

**Automation references：** [money.test.mjs](../tests/money.test.mjs) / [approved-plan-calendar.test.mjs](../tests/approved-plan-calendar.test.mjs) / [plan-actual-date.test.mjs](../tests/plan-actual-date.test.mjs)

**Manual chapters:** [M08](PRODUCT-MANUAL.en.md#m08) / [M15](PRODUCT-MANUAL.en.md#m15)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c24"></a>

## C24 · P0 · Future first occurrence, pause, and rule totals

**Prerequisites and data：** Recurring income100, first occurrence D+1; another paused rule.

### Steps

1. Compare regular rule totals with month-specific schedules.
2. Check due items before D+1, then pause and check again.
3. Compare actual versus forecast in the report.

**Expected result：** An active rule may contribute to regular totals but posts no actual before its first date. Paused rules create no new due items and no historical income is invented.

**Failure criteria：** Cash increases before the first date, or regular totals are treated as receipts.

**Automation references：** [recurring-monthly-link.test.mjs](../tests/recurring-monthly-link.test.mjs) / [recurring-safety.test.mjs](../tests/recurring-safety.test.mjs)

**Manual chapters:** [M14](PRODUCT-MANUAL.en.md#m14) / [M15](PRODUCT-MANUAL.en.md#m15)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S14](assets/workflows/14-recurring-rule-mobile.png) / [S15](assets/workflows/15-recurring-monthly-overview.png)


<a id="c25"></a>

## C25 · P0 · Changing the day does not duplicate a monthly occurrence

**Prerequisites and data：** The rule already has a due or confirmed occurrence in the same month.

### Steps

1. Move the monthly day to another date in the same month.
2. Recheck due items/confirmation/catch-up and retry.

**Expected result：** No second business occurrence for the same rule/month. Confirmed amounts leave remaining forecasts without double-counting either actuals or forecasts.

**Failure criteria：** A moved date creates duplicate wages or repayment.

**Automation references：** [recurring-monthly-link.test.mjs](../tests/recurring-monthly-link.test.mjs) / [recurring-safety.test.mjs](../tests/recurring-safety.test.mjs)

**Manual chapters:** [M14](PRODUCT-MANUAL.en.md#m14)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c26"></a>

## C26 · P0 · Separate income, expense, cashflow, and net worth

**Prerequisites and data：** Independent demo opening; income200, expense50, loan principal100/interest10, plus an internal transfer.

### Steps

1. Record each event using its correct flow.
2. Open the report/actual accumulation and inspect member/currency details.
3. Add a pending recurring income and compare forecasts.

**Expected result：** Business income200 and consumption/interest expense60. Loan principal is not expense; openings/transfers are not income; pending income is forecast only. Cash and net-worth changes may differ.

**Failure criteria：** All asset growth called returns, or loan principal treated as living expense and deducted twice.

**Automation references：** [monthly-report.test.mjs](../tests/monthly-report.test.mjs) / [monthly-accumulation-v15.test.mjs](../tests/monthly-accumulation-v15.test.mjs)

**Manual chapters:** [M04](PRODUCT-MANUAL.en.md#m04) / [M08](PRODUCT-MANUAL.en.md#m08) / [M14](PRODUCT-MANUAL.en.md#m14) / [M15](PRODUCT-MANUAL.en.md#m15) / [M16](PRODUCT-MANUAL.en.md#m16)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S13](assets/workflows/13-monthly-archive.png) / [S15](assets/workflows/15-recurring-monthly-overview.png)


<a id="c27"></a>

## C27 · P0 · Immutable archive and stale review basis

**Prerequisites and data：** Saved monthly archive v1; review draft based on an older fingerprint.

### Steps

1. Add a demo expense in the same month.
2. Compare live preview, v1, and new archive v2.
3. Attempt adoption with the stale review fingerprint, then regenerate from fresh context.

**Expected result：** v1 remains unchanged; live/v2 reflect the new journal. Stale review adoption fails or requires refresh. Annual totals do not add both versions.

**Failure criteria：** A new transaction rewrites v1, stale prose silently passes, or annual totals duplicate versions.

**Automation references：** [monthly-report-archive.test.mjs](../tests/monthly-report-archive.test.mjs) / [monthly-archive-http.test.mjs](../tests/monthly-archive-http.test.mjs) / [mcp-drafts.test.mjs](../tests/mcp-drafts.test.mjs)

**Manual chapters:** [M16](PRODUCT-MANUAL.en.md#m16)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S13](assets/workflows/13-monthly-archive.png) / [S16](assets/workflows/16-monthly-second-version.png)


<a id="c28"></a>

## C28 · P0 · Complete pagination with consistent versions

**Prerequisites and data：** Demo history larger than one page, including rows outside the filter.

### Steps

1. Hold filters/versions constant and follow nextCursor until complete=true.
2. Check cursors even on an empty filtered page.
3. Change ledger/membership between pages and continue with stale versions.

**Expected result：** No skipped pages or claims that recent rows represent full bank history. Restart after conflicts; reports/recurring analysis must not mix versions.

**Failure criteria：** Stop on an empty page, sum only recent100 rows, or mix versions.

**Automation references：** [mcp.test.mjs](../tests/mcp.test.mjs) / [recurring-history-v15.test.mjs](../tests/recurring-history-v15.test.mjs) / [monthly-report.test.mjs](../tests/monthly-report.test.mjs)

**Manual chapters:** [M13](PRODUCT-MANUAL.en.md#m13) / [M14](PRODUCT-MANUAL.en.md#m14) / [M16](PRODUCT-MANUAL.en.md#m16)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c29"></a>

## C29 · P0 · Pension internal trading is not external contribution

**Prerequisites and data：** Ordinary bank1,000; pension cash200, products0; demo annual allowance already exhausted.

### Steps

1. Buy internally for100 with zero fee.
2. Redeem completely for net110.
3. Reinvest50 internally and read ordinary cash/contributions.

**Expected result：** Pension cash200→100→210→160, products0→100→0→50, total200→200→210→210. Ordinary cash stays1,000 and annual contributions do not change.

**Failure criteria：** Exhausted allowance blocks internal investment, redemption credits ordinary cash, or totals double-count products.

**Automation references：** [pension-investment.test.mjs](../tests/pension-investment.test.mjs) / [pension-classification.test.mjs](../tests/pension-classification.test.mjs)

**Manual chapters:** [M06](PRODUCT-MANUAL.en.md#m06) / [M09](PRODUCT-MANUAL.en.md#m09)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c30"></a>

## C30 · P0 · Pension restrictions survive snapshots and ownership edits

**Prerequisites and data：** Demo pension with confirmed contributions and internal trades.

### Steps

1. Attempt to clear contributions, change to an ordinary type, transfer ownership, or merge through aliases.
2. Submit a snapshot older than the last trade and treat a planned age as automatic unlocking.

**Expected result：** Reject bypasses while preserving balances, contributions, ownership, and history. Classification is not withdrawal.

**Failure criteria：** One field unlocks withdrawal or overwrites newer facts.

**Automation references：** [pension.test.mjs](../tests/pension.test.mjs) / [pension-investment.test.mjs](../tests/pension-investment.test.mjs)

**Manual chapters:** [M09](PRODUCT-MANUAL.en.md#m09)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c31"></a>

## C31 · P1 · Membership validity, party coverage, incremental cost

**Prerequisites and data：** Independent demo two-person pass, sunk cost600; party of3 adults; extra vehicle fee40 is an unverified reference.

### Steps

1. Save benefits and test valid/expired/unactivated/disabled date/status combinations.
2. Have planning read them and list covered2 people, the third person, and vehicle charge evidence.

**Expected result：** Do not add600 again to this trip or debit cash for maintenance. List the uncovered person/vehicle charge; unknown tickets are not free and expired benefits provide no assumed discount.

**Failure criteria：** Sunk cost charged again, everyone assumed free, or an unknown hotel tier invents a discount.

**Automation references：** [memberships.test.mjs](../tests/memberships.test.mjs)

**Manual chapters:** [M17](PRODUCT-MANUAL.en.md#m17)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c32"></a>

## C32 · P0 · Quotes, snapshots, and missing FX do not post

**Prerequisites and data：** Demo securities have stored quantity/price/carrying value; another account lacks FX.

### Steps

1. Refresh quotes with stale/failure/currency-mismatch responses.
2. Compare stored-snapshot arithmetic with new indicative market value.
3. Inspect totals and cash.

**Expected result：** Preserve stored snapshots, timestamps, and unconverted warnings. No default1:1 FX, execution-price claim, cash conversion, or balancing entry.

**Failure criteria：** Quote refresh changes booked balances, or missing FX produces a false complete total.

**Automation references：** [position-snapshot.test.mjs](../tests/position-snapshot.test.mjs) / [valuation-boundaries.test.mjs](../tests/valuation-boundaries.test.mjs)

**Manual chapters:** [M04](PRODUCT-MANUAL.en.md#m04) / [M07](PRODUCT-MANUAL.en.md#m07)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c33"></a>

## C33 · P1 · Privacy defaults hide display, not edit values

**Prerequisites and data：** Independent demo household with amounts and explanatory prose.

### Steps

1. Inspect cards/lists/prose/research on first load.
2. Reveal, navigate, then reload.
3. Open edit/review forms and check the original-value warning before sharing.

**Expected result：** Reload hides values; in-page preference behaves consistently and explanatory prose does not leak amounts. Original values in forms are not redacted data.

**Failure criteria：** Reveal preference becomes the next default, or small print leaks amounts.

**Automation references：** [financial-privacy.test.mjs](../tests/financial-privacy.test.mjs)

**Manual chapters:** [M04](PRODUCT-MANUAL.en.md#m04) / [M18](PRODUCT-MANUAL.en.md#m18)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S01](assets/workflows/01-onboarding.png) / [S07](assets/workflows/07-recorded-cashflow.png)


<a id="c34"></a>

## C34 · P0 · Attachment upload success, failure, uncertain result

**Prerequisites and data：** Independent plan, synthetic1KB PDF, fixed request key.

### Steps

1. Preview without consent, then consent/save and inspect reset selection.
2. Simulate saved-but-refresh-failed and lost-response retry.
3. Check the original status before changing files; test invalid signature/size and foreign downloads.

**Expected result：** Upload only after explicit consent; retries do not duplicate, selection resets appropriately, foreign access leaks nothing, invalid files fail.

**Failure criteria：** Preview uploads immediately, retry loses selection, or uncertainty duplicates storage.

**Automation references：** [attachments.test.mjs](../tests/attachments.test.mjs)

**Manual chapters:** [M18](PRODUCT-MANUAL.en.md#m18)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S17](assets/workflows/17-attachments-mobile.png)


<a id="c35"></a>

## C35 · P0 · Site connection does not certify another chat

**Prerequisites and data：** Site signed in, another ChatGPT conversation unconnected; local plugin not distributed.

### Steps

1. Run the site check and inspect minimal status.
2. Try the separate unconnected chat, then handle actual distribution/authorization results.
3. Test401, a read-only identity, and missing packaging metadata.

**Expected result：** The site check returns no balances and posts nothing. Site success or installed skill files do not mean MCP is connected. Missing binding rejects packaging; real distribution/mobile acceptance stay separate.

**Failure criteria：** Invented IDs/endpoints/install links, or the website certifies another conversation.

**Automation references：** [plugin-connection.test.mjs](../tests/plugin-connection.test.mjs)

**Manual chapters:** [M02](PRODUCT-MANUAL.en.md#m02) / [M18](PRODUCT-MANUAL.en.md#m18)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S09](assets/workflows/09-plugin-connection.png)


<a id="c36"></a>

## C36 · P0 · Images create reviewable, deduplicated candidates

**Prerequisites and data：** Two synthetic receipts describe the same actual12 expense.

### Steps

1. Have ChatGPT interpret images and submit cashflow candidates.
2. Verify no draft-stage debit, then adopt one after checking date/account/coverage.
3. Review the second for duplication and treat any embedded instructions as data.

**Expected result：** Record the event once after actual-event/snapshot confirmation. Recognition errors remain editable/rejectable; no automatic posting.

**Failure criteria：** Recognition debits immediately, duplicates debit twice, or embedded text changes permissions.

**Automation references：** [image-import.test.mjs](../tests/image-import.test.mjs) / [mcp-plan-actuals.test.mjs](../tests/mcp-plan-actuals.test.mjs)

**Manual chapters:** [M11](PRODUCT-MANUAL.en.md#m11) / [M18](PRODUCT-MANUAL.en.md#m18)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S06](assets/workflows/06-actual-expense-review.png)


<a id="c37"></a>

## C37 · P0 · Exact cost totals, quote conditions, and unknowns

**Prerequisites and data：** Costs80×2 and40×1 total200; a separate transport cost is unknown.

### Steps

1. Submit a declared total inconsistent with items and verify rejection.
2. Use the correct known total while explicitly preserving unresolved cost, not zero.
3. Change merchant/specification/price and inspect stale evidence and confirmation reset.

**Expected result：** No silent total adjustment to hide missing costs. Unsupported prices are not live quotes; changed conditions require new evidence/confirmation. Original prose remains historical.

**Failure criteria：** Inconsistent totals accepted, unknown treated as free, or changed specs retain old evidence/consent.

**Automation references：** [expense-plan.test.mjs](../tests/expense-plan.test.mjs) / [research-cost-completeness.test.mjs](../tests/research-cost-completeness.test.mjs) / [mcp-amend.test.mjs](../tests/mcp-amend.test.mjs)

**Manual chapters:** [M10](PRODUCT-MANUAL.en.md#m10) / [M13](PRODUCT-MANUAL.en.md#m13)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S03](assets/workflows/03-budget-review.png)


<a id="c38"></a>

## C38 · P1 · Research and follow-up do not trade

**Prerequisites and data：** Demo investment research and a D+1 follow-up, with known initial holdings/cash.

### Steps

1. Save/adopt an investment draft.
2. Adjust its follow-up date/conditions and sync to the calendar.
3. Compare holdings/cash/budgets/transactions, then cancel the follow-up.

**Expected result：** Only research/follow-up metadata changes, labeled unexecuted. A buy recommendation creates no holding, debit, or spending budget.

**Failure criteria：** Adoption executes a trade, or cancelling a reminder reverses holdings.

**Automation references：** [calendar-content.test.mjs](../tests/calendar-content.test.mjs) / [mcp-workflows.test.mjs](../tests/mcp-workflows.test.mjs)

**Manual chapters:** [M12](PRODUCT-MANUAL.en.md#m12)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S18](assets/workflows/18-investment-followup-calendar.png)


<a id="c39"></a>

## C39 · P0 · Same-currency transfers are not income

**Prerequisites and data：** CNY bank A1,000 and B500; completed transfer A→B200.

### Steps

1. Record200 from A to B with the correct members.
2. Inspect both balances, total cash/report, then retry.

**Expected result：** A800, B700, total1,500 unchanged; both sides are traceable, no income/consumption, no duplicate on retry.

**Failure criteria：** Only one side changes, transfer becomes income, or hidden FX occurs.

**Automation references：** [member-ownership-store.test.mjs](../tests/member-ownership-store.test.mjs) / [extensions.test.mjs](../tests/extensions.test.mjs)

**Manual chapters:** [M05](PRODUCT-MANUAL.en.md#m05) / [M11](PRODUCT-MANUAL.en.md#m11)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.


<a id="c40"></a>

## C40 · P1 · Clearing/archiving preserves history and re-entry

**Prerequisites and data：** A fully sold demo holding with its original transactions.

### Steps

1. Check default hiding and enable the cleared/archived view.
2. Inspect original trades and, when allowed, buy into the same account again.
3. Attempt archiving nonzero assets or deleting history.

**Expected result：** History remains; re-entry is a trade, not another invented opening. Invalid archiving fails and old transactions remain traceable.

**Failure criteria：** Liquidation deletes records, re-entry loses history, or archiving erases a balance.

**Automation references：** [security-trades.test.mjs](../tests/security-trades.test.mjs) / [store.test.mjs](../tests/store.test.mjs)

**Manual chapters:** [M05](PRODUCT-MANUAL.en.md#m05) / [M07](PRODUCT-MANUAL.en.md#m07)

Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.

**Screenshots：** [S10](assets/workflows/10-assets-desktop.png)

## Case maintenance and execution records

Keep IDs stable when titles change. Add an ID for a new boundary. Execution records need source revision, environment, roles, independent dataset, actual steps/results, pass/fail/blocked status, and original screenshot/log paths. Preserve failures and append retests; never copy expected values into observed results or label simulated identities as production OAuth/real-member acceptance.

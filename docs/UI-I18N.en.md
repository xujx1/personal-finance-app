# Product localization and key cases

[中文](UI-I18N.md) · [User guide](USER-GUIDE.en.md) · [Full manual](PRODUCT-MANUAL.en.md)

Localization is implemented in the product itself. In Auto display-currency mode, English defaults to USD and Chinese to CNY. You can manually select USD or CNY; that choice takes priority over language. The main top bar and standalone household join page offer **中文 / English**, covering navigation, forms, system classifications, approvals, drafts, notices, validation errors, calendars and report presentation.

## Walkthrough

1. Select **English** in the product's language selector. It is also available before joining a household.
2. Browse overview, assets, research, budgets, cashflow, calendar, recurring items, reports and forecasts. Household management, memberships, goals and workflows in the avatar menu follow the same choice.
3. Open a record or review form. Switching language changes labels without clearing inputs or submitting the form.
4. Choose **Auto / USD / CNY** in Display currency. Auto follows language for summaries, valuations, budgets, goals and forecasts; a manual currency stays fixed when language changes.
5. Refreshing or opening another same-origin tab reuses both preferences. Original transaction currencies, form values and quantities remain unchanged.

A saved choice takes priority, followed by the first supported browser language, then Chinese. The preference is stored locally as `family-finance.locale`, with display currency stored separately as `family-finance.display-currency`; neither preference is in the ledger. Switching still works for the current page when storage is unavailable. Storage events synchronize other tabs.

## Data boundaries

| Content | Behavior |
| --- | --- |
| Navigation, buttons, field labels, system enums, cataloged errors | Localized |
| Original built-in asset types and shared household ownership | Localized; stable IDs retained |
| Custom/renamed types, member nicknames, account/plan names, notes | Original text retained, even when identical to a UI label |
| Historical research, AI analysis, monthly review prose, source excerpts | Original text retained as historical evidence |
| Ledger amounts, CNY/USD, integer minor units, quantities, versions, permissions | Original data unchanged; read-only summaries convert for display, with no actual currency exchange or trade |
| Calendar/report dates | Localized titles; business dates, date-input values and Beijing-time rules unchanged |
| New tasks started in English | Request an English response while preserving original names, amounts and dates |

Switching language does not save or approve anything. Unknown service errors retain their original information; add new errors to the catalog. Sign-in provider and ChatGPT pages control their own language.

## Maintenance

- `components/I18n.tsx` owns the per-root React context, selector and formatting entry points. There is no global user locale that could leak across requests.
- `src/domain/i18n.mjs` handles negotiation, interpolation, known system messages, exact minor-unit formatting and built-in labels. Translate application-owned messages only; do not pass arbitrary record names through the generic translator.
- `src/domain/display-currency.mjs` treats the rate as CNY per USD, dividing for CNY-to-USD presentation. Integer minor units and up to twelve rate decimals use BigInt, with one final rounding step. Native USD assets join USD totals directly, avoiding a CNY round trip. Missing rates preserve original amounts and count unconverted items; entirely unavailable totals remain unknown rather than zero.
- `src/i18n/en.json` uses Chinese source messages as keys. Add English text with every new UI message and preserve interpolation parameters.
- Keep stable business values in option `value` attributes; translate labels separately. Never submit translated option text as its business value.
- Use `UiMessage` for interpolation containing React money nodes, preserving privacy wrappers rather than stringifying elements.
- Date-only formatting uses UTC to preserve the original calendar day. Business “today,” monthly ranges and timestamp handling retain their existing Beijing-time rules.

## Retained key cases

| ID | Acceptance criterion | Evidence |
| --- | --- | --- |
| I18N-01 | Saved preference wins; unsupported languages fall back to Chinese | Automated pass |
| I18N-02 | Actual navigation, forms, pension, budget, research and workflow components render both languages without untranslated UI text | 30 React render scenarios pass; original records and language names are excluded from translation |
| I18N-03 | Input names, values and option values match across languages | 30 component comparisons pass; browser submission remains pending |
| I18N-04 | An account named “银行现金,” custom/renamed types and member names retain their original text | Automated pass |
| I18N-05 | Exact minor units, negatives and safe-integer boundaries; missing amounts never become zero | Automated pass |
| I18N-06 | Locale/display timezone never moves 2026-11-13 to the previous day; invalid dates are not silently corrected | Automated pass |
| I18N-07 | Conflicts, insufficient funds and parameterized member errors translate while interpolated names remain original | Automated pass |
| I18N-08 | Translation keys and placeholders are complete; reachable JSX cannot bypass localization with raw Chinese UI text | Automated pass |
| I18N-09 | Refresh persistence, cross-tab synchronization, zero writes on switching, mobile width and screenshots | Browser script supplied; browser acceptance incomplete in this environment |

## Display-currency key cases

| ID | Acceptance criterion | Evidence |
| --- | --- | --- |
| FX-01 | Auto means USD for English and CNY for Chinese; manual choices override language until Auto is restored | Rule and actual context tests pass; browser persistence pending |
| FX-02 | At a synthetic rate of 1 USD = 7.1 CNY, CNY 7,100 displays approximately USD 1,000, with a correct reverse conversion | Automated pass; this is a test rate, not a current market quote |
| FX-03 | Positive/negative half-cent ties, twelve-decimal rates, safe-integer boundaries, unknown amounts and unsupported currencies | Automated pass; no overflow or invented 1:1 conversion |
| FX-04 | Missing rates, invalid source/date and mixed balances with native USD still counted | Automated pass; unconverted coverage is explicit |
| FX-05 | Old rates retain source, date and stale labeling; failed refreshes cannot impersonate fresh quotes | Date, stale state and actual notice component tests pass |
| FX-06 | Every transaction form input/option, ledger record and saved budget stays identical across display currencies | Actual form/budget component and immutability tests pass |

The rate area shows source and quote date. Converted amounts are for reference. Historical report presentation uses the current reference rate without inventing historical FX; original-currency details remain available for reconciliation. Restricted pension account display also retains its original CNY reference and does not change the statutory CNY allowance. Execution prices, input fields and historical research retain their original currency.

## Reproduction and screenshots

```sh
npm run test:i18n
npm run typecheck
npm run build
npm run preview:i18n
# In an environment with Playwright and Chrome:
# LOCAL_TEST_MODULES points to node_modules containing playwright;
# the default is the existing work/calendar-qa/node_modules setup.
npm run test:e2e:i18n
```

The offline preview uses real product components and a synthetic ledger generated in memory with SQLite. All requests use local fixtures and writes are rejected. The browser script produces desktop checks, an identical-payload comparison, reload/cross-tab checks and 390px screenshots under `work/i18n/e2e/`. Outputs require an actual run and review; they are not pre-existing acceptance screenshots.

2026-11-13: all 46 localization and display-currency tests pass, type checking passes, and the production build passes. The current workspace full suite has 764 tests: 759 pass and five fail. Three Worker tests cannot listen on `127.0.0.1` because of `EPERM`. One monthly basis/archive validation test fails in each of `tests/mcp-amend.test.mjs` and `tests/monthly-archive-http.test.mjs`. These are not reported as passed or skipped. This environment blocks local listening ports and the browser rejects `file:` previews. Browser acceptance and new screenshots are therefore unverified; none were fabricated. Existing manual screenshots remain earlier evidence and do not verify the new selector. Source implementation does not mean the hosted site has been updated.

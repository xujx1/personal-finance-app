# Correct a bank deposit classification

[中文](DEPOSIT-CLASSIFICATION.md)

Choose Adjust on an account in Assets. Bank cash and term deposits can be reclassified between these two underlying natures, including compatible household custom types. This retains account ID, amount, currency, owner and historical journals, without adding money or creating transfers.

A correction cannot simultaneously change the amount or owner, or modify an archived account. Accounts used in actual payments or active recurring cashflows require review of those operations first. Record actual deposits and maturity withdrawals through internal transfers, rather than disguising movements as classification corrections. Historical-use checks cover the complete ledger, beyond the recent UI transaction window.

When only a maturity year is known, save the year and leave the exact date empty. Missing dates, rates or bank details remain pending: no date is invented and no interest is estimated. Term-deposit principal is excluded from spendable bank cash. Newly registered term deposits retain their existing complete-information validation.

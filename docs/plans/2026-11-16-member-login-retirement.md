# Retain finance identity while retiring a family login

Authorized scope: administrator exports a complete logical backup, verifies it, then converts one non-owner login to an unlinked finance profile. Preserve all existing records, journal amounts, approval decisions and original actors. Do not delete an OpenAI account or share credentials.

Implementation:
1. Add an administrator-only, no-store export in one database read. Include the active family ledger, all its documents/audit/receipts, book and membership/invitation rows. No pagination or truncation; exclude other families and runtime credentials. Return a SHA-256 integrity digest.
2. Add a guarded, atomic, idempotent retirement operation requiring the exact current backup digest. Preserve immutable transactions, archive ownership for legacy entries, map historical identity aliases to an unlinked profile, and update current account ownership. Preserve original closed approvals under a compatibility fingerprint; pending plans require a fresh vote by remaining active members. Content edits and later membership changes still require normal reapproval.
3. Expose backup-first controls in family management, with matching Chinese and English text. Keep the ordinary member-removal behavior unchanged.
4. Test backup completeness and local restore, foreign/member denial, stale backup/concurrency rollback, pension and operational ownership, immutable history, approval/calendar behavior and removed-login denial. Run the full suite, typecheck/build and local browser E2E.
5. Publish without widening the site audience. Download and locally verify the real backup BEFORE invoking retirement. Retain it outside tracked source, compare a post-operation export for full record retention, unchanged journals/balances and intended changes, and verify the active login directory.

Do not treat a truncated database viewer, the 300-transaction UI snapshot, simulated user denial or a successful deployment as production migration verification.

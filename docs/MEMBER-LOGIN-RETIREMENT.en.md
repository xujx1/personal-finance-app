# Disable a login and retain the finance member

[中文](MEMBER-LOGIN-RETIREMENT.md) · **English**

In Household management, an administrator chooses “Disable login and retain finance member” for another login, downloads and privately saves the complete backup, then confirms migration. This disables access to this website's household. It does not delete an OpenAI account or combine two people's finances into one identity.

A single consistent read exports every asset, transaction, entry, document, approval, monthly archive, audit event and command receipt in the household's active ledger, plus book, household, member and invitation metadata. It uses neither the UI's recent-transaction limit nor a database viewer that truncates long fields. Other households, runtime credentials and attachment file contents are excluded. Existing attachment/image references are retained, and stored files are not modified. Older restored datasets are outside this active-ledger logical backup.

Backups contain private financial information. Keep them in a private directory and never upload them to GitHub. To verify and rehearse restoring offline:

```sh
node scripts/verify-member-retirement-backup.mjs /private/path/before.json
```

The verifier rebuilds raw rows in a separate in-memory database, checks foreign keys and balanced journals, and never connects to or restores production. Compare pre/post backups with:

```sh
node scripts/verify-member-retirement-backup.mjs /private/path/before.json /private/path/after.json
```

Migration requires the current complete backup's digest. A ledger or membership change after backup blocks migration until a new backup is downloaded. Ownership changes, approval compatibility, audit and login retirement are atomic; retries return the original receipt.

- Current assets move to a separate finance profile. The original login remains a historical ownership alias. Posted transactions and entries are not rewritten; inferred legacy ownership is frozen before current metadata changes.
- Existing approved/rejected decisions retain their original votes, actors and timestamps. Pending plans clear current votes and require fresh confirmation from remaining active login members. The complete previous approval is retained in the plan's retirement history.
- Later plan-content or household-login changes still require normal reapproval. Migration never consents to a budget on someone's behalf.
- Finance profiles grant no login or approval rights. The retired identity's old sessions, MCP and finance endpoints lose household access; historical names and audit identities remain.

This logical backup is not a hosted database-wide snapshot. Offline recovery rehearsal does not prove production recovery. Restoring production requires controlled database operations; the backup is not a public import endpoint.

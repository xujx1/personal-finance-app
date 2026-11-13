# Data security and reporting

[中文](SECURITY.md) · **English** · [Current review](docs/PUBLIC-DATA-REVIEW-2026-11-13.md)

## Publication boundaries

The public repository is for code, rules, blank configuration examples, and demo images with known provenance. Do not commit real ledgers, exports, receipts, original screenshots, personal income/balances/holdings/loans, household identities, invitation tokens, secrets, actual environment values, or authentication logs.

Transcribed prose and test fixtures can also disclose private information. An export allowlist cannot classify arbitrary text; `.gitignore` does not remove tracked files. Public source does not make a deployment or household public.

Screenshots must use isolated demo households or material confirmed for publication. Inspect amounts, names, emails, avatars, receipts, identifiers, URL parameters, and browser tabs. Published images retain their local-demo banner. App privacy blur is a display feature, not a guarantee that a real screenshot is safely redacted.

## Authorization and accounting

| Identity | Read own household | General financial writes | Budget approval |
| --- | --- | --- | --- |
| Anonymous, nonmember, other household, removed member | Denied | Denied | Denied |
| Current household administrator | Allowed | Authorized website review required | Own opinion only |
| Current signed-in household member | Allowed | Denied | Own opinion only |
| Unlinked bookkeeping profile | No sign-in access | No sign-in access | No vote |

The server derives household scope from authenticated identity. Supplying a household ID is not authorization. MCP exposes bounded queries and draft submission/amendment, not approval delegation, payments, or trades. Review adoption, actual-event confirmation, balance coverage, versions, and idempotency separately. Incorrect currency units are also a data-safety issue.

Production relies on trusted Sites authentication headers and household checks. Self-hosting requires a trusted authentication edge that removes forged headers and supplies verified identity. Never expose the local simulated-identity adapter publicly. Hiding amounts does not replace server authorization or database security.

## Before publication

1. Review staged files and diffs, including Markdown, fixtures, SQL seeds, images, archives, and deployment metadata.
2. Check the current tree and all available Git history. Search credential patterns and manually review personal scenarios.
3. Run [targeted checks](docs/DEVELOPMENT.en.md), then separately verify anonymous, cross-household, removed-member, and personal-approval behavior in the deployed environment.
4. Confirm blank environment examples, intended site audience, and clean downloads/screenshots.

Earlier commits contain private prose. Redaction does not remove history, remote caches, forks, or third-party copies. `.openai/hosting.json` and IDE metadata remain tracked; the project identifier is not a secret, but its publication should be reviewed. Fixtures derived from historical personal values also require separate replacement with independent synthetic data.

## Responding to a disclosure

If actual credentials leak, revoke or rotate them with their provider before cleaning source and history. Deleting a file does not invalidate a key. For personal-data disclosure, limit further propagation and review commits, branches, tags, attachments, and copies.

This revision does not rewrite history or force-push. History cleanup affects existing clones and collaboration branches; define its scope and recovery plan before execution.

No dedicated security email has been declared. Check whether private vulnerability reporting is enabled for the repository and use it when available; otherwise contact the maintainer through a verified private channel. Do not post secrets, full ledgers, or unredacted screenshots in public issues. Provide a minimal reproduction, affected endpoint, and sanitized result. Do not test other households' real data.

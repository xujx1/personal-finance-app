# MCP amend and executable pricing plan

Goal: ChatGPT updates a pending draft durably and provides auditable executable cost bases.
Spec: docs/requirements-mcp-amend-and-execution-2026-11-12.md
Architecture: reuse existing draft validators/target fingerprints and family command guards. Add immutable revision docs and external-unverified quote provenance; no payments or family votes exposed.

- [x] Failing tests for pending same-ID update/version/history/idempotency/seven types, rejected/accepted/readonly/cross-family and original plan freshness.
- [x] Reuse draft staging validation for submit and update; schema/tool/readback version, website rekey on version.
- [x] Add pricing/execution domain/schema/UI; preserve unverified external evidence, validate preparation windows and calendar dates.
- [x] Update six workflow instructions and capability audit; generate backups.
- [x] Run full tests/type/build and isolated browser/MCP E2E; independent review, fix findings.
- [x] Publish preserving settings and verify production read-only; receipt, requirements, commit.

# Membership benefits implementation plan

Goal: 家庭维护会员权益，ChatGPT消费规划按日期、人数和额外费用使用。
Architecture: membership documents store yuan strings as non-ledger reference data. Pure domain normalization/eligibility feeds website and MCP; same existing family-scoped command guards. Website edits only, external tools read only. No financial migrations.
Spec: docs/requirements-memberships-2026-11-12.md

- [x] Add failing domain/server tests: validity boundaries, unknown expiry, fee units, strict input, membership ownership/idempotency, no money mutation.
- [x] Implement src/domain/memberships.mjs and src/server/memberships.ts; route membership.save through existing guarded API and expose get_memberships/context.
- [x] Add components/MembershipBenefits.tsx/CSS, account-menu and calendar entries; edit dialog with benefits/extra-fee rows, member/type/search filters and archive restoration.
- [x] Update shared consumption/images/onboarding workflow guidance and generated Skill backups; no new model keys, searches remain ChatGPT responsibility.
- [x] Run unit/type/build and isolated browser E2E for CRUD, member scoping, future/expired/extra fees, read-only and two-family rejection, no cash changes, phone layout; independent read-only review.
- [x] Deploy preserving audience/MCP/env. Maintain user-provided real membership records only, compare financial context before/after; save screenshot and release receipt.

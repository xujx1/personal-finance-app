# Development and verification

[中文](DEVELOPMENT.md) · **English** · [Documentation](README.en.md)

## Environment and startup

Use Node.js 24 and npm with `package-lock.json`. The declared minimum is Node 22.13.0; tests use native SQLite and TypeScript, so prefer the previously exercised Node 24 environment.

```sh
npm ci
npm run dev:local
```

The UI defaults to `http://127.0.0.1:5173`, the API to `http://127.0.0.1:5174`. Local data lives under `.sites-runtime/local-qa/`. Startup reuses the latest `simulated-*.sqlite`, or creates an empty one. The adapter uses a simulated administrator, does not verify production sign-in, and must not be exposed publicly.

Choose a separate file for a new demo instead of reusing an existing development ledger:

```sh
LOCAL_QA_DATABASE=qa-docs-example.sqlite npm run dev:local
```

The current ChatGPT + MCP workflow does not require retired in-site model or search keys. If runtime configuration is needed, start with the blank `.env.example` and keep actual values private. See the [Chinese deployment resource reference](DEPLOYMENT-RESOURCES.md).

## Checks

| Command | Scope |
| --- | --- |
| `npm test` | Node unit, HTTP, and server tests |
| `npm run typecheck` | TypeScript checking |
| `npm run build` | Packages the generic workflow installer and builds the application |
| `npm run test:e2e:local` | Local migration browser scenarios; AI output is supplied fixture data |
| `npm run test:e2e:onboarding` | Isolated onboarding browser scenarios |
| `npm run test:e2e:approval-sharing` | Budget sharing, personal approval, household isolation |
| `npm run test:e2e:mcp-amend` | Same-ID draft updates and execution plans |

Browser scripts require Chrome and Playwright. The default module directory is `work/calendar-qa/node_modules`; pass an existing directory as an argument, for example `npm run test:e2e:onboarding -- /absolute/path/to/node_modules`. Keep personal paths and dependency caches out of the repository.

If network, listening ports, or browsers are unavailable, record `blocked` or `not_run`. Existing screenshots are not new passing results. See the [current review](PUBLIC-DATA-REVIEW-2026-11-13.md) for checks actually executed.

## Targeted security checks

```sh
node --test tests/source-export.test.mjs tests/migration-security.test.mjs tests/family-route.test.mjs tests/family-api-isolation-v15.test.mjs tests/financial-privacy.test.mjs tests/mcp.test.mjs tests/attachments.test.mjs tests/backup.test.mjs
```

These isolated tests do not certify production D1, edge identity, a real second user, or the ChatGPT client. `scripts/export-source.py` allowlists source files and blanks environment values, but cannot classify arbitrary private prose. Publishing a Git repository directly does not pass through that exporter.

## Deployment boundaries

Production depends on trusted Sites identity, household authorization, and D1. The application reads platform authentication headers. Self-hosting requires a trusted authentication edge that removes forged client headers; exposing the application alone is insufficient. Local QA identities and `local/server.mjs` are not production authentication.

Keep deployment metadata private and use the legitimate identity of your own deployment. Do not copy someone else's database or replace live metadata with documentation examples. Apply incremental migrations without editing previously applied ones. Separately verify anonymous, nonmember, removed-member, cross-household, and personal-approval behavior without posting production test transactions.

This revision changes documentation and demo images only, not business logic, databases, site audiences, or deployment state.

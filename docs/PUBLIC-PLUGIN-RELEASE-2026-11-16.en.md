# Plugin publication and household access

[中文](PUBLIC-PLUGIN-RELEASE-2026-11-16.md) · **English**

Updated: 2026-11-16. Website deployment, the current private connection, other members' connections and directory publication are separate acceptance gates. A GitHub push does not publish a plugin.

## Current status

| Area | Status and evidence boundary |
| --- | --- |
| Controlled website | v64 is deployed; existing access is preserved and household ledgers are not public |
| Current private plugin | A native read-only get_skill_bundle call returned seven workflows; this does not verify other accounts or every tool |
| Implementation | Eight confirmed issues were fixed and independently retested; see the [Chinese acceptance record](RELEASE-ACCEPTANCE-2026-11-16.md) |
| Public directory | BLOCKED: developer identity and organization payment verification are incomplete; no completed upload, scan, approval or public release |
| Second real account, new chats, iPad | Installation, OAuth and end-to-end use remain unverified; simulated households or mobile layouts do not replace them |

A backup-first login-retirement flow now retains finance profiles, historical ownership and closed approval decisions; see the [operation and verification guide](MEMBER-LOGIN-RETIREMENT.en.md). It does not provision a new OAuth client or delete an OpenAI account.

## Payment and regional eligibility

The current organization's publishing flow requires a valid default payment method before verification. The holder currently has only mainland China-issued cards. OpenAI requires cards from supported issuing regions, and mainland China is not on its current API-supported regions list. Changing mainland banks or network branding does not resolve that restriction. This route remains blocked; users are not instructed to repeatedly retry cards, buy credits or use third-party payment intermediaries.

This is developer-platform verification and billing eligibility, not a requirement to resume website model API calls. ChatGPT performs analysis, search, image understanding and summaries; MCP saves drafts for website review. ChatGPT subscriptions and API organization billing are separate.

The payment-method prompt does not establish a required API credit purchase or listing fee. Later purchases, automatic recharges or payment terms require separate review. API card setup can involve a temporary authorization hold; a process with no holds or fees is not promised.

## What remains usable

- Existing private connections and the controlled website remain usable within existing permissions, independently of directory publication.
- The website retains household management, manual opening assets, plan revision/approval and actual cashflow review. It does not execute bank payments or securities trades.
- Each member's independent ChatGPT connection depends on their account, region, plan/workspace and available installation/authentication controls. Private connections, workspace sharing and mobile availability are not guaranteed and do not bypass eligibility requirements.
- A website invitation does not share a ChatGPT plugin. Each recipient still needs installation, connection and household access. Real second-account and physical iPad acceptance remain open.

## Custom household MCP connections: verified OAuth blocker

On 2026-11-16, the current site's `/mcp` URL was checked through the ChatGPT web “Add custom MCP server” form. This was a read-only discovery check: no new plugin, authorization grant or site audience change was submitted.

| Check | Result |
| --- | --- |
| Authorization server | Discovery identifies `https://auth.openai.com` and authorization/token endpoints |
| Dynamic Client Registration (DCR) | Unavailable in the form; no registration URL discovered |
| Client ID Metadata Documents (CIMD) | Unavailable in the form; support is not advertised |
| Registration method | Defaults to a user-provided OAuth client and requires a valid client ID |
| Redirect URI | Generated for that connection; register the recipient's exact displayed URI, not the maintainer's temporary test URI |
| Existing Sites plugin | The current account's read-only `get_skill_bundle` call succeeds; this does not verify a new custom connection |
| Household member connection | **BLOCKED**: no registered and verified client configuration for that connection; authorization, tool discovery and a real second-account test are incomplete |

The site's `auth_client_id` is part of Sites-managed configuration. Its presence does not establish that another custom connection's redirect URI is allowed. Plugin IDs, household IDs, model API keys and Sites service-access tokens do not replace OAuth client credentials. Token authentication methods, scopes and rules for leaving secrets blank have not been validated as installation instructions.

The available Sites tools do not expose client registration or redirect allowlist management, and neither does the inspected private-plugin management page. OpenAI's separate Sign in with ChatGPT client application remains restricted to selected partners. The open-source local inference client's dynamic registration flow must not be substituted for this hosted MCP connection.

Resolution requires platform-provisioned client configuration with the actual redirect URI and resource registered, or a supported plugin distribution method for invited members. Only then can authorization, tool discovery, household isolation and Skill retrieval be verified before delivering installation instructions. This is tracked separately from public-directory identity/payment verification; adding a payment card is not claimed to resolve it.

No application code, discovery metadata, hosted login, site audience or identity checks were changed. Client provisioning and a real second-account authorization remain outstanding; installation is not complete.

## Conditions for resuming public submission

1. The account and organization meet supported eligibility and complete legitimate verification. The holder submits identity/payment materials directly to the official platform, never through chat or source code.
2. Confirm accurate publisher information, support, privacy and terms URLs.
3. Prepare a dedicated reviewer identity and synthetic household, without real ledgers, bypass tokens or production credentials.
4. Use an accepted public package and complete MCP domain/OAuth and tool/skill scans. Public submissions cannot contain apps/.app.json references; declare remote MCP URLs instead. The packager supports both modes, but a local app-reference bundle is not submission-ready.
5. Run positive/negative cases with the reviewer identity, prepare demonstration/review information, submit and publish only after approval.

Npm installation, packaging, website deployment and a successful read do not replace these gates. Public publication stays BLOCKED, without widening site access or rewriting prior results.

## Official references

- [Payment declines and issuing regions](https://help.openai.com/en/articles/7232916-why-was-my-credit-card-declined)
- [API-supported regions](https://help.openai.com/en/articles/5347006-openai-api-supported-countries-and-territories)
- [Separate ChatGPT/API billing](https://help.openai.com/en/articles/9039756)
- [Temporary API authorization holds](https://help.openai.com/en/articles/7438062)
- [Plugin format and submission](https://developers.openai.com/plugins/deploy/submission)
- [Custom MCP and account permissions](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [MCP OAuth client registration and redirect requirements](https://developers.openai.com/plugins/build/auth)
- [Request a Sign in with ChatGPT client](https://developers.openai.com/siwc/request-client-id)

Future availability depends on official rules and the account's actual controls.

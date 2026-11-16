# Plugin publication and household access

[中文](PUBLIC-PLUGIN-RELEASE-2026-11-16.md) · **English**

Updated: 2026-11-16. Website deployment, the current private connection, other members' connections and directory publication are separate acceptance gates. A GitHub push does not publish a plugin.

## Current status

| Area | Status and evidence boundary |
| --- | --- |
| Controlled website | v63 is deployed; existing access is preserved and household ledgers are not public |
| Current private plugin | A native read-only get_skill_bundle call returned seven workflows; this does not verify other accounts or every tool |
| Implementation | Eight confirmed issues were fixed and independently retested; see the [Chinese acceptance record](RELEASE-ACCEPTANCE-2026-11-16.md) |
| Public directory | BLOCKED: developer identity and organization payment verification are incomplete; no completed upload, scan, approval or public release |
| Second real account, new chats, iPad | Installation, OAuth and end-to-end use remain unverified; simulated households or mobile layouts do not replace them |

## Payment and regional eligibility

The current organization's publishing flow requires a valid default payment method before verification. The holder currently has only mainland China-issued cards. OpenAI requires cards from supported issuing regions, and mainland China is not on its current API-supported regions list. Changing mainland banks or network branding does not resolve that restriction. This route remains blocked; users are not instructed to repeatedly retry cards, buy credits or use third-party payment intermediaries.

This is developer-platform verification and billing eligibility, not a requirement to resume website model API calls. ChatGPT performs analysis, search, image understanding and summaries; MCP saves drafts for website review. ChatGPT subscriptions and API organization billing are separate.

The payment-method prompt does not establish a required API credit purchase or listing fee. Later purchases, automatic recharges or payment terms require separate review. API card setup can involve a temporary authorization hold; a process with no holds or fees is not promised.

## What remains usable

- Existing private connections and the controlled website remain usable within existing permissions, independently of directory publication.
- The website retains household management, manual opening assets, plan revision/approval and actual cashflow review. It does not execute bank payments or securities trades.
- Each member's independent ChatGPT connection depends on their account, region, plan/workspace and available installation/authentication controls. Private connections, workspace sharing and mobile availability are not guaranteed and do not bypass eligibility requirements.
- A website invitation does not share a ChatGPT plugin. Each recipient still needs installation, connection and household access. Real second-account and physical iPad acceptance remain open.

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

Future availability depends on official rules and the account's actual controls.

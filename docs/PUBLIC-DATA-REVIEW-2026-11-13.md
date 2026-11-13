# 公开资料安全校验 / Public-data review

日期 / Date：2026-11-13（Asia/Shanghai）。范围 / Scope：本地仓库文档与可达历史，不是生产安全认证 / Local documents and reachable Git history, not production certification.

## 结论 / Outcome

**已完成当前公开文档整理；资料安全仍有未解决项，不能标为整体通过。** 个人参数、截图转录、家庭行程与部署回执已从当前文档删减；旧提交及部分沿用个人快照的测试夹具仍需处理。未推送GitHub、改写历史或变更站点权限。

**The current public documentation has been reorganized, but publication safety is not fully cleared.** Personal parameters, screenshot transcriptions, family itineraries, and deployment receipts were removed from current documents. Earlier commits and some fixtures derived from personal snapshots remain outstanding. No GitHub push, history rewrite, or site-access change was performed.

## 检查范围 / Review scope

- 起始源码 / Initial source：`0b43644`，分支 / branch `codex/chatgpt-mcp-skills`；起始601个已跟踪文件 / 601 tracked files at the start.
- 本地所有可达引用 / All locally reachable refs：32个提交、1264个blob；包括旧版文件内容。未检查未取得的远端分支、PR引用、不可达对象、GitHub附件、分叉、缓存或其他克隆。 / 32 commits and 1,264 blobs, including earlier file versions. Unfetched refs, PR refs, unreachable objects, GitHub attachments, forks, caches, and other clones are outside scope.
- 规则搜索 / Pattern checks：常见GitHub/OpenAI/AWS令牌格式、私钥头、带认证信息URL、非空敏感环境赋值；不输出匹配的秘密值。模式搜索无法证明不存在未知格式或其他个人内容。 / Common token patterns, private-key headers, credential URLs, and nonblank sensitive environment assignments, without printing matched secrets. This is not a comprehensive secret detector.
- 人工检查 / Manual review：当前Markdown中的财务配置、截图转录、行程、操作回执及8张拟公开图片。未读取生产数据库或运行时密钥。 / Financial configuration, screenshot transcriptions, itineraries, operation receipts, and eight publication images. No production database or runtime secrets were read.
- 检查期间工作区另有插件接入改动；其业务代码不由本次文档维护改写。测试对应执行时工作树，不能仅凭HEAD复现全部未提交状态。 / Concurrent plugin changes were present; their application code was not edited by this documentation task. Checks describe the worktree at execution time, not necessarily HEAD alone.

## 发现与处理 / Findings

| 事项 / Finding | 当前处理 / Current action | 状态 / Status |
| --- | --- | --- |
| 历史文档含个人收入、余额、贷款、持仓、会员及行程 / Personal finance and itinerary prose | 当前文档删减，保留业务编号和规则；旧回执改为历史摘要 / Redacted current prose while preserving requirement IDs and business rules | 当前文档已处理；历史未清理 / Current prose addressed; history outstanding |
| 旧Git提交保留原始个人文字 / Earlier commits retain original prose | 本轮未重写或强推；需定义全部引用、协作克隆及副本处理范围 / No rewrite or force-push; cleanup needs a defined ref/clone/copy scope | 未解决 / Open |
| 部分养老金测试夹具沿用个人截图数值 / Some pension fixtures reuse personal snapshot values | 文档移除原截图表；未改业务测试，后续应换独立合成数据并重跑 / Removed the document transcription; fixtures need independent synthetic values and reruns | 未解决 / Open |
| 托管项目和IDE元数据已跟踪 / Hosting and IDE metadata tracked | 部署ID不是访问令牌；公开文档移除回执，但保留运行配置原文件 / IDs are not access tokens; receipts removed, runtime metadata left intact | 公开必要性待复核 / Publication necessity requires review |
| 仅靠gitignore或ZIP导出不能防文字泄露 / Ignore/export rules do not classify prose | 补充双语维护与安全规则；GitHub直接公开不经过导出器 / Added bilingual review rules; direct Git publication bypasses the exporter | 边界已说明 / Boundary documented |
| 新增根文档不在旧源码导出白名单 / New root docs are outside the older ZIP allowlist | 本次面向Git仓库展示，未生成源码ZIP；完整文档打包需另行同步白名单 / This delivery targets Git documentation, not a source ZIP; complete ZIP packaging needs an allowlist update | 未解决 / Open |
| 常见凭据模式 / Common credential patterns | 未检出常见真实令牌、私钥或非空敏感环境值；认证URL命中为故意构造的测试反例 / No common real token, private key, or nonblank sensitive env value found; credential-URL match is an intentional test case | 有限检查通过 / Limited check passed |

测试夹具风险涉及 `tests/pension.test.mjs` 等养老金相关文件，应根据来源审查整组数据，不能只替换一个可搜索金额。不要把公开文档删减视为这些值已从代码、历史或他人副本消失。

The fixture issue includes pension-related tests such as `tests/pension.test.mjs`. Review the complete dataset and its provenance rather than replacing one searchable amount. Document redaction does not remove values from code, history, or other copies.

## 本轮验证 / Checks executed this revision

| 检查 / Check | 结果 / Result | 边界 / Limit |
| --- | --- | --- |
| 8个既有安全测试文件 / Eight existing security test files | 29通过，0失败，0跳过 / 29 passed, 0 failed, 0 skipped | 隔离测试，不是生产认证 / Isolated tests, not production certification |
| 原有图片逐张检查、原样复制及SHA256清单 / Image inspection, unchanged copies, SHA256 inventory | 8张 / Eight images | 旧本地演示，不算本轮E2E / Existing demos, not new E2E passes |
| 重新启动隔离环境拍图 / New screenshot capture | blocked：127.0.0.1监听EPERM / TCP listen EPERM | 未新拍；如实保留来源日期 / No new images; original dates retained |
| GitHub远端核对 / Remote repository verification | blocked：git连接DNS解析失败，网页读取不可用 / Git DNS failure and unavailable web retrieval | 不能判断远端最新内容、分支或可见性 / Remote state and visibility not verified |
| 真实ChatGPT、Sites登录、生产D1与第二真人 / Real ChatGPT, Sites identity, production D1, second real user | not_run | 本轮只维护文档，不写生产测试记录 / Documentation only; no production test records |
| 全量应用测试、类型检查、构建 / Full suite, typecheck, build | not_run by this task | 并行插件报告的结果不归入本轮 / Concurrent plugin results are not counted here |

定向命令 / Targeted command：

```sh
node --test tests/source-export.test.mjs tests/migration-security.test.mjs tests/family-route.test.mjs tests/family-api-isolation-v15.test.mjs tests/financial-privacy.test.mjs tests/mcp.test.mjs tests/attachments.test.mjs tests/backup.test.mjs
```

覆盖源码导出过滤、迁移阶段旧能力退役、家庭路由和隔离、隐私展示、MCP、加密附件与备份边界。旧备份实现的测试通过不代表网站当前提供备份恢复入口。

Coverage includes source export filtering, retired capabilities, household routing/isolation, privacy display, MCP, encrypted attachments, and backup boundaries. Backup implementation tests do not imply that the current product exposes a backup/restore UI.

本轮完成文档本地链接、图片清单哈希、双语对应及R001–R127编号完整性检查。具体命令和维护规则见[开发说明](DEVELOPMENT.md)与[贡献约定](../CONTRIBUTING.md)。历史截图的原套件结果只作来源，详见[图片说明](assets/workflows/README.md)。

Local links, image inventory hashes, bilingual pairs, and requirement IDs R001–R127 were checked for this documentation revision. See [development](DEVELOPMENT.en.md) and [contribution rules](../CONTRIBUTING.md). Historical screenshot suite counts are provenance only; see the [image inventory](assets/workflows/README.md).

## 后续处理 / Follow-up

先处理已知个人资料在夹具和历史中的残留，再复核GitHub全部引用与发布附件；若发现实际凭据，先撤销或轮换，再处理历史。重新验证家庭隔离与真实客户端时使用授权范围内的独立数据，不向生产写演示流水。改写共享历史前明确清理和恢复方案，本轮未执行这一操作。

Address known fixture and history remnants, then review GitHub refs and release attachments. If actual credentials are found, revoke or rotate them before history cleanup. Use authorized isolated data for household and real-client verification, not production demo transactions. Define cleanup and recovery before rewriting shared history; this revision did not perform it.


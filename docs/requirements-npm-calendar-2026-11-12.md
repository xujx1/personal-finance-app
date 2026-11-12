# npm 安装、日历取消及周期收支 MCP

日期：2026-11-12。当前分支：codex/chatgpt-mcp-skills。叠加现行 M001–M012 和 S001–S006，不恢复站内模型调用。

|编号|有效需求|验收要求|
|---|---|---|
|N001|Codex 直接执行 npm 命令安装五份 Skill 入口|`npx --yes <本站地址>/downloads/family-finance-skills-1.1.0.tgz install` 实际可运行；无额外依赖、npm 发布账号或模型密钥；固定五个入口、预检 SHA256/大小/路径、备份旧版、拒绝符号链接、不改其他 Skill 或 MCP 认证。|
|N002|页面不再暴露复制请求|删除复制请求按钮与只读提示词框。日历日期、原计划与月报月份通过家庭私有任务交接，ChatGPT 经 list_research_requests 读取；不放进 ChatGPT URL。用户明确继续时确认任务，不能自动执行旧任务。网络回执恢复不重复新增。|
|N003|生活日历取消，同步取消预算|直接取消按钮、单独核对确认；同一个 plan 文档原子改为 CANCELLED 并释放 reserved。退出确认不写入；版本冲突、跨家庭、只读成员拒绝。已付款、预付款、预算历史及流水保留，不自动退款。编辑或旧草稿不能复活取消计划，默认日历隐藏，可显示已取消查历史。|
|N004|周期收支 MCP 和 Skill 全链路|支持 get_skill_bundle → get_financial_context → list_transactions 完整分页 → get_recurring_candidates → submit_finance_draft(kind=recurring) → 网站核对采用。候选按账户/成员/方向归并至少两个不同月份；已有人工规则不覆盖；采用规则 autoPost=false，不改现金，不自动补扣历史。|

## 安装与维护的范围

公开 npm 包只包含通用入口、安装器及完整性清单，不导入家庭正文目录。每次使用入口，先由认证 MCP 获取对应 id 的最新正文；网站维护后，下次读取生效。入口升级本身仍须重新安装。完整正文 ZIP 备份继续只对家庭成员开放，可选择固定历史版本；它不是公开安装包，也不承诺修改 ChatGPT 客户端插件文件。

npm 命令使用已发布站点的 tgz URL；没有虚构未发布的 npm scope。Node.js 20 或更新版本即可。默认安装 CODEX_HOME/skills，未设置时 ~/.codex/skills，可指定 --target 临时目录及 --dry-run。命令执行的是本站公开、经审查的无依赖安装器；连接与登录继续使用已有 MCP。

## 本轮真实线上只读核验

发布前修订 46：list_transactions 完整返回 17 条，INCOME/EXPENSE/PAYMENT 为 0；get_recurring_candidates 返回 0 候选。已有四条人工周期规则保留。这表示目前没有足够重复月份的已过账实际记录，不表示 MCP 未开通。测试用两个月实际模拟收入独立验证归并到采用，未向生产家庭写入测试流水。

## 证据

见 VERIFICATION-NPM-CALENDAR-2026-11-12.md。保留此前 127 项及迁移阶段的历史验收边界；本轮不把新增测试数宣称为所有历史需求的覆盖率。

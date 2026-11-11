# Personal Finance Center — 2026-11-11接续快照

私人家庭财务站：Sites Vinext / React / TypeScript / D1。当前包含账本、资产/贷款、AI评估、预算付款退款、预付款、图片候选、周期规则、目标、站内提醒、加密备份和OAuth协议等实现，但主流程仍有未完成需求。

先读：

- [Mac接续开发](docs/MAC-HANDOFF.md)
- [最新需求](docs/requirements-latest.md)
- [需求执行清单](docs/superpowers/plans/2026-11-11-execution-checklist.md)
- [复杂需求技术方案v2](docs/TECHNICAL-DESIGN-v2.md)
- [部署资源清单](docs/DEPLOYMENT-RESOURCES.md)

交接前重跑npm test：107项通过。新历史弹窗E2E目前预期失败，组件还没实现；投资统一节点、自动分类和可编辑清单的页面接线也尚未完成。不要把方案当成现有功能。

建议Node24；npm ci后按Mac文档启动与验证。源码包不含node_modules、真实数据库、用户截图、API密钥或OAuth凭据。默认空模拟账本；源码恢复不等于真实数据恢复。

站点尚未正式发布。保留.openai/hosting.json中同一project_id，依照Sites源码流程发布；不要新建重复Site，不将local/server.mjs的模拟身份服务作为公网生产入口。

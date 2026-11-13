# 统一插件安装与连接检查

来自用户分享会话6af683c5-45c0-83e9-b96c-ff49d4be47dd，已在浏览器读取。7个Skill安装成功但目标会话没有MCP；iPad无法执行桌面命令，通用包下载还曾返回401。用户要求减少手工配置，以完整插件形式分发。本轮仅本地，不发布。

|编号|需求|验收|
|---|---|---|
|PI01|插件包含七个业务Skill和必需MCP映射|生成符合官方格式的plugin.json、.app.json或mcp.json，缺实际绑定时拒绝打包，禁止伪造地址/应用ID|
|PI02|安装后检查账号、家庭、权限和工作流|新增只读MCP检查，不返回余额/流水/令牌，不因本机Skill文件存在而宣称MCP可用|
|PI03|网站说明适配手机/iPad|主流程不用终端；旧npx仅桌面兼容入口，明确不含MCP连接；不展示技能下载|
|PI04|安装与授权分离|账号实际完成OAuth，检测当前认证身份与家庭；仅接通/工作流正常时向当前MCP会话报告就绪，网页不代断言另一个ChatGPT会话已连接|
|PI05|保持财务审批链|只读检查及安装不改变权限、不代审批、不记账、不交易，七业务入口继续实时读取家庭正文|
|PI06|真实分发完成前不作成功承诺|本地测试通过与ChatGPT安装、授权、iPad可用分开记录；缺平台注册/分发时列外部依赖|

实现选择：以已注册应用映射为优先分发方式；远程MCP配置作为便携/桌面打包选项，不承诺导入后可在手机使用。另带一个安装后检查Skill，不增加业务工作流种类。检查Skill只读取最小连接状态，业务请求才读取财务上下文。

参考：https://developers.openai.com/plugins/build/plugins ，https://learn.chatgpt.com/docs/plugins ，https://learn.chatgpt.com/docs/enterprise/plugin-management 。官方明确：导入仓库与公开目录不同；即使远程HTTPS MCP也可能在导入时被标为Desktop only；增加.app.json不自动改变该标记。

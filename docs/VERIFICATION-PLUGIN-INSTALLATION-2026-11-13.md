# 统一插件接入：本地实现与验证

按[PI01—PI06](requirements-plugin-installation-2026-11-13.md)实施，本轮仅本地，未发布、未注册应用、未安装到用户账号或改动其MCP配置。

## 已实现

- `scripts/package-finance-plugin.mjs`：生成完整可分发目录，含官方格式根plugin.json、七个通用业务Skill、安装后连接检查Skill、必需平台注册应用映射（.app.json），或显式选择远程OAuth MCP配置（mcp.json），以及市场清单。没有实际绑定就拒绝打包，不猜首页/mcp路径，不把Site/link/plugin ID冒充App ID；不接受令牌/密钥或在非空目录残留旧绑定。
- `get_connection_status`：第14个只读MCP工具，检查请求身份、有效家庭成员、读写权限及7个工作流。无余额、流水、凭据，不写财务数据。成员移除、身份伪造和未知参数均拒绝。它不能检测其他会话或设备的插件安装状态。
- 安装后检查Skill只读最小状态，业务请求才加载get_skill_bundle/财务上下文，保留网站核对与家庭审批。
- 网站工作流页改为插件接入说明、本站检查与清晰的“ChatGPT会话需另行检查”。手机/iPad不展示终端为主流程，旧版npx入口默认收起且明确仅安装Skill、不连接MCP。没有新增下载Skill入口。

## 验证

- 708项单元/接口测试全部通过，0失败0跳过：`work/plugin-unit.log`。
- 类型检查与本地生产构建通过：`work/plugin-typecheck.log`、`work/plugin-build.log`；未部署。
- 新增插件打包及身份/权限回归4项：先复现新工具缺失，再实现后通过。实际运行打包CLI检查市场与Skill/MCP文件，故意使用明确测试App ID，仅在临时目录验证，不声称该ID存在于平台。
- 本地真实Chrome/HTTP/独立SQLite 6项全部通过：`work/plugin-connection-e2e/report.json`。包含默认无终端/下载路径、真实本站身份与家庭、401清除旧成功提示并重试、768及390布局、只读成员身份、检查零财务写入及无外部网络请求。仅验证视口布局，不等于真实iPad客户端安装。

## 尚未完成的外部环节

1. 平台上实际注册的MCP应用ID或平台确认的远程MCP连接元数据。本次Sites读取项目返回404，插件检索未找到可用条目，不能核实原连接映射；未据此编造ID、MCP地址或安装链接。
2. 将完整包导入个人/工作区或提交公共目录的授权分发流程。若使用工作区GitHub导入需管理员权限；不能保证个人账号具备该入口，不能把本机市场当跨设备安装。
3. 完成真实OAuth、新会话读取、提交预算调整草稿及研究草稿、站点核对后的回读，以及真实iPad使用验收。上述均未测试，不标成功。

开发者拿到实际注册应用ID后，可执行：

`npm run plugin:pack -- --app-id 平台实际AppID --output 一个空的发布目录`

远程配置使用 `--mcp-url 平台已确认的HTTPS端点`，可选`--oauth-resource 平台确认资源`。该命令仅准备文件，不上传、不安装、不注册。普通用户无需执行。

官方依据：[打包格式](https://developers.openai.com/plugins/build/plugins)、[插件安装与手机支持](https://learn.chatgpt.com/docs/plugins)、[GitHub导入与Desktop only限制](https://learn.chatgpt.com/docs/enterprise/plugin-management)。导入带远程MCP的插件也可能标记Desktop only，添加.app.json本身不保证消除该标记。

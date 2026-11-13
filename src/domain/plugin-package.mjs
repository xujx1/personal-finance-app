import {SKILL_ENTRIES,bootstrapSkill} from './skill-cli.mjs';

export const FINANCE_PLUGIN_VERSION='1.0.0';
export const FINANCE_WEBSITE='https://xu-family-finance-20261111.shady-gnat-0277.chatgpt.site';
export const CONNECTION_SKILL=`---
name: family-finance-connection
description: 安装家庭财务中心插件后检查当前会话的MCP、登录家庭及权限，或排查技能已安装但无法读取站点的问题。
---

# 家庭财务中心连接检查

不要通过Skill文件、插件菜单或站点登录推断当前会话已连接。
1. 在当前会话发现家庭财务中心的 get_connection_status 工具并调用，不使用浏览器替代该检查。工具不存在时只报告“当前会话未加载连接”，引导用户在插件详情完成连接并打开新会话；不要让iPad用户运行npm/PowerShell，不索取密码、令牌或下载私人账本。
2. 401表示需要完成该插件的登录授权；FAMILY_REQUIRED表示尚未加入家庭，到财务网站接受有效邀请。403或成员状态变化须停止访问，不重复尝试绕过权限。
3. 成功时展示返回的当前账号、家庭、只读或可提交草稿权限与工作流版本。仅status=ready才说“当前会话连接检查通过”。不把它描述为授权付款或审批。
4. 检查不读取资产、余额或流水。若用户接着发起业务任务，再调用get_skill_bundle读取对应最新业务正文，按正文读取必要上下文并提交待核对草稿。
5. 如果平台没有提供安装或共享入口，说明分发尚未完成，不编造安装链接、不声称本地仓库会同步到iPad。已安装本地技能无需反复重装；插件接入和账号授权是独立环节。
`;

function httpsEndpoint(value){
 if(typeof value!=='string')throw Error('需要平台确认的HTTPS地址');
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||['localhost','127.0.0.1','::1','[::1]'].includes(u.hostname)||/\.test$|\.invalid$/.test(u.hostname))throw Error('连接地址必须为不含凭据、查询或片段的正式HTTPS地址');
 return u.href;
}
/** Configuration describes a connection; it never contains an account credential. */
export function financePluginFiles(config){
 if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['appId','mcpUrl','oauthResource'].includes(k)))throw Error('插件配置无效；不接受令牌或密钥');
 if(Boolean(config.appId)===Boolean(config.mcpUrl))throw Error('必须提供一个实际注册应用ID或已确认MCP地址，不能只有技能');
 if(config.oauthResource&&!config.mcpUrl)throw Error('OAuth资源仅用于远程MCP配置');
 const extension={onboardingSkill:'./skills/family-finance-connection/SKILL.md',interface:{displayName:'家庭财务中心',shortDescription:'家庭规划、研究、审批查询与实际记账草稿',developerName:'家庭财务中心',category:'Productivity',capabilities:['Read','Write'],websiteURL:FINANCE_WEBSITE,defaultPrompt:['检查家庭财务中心连接','查看我的待审批预算','调整出游预算并保存待核对草稿']}};
 const files={};
 if(config.appId){
  if(typeof config.appId!=='string'||!/^(asdk_app_|connector_|templated_apps_)[A-Za-z0-9_-]{1,150}$/.test(config.appId))throw Error('请使用平台注册的应用ID，不是站点ID、连接ID或插件ID');
  extension.apps='./.app.json';files['.app.json']=JSON.stringify({apps:{'family-finance':{id:config.appId,required:true}}},null,2)+'\n';
 }else{
  const auth={type:'oauth',...(config.oauthResource?{resource:httpsEndpoint(config.oauthResource)}:{})};
  files['mcp.json']=JSON.stringify({$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{'family-finance':{type:'streamable-http',url:httpsEndpoint(config.mcpUrl),extensions:{'com.openai':{auth}}}}},null,2)+'\n';
 }
 files['plugin.json']=JSON.stringify({$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:'family-finance',version:FINANCE_PLUGIN_VERSION,description:'家庭财务中心七个业务工作流及认证MCP连接；草稿经网站核对和家庭审批后生效。',extensions:{'com.openai':extension}},null,2)+'\n';
 for(const entry of SKILL_ENTRIES)files['skills/'+entry[0]+'/SKILL.md']=bootstrapSkill(entry);
 files['skills/family-finance-connection/SKILL.md']=CONNECTION_SKILL;
 return files;
}
export function financeMarketplace(){return {name:'family-finance',interface:{displayName:'家庭财务中心'},plugins:[{name:'family-finance',source:{source:'local',path:'./plugins/family-finance'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]};}

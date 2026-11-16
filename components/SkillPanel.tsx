"use client";
import {useEffect,useState} from 'react';
import {HouseholdSetupStart} from './HouseholdSetup';
import ChatGPTEntry from './ChatGPTEntry';
import {skillInstallCommand} from '../src/domain/skill-cli.mjs';
import './ChatGPTWorkflows.css';
import './PluginConnection.css';
import {useI18n} from './I18n';

export default function SkillPanel({state,onSave,prompt}:{state:any;onSave:any;prompt?:string}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const [command,setCommand]=useState(''),[status,setStatus]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{setCommand(skillInstallCommand(window.location.origin))},[]);
 async function check(){
  if(busy)return;setBusy(true);setError('');setStatus(null);
  try{const response=await fetch('/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name:'get_connection_status',arguments:{}}})});const value:any=await response.json();if(!response.ok||value.result?.isError||!value.result?.structuredContent)throw Error(response.status===401?'请重新登录本站后检查。':response.status===403?'请确认家庭邀请及当前成员权限后重新检查。':'本站连接检查暂未完成，请稍后重试。');setStatus(value.result.structuredContent)}catch(cause){setError(cause instanceof Error?cause.message:'连接检查失败，请重试。')}finally{setBusy(false)}
 }
 return <><div className="page-title"><div><div className="eyebrow">WORKFLOW INTEGRATION</div><h1>{tr("工作流集成")}</h1><p className="subtitle">{tr("在ChatGPT中连接家庭财务中心，网站负责核对、审批和展示。")}</p></div></div>
 <section className="card plugin-connection" aria-label={tr("ChatGPT插件接入")}><h2>{tr("连接家庭财务中心")}</h2><p className="help-text">{tr("七个业务工作流与财务连接应一起安装。手机和iPad无需执行命令，也无需下载技能包。")}</p>
 <ol className="plugin-steps"><li><strong>{tr("安装插件并登录授权")}</strong><p>{tr("在ChatGPT插件中使用家庭财务中心，按提示连接你的账号。如尚无安装入口，请联系管理员完成插件分发，不必重复安装技能。")}</p></li><li><strong>{tr("检查当前会话")}</strong><p>{tr("在新会话中说“检查家庭财务中心连接”。助手应确认当前账号、家庭、权限和工作流可用后，再开始规划。")}</p></li><li><strong>{tr("核对后再生效")}</strong><p>{tr("助手提交草稿；预算仍需家人逐一审批，实际消费核对后才更新流水和账户。")}</p></li></ol>
 <a className="btn primary" href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer">{tr("打开ChatGPT插件页 ↗")}</a>
 <div className="plugin-site-check"><div><h3>{tr("检查本站账号与家庭")}</h3><p className="help-text">{tr("这项检查来自浏览器，不能证明另一个ChatGPT会话已经安装或授权。")}</p></div><button type="button" className="btn" disabled={busy} onClick={check}>{busy?tr("正在检查…"):tr("检查本站连接")}</button></div>
 {error&&<p className="notice" role="alert">{uiMessage(error)}</p>}{status&&<div className="plugin-check-result" role="status"><strong>{status.status==='ready'?tr("本站账号与家庭检查通过"):tr("本站尚未就绪")}</strong><dl><div><dt>{tr("当前账号")}</dt><dd>{status.account?.name??tr("待确认")}</dd></div><div><dt>{tr("当前家庭")}</dt><dd>{status.family?.name??tr("尚未绑定")}</dd></div><div><dt>{tr("权限")}</dt><dd>{status.permissions?.canSubmitDraft?tr("可提交待核对草稿"):status.permissions?.canRead?tr("只读访问"):tr("待授权")}</dd></div><div><dt>{tr("工作流")}</dt><dd>{status.workflows?.ready?tr("{p0}项业务工作流可用", {p0: status.workflows.count}):tr("待检查")}</dd></div><div><dt>{tr("ChatGPT当前会话")}</dt><dd>{tr("请在该会话中检查连接")}</dd></div></dl></div>}
 </section>
 {prompt?<ChatGPTEntry prompt={prompt} onSave={state.viewer?.canWrite?onSave:undefined} context="已准备好你在站点选择的任务。"/>:<HouseholdSetupStart state={state} onSave={onSave}/>}
 <details className="card section-space plugin-legacy"><summary>{tr("电脑端旧版技能入口")}</summary><p className="help-text">{tr("仅兼容已配置好MCP的Codex电脑环境。此命令只安装七个技能，不连接MCP、不完成登录，不适用于iPad。")}</p><pre className="skill-npm-command" aria-label={tr("Codex安装命令")}><code>{command||tr("正在准备安装命令…")}</code></pre></details></>;
}

"use client";
import {useEffect,useState} from 'react';
import {HouseholdSetupStart} from './HouseholdSetup';
import ChatGPTEntry from './ChatGPTEntry';
import {skillInstallCommand} from '../src/domain/skill-cli.mjs';
import './ChatGPTWorkflows.css';
export default function SkillPanel({state,onSave,prompt}:{state:any;onSave:any;prompt?:string}){
 const [command,setCommand]=useState('');useEffect(()=>{setCommand(skillInstallCommand(window.location.origin))},[]);
 return <><div className="page-title"><div><div className="eyebrow">WORKFLOW INTEGRATION</div><h1>工作流集成</h1><p className="subtitle">一次安装，在ChatGPT或Codex中规划，回到这里核对与保存。</p></div></div>{prompt&&<ChatGPTEntry prompt={prompt} onSave={state.viewer?.canWrite?onSave:undefined} context="已准备好你在站点选择的任务。"/>}{!prompt&&<HouseholdSetupStart state={state} onSave={onSave}/>}<section className="card section-space" aria-label="Codex一键安装"><h2>Codex一键安装</h2><p className="help-text">安装建档、消费、投资、图片、月报、周期收支和审批查询七个工作流入口。</p><pre className="skill-npm-command" aria-label="Codex安装命令"><code>{command||'正在准备安装命令…'}</code></pre><p className="help-text">让Codex执行这条命令即可。需要Node.js 20或更新版本；首次安装或升级后重新打开Codex会话，使用已连接的家庭财务中心。入口使用时自动读取本站最新工作流。</p><a className="btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">打开ChatGPT ↗</a></section></>;
}

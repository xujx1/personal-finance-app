"use client";
import {useEffect,useRef,useState} from 'react';
import './ChatGPTWorkflows.css';
import {useI18n} from './I18n';

export default function ChatGPTEntry({prompt,title='在ChatGPT中继续',onSave,kind='travel',context}:{prompt?:string;title?:string;onSave?:any;kind?:string;context?:string}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),saved=useRef(new Set<string>()),pending=useRef(false);
 const taskKey=JSON.stringify([kind,prompt??title]),currentTask=useRef(taskKey);currentTask.current=taskKey;
 useEffect(()=>{setMessage('')},[taskKey]);
 async function start(){
  if(pending.current)return;pending.current=true;setBusy(true);setMessage('');
  // Open on the click, before awaiting the private save, so popup blocking does
  // not silently lose a prepared date or original plan. Never put it in a URL.
  const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
  try{if(!saved.current.has(taskKey)){const result=await onSave('research.request',{kind,title:title.slice(0,100),question:uiLocale==='en-US'?prompt+'\n\nPlease respond in English. Keep original record names, identifiers, amounts, currencies and dates unchanged.':prompt});if(!result?.id)throw Error('任务保存结果未确认，请核对站点提示后再继续。');saved.current.add(taskKey);}
   if(tab)tab.location.href='https://chatgpt.com/';if(currentTask.current===taskKey)setMessage('任务已保存在家庭内。在ChatGPT中选择家庭财务中心，说“继续网站中准备的任务”即可读取。');
  }catch(error:any){tab?.close();if(currentTask.current===taskKey)setMessage(error.message??'任务暂未保存，请稍后重试。');}finally{pending.current=false;setBusy(false);}
 }
 return <section className="card chatgpt-entry" aria-label={tr("ChatGPT处理入口")}><div className="eyebrow">{tr("CHATGPT · 家庭财务中心")}</div><h2>{tr(title)}</h2><p className="help-text">{tr("在ChatGPT中选择已连接的“家庭财务中心”，直接说明你的想法。分析完成后保存草稿，再回本站核对与审批。")}</p>{context&&<p className="help-text">{tr(context)}</p>}<div className="actions">{prompt&&onSave?<button className="btn primary" disabled={busy} onClick={start}>{busy?tr("正在准备…"):tr("交给ChatGPT ↗")}</button>:<a className="btn primary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">{tr("打开ChatGPT ↗")}</a>}</div>{message&&<p role="status" className="help-text">{uiMessage(message)}</p>}</section>;
}

"use client";
import {useState} from 'react';
import './ChatGPTWorkflows.css';
export default function ChatGPTEntry({prompt,title='在ChatGPT中继续'}:{prompt:string;title?:string}){
 const [message,setMessage]=useState('');
 return <section className="card chatgpt-entry" aria-label="ChatGPT处理入口"><div className="eyebrow">CHATGPT · 家庭财务中心</div><h2>{title}</h2><p className="help-text">在ChatGPT中选择已连接的“家庭财务中心”，完成分析后保存草稿，再回本站核对。预算须家庭成员确认，实际收支须核对到账或付款事实。</p><label className="field">可以这样说<textarea aria-label="ChatGPT请求内容" readOnly value={prompt}/></label><div className="actions"><button className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setMessage('已复制，可以粘贴到ChatGPT。')}catch{setMessage('请选中上方文字手动复制。')}}}>复制请求</button><a className="btn primary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">打开ChatGPT ↗</a></div>{message&&<p role="status" className="help-text">{message}</p>}</section>;
}

"use client";
import {useState} from 'react';
import McpDraftInbox from './McpDraftInbox';
import {CONSUMPTION_TYPES,consumptionTypeOf} from '../src/domain/consumption.mjs';
import {researchRecords,filterResearchRecords,researchRecordDate} from '../src/domain/research-records.mjs';
import {RichText} from './AssistantPresentation';
import './ChatGPTWorkflows.css';
import './RecordFilters.css';
export default function ResearchRecords({state,onSave}:{state:any;onSave:any}){
 const [query,setQuery]=useState(''),[kind,setKind]=useState('all'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(1);
 const all=researchRecords(state),records=filterResearchRecords(all,{query,kind,from,to}),pages=Math.max(1,Math.ceil(records.length/5)),currentPage=Math.min(page,pages),shown=records.slice((currentPage-1)*5,currentPage*5),invalidRange=Boolean(from&&to&&from>to);
 const labels:Record<string,string>=Object.fromEntries([...CONSUMPTION_TYPES,{id:'investment',label:'投资研究'}].map(t=>[t.id,t.label]));
 return <><div className="page-title"><div><div className="eyebrow">RESEARCH RECORDS</div><h1>研究记录</h1><p className="subtitle">统一核对同步草稿，查看已保存的研究与历史方案。</p></div></div>
 <McpDraftInbox state={state} onSave={onSave}/>
 <section className="card section-space"><div className="card-title"><h2>研究与历史方案</h2><span>共 {all.length} 条 · 匹配 {records.length} 条 · 每页5条</span></div>
 <div className="record-filters"><label className="field">搜索研究记录<input aria-label="搜索研究记录" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label><label className="field">消费种类<select aria-label="消费种类" value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}}><option value="all">全部种类</option>{[...CONSUMPTION_TYPES,{id:'investment',label:'投资研究'}].map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label><label className="field">评估 / 保存时间 · 从<input aria-label="研究开始日期" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1)}}/></label><label className="field">至<input aria-label="研究结束日期" type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1)}}/></label></div>
 {invalidRange&&<p className="help-text" role="status">开始日期不能晚于结束日期。</p>}<p className="help-text">按评估或保存时间筛选；旧记录仅有计划日期时会明确标注，未记录时间的方案仅在未限定日期时显示。</p>
 {!shown.length&&<p className="help-text">暂无匹配研究。</p>}{shown.map((d:any)=>{const p=d.payload,projection=['plan_research','budget_research'].includes(d.kind),legacy=d.kind!=='investment_review'&&!projection,when=researchRecordDate(d);return <article className="review-record" key={d.id}><div className="research-record-meta"><span className="badge gray">{projection?'已采用预算 · 研究存档':legacy?'历史方案 · 按当时资料保存':'已核对研究 · 未交易'}</span><span>{labels[consumptionTypeOf(d)]??'未分类'} · {when.date?when.label+'：'+when.date:'时间未记录'}</span></div><h3>{p.title??p.inputs?.question??'历史研究'}</h3><RichText text={p.summary??''}/><details><summary>查看分析与来源</summary><RichText text={p.content??p.modelSummary??p.summary??''}/>{p.missing?.length>0&&<ul>{p.missing.map((m:string,i:number)=><li key={i}>{m}</li>)}</ul>}<ul>{(p.sources??[]).map((s:any,i:number)=>{let href;try{const u=new URL(s.url);if(u.protocol==='https:'&&!u.username&&!u.password)href=u.href}catch{}return <li key={i}>{href?<a href={href} target="_blank" rel="noopener noreferrer">{s.title}</a>:s.title} · {s.checkedAt??s.checked_at??'查询时间待核实'}</li>})}</ul><p className="help-text">引用与分析未由本站重新联网核验，不代表实时成交报价。</p></details></article>})}<div className="actions section-space" aria-label="研究分页"><button className="btn" disabled={currentPage<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>第 {currentPage} / {pages} 页</span><button className="btn" disabled={currentPage>=pages} onClick={()=>setPage(p=>p+1)}>下一页</button></div></section></>;
}

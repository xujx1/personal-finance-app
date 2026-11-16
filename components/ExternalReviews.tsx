"use client";
import InvestmentFollowups from './InvestmentFollowups';
import {useEffect,useRef,useState} from 'react';
import McpDraftInbox from './McpDraftInbox';
import {CONSUMPTION_TYPES,consumptionTypeOf} from '../src/domain/consumption.mjs';
import {researchRecords,filterResearchRecords,researchRecordDate,researchFactSummary} from '../src/domain/research-records.mjs';
import {getResearchView,saveResearchView} from '../src/domain/research-view.mjs';
import HistoricalAnalysisNotice from './HistoricalAnalysisNotice';
import {RichText} from './AssistantPresentation';
import './ChatGPTWorkflows.css';
import './RecordFilters.css';
import {useI18n} from './I18n';

const expandedRecords=new Set<string>();
export default function ResearchRecords({state,onSave,focusId}:{state:any;onSave:any;focusId?:string|null}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const [view,setView]=useState(()=>getResearchView()),history=useRef<HTMLElement>(null),initial=useRef(view.scrollY);
 const {query,kind,from,to,page,open}=view;
 function update(patch:any){setView(current=>{const next={...current,...patch};saveResearchView(next);return next})}
 useEffect(()=>{const saveScroll=()=>saveResearchView({scrollY:window.scrollY});window.addEventListener('scroll',saveScroll,{passive:true});const frame=requestAnimationFrame(()=>{if(!focusId&&initial.current)window.scrollTo(0,initial.current)});return()=>{window.removeEventListener('scroll',saveScroll);cancelAnimationFrame(frame)}},[]);
 useEffect(()=>{if(focusId){expandedRecords.add(focusId);setView(current=>{const next={...current,query:focusId,kind:'all',from:'',to:'',page:1,open:true};saveResearchView(next);return next});requestAnimationFrame(()=>history.current?.scrollIntoView({block:'start'}))}},[focusId]);
 const all=researchRecords(state),records=filterResearchRecords(all,{query,kind,from,to}),pages=Math.max(1,Math.ceil(records.length/5)),currentPage=Math.min(page,pages),shown=open?records.slice((currentPage-1)*5,currentPage*5):[],invalidRange=Boolean(from&&to&&from>to);
 const labels:Record<string,string>=Object.fromEntries([...CONSUMPTION_TYPES,{id:'investment',label:'投资研究'}].map(t=>[t.id,t.label]));
 return <><div className="page-title"><div><div className="eyebrow">RESEARCH RECORDS</div><h1>{tr("研究记录")}</h1><p className="subtitle">{tr("统一核对同步草稿，查看已保存的研究与历史方案。")}</p></div></div>
 <McpDraftInbox state={state} onSave={onSave}/>
 <section className="card section-space research-history" ref={history}><div className="card-title"><h2>{tr("研究与历史方案")}</h2><button type="button" className="btn" aria-expanded={open} aria-controls="research-history-content" onClick={()=>update({open:!open})}>{open?tr("收起"):tr("展开")}{tr("研究与历史方案（")}{all.length}{" "}{tr("条）")}</button></div>
 {!open&&<p className="help-text">{tr("展开查看已保存研究、历史版本与筛选条件。")}</p>}
 {open&&<div id="research-history-content"><p className="help-text">{tr("共")}{" "}{all.length}{" "}{tr("条 · 匹配")}{" "}{records.length}{" "}{tr("条 · 每页5条")}</p>
 <div className="record-filters"><label className="field">{tr("搜索研究记录")}<input aria-label={tr("搜索研究记录")} value={query} onChange={e=>update({query:e.target.value,page:1})}/></label><label className="field">{tr("消费种类")}<select aria-label={tr("消费种类")} value={kind} onChange={e=>update({kind:e.target.value,page:1})}><option value="all">{tr("全部种类")}</option>{[...CONSUMPTION_TYPES,{id:'investment',label:'投资研究'}].map(t=><option key={t.id} value={t.id}>{tr(t.label)}</option>)}</select></label><label className="field">{tr("评估 / 保存时间 · 从")}<input aria-label={tr("研究开始日期")} type="date" value={from} onChange={e=>update({from:e.target.value,page:1})}/></label><label className="field">{tr("至")}<input aria-label={tr("研究结束日期")} type="date" value={to} onChange={e=>update({to:e.target.value,page:1})}/></label></div>
 <button type="button" className="text-button" onClick={()=>update({query:'',kind:'all',from:'',to:'',page:1})}>{tr("清空研究筛选")}</button>
 {invalidRange&&<p className="help-text" role="status">{tr("开始日期不能晚于结束日期。")}</p>}<p className="help-text">{tr("按评估或保存时间筛选；旧记录仅有计划日期时会明确标注，未记录时间的方案仅在未限定日期时显示。")}</p>
 {!shown.length&&<p className="help-text">{tr("暂无匹配研究。")}</p>}{shown.map((d:any)=>{const p=d.payload,projection=['plan_research','budget_research'].includes(d.kind),legacy=d.kind!=='investment_review'&&!projection,when=researchRecordDate(d),facts=researchFactSummary(d,state),budget=projection||p.expenseDraft||facts.current;return <article className="review-record" key={d.id} data-research-id={d.id}><div className="research-record-meta"><span className="badge gray">{projection?tr("已采用预算 · 研究存档"):legacy?tr("历史方案 · 按当时资料保存"):tr("已核对研究 · 未交易")}</span><span>{tr(labels[consumptionTypeOf(d)])??tr("未分类")} · {when.date?tr(when.label)+' · '+when.date:tr("时间未记录")}</span></div><h3>{p.title??p.inputs?.question??tr("历史研究")}</h3>{budget?<HistoricalAnalysisNotice facts={facts}/>:<div className="sensitive-text"><RichText text={p.summary??''}/></div>}{d.kind==='investment_review'&&<InvestmentFollowups key={d.id+':'+(p.followUpsUpdatedAt??p.acceptedAt??'')} document={d} state={state} onSave={onSave}/>}<details open={expandedRecords.has(d.id)} onToggle={e=>{if(e.currentTarget.open)expandedRecords.add(d.id);else expandedRecords.delete(d.id)}}><summary>{budget?tr("查看历史原始分析与来源"):tr("查看分析与来源")}</summary>{budget&&<p className="help-text">{tr("以下保留原文，可能包含修改前金额、状态及行程描述，需对照上方结构化事实重新核对。")}</p>}<div className="sensitive-text"><RichText text={p.content??p.modelSummary??p.summary??''}/></div>{p.missing?.length>0&&<ul className="sensitive-text">{p.missing.map((m:string,i:number)=><li key={i}>{m}</li>)}</ul>}<ul>{(p.sources??[]).map((s:any,i:number)=>{let href;try{const u=new URL(s.url);if(u.protocol==='https:'&&!u.username&&!u.password)href=u.href}catch{}return <li key={i}>{href?<a href={href} target="_blank" rel="noopener noreferrer">{s.title}</a>:s.title} · {s.checkedAt??s.checked_at??tr("查询时间待核实")}</li>})}</ul><p className="help-text">{tr("引用与分析未由本站重新联网核验，不代表实时成交报价。")}</p></details></article>})}<div className="actions section-space" aria-label={tr("研究分页")}><button className="btn" disabled={currentPage<=1} onClick={()=>update({page:currentPage-1})}>{tr("上一页")}</button><span>{tr("第")}{" "}{currentPage} / {pages}{" "}{tr("页")}</span><button className="btn" disabled={currentPage>=pages} onClick={()=>update({page:currentPage+1})}>{tr("下一页")}</button></div></div>}</section></>;
}

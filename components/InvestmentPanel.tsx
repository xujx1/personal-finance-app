"use client";

import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import AdvisorHistory from './AdvisorHistory';
import InvestmentCalculation from './InvestmentCalculation';
import {AnalysisFlow,RichText,upsertAnalysisStep} from './AssistantPresentation';
import {consumeAdviceStream} from '../src/domain/advisor-stream.mjs';

type Props={state:any;onRefresh:()=>Promise<void>;registration:ReactNode;startWithRegistration?:boolean};
type Proposal={kind:string;title:string;summary:string;content:string;calculation?:any;modelSummary?:string;createdAt?:string;missing?:string[];sources?:{url:string;title:string;checkedAt?:string|null;verification?:string}[]};
type Result={id:string;proposal:Proposal};
type Stage={name:string;status:string;summary?:string};
const labels:Record<string,string>={get_assets:'核对已有资产',get_liabilities:'核对贷款和负债',get_budgets:'核对预算占用',get_holdings:'核对证券持仓',get_savings_goals:'核对金额与期限目标',get_market_quotes:'更新可用报价并核对来源日期',get_recent_consumption:'核对已确认消费',get_cashflow_context:'核对现金流依据',investment_research:'检索资料并分析投资问题'};

export default function InvestmentPanel({state,onRefresh,registration,startWithRegistration=false}:Props){
 const [registering,setRegistering]=useState(startWithRegistration),[question,setQuestion]=useState(''),[provider,setProvider]=useState('compatible');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[stages,setStages]=useState<Stage[]>([]),[answer,setAnswer]=useState(''),[result,setResult]=useState<Result|null>(null);
 const pending=useRef<{fingerprint:string;key:string}|null>(null),flight=useRef<AbortController|null>(null);
 const canWrite=state?.viewer?.canWrite!==false;
 const history=(Array.isArray(state?.documents)?state.documents:[]).filter((record:any)=>record?.kind==='research_proposal'&&record.payload?.kind==='wealth').sort((a:any,b:any)=>String(b.payload.createdAt??'').localeCompare(String(a.payload.createdAt??'')));
 useEffect(()=>()=>{flight.current?.abort();},[]);
 useEffect(()=>{let active=true;fetch('/api/advisor',{cache:'no-store'}).then(r=>r.ok?r.json():null).then((config:any)=>{if(active)setProvider(config?.configured?'compatible':config?.chatgpt?.connected&&config?.chatgpt?.model?'chatgpt':'compatible')}).catch(()=>{});return()=>{active=false}},[]);
 async function submit(event:FormEvent){
  event.preventDefault();if(flight.current||!canWrite)return;
  const body={question:question.trim(),provider},fingerprint=JSON.stringify(body);
  if(!pending.current||pending.current.fingerprint!==fingerprint)pending.current={fingerprint,key:crypto.randomUUID()};
  const controller=new AbortController();flight.current=controller;setBusy(true);setError('');setStages([]);setAnswer('');setResult(null);
  try{
   const response=await fetch('/api/investment',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({...body,key:pending.current.key}),signal:controller.signal});
   if(!response.ok){const value=await response.json() as {error?:string};throw Error(value.error??'投资分析未完成');}
   const rawValue:unknown=await consumeAdviceStream(response,(event:{type:string;name?:string;status?:string;text?:string;summary?:string})=>{
    if(event.type==='tool'&&event.name&&event.status){setStages(old=>upsertAnalysisStep(old,event));}
    if(event.type==='delta'&&typeof event.text==='string')setAnswer(text=>text+event.text);
   });
   if(!rawValue||typeof rawValue!=='object')throw Error('投资分析结果无效');
   const candidate=rawValue as Partial<Result>;
   if(typeof candidate.id!=='string'||candidate.proposal?.kind!=='wealth'||typeof candidate.proposal.content!=='string'||typeof candidate.proposal.title!=='string')throw Error('投资分析结果无效');
   const value=candidate as Result;
   controller.signal.throwIfAborted();setResult(value);setAnswer(value.proposal.content);pending.current=null;await onRefresh();
  }catch(error){setError(controller.signal.aborted?'分析已停止，可使用原问题重试':error instanceof Error?error.message:'投资分析未完成');}
  finally{if(flight.current===controller)flight.current=null;setBusy(false);}
 }
 return <>
  {!registering&&<div className="page-title"><div><div className="eyebrow">INVESTMENT ASSISTANT</div><h1>AI投资助手</h1><p className="subtitle">从一个投资问题开始，结合已有持仓、预算、目标与现金流分析。</p></div></div>}
  <div className="actions section-space"><button className="btn soft" type="button" disabled={busy} onClick={()=>setRegistering(value=>!value)}>{registering?'返回投资分析':'登记已有资产'}</button></div>
  {registering?registration:<>
   <div className="advisor-grid investment-grid"><form className="card" onSubmit={submit}>
    <label className="field">投资问题<textarea aria-label="投资问题" rows={4} maxLength={3000} required value={question} disabled={busy||!canWrite} onChange={event=>setQuestion(event.target.value)} placeholder="例如：结合我的贷款、现金流和持仓，是否需要降低单一股票占比？"/></label>

    <p className="help-text">结合家庭账本与市场资料分析，报价注明来源和时间。结果供你决策，不执行交易。</p>
    <div className="actions"><button className="btn primary" disabled={busy||!canWrite||!question.trim()}>{busy?'正在分析…':'分析投资问题'}</button>{busy&&<button className="btn" type="button" onClick={()=>flight.current?.abort()}>停止分析</button>}</div>
    {error&&<p className="notice" role="alert">{error}</p>}
   </form>
   <section className="card advisor-result" aria-label="投资分析结果">
    <div className="card-title"><h2>建议与资金影响</h2>{result&&<small>研究草稿 · 由本人决定后续操作</small>}</div>
    {result?.proposal.calculation&&<InvestmentCalculation calculation={result.proposal.calculation}/>}
    {result&&<div className="advisor-verdict"><h3>{result.proposal.calculation?'投资研究与资金核对':result.proposal.title}</h3><RichText text={result.proposal.calculation?result.proposal.summary:'此份历史研究未附服务器逐项测算，正文金额和结论尚需核实；请重新分析以取得当前报价及计算。'}/></div>}
    <AnalysisFlow steps={stages} busy={busy}/>
    {busy&&<p className="help-text" aria-live="polite">{answer?'正在生成分析…':'正在分析，请稍候…'}</p>}
    {answer&&!result&&<p className="help-text">以下为未完成校验的分析片段</p>}{answer?result?<details key={result.id+':analysis'} className="assistant-details"><summary>查看完整分析与依据</summary><div className="notice neutral">以下为模型研究文字，金额与判断尚需逐项核实。请先核对上方服务器情景测算及现金预测；这些文字不执行记账或交易。</div>{result.proposal.modelSummary&&<><h3>模型原始摘要 · 待核实</h3><RichText text={result.proposal.modelSummary}/></>}<RichText text={answer}/></details>:<RichText text={answer}/>:<p className="help-text">提出问题后，分析会在这里逐步展开。</p>}
    {result?.proposal.missing?.length? <div className="notice neutral"><strong>尚需核实</strong><ul>{result.proposal.missing.map((item,index)=><li key={index}>{item}</li>)}</ul></div>:null}
    {result&&<details key={result.id+':sources'} className="assistant-details"><summary>查看研究来源</summary><p className="help-text">研究时间：{result.proposal.createdAt??'未记录'}；以下为研究时取得的引用，正文结论仍需核实。</p>{result.proposal.sources?.length?<ul>{result.proposal.sources.map((source,index)=><li key={index}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small> · 查询时间 {source.checkedAt??'未提供'}</small></li>)}</ul>:<p className="notice neutral">未取得可核验引用，分析中的报价与市场判断仍需核实。</p>}</details>}
   </section></div>
   <AdvisorHistory records={history.map((record:any)=>({...record,payload:{...record.payload,inputs:{question:record.payload.question??record.payload.title}}}))} disabled={busy} onSelect={record=>{setResult({id:record.id,proposal:record.payload});setAnswer(typeof record.payload.content==='string'?record.payload.content:'');setQuestion(record.payload.question??record.payload.title??'');setStages([]);setError('')}}/>
  </>}
 </>;
}

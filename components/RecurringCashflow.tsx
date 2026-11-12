"use client";

import {useState,type FormEvent,type ReactNode} from 'react';
import {Plus,History,RefreshCw,ArrowDownLeft,ArrowUpRight,CalendarClock,ListChecks} from 'lucide-react';
import AccessibleDialog from './AccessibleDialog';
import {MemberAccountFields,accountDisplay} from './MemberControls';
import {decimal} from '../src/domain/finance.mjs';
import {recurringSetupSuggestions,recurringConfiguredPlan} from '../src/domain/recurring.mjs';
import {recurringCandidateBody} from '../src/domain/finance-ui.mjs';
import './RecurringCashflow.css';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
const typeNames:Record<string,string>={income:'收入',expense:'固定支出',loan:'贷款还款',investment:'资产定投'};
const money=(amount:number)=>'¥ '+decimal(amount);

export default function RecurringCashflow({state,onSave}:{state:any;onSave:(action:string,body:any)=>Promise<any>}){
 const [panel,setPanel]=useState<'rules'|'due'>('rules');
 const [edit,setEdit]=useState<any>(null),[actual,setActual]=useState<any>(null);
 const [historyOpen,setHistoryOpen]=useState(false),[history,setHistory]=useState<any>(null);
 const [historyError,setHistoryError]=useState(''),[historyBusy,setHistoryBusy]=useState(false);
 const [busy,setBusy]=useState(false),[saveError,setSaveError]=useState('');
 const canWrite=state.viewer?.canWrite!==false;
 const rules=state.documents.filter((document:any)=>document.kind==='recurring_rule');
 const due=state.documents.filter((document:any)=>document.kind==='recurring_occurrence'&&document.payload.status==='DUE');
 const suggestions=recurringSetupSuggestions(state,today());
 const {enabled,income,outflow}=recurringConfiguredPlan(rules,today());
 const accountName=(id:string)=>{const account=state.accounts.find((item:any)=>item.id===id);return account?accountDisplay(state,account):'现金账户待确认'};
 async function save(action:string,body:any){
  if(!canWrite||busy)return;
  setBusy(true);setSaveError('');
  try{return await onSave(action,body)}catch(error){setSaveError(error instanceof Error?error.message:'保存失败，请保留内容后重试');return undefined}finally{setBusy(false)}
 }
 async function loadCandidates(){
  setHistoryBusy(true);setHistoryError('');
  try{const response=await fetch('/api/recurring',{method:'GET',cache:'no-store'}),data:any=await response.json();if(!response.ok)throw Error(data.error??'历史归并读取失败');setHistory(data)}catch(error){setHistoryError(error instanceof Error?error.message:'历史读取失败')}finally{setHistoryBusy(false)}
 }
 function openRule(rule:any={payload:{type:'income'}}){setSaveError('');setEdit(rule)}
 return <div className="recurring-workspace">
  <div className="page-title"><div><div className="eyebrow">RECURRING CASH FLOW</div><h1>周期收支</h1><p className="subtitle">管理每月收支计划，到期核实实际到账后记账。</p></div><button type="button" className="btn primary" disabled={!canWrite||busy} onClick={()=>openRule()}><Plus/>新增规则</button></div>
  <div className="recurring-metrics" aria-label="周期规则计划概览">
   <Metric label="规则月收入合计" value={money(income)} note="已启用规则，含首期未到 · CNY" icon={<ArrowDownLeft/>}/>
   <Metric label="规则月流出合计" value={money(outflow)} note="含固定支出、贷款与定投 · CNY" icon={<ArrowUpRight/>}/>
   <Metric label="已启用规则" value={String(enabled.length)} note={`${rules.length-enabled.length} 项已结束或暂停`} icon={<ListChecks/>}/>
   <Metric label="到期待核实" value={String(due.length)} note="核实实际发生后进入流水" icon={<CalendarClock/>}/>
  </div>
  <p className="recurring-plan-note">汇总未暂停、未结束规则的每月金额，包含首期尚未到的安排。这是规则合计，不是指定月份预测；实际按各自开始日期执行，不补记历史。</p>
  <section className="card recurring-list-card" aria-label="周期规则与待核实记录">
   <div className="recurring-toolbar"><div className="recurring-switch" aria-label="查看周期收支"><button type="button" aria-pressed={panel==='rules'} onClick={()=>setPanel('rules')}>规则列表 <span>{rules.length}</span></button><button type="button" aria-pressed={panel==='due'} onClick={()=>setPanel('due')}>待核实 <span>{due.length}</span></button></div><div className="recurring-toolbar-actions"><button type="button" className="btn" onClick={()=>{setHistoryOpen(true);void loadCandidates()}}><History/>历史候选</button><button type="button" className="btn" disabled={!canWrite||busy} onClick={()=>save('recurring.run',{through:today()})}><RefreshCw/>{busy?'正在检查…':'检查到期'}</button></div></div>
   {saveError&&!edit&&!actual&&<p className="notice" role="alert">{saveError}</p>}
   {panel==='rules'?<>
    <div className="table-wrap"><table className="recurring-table"><thead><tr><th>规则名称 / 类型</th><th>收付款账户</th><th>金额 / 日期</th><th>记账方式</th><th>操作</th></tr></thead><tbody>{rules.map((rule:any)=><tr key={rule.id}><td><strong>{rule.payload.name}</strong><small>{typeNames[rule.payload.type]??rule.payload.type}</small></td><td>{accountName(rule.payload.accountId)}</td><td><strong className="money">{money(rule.payload.amount)}</strong><small>每月 {rule.payload.day} 日</small></td><td><span className={'recurring-status'+(rule.payload.paused?' paused':'')}>{rule.payload.paused?'已暂停':rule.payload.start>today()?'首期未到 · '+rule.payload.start:rule.payload.end&&rule.payload.end<today()?'已结束 · '+rule.payload.end:rule.payload.autoPost&&rule.payload.confirmedAt&&!['loan','investment'].includes(rule.payload.type)?'本站自动记账':'待核实后记账'}</span></td><td><button type="button" className="btn" disabled={!canWrite||busy} onClick={()=>openRule(rule)}>调整</button></td></tr>)}</tbody></table></div>
    {!rules.length&&<div className="recurring-empty"><ListChecks/><h3>还没有周期规则</h3><p>新增每月固定安排，或从历史候选中核对导入。</p><button type="button" className="btn" disabled={!canWrite} onClick={()=>openRule()}>新增第一条规则</button></div>}
    {suggestions.length>0&&<details className="recurring-suggestions"><summary>贷款资料待设置 <span>{suggestions.length} 项</span></summary><p className="help-text">已带入已登记的月供与扣款日。请补充现金账户和生效日期；不追补历史，每期实际本金仍需核实。</p>{suggestions.map((suggestion:any)=><div className="recurring-suggestion-row" key={suggestion.id}><div><strong>{suggestion.payload.name}</strong><small>{suggestion.payload.day?`每月 ${suggestion.payload.day} 日`:'扣款日待核对'} · {suggestion.missing.join('、')}</small></div><span className="money">{suggestion.payload.amount==null?'月供待核对':money(suggestion.payload.amount)}</span><button type="button" className="btn" disabled={!canWrite||busy} onClick={()=>openRule({...suggestion,suggestion:true})}>核对并设置</button></div>)}</details>}
   </>:<>
    <div className="table-wrap"><table className="recurring-table"><thead><tr><th>待核实记录</th><th>收付款账户</th><th>计划金额 / 日期</th><th>操作</th></tr></thead><tbody>{due.map((occurrence:any)=><tr key={occurrence.id}><td><strong>{occurrence.payload.name}</strong><small>{typeNames[occurrence.payload.type]}</small></td><td>{accountName(occurrence.payload.accountId)}</td><td><strong className="money">{money(occurrence.payload.amount)}</strong><small>{occurrence.payload.date}</small></td><td><button type="button" className="btn" disabled={!canWrite||busy} onClick={()=>{setSaveError('');setActual(occurrence)}}>核实实际到账</button></td></tr>)}</tbody></table></div>
    {!due.length&&<div className="recurring-empty"><CalendarClock/><h3>暂无待核实记录</h3><p>检查到期规则后，在这里核对银行实际发生记录。</p></div>}
   </>}
  </section>
  {edit&&<AccessibleDialog title={edit.suggestion?'核对贷款规则':edit.id?'调整固定收支规则':'新增固定收支规则'} busy={busy} wide onClose={()=>setEdit(null)}><RuleEditor key={edit.id??'new'} state={state} edit={edit} busy={busy} canWrite={canWrite} error={saveError} onCancel={()=>setEdit(null)} onSubmit={async body=>{const result=await save('recurring.save',body);if(result)setEdit(null)}}/></AccessibleDialog>}
  {actual&&<AccessibleDialog title="核实到期记录" busy={busy} wide onClose={()=>setActual(null)}><ActualEditor state={state} actual={actual} busy={busy} canWrite={canWrite} error={saveError} onCancel={()=>setActual(null)} onSubmit={async body=>{const result=await save('recurring.confirm',body);if(result)setActual(null)}}/></AccessibleDialog>}
  {historyOpen&&<AccessibleDialog title="从完整流水归并周期候选" busy={busy} wide onClose={()=>setHistoryOpen(false)}><div className="recurring-history" aria-label="完整历史周期候选"><div className="recurring-history-heading"><p className="help-text">按成员、账户和收支类型归并完整历史。核对多月证据后逐项导入，默认每期待核实。</p><button type="button" className="btn" disabled={historyBusy||busy} onClick={()=>loadCandidates()}>{historyBusy?'正在核对历史…':'刷新历史归并候选'}</button></div>{historyError&&<p className="notice" role="alert">{historyError}</p>}{historyBusy&&!history&&<p className="help-text" role="status">正在读取完整历史…</p>}{history?.message&&<p className="help-text">{history.message}</p>}{history?.complete===true&&history.candidates?.length===0&&<div className="recurring-empty"><History/><h3>本次无可导入候选</h3><p>没有足够的多月重复证据，或相应规则已经存在。</p></div>}{history?.candidates?.map((candidate:any)=><article className="recurring-history-candidate" key={candidate.id}><div className="recurring-candidate-heading"><div><h3>{candidate.name}</h3><p className="help-text">{accountName(candidate.accountId)} · {typeNames[candidate.type]} · 每月 {candidate.day} 日 · {Array.isArray(candidate.months)?candidate.months.length:candidate.months} 个月证据</p></div><strong className="money">{money(candidate.amount)}</strong></div><p className="help-text">{candidate.aiReason??'依据多月实际流水归并，请核对证据后确认。'}</p><details><summary>查看归并证据</summary><ul className="recurring-evidence">{(candidate.evidence??[]).map((evidence:any)=><li key={evidence.transactionId}>{evidence.date} · {money(evidence.amountMinor)} · {evidence.note||'实际流水'}<small>流水编号：{evidence.transactionId}</small></li>)}</ul></details><form onSubmit={async event=>{event.preventDefault();const result=await save('recurring.save',recurringCandidateBody(candidate));if(result)await loadCandidates()}}><fieldset className="contextual-fields recurring-dialog-actions" disabled={!canWrite||busy||historyBusy}><label className="recurring-check"><input type="checkbox" required/>我已核对上述多月流水、金额、日期和收付款账户，确认保存为每期待核实规则</label><button className="btn primary">确认导入此规则</button></fieldset></form></article>)}{saveError&&<p className="notice" role="alert">{saveError}</p>}</div></AccessibleDialog>}
 </div>;
}

function Metric({label,value,note,icon}:{label:string;value:string;note:string;icon:ReactNode}){return <div className="card recurring-metric"><div>{label}{icon}</div><strong className="money">{value}</strong><small>{note}</small></div>}

function RuleEditor({state,edit,busy,canWrite,error,onCancel,onSubmit}:{state:any;edit:any;busy:boolean;canWrite:boolean;error:string;onCancel:()=>void;onSubmit:(body:any)=>Promise<void>}){
 const [type,setType]=useState(edit.payload.type??'income');
 const [auto,setAuto]=useState(Boolean(edit.payload.autoPost));
 const needsActual=type==='loan'||type==='investment';
 return <form className="recurring-rule-form recurring-dialog-form" onSubmit={async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const body:any=Object.fromEntries(new FormData(event.currentTarget));await onSubmit({...body,id:edit.id&&!edit.suggestion?edit.id:undefined,day:Number(body.day),autoPost:!needsActual&&auto,confirmed:true,paused:body.paused==='on'})}}>
  <fieldset className="contextual-fields" disabled={!canWrite||busy}>
   <section className="recurring-form-section"><h3>规则内容</h3><div className="form-grid"><Input name="name" label="规则名称" value={edit.payload.name}/><label className="field">类型<select aria-label="类型" name="type" value={type} onChange={event=>{setType(event.target.value);setAuto(false)}}><option value="income">工资 / 公积金提取等收入</option><option value="expense">日常固定支出</option><option value="loan">贷款还款</option><option value="investment">已登记人民币资产定投</option></select></label><Input name="amount" label="每期金额 CNY" value={edit.payload.amount!=null?decimal(edit.payload.amount):''}/><Input name="day" label="每月日期（1–31，短月取月末）" type="number" min="1" max="31" value={edit.payload.day??''}/><Input name="start" label="生效日期（历史日期需核对余额快照）" type="date" value={edit.payload.start??today()}/><Input name="end" label="结束日期（可空）" type="date" value={edit.payload.end??''} required={false}/></div></section>
   <section className="recurring-form-section"><h3>成员与账户</h3><div className="form-grid"><MemberAccountFields state={state} defaultAccountId={edit.payload.accountId} defaultMemberId={edit.payload.cashMemberId??''}/>{type==='loan'&&<Account state={state} name="loanId" label="贷款账户" liability defaultValue={edit.payload.loanId}/>} {type==='investment'&&<Account state={state} name="assetId" label="已登记定投资产" defaultValue={edit.payload.assetId}/>}</div></section>
   <section className="recurring-form-section"><h3>执行设置</h3><div className="recurring-settings"><div>{needsActual?<p className="recurring-safety">{type==='loan'?'每期先生成待核实记录。按银行实际本金分拆还款，本金减少贷款余额，其余计为利息。':'每期金额与成交份额须核实；本站不推算份额，规则不支持自动记账。'}</p>:<label className="recurring-check"><input type="checkbox" checked={auto} onChange={event=>setAuto(event.target.checked)}/><span><strong>到期自动更新本站账本</strong><small>我明确授权，并会核对实际到账；这不代表银行交易已发生。</small></span></label>}</div><label className="recurring-check recurring-pause"><input type="checkbox" name="paused" defaultChecked={edit.payload.paused}/><span><strong>暂停此规则</strong><small>暂停期间不生成新的到期记录。</small></span></label></div></section>
   {error&&<p className="notice" role="alert">{error}</p>}
   <div className="recurring-confirmation"><label className="recurring-check"><input type="checkbox" required/>我已确认金额、日期和账户，未从单笔流水猜测固定收入</label></div><div className="recurring-dialog-actions"><button type="button" className="btn" onClick={onCancel}>取消</button><button className="btn primary">{busy?'正在保存…':'保存确认的规则'}</button></div>
  </fieldset>
 </form>;
}

function ActualEditor({state,actual,busy,canWrite,error,onCancel,onSubmit}:{state:any;actual:any;busy:boolean;canWrite:boolean;error:string;onCancel:()=>void;onSubmit:(body:any)=>Promise<void>}){
 return <form className="recurring-dialog-form" onSubmit={async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();await onSubmit({...Object.fromEntries(new FormData(event.currentTarget)),id:actual.id,confirmed:true})}}><fieldset className="contextual-fields" disabled={!canWrite||busy}><div className="recurring-actual-summary"><div><strong>{actual.payload.name}</strong><small>计划日期 {actual.payload.date} · {typeNames[actual.payload.type]}</small></div><strong className="money">计划 {money(actual.payload.amount)}</strong></div><section className="recurring-form-section"><h3>实际发生信息</h3><div className="form-grid"><MemberAccountFields state={state} defaultAccountId={actual.payload.accountId} defaultMemberId={actual.payload.cashMemberId??''}/><Input name="date" label="银行实际发生日期" type="date" max={today()} value={actual.payload.date}/><Input name="amount" label="本期实际金额 CNY" value={decimal(actual.payload.amount)}/>{actual.payload.type==='loan'&&<Input name="principal" label="银行本期实际本金 CNY（其余计为利息）"/>}</div></section>{actual.payload.type==='investment'&&<p className="recurring-safety">请核对实际成交金额与份额。本次记录现金与资产金额，不推算或改写成交份额。</p>}{error&&<p className="notice" role="alert">{error}</p>}<div className="recurring-confirmation"><label className="recurring-check"><input type="checkbox" required/>已核对银行实际发生记录，且未包含在当前余额快照中</label></div><div className="recurring-dialog-actions"><button type="button" className="btn" onClick={onCancel}>取消</button><button className="btn primary">{busy?'正在保存…':'确认已实际发生'}</button></div></fieldset></form>;
}

function Input({name,label,value='',required=true,type='text',min,max}:any){return <label className="field">{label}<input name={name} defaultValue={value} required={required} type={type} min={min} max={max}/></label>}
function Account({state,name,label,liability,defaultValue=''}:any){return <label className="field">{label}<select aria-label={label} name={name} defaultValue={defaultValue??''} required><option value="">请选择</option>{state.accounts.filter((account:any)=>!account.archived&&account.currency==='CNY'&&(liability?account.kind==='LIABILITY':account.kind==='ASSET'&&['fund','stock'].includes(account.category))).map((account:any)=><option key={account.id} value={account.id}>{accountDisplay(state,account)}</option>)}</select></label>}

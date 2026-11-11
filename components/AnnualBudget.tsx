"use client";
import {useState} from 'react';
import {annualBudgetOverview} from '../src/domain/annual-budget.mjs';
import './AnnualBudget.css';

type Props={state:any;onOpenPlan:(id:string)=>void};
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const formattedAmount=(value:unknown)=>{
 if(typeof value!=='number'||!Number.isSafeInteger(value))return '待核实';
 const cents=BigInt(value),absolute=cents<0n?-cents:cents;
 return (cents<0n?'-':'')+'¥'+(absolute/100n).toLocaleString('zh-CN')+'.'+String(absolute%100n).padStart(2,'0');
};

const amount=(value:unknown)=><span className="money">{formattedAmount(value)}</span>;

export default function AnnualBudget({state,onOpenPlan}:Props){
 const [year,setYear]=useState(()=>Number(localToday().slice(0,4)));
 let model:ReturnType<typeof annualBudgetOverview>|null=null,error='';
 try{model=annualBudgetOverview(state,year,localToday());}catch(cause){error=cause instanceof Error?cause.message:'年度预算资料需核对';}
 const years=[...new Set([...(model?.years??[]),year-1,year,year+1])].filter(value=>value>=1&&value<=9998).sort((a,b)=>a-b);
 return <section className="card section-space annual-budget" aria-label="年度预算与预留">
  <div className="annual-budget-heading"><div><h2>年度预算与预留</h2><p className="help-text">已知预算与实际付款、消费分别核对。</p></div><label className="field">查看年度<select aria-label="年度预算年份" value={year} onChange={event=>setYear(Number(event.target.value))}>{years.map(value=><option key={value} value={value}>{value}年</option>)}</select></label></div>
  {error||!model?<p className="notice" role="alert">{error||'年度预算资料需核对'}</p>:<>
   <div className="annual-budget-metrics">{[
    ['已知正式预算',model.summary.approvedBudgetMinor],['候选预算参考',model.summary.candidateBudgetMinor],['本年净付款',model.summary.paidMinor],['本年已确认消费',model.summary.consumedMinor],['已知尚需准备',model.summary.remainingNeededMinor],['有效预留标签',model.summary.reservedMinor],['建议追加预留',model.summary.suggestedReserveMinor]
   ].map(([label,value])=><div className="card metric" key={String(label)}><small>{String(label)}</small><div className="metric-value">{amount(value)}</div></div>)}</div>
   <p className="help-text">正式预算不包含候选方案，也不重复累加一个计划下的替代选项。跨日、跨月计划的完整预算只归开始月份一次；取消计划不占待执行预算，已完成计划的原预算与历史实际仍保留。金额均为CNY。</p>
   <p className="help-text">尚需准备＝未结正式预算减去全期净付款，最低为零；有效预留不超过尚需金额。建议追加预留＝已知尚需准备减有效预留，仅为规划参考，不代表现金已充足，不新增资产、不扣款。未审批的候选不计正式准备或有效预留。</p>
   {(model.summary.unknownBudgetCount>0||model.summary.unknownRemainingCount>0)&&<p className="notice neutral">开始于本年的计划有{model.summary.unknownBudgetCount}项预算待核实；未结正式计划有{model.summary.unknownRemainingCount}项尚需金额待完整资料核对。上方金额仅合计已知部分，未知预算没有按零填充。</p>}
   {!model.monthlyActualAvailable&&<p className="notice neutral" role="status">{model.actualNotice}。全期净付款仍可用于尚需金额；不使用最近流水列表猜测年度实际。</p>}
   <p className="help-text">净付款包含预付款和直接消费付款，抵减实际到账退款；预付款转消费不再重复算付款。已确认消费与净付款分列，退款保留实际发生月份，可出现负数。历史实际仅指本站已入账记录，不代表完整银行对账单。</p>
   <h3>月度预算与实际对比</h3>
   <div className="annual-budget-table"><table aria-label="年度预算月度对比"><thead><tr><th>归属月份</th><th>已知正式预算</th><th>候选预算</th><th>预算待核实</th><th>实际净付款</th><th>已确认消费</th></tr></thead><tbody>{model.months.map(row=><tr key={row.month}><td>{row.month}</td><td>{amount(row.approvedBudgetMinor)}</td><td>{amount(row.candidateBudgetMinor)}</td><td>{row.unknownBudgetCount}项</td><td>{amount(row.paidMinor)}</td><td>{amount(row.consumedMinor)}</td></tr>)}</tbody></table></div>
   <h3>类别预算与实际对比</h3>
   {model.categories.length===0?<p className="help-text">本年暂无可归属的计划预算或实际记录。</p>:<div className="annual-budget-table"><table aria-label="年度预算类别对比"><thead><tr><th>类别</th><th>已知正式预算</th><th>候选预算</th><th>预算待核实</th><th>实际净付款</th><th>已确认消费</th></tr></thead><tbody>{model.categories.map((row:any)=><tr key={row.category}><td>{row.category}</td><td>{amount(row.approvedBudgetMinor)}</td><td>{amount(row.candidateBudgetMinor)}</td><td>{row.unknownBudgetCount}项</td><td>{amount(row.paidMinor)}</td><td>{amount(row.consumedMinor)}</td></tr>)}</tbody></table></div>}
   <h3>最近三项未结计划</h3>
   {model.upcoming.length===0?<p className="help-text">本年暂无未结计划；完成和取消的历史实际已保留在上方对比中。</p>:<div className="annual-budget-plans">{model.upcoming.slice(0,3).map((plan:any)=><article className="card" key={plan.id}><div className="card-title"><strong>{plan.name}</strong><span className="badge">{plan.approved?'正式预算':'候选参考'}</span></div><p className="help-text">{plan.date} — {plan.end}{plan.end<localToday()?' · 日期已过，状态尚未结清':''}</p><p>预算 {amount(plan.budgetMinor)}<br/>{plan.approved?'尚需准备 '+amount(plan.remainingNeededMinor):'候选尚需参考 '+amount(plan.candidateRemainingMinor)}<br/>有效预留 {amount(plan.reservedMinor)}</p><button type="button" className="btn soft" onClick={()=>onOpenPlan(plan.id)}>查看{plan.name}</button></article>)}</div>}
   <details className="section-space"><summary>查看本年度关联计划及历史实际（{model.plans.length}项）</summary><div className="annual-budget-table"><table aria-label="年度关联计划"><thead><tr><th>计划</th><th>状态</th><th>预算</th><th>全期净付款</th><th>本年净付款</th><th>本年消费</th><th>尚需准备</th><th>有效预留</th></tr></thead><tbody>{model.plans.map((plan:any)=><tr key={plan.id}><td><button type="button" className="text-button" onClick={()=>onOpenPlan(plan.id)}>{plan.name}</button><small>{plan.date??'开始日期待核实'} · {plan.category}</small></td><td>{plan.closed?(plan.cancelled?'已取消':'已完成'):plan.approved?'正式未结':'候选参考'}</td><td>{amount(plan.budgetMinor)}</td><td>{amount(plan.lifetimePaidMinor)}</td><td>{amount(plan.yearPaidMinor)}</td><td>{amount(plan.yearConsumedMinor)}</td><td>{plan.approved?amount(plan.remainingNeededMinor):'候选不占用'}</td><td>{amount(plan.reservedMinor)}</td></tr>)}</tbody></table></div></details>
   {model.unassignedPlans.length>0&&<div className="notice neutral"><strong>{model.unassignedPlans.length}项计划的开始日期待核实</strong><p>未把预算任意分配到年度；已知实际仍按发生月份归集。</p><div className="actions">{model.unassignedPlans.map((plan:any)=><button type="button" className="btn soft" key={plan.id} onClick={()=>onOpenPlan(plan.id)}>核对{plan.name}</button>)}</div></div>}
  </>}
 </section>;
}

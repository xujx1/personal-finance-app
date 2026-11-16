"use client";
import {useState} from 'react';
import {annualBudgetOverview} from '../src/domain/annual-budget.mjs';
import './AnnualBudget.css';
import {useI18n,UiMessage} from './I18n';


type Props={state:any;onOpenPlan:(id:string)=>void};
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function BudgetAmount({value}:{value:unknown}){const {displayMoney:money,t}=useI18n();return <span className="money">{typeof value==='number'&&Number.isSafeInteger(value)?money(value):t('待核实')}</span>;}
const amount=(value:unknown)=><BudgetAmount value={value}/>;

export default function AnnualBudget({state,onOpenPlan}:Props){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember,category:uiCategory}=useI18n();

 const [year,setYear]=useState(()=>Number(localToday().slice(0,4)));
 let model:ReturnType<typeof annualBudgetOverview>|null=null,error='';
 try{model=annualBudgetOverview(state,year,localToday());}catch(cause){error=cause instanceof Error?cause.message:'年度预算资料需核对';}
 const visiblePlans=model?.plans.filter((plan:any)=>!plan.closed)??[],unassignedPlans=model?.unassignedPlans.filter((plan:any)=>!plan.closed)??[];
 const years=[...new Set([...(model?.years??[]),year-1,year,year+1])].filter(value=>value>=1&&value<=9998).sort((a,b)=>a-b);
 return <section className="card section-space annual-budget" aria-label={tr("年度预算与预留")}>
  <div className="annual-budget-heading"><div><h2>{tr("年度预算与预留")}</h2><p className="help-text">{tr("已知预算与实际付款、消费分别核对。")}</p></div><label className="field">{tr("查看年度")}<select aria-label={tr("年度预算年份")} value={year} onChange={event=>setYear(Number(event.target.value))}>{years.map(value=><option key={value} value={value}>{value}{tr("年")}</option>)}</select></label></div>
  {error||!model?<p className="notice" role="alert">{uiMessage(error)||tr("年度预算资料需核对")}</p>:<>
   <div className="annual-budget-metrics">{[
    ['已知正式预算',model.summary.approvedBudgetMinor],['候选预算参考',model.summary.candidateBudgetMinor],['本年净付款',model.summary.paidMinor],['本年已确认消费',model.summary.consumedMinor],['已知尚需准备',model.summary.remainingNeededMinor],['有效预留标签',model.summary.reservedMinor],['建议追加预留',model.summary.suggestedReserveMinor]
   ].map(([label,value])=><div className="card metric" key={String(label)}><small>{tr(String(label))}</small><div className="metric-value">{amount(value)}</div></div>)}</div>
   <p className="help-text">{tr("正式预算不包含候选方案，也不重复累加一个计划下的替代选项。跨日、跨月计划的完整预算只归开始月份一次；取消计划不占待执行预算，已完成计划的原预算与历史实际仍保留。原始金额为CNY，展示按所选币种折算。")}</p>
   <p className="help-text">{tr("尚需准备＝未结正式预算减去全期净付款，最低为零；有效预留不超过尚需金额。建议追加预留＝已知尚需准备减有效预留，仅为规划参考，不代表现金已充足，不新增资产、不扣款。未审批的候选不计正式准备或有效预留。")}</p>
   {(model.summary.unknownBudgetCount>0||model.summary.unknownRemainingCount>0)&&<p className="notice neutral">{tr("开始于本年的计划有")}{model.summary.unknownBudgetCount}{tr("项预算待核实；未结正式计划有")}{model.summary.unknownRemainingCount}{tr("项尚需金额待完整资料核对。上方金额仅合计已知部分，未知预算没有按零填充。")}</p>}
   {!model.monthlyActualAvailable&&<p className="notice neutral" role="status">{uiMessage(model.actualNotice)}{tr("。全期净付款仍可用于尚需金额；不使用最近流水列表猜测年度实际。")}</p>}
   <p className="help-text">{tr("净付款包含预付款和直接消费付款，抵减实际到账退款；预付款转消费不再重复算付款。已确认消费与净付款分列，退款保留实际发生月份，可出现负数。历史实际仅指本站已入账记录，不代表完整银行对账单。")}</p>
   <h3>{tr("月度预算与实际对比")}</h3>
   <div className="annual-budget-table"><table aria-label={tr("年度预算月度对比")}><thead><tr><th>{tr("归属月份")}</th><th>{tr("已知正式预算")}</th><th>{tr("候选预算")}</th><th>{tr("预算待核实")}</th><th>{tr("实际净付款")}</th><th>{tr("已确认消费")}</th></tr></thead><tbody>{model.months.map(row=><tr key={row.month}><td>{row.month}</td><td>{amount(row.approvedBudgetMinor)}</td><td>{amount(row.candidateBudgetMinor)}</td><td>{row.unknownBudgetCount}{tr("项")}</td><td>{amount(row.paidMinor)}</td><td>{amount(row.consumedMinor)}</td></tr>)}</tbody></table></div>
   <h3>{tr("类别预算与实际对比")}</h3>
   {model.categories.length===0?<p className="help-text">{tr("本年暂无可归属的计划预算或实际记录。")}</p>:<div className="annual-budget-table"><table aria-label={tr("年度预算类别对比")}><thead><tr><th>{tr("类别")}</th><th>{tr("已知正式预算")}</th><th>{tr("候选预算")}</th><th>{tr("预算待核实")}</th><th>{tr("实际净付款")}</th><th>{tr("已确认消费")}</th></tr></thead><tbody>{model.categories.map((row:any)=><tr key={uiCategory(row.category)}><td>{uiCategory(row.category)}</td><td>{amount(row.approvedBudgetMinor)}</td><td>{amount(row.candidateBudgetMinor)}</td><td>{row.unknownBudgetCount}{tr("项")}</td><td>{amount(row.paidMinor)}</td><td>{amount(row.consumedMinor)}</td></tr>)}</tbody></table></div>}
   <h3>{tr("最近三项未结计划")}</h3>
   {model.upcoming.length===0?<p className="help-text">{tr("本年暂无未结计划；完成和取消的历史实际已保留在上方对比中。")}</p>:<div className="annual-budget-plans">{model.upcoming.slice(0,3).map((plan:any)=><article className="card" key={plan.id}><div className="card-title"><strong>{plan.name}</strong><span className="badge">{plan.approved?tr("正式预算"):tr("候选参考")}</span></div><p className="help-text">{plan.date} — {plan.end}{plan.end<localToday()?tr(" · 日期已过，状态尚未结清"):''}</p><p>{tr("预算")}{" "}{amount(plan.budgetMinor)}<br/>{plan.approved?<UiMessage text="尚需准备 {p0}" values={{p0:amount(plan.remainingNeededMinor)}}/>:<UiMessage text="候选尚需参考 {p0}" values={{p0:amount(plan.candidateRemainingMinor)}}/>}<br/>{tr("有效预留")}{" "}{amount(plan.reservedMinor)}</p><button type="button" className="btn soft" onClick={()=>onOpenPlan(plan.id)}>{tr("查看")}{plan.name}</button></article>)}</div>}
   <details className="section-space"><summary>{tr("查看本年度关联计划（")}{visiblePlans.length}{tr("项）")}</summary><div className="annual-budget-table"><table aria-label={tr("年度关联计划")}><thead><tr><th>{tr("计划")}</th><th>{tr("状态")}</th><th>{tr("预算")}</th><th>{tr("全期净付款")}</th><th>{tr("本年净付款")}</th><th>{tr("本年消费")}</th><th>{tr("尚需准备")}</th><th>{tr("有效预留")}</th></tr></thead><tbody>{visiblePlans.map((plan:any)=><tr key={plan.id}><td><button type="button" className="text-button" onClick={()=>onOpenPlan(plan.id)}>{plan.name}</button><small>{plan.date??tr("开始日期待核实")} · {uiCategory(plan.category)}</small></td><td>{plan.closed?(plan.cancelled?tr("已取消"):tr("已完成")):plan.approved?tr("正式未结"):tr("候选参考")}</td><td>{amount(plan.budgetMinor)}</td><td>{amount(plan.lifetimePaidMinor)}</td><td>{amount(plan.yearPaidMinor)}</td><td>{amount(plan.yearConsumedMinor)}</td><td>{plan.approved?amount(plan.remainingNeededMinor):tr("候选不占用")}</td><td>{amount(plan.reservedMinor)}</td></tr>)}</tbody></table></div></details>
   {unassignedPlans.length>0&&<div className="notice neutral"><strong>{unassignedPlans.length}{tr("项计划的开始日期待核实")}</strong><p>{tr("未把预算任意分配到年度；已知实际仍按发生月份归集。")}</p><div className="actions">{unassignedPlans.map((plan:any)=><button type="button" className="btn soft" key={plan.id} onClick={()=>onOpenPlan(plan.id)}>{tr("核对")}{plan.name}</button>)}</div></div>}
  </>}
 </section>;
}

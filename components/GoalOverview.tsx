"use client";
import type {CSSProperties} from 'react';
import {buildAssetGoalOverview} from '../src/domain/asset-goals.mjs';
import {buildBudgetFundingGoals} from '../src/domain/budget-funding.mjs';
import './AssetGoals.css';

export const goalMoney=(value:number|null)=>value===null?'待核对':'¥ '+new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);
function ProgressRing({progress,label,detail}:{progress:number|null,label:string,detail:string}){
 const style={'--goal-progress':(progress??0)+'%'} as CSSProperties;
 return <div className={'goal-ring '+(progress===null?'goal-ring-unknown':'')} style={style} role="img" aria-label={label+'：'+(progress===null?'完成率待确认':progress.toFixed(1)+'%')}><div><strong className="money">{progress===null?'待确认':progress.toFixed(1)+'%'}</strong><small>{detail}</small></div></div>;
}

export default function GoalOverview({state,valueCNY,onGoPlans,onSetup}:{state:any,valueCNY:(account:any)=>number|null,onGoPlans?:()=>void;onSetup?:()=>void}){
 const model=buildAssetGoalOverview(state,valueCNY),{goal,monthly}=model;
 const funding=buildBudgetFundingGoals(state);
 return <section className="goal-overview section-space" aria-label="资产目标总览">
  <div className="goal-overview-heading"><div><h2>向资产目标，再进一步</h2><p className="help-text">不含房产 · {goal.isDefault?'目标由你确认':goal.schemaVersion===3?'按所选类型积累':'四类长期积累'}{goal.deadline?' · 目标日期 '+goal.deadline:''}</p></div><span className="badge gray">{goal.isDefault?'待设置':'已保存目标'}</span></div>
  {goal.isDefault?<article className="card"><h3>先定一个适合家庭的目标</h3><p className="help-text">还没有保存目标。可以先确定总额和每月希望新增的积累，类别分配以后再细化。</p>{onSetup&&<button className="btn section-space" onClick={onSetup}>整理家庭目标 →</button>}</article>:<><div className="goal-summary-grid">
   <article className="card goal-summary"><ProgressRing progress={model.progress} label="总资产目标进度" detail="总目标完成"/><div className="goal-summary-copy"><p>非房产资产目标</p><h3 className="money">{goalMoney(goal.totalTarget)}</h3><dl><div><dt>{model.complete?'当前资产':'已确认资产'}</dt><dd className="money">{goalMoney(model.current)}</dd></div><div><dt>距离目标</dt><dd className="money">{goalMoney(model.gap)}</dd></div></dl>{!model.complete&&<p className="goal-explanation">部分资产缺少估值或汇率，合计与差额待核对。</p>}</div></article>
   <article className="card goal-summary"><ProgressRing progress={monthly.progress} label="月度目标进度" detail={monthly.month+' 月目标'}/><div className="goal-summary-copy"><p>本月账面积累目标</p><h3 className="money">{goal.monthlyTarget===null?'尚未设置':goalMoney(goal.monthlyTarget)}</h3><dl><div><dt>已记录积累</dt><dd className="money">{monthly.available?goalMoney(monthly.change):'期初待核对'}</dd></div></dl>{monthly.reason&&<p className="goal-explanation">{monthly.reason}</p>}{goal.monthlyTarget===null&&<p className="goal-explanation">可在设置中填写月目标。</p>}</div></article>
  </div>
  <div className="goal-bucket-grid">{model.buckets.map((bucket:any)=><article className="goal-bucket" key={bucket.id}><div className="goal-bucket-title"><span style={{background:bucket.color}}/>{bucket.label}</div><div className="goal-bucket-values"><strong className="money">{goalMoney(bucket.current)}</strong><small className="money">目标 {goalMoney(bucket.target)}</small></div><div className="goal-bucket-track" aria-hidden="true"><i style={{width:(bucket.progress??0)+'%',background:bucket.color}}/></div><small>{bucket.complete?(bucket.current>=bucket.target?'已达成此类目标':<span>还需 <span className="money">{goalMoney(bucket.gap)}</span></span>):'部分估值待核对'}</small></article>)}</div>
  </>}
  {funding.gap>0&&<section className="card budget-funding-goals" aria-label="预算备款目标"><div className="card-title"><div><h3>为下一笔计划，备好现金</h3><p className="help-text">计划尚需 <span className="money">{goalMoney(funding.totalRemaining)}</span> · 人民币银行现金 <span className="money">{goalMoney(funding.cash)}</span></p></div>{onGoPlans&&<button className="text-button" onClick={onGoPlans}>查看预算与大型支出 →</button>}</div><p className="budget-funding-total">还需积累 <strong className="money">{goalMoney(funding.gap)}</strong></p><div className="budget-funding-list">{funding.plans.filter((plan:any)=>plan.gap>0).map((plan:any)=><article key={plan.id}><div><strong>{plan.name}</strong><small>{plan.date}{plan.pending?' · 待家庭确认':''}</small></div><div><span className="money">尚需备款 {goalMoney(plan.gap)}</span><small>计划未付款 <span className="money">{goalMoney(plan.remaining)}</span> · 已分配现金 <span className="money">{goalMoney(plan.funded)}</span></small></div></article>)}</div><p className="help-text">按计划日期依次分配当前银行现金；只是备款进度，不冻结或扣款。已付款及预付款已经抵减，资金预留不重复扣除。{funding.unknown>0?`另有${funding.unknown}项预算金额待确定。`:''}</p></section>}
  {model.unassignedNames.length>0&&<p className="goal-explanation">待分类资产 <span className="money">{goalMoney(model.unassignedComplete===false?null:model.unassigned)}</span> {goal.schemaVersion===3?'不计入当前所选目标，':'已计入非房产资产合计，'}尚未分入当前目标：{model.unassignedNames.join('、')}。分类确认前不会猜测基金类型。</p>}
  <details className="goal-basis"><summary>计算口径与月度数据说明</summary><p>总目标统计当前有效的非房产资产，排除预付款、系统账户、负债、归档与清仓持仓。每项资产只归入一个目标；自选目标仅累计所选范围，未选类型另列，旧版四组合沿用原统计口径。活期、定期及明确的国债归入存款类；基金按明确名称识别宽基或贵金属。</p><p>{monthly.basis}</p>{monthly.available&&monthly.opening!==null&&<p className="money">本月人民币期初 {goalMoney(monthly.opening)} → 期末 {goalMoney(monthly.closing)}；扣除开账及校正 {goalMoney(monthly.corrections)}。</p>}</details>
 </section>;
}

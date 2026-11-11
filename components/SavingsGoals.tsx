"use client";
import {useState,type FormEvent} from 'react';
import {decimal} from '../src/domain/finance.mjs';
import {ASSET_GOAL_BUCKETS,buildAssetGoalOverview,normalizeAssetGoalInput} from '../src/domain/asset-goals.mjs';
import {goalMoney} from './GoalOverview';
import './AssetGoals.css';

type Props={state:any,onSave:(action:string,body:any)=>unknown,valueCNY:(account:any)=>number|null};
function GoalEditor({goal,onSave,readOnly}:{goal:any,onSave:Props['onSave'],readOnly:boolean}){
 const [targets,setTargets]=useState<Record<string,string>>(()=>Object.fromEntries(ASSET_GOAL_BUCKETS.map(bucket=>[bucket.id,decimal(goal.bucketTargets[bucket.id])])));
 const [monthly,setMonthly]=useState(goal.monthlyTarget===null?'':decimal(goal.monthlyTarget)),[deadline,setDeadline]=useState(goal.deadline??'');
 const [error,setError]=useState(''),[saving,setSaving]=useState(false);
 let total:number|null=null;try{const parsed=normalizeAssetGoalInput({schemaVersion:2,bucketTargets:targets,monthlyTarget:monthly,deadline});total=Object.values(parsed.bucketTargets).reduce((n:any,value:any)=>n+value,0) as number;}catch{}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');
  const body={id:goal.id??undefined,name:'四类资产目标',schemaVersion:2,bucketTargets:targets,monthlyTarget:monthly||null,deadline:deadline||null};
  try{normalizeAssetGoalInput(body);setSaving(true);await onSave('savings.goal.save',body);}catch(error){setError(error instanceof Error?error.message:'目标暂未保存，请重试');}finally{setSaving(false);}
 }
 return <form onSubmit={submit} className="goal-settings-form">
  <fieldset disabled={readOnly||saving}><legend>四类资产目标（人民币）</legend><div className="goal-target-fields">{ASSET_GOAL_BUCKETS.map(bucket=><label className="field" key={bucket.id}>{bucket.label}<input aria-label={bucket.label+'目标金额'} inputMode="decimal" value={targets[bucket.id]} onChange={event=>setTargets({...targets,[bucket.id]:event.target.value})} required/><small>{bucket.hint}</small></label>)}</div>
   <div className="goal-total-setting"><span>资产总目标 · 不含房产</span><strong className="money">{goalMoney(total)}</strong></div>
   <div className="form-grid section-space"><label className="field">每月积累目标（可留空）<input aria-label="每月积累目标" placeholder="尚未设置" inputMode="decimal" value={monthly} onChange={event=>setMonthly(event.target.value)}/></label><label className="field">目标日期（可留空）<input aria-label="资产目标日期" type="date" value={deadline} onChange={event=>setDeadline(event.target.value)}/></label></div>
   <p className="goal-explanation">只维护大类金额，无需逐只基金设置目标。月目标留空时显示“尚未设置”，不会生成完成率；目标日期可按需要填写。</p>
   <div className="actions section-space"><button className="btn primary" disabled={total===null}>{saving?'正在保存…':'保存资产目标'}</button></div>
  </fieldset>{error&&<p className="notice" role="alert">{error}</p>}
 </form>;
}

export default function SavingsGoals({state,onSave,valueCNY}:Props){
 const model=buildAssetGoalOverview(state,valueCNY),readOnly=state?.viewer?.canWrite===false;
 return <section className="card section-space goal-settings" aria-label="资产目标设置"><div className="card-title"><h2>存款与资产目标</h2><span className="badge gray">按四个大类维护</span></div><p className="help-text">默认总目标400万元：股票、银行存款与国债、宽基指数、黄金贵金属各100万元。只记录目标规划。</p>
  <GoalEditor key={(model.goal.id??'default')+':'+(model.goal.updatedAt??'')} goal={model.goal} onSave={onSave} readOnly={readOnly}/>
  {readOnly&&<p className="goal-explanation">当前为只读访问，目标由有写入权限的家庭成员维护。</p>}
  {model.legacyGoals.length>0&&<details className="goal-basis"><summary>查看旧版逐项目标（{model.legacyGoals.length}份，保留历史）</summary><p>旧记录保留在这里供核对。新的四类目标独立保存，不替换旧记录，也不叠加旧目标金额。</p>{model.legacyGoals.map((document:any)=><article className="goal-legacy" key={document.id}><h3>{document.payload?.name??'旧版资产目标'}</h3>{(document.payload?.items??[]).map((item:any,index:number)=><p key={item.accountId+':'+index}>{state.accounts.find((account:any)=>account.id===item.accountId)?.name??'历史资产'} · <span className="money">{goalMoney(Number.isSafeInteger(item.target)?item.target:null)}</span>{item.date?' · '+item.date:''}</p>)}</article>)}</details>}
 </section>;
}

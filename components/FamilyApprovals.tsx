"use client";
import {SensitiveValue} from './FinancialPrivacy';
import SharePlanApproval from './SharePlanApproval';
import {useState} from 'react';
import {decimal} from '../src/domain/finance.mjs';
import {canSubmitFinanceAction} from '../src/domain/finance-ui.mjs';

export default function FamilyApprovals({state,onSave,planId}:{state:any;onSave:(action:string,body:any)=>Promise<any>;planId?:string}){
 const [pending,setPending]=useState<string|null>(null);
 const plans=(state.documents??[]).filter((document:any)=>document.kind==='plan'&&(!planId||document.id===planId)&&document.payload.familyApproval&&!['COMPLETED','CANCELLED'].includes(document.payload.status));
 if(!plans.length)return null;
 const members=state.householdMembers??[],actor=state.viewer?.subject;
 return <section className="card section-space family-approvals" aria-label="家庭预算审批"><div className="card-title"><h2>家庭审批</h2><span className="badge gray">每位成员确认自己的意见</span></div><p className="help-text">全部有效家庭登录成员同意后，计划纳入正式预算并同步生活日历。方案变更后需重新确认。</p>{plans.map((document:any)=>{const plan=document.payload,approval=plan.familyApproval,approved=new Set((approval.approvals??[]).map((vote:any)=>vote.userId)),body={planId:document.id,version:approval.version,confirmed:true},canVote=canSubmitFinanceAction({...state,viewer:{...state.viewer,canWrite:false}},'plan.approve',body);return <article className="approval-row" key={document.id}><div><strong>{plan.name}</strong><p className="help-text">{plan.date} · <SensitiveValue>{plan.budget==null?'预算待补充':'¥'+decimal(plan.budget)}</SensitiveValue> · {approval.status==='APPROVED'?'家庭已通过':'等待家庭确认'} · v{approval.version}</p><div className="approval-members">{(approval.required??[]).map((id:string)=><span className={'badge '+(approved.has(id)?'':'gray')} key={id}>{members.find((member:any)=>member.userId===id)?.displayName??'家庭成员'}{id===actor?'（你）':''} · {approved.has(id)?'已同意':'待确认'}</span>)}</div></div><div className="approval-row-actions">{approval.status==='PENDING_APPROVAL'&&<SharePlanApproval planId={document.id}/ >}{canVote?<button className="btn primary" disabled={pending!==null} onClick={async()=>{setPending(document.id);try{await onSave('plan.approve',body)}finally{setPending(null)}}}>{pending===document.id?'正在确认…':'我同意此预算'}</button>:<span className="help-text">{approved.has(actor)?'你已确认':approval.status==='APPROVED'?'已转为正式预算':'等待其他成员'}</span>}</div></article>})}</section>;
}

"use client";
import {useState} from 'react';
import {accountMember,resolveFinanceMember} from '../src/domain/member-ownership.mjs';
import './MemberControls.css';

export function memberDisplay(state:any,id:string){return (state?.financeMembers??[]).find((member:any)=>member.id===id||member.aliases?.includes(id))?.name??(id==='family'?'家庭共用':'待确认');}
export function accountDisplay(state:any,account:any){return `${accountMember(account,state).name} · ${account.name} · ${account.currency}`;}
export function MemberSelect({state,name='ownerMemberId',label='归属成员',value,defaultValue='',onChange,required=true,disabled=false}:any){
 const members=(state?.financeMembers??[]).filter((member:any)=>member.selectable!==false&&member.active!==false);
 const selected=value??defaultValue;
 return <label className="field">{label}<select aria-label={label} name={name} {...(value!==undefined?{value}:{defaultValue})} required={required} disabled={disabled} onChange={event=>onChange?.(event.target.value)}><option value="">请选择成员</option>{selected&&!members.some((member:any)=>member.id===selected)&&<option value={selected}>{memberDisplay(state,selected)}（当前归属）</option>}{members.map((member:any)=><option key={member.id} value={member.id}>{member.name}{member.active===false?'（已停用）':''}</option>)}</select></label>;
}
export function MemberFilter({state,value,onChange,label='按成员筛选'}:any){return <div className="member-filter"><label className="field">{label}<select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}><option value="all">全部成员</option>{(state?.financeMembers??[]).map((member:any)=><option value={member.id} key={member.id}>{member.name}{member.active===false?'（已停用）':''}</option>)}{!(state?.financeMembers??[]).some((member:any)=>member.id==='unknown')&&<option value="unknown">待确认</option>}</select></label></div>}
export function MemberAccountFields({state,name='accountId',label='人民币现金账户',memberName='cashMemberId',memberLabel='收付款成员',currency='CNY',defaultAccountId='',defaultMemberId='',excludeAccountId,disabled=false,onAccountChange}:any){
 const existing=(state?.accounts??[]).find((account:any)=>account.id===defaultAccountId);
 const [memberId,setMemberId]=useState(()=>defaultMemberId?resolveFinanceMember(state,defaultMemberId).id:(existing?accountMember(existing,state).id:''));
 const [accountId,setAccountId]=useState(defaultAccountId);
 const accounts=(state?.accounts??[]).filter((account:any)=>!account.archived&&account.kind==='ASSET'&&account.category==='cash'&&(!currency||account.currency===currency)&&account.id!==excludeAccountId&&accountMember(account,state).id===memberId);
 const selected=accounts.some((account:any)=>account.id===accountId)?accountId:'';
 return <><MemberSelect state={state} label={memberLabel} name={memberName} value={memberId} disabled={disabled} onChange={(id:string)=>{setMemberId(id);setAccountId('');onAccountChange?.('')}}/><label className="field">{label}<select aria-label={label} name={name} value={selected} disabled={disabled||!memberId} required onChange={event=>{setAccountId(event.target.value);onAccountChange?.(event.target.value)}}><option value="">{memberId?'请选择现金账户':'请先选择收付款成员'}</option>{accounts.map((account:any)=><option key={account.id} value={account.id}>{accountDisplay(state,account)}</option>)}</select>{memberId&&!accounts.length&&<small className="help-text">该成员尚无可用的{currency||''}现金账户，请先登记。</small>}</label></>;
}

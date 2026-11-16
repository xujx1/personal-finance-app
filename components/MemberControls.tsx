"use client";
import {useEffect,useState} from 'react';
import {accountMember,resolveFinanceMember,activeMemberFilterOptions} from '../src/domain/member-ownership.mjs';
import './MemberControls.css';
import {useI18n} from './I18n';
import {memberLabel as localizedMember,translate} from '../src/domain/i18n.mjs';


export function memberDisplay(state:any,id:string,locale='zh-CN'){const member=(state?.financeMembers??[]).find((member:any)=>member.id===id||member.aliases?.includes(id));return member?localizedMember(member,locale):translate(id==='family'?'家庭共用':'待确认',{},locale);}
export function accountDisplay(state:any,account:any,locale='zh-CN'){return `${localizedMember(accountMember(account,state),locale)} · ${account.name} · ${account.currency}`;}
export function MemberSelect({state,name='ownerMemberId',label='归属成员',value,defaultValue='',onChange,required=true,disabled=false}:any){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const members=(state?.financeMembers??[]).filter((member:any)=>member.selectable!==false&&member.active!==false);
 const selected=value??defaultValue;
 return <label className="field">{tr(label)}<select aria-label={tr(label)} name={name} {...(value!==undefined?{value}:{defaultValue})} required={required} disabled={disabled} onChange={event=>onChange?.(event.target.value)}><option value="">{tr("请选择成员")}</option>{selected&&!members.some((member:any)=>member.id===selected)&&<option value={selected}>{memberDisplay(state,selected,uiLocale)}{tr("（当前归属）")}</option>}{members.map((member:any)=><option key={member.id} value={member.id}>{uiMember(member)}{member.active===false?tr("（已停用）"):''}</option>)}</select></label>;
}
export function MemberFilter({state,value,onChange,label='按成员筛选'}:any){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();
const members=activeMemberFilterOptions(state);useEffect(()=>{if(value!=='all'&&!members.some((m:any)=>m.id===value))onChange('all')},[value,state?.financeMembers,onChange]);return <div className="member-filter"><label className="field">{tr(label)}<select aria-label={tr(label)} value={value} onChange={event=>onChange(event.target.value)}><option value="all">{tr("全家汇总")}</option>{members.map((member:any)=><option value={member.id} key={member.id}>{uiMember(member)}</option>)}</select></label></div>}
export function MemberAccountFields({state,name='accountId',label='人民币现金账户',memberName='cashMemberId',memberLabel='收付款成员',currency='CNY',defaultAccountId='',defaultMemberId='',excludeAccountId,disabled=false,onAccountChange}:any){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const existing=(state?.accounts??[]).find((account:any)=>account.id===defaultAccountId);
 const [memberId,setMemberId]=useState(()=>defaultMemberId?resolveFinanceMember(state,defaultMemberId).id:(existing?accountMember(existing,state).id:''));
 const [accountId,setAccountId]=useState(defaultAccountId);
 const accounts=(state?.accounts??[]).filter((account:any)=>!account.archived&&account.kind==='ASSET'&&account.category==='cash'&&(!currency||account.currency===currency)&&account.id!==excludeAccountId&&accountMember(account,state).id===memberId);
 const selected=accounts.some((account:any)=>account.id===accountId)?accountId:'';
 return <><MemberSelect state={state} label={memberLabel} name={memberName} value={memberId} disabled={disabled} onChange={(id:string)=>{setMemberId(id);setAccountId('');onAccountChange?.('')}}/><label className="field">{tr(label)}<select aria-label={tr(label)} name={name} value={selected} disabled={disabled||!memberId} required onChange={event=>{setAccountId(event.target.value);onAccountChange?.(event.target.value)}}><option value="">{memberId?tr("请选择现金账户"):tr("请先选择收付款成员")}</option>{accounts.map((account:any)=><option key={account.id} value={account.id}>{accountDisplay(state,account,uiLocale)}</option>)}</select>{memberId&&!accounts.length&&<small className="help-text">{tr("该成员尚无可用的")}{currency||''}{tr("现金账户，请先登记。")}</small>}</label></>;
}

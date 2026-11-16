import {accountMember,resolveFinanceMember} from './member-ownership.mjs';

export const MEMBER_DRAFT_KINDS=['asset','cashflow'];
export function assertMemberDraftAccess(state,actor,kind,payload,document){
 if(!state.household)return; // Legacy isolated owner ledgers have no member directory.
 const member=state.householdMembers?.find(member=>member.userId===actor&&member.active);
 if(!member)throw Error('家庭成员权限已失效，请重新加载');
 if(member.role==='owner'&&state.household.ownerSubject===actor)return;
 if(!MEMBER_DRAFT_KINDS.includes(kind))throw Error('权限不足：普通成员可登记本人资产与实际收支；家庭配置及其他草稿由管理员核对');
 if(document&&(document.kind!=='financial_draft'||document.payload.submittedBy!==actor))throw Error('只能处理本人提交的资产或流水草稿');
 if(kind==='asset'){
  const owner=resolveFinanceMember(state,payload?.ownerMemberId,{write:true});
  if(owner.userId!==actor)throw Error('只能登记本人名下的资产');
 }else{
  const account=state.accounts?.find(account=>account.id===payload?.accountId);
  const owner=resolveFinanceMember(state,payload?.cashMemberId,{write:true});
  if(!account||account.archived||accountMember(account,state).userId!==actor||owner.userId!==actor||owner.id!==accountMember(account,state).id)throw Error('只能核对本人现金账户的实际收支');
 }
}
export function canManageOwnDraft(state,document,payload=document?.payload?.payload){
 if(state?.viewer?.canWrite===true)return true;
 if(!state?.household||!state?.viewer?.subject||!document)return false;
 try{assertMemberDraftAccess(state,state.viewer.subject,document.payload?.kind,document.payload?.payload,document);assertMemberDraftAccess(state,state.viewer.subject,document.payload?.kind,payload,document);return true}catch{return false}
}

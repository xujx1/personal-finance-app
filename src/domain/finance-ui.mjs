import {decimal} from './finance.mjs';

// This is a UI affordance only. The server always authenticates the actual voter.
export function canSubmitFinanceAction(state,action,body={}){
 if(state?.viewer?.canWrite!==false)return true;
 if(action!=='plan.approve')return false;
 const actor=state.viewer.subject;
 if(!(state.householdMembers??[]).some(member=>member.userId===actor&&member.active))return false;
 const approval=(state.documents??[]).find(document=>document.kind==='plan'&&document.id===body.planId)?.payload?.familyApproval;
 return Boolean(approval&&approval.status==='PENDING_APPROVAL'&&approval.version===body.version&&approval.required?.includes(actor)&&!approval.approvals?.some(vote=>vote.userId===actor));
}
export function recurringCandidateBody(candidate){
 return {name:candidate.name,type:candidate.type,accountId:candidate.accountId,cashMemberId:candidate.cashMemberId,amount:decimal(candidate.amount),day:candidate.day,start:candidate.start,autoPost:false,confirmed:true};
}

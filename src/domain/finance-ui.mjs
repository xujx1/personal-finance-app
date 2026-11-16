import {canManageOwnDraft} from './member-draft-access.mjs';
import {decimal} from './finance.mjs';

// This is a UI affordance only. The server always authenticates the actual voter.
export function canSubmitFinanceAction(state,action,body={}){
 if(['mcp.draft.accept','mcp.draft.reject'].includes(action)&&state?.viewer?.canWrite!==true){const document=state?.documents?.find(d=>d.id===body.draftId);return canManageOwnDraft(state,document,action==='mcp.draft.accept'?body.reviewedPayload:document?.payload?.payload);}
 if(action==='account.create')return Boolean((state?.householdMembers??[]).some(member=>member.userId===state?.viewer?.subject&&member.active));
 if(!['plan.approve','plan.reject','plan.revise'].includes(action))return state?.viewer?.canWrite!==false;
 const actor=state?.viewer?.subject;
 if(!(state.householdMembers??[]).some(member=>member.userId===actor&&member.active))return false;
 const plan=(state.documents??[]).find(document=>document.kind==='plan'&&document.id===body.planId)?.payload;if(!plan||['COMPLETED','CANCELLED'].includes(plan.status))return false;
 if(action==='plan.revise')return (plan.version??0)===body.version;
 const approval=plan.familyApproval;
 if(action==='plan.reject')return Boolean(approval&&approval.status==='PENDING_APPROVAL'&&approval.version===body.version&&approval.required?.includes(actor));
 return Boolean(approval&&approval.status==='PENDING_APPROVAL'&&approval.version===body.version&&approval.required?.includes(actor)&&!approval.approvals?.some(vote=>vote.userId===actor));
}
export function recurringCandidateBody(candidate){
 return {name:candidate.name,type:candidate.type,accountId:candidate.accountId,cashMemberId:candidate.cashMemberId,amount:decimal(candidate.amount),day:candidate.day,start:candidate.start,autoPost:false,confirmed:true};
}

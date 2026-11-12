export const isPendingPlan=plan=>!['CANCELLED','COMPLETED'].includes(plan.status)&&(plan.budgetStatus==='PENDING_APPROVAL'||plan.familyApproval?.status==='PENDING_APPROVAL');
export const needsMyApproval=(plan,state)=>isPendingPlan(plan)&&Boolean(state?.viewer?.subject)&&plan.familyApproval?.required?.includes(state.viewer.subject)&&!plan.familyApproval?.approvals?.some(vote=>vote.userId===state.viewer.subject);
export const planIdFromValue=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value)?value:null;
// This is a locator, never a grant of access. The server still scopes every read/vote.
export function approvalLink(origin,id){if(!planIdFromValue(id))throw Error('计划链接无效');const url=new URL('/',origin);url.searchParams.set('plan',id);return url.href;}

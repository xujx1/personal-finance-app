import {defaultMemberId,planMember} from './member-ownership.mjs';

export function expenseTargetPlans(state){
 const dataset=state?.book?.dataset??state?.book?.active_dataset;
 return (state?.documents??[]).filter(document=>document.kind==='plan'&&document.payload?.status==='PLANNED'&&
  !(document.dataset_id&&dataset&&document.dataset_id!==dataset));
}
export function selectExpenseTarget(form,state,planId){
 if(form.intent==='asset'||state?.viewer?.canWrite===false)throw Error('当前不能修改预算去向');
 const plan=planId?expenseTargetPlans(state).find(document=>document.id===planId):null;
 if(planId&&!plan)throw Error('原预算已变化，请刷新后重新选择');
 return {form:{...form,planId:plan?.id},ownerMemberId:plan?planMember(plan.payload,state).id:defaultMemberId(state),planName:plan?.payload.name??''};
}

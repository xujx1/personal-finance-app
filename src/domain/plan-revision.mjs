import {minor} from './finance.mjs';
import {normalizeExpenseDraft} from './expense-plan.mjs';
import {validateItineraryWindow} from './executable-costs.mjs';
import {consumptionTypeForWrite} from './consumption.mjs';
import {beginFamilyApproval,applyFamilyApproval} from './family-approval.mjs';
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('请填写有效的计划内容');return v.trim()};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v).toISOString().slice(0,10)!==v)throw Error('计划日期无效');return v};
const comparable=p=>JSON.stringify([p.name,p.category,p.date,p.end,p.note??'',p.budget,p.principal??null,p.interest??null,p.expenseDraft?normalizeExpenseDraft({...p.expenseDraft,reviewed:true},{requireReview:false}):null]);
export function reviseFamilyPlan(plan,body,state,actor){
 if(!body||Object.keys(body).some(k=>!['planId','version','confirmed','name','category','date','end','note','budget','expenseDraft','principal','interest'].includes(k)))throw Error('计划修改包含不允许的字段');
 if(body.confirmed!==true)throw Error('请确认修改后由全部家庭成员重新审批');
 if(!state.householdMembers.some(m=>m.userId===actor&&m.active))throw Error('修改人不是有效家庭成员');
 if(['CANCELLED','COMPLETED'].includes(plan.status))throw Error('计划已结束，不能修改');
 if(!Number.isSafeInteger(body.version)||body.version!==(plan.version??0))throw Error('CONFLICT:计划版本已变化，请刷新');
 const next={...plan,name:body.name===undefined?plan.name:text(body.name,100),category:body.category===undefined?plan.category:text(body.category,30),date:date(body.date??plan.date),end:date(body.end??plan.end??plan.date),note:body.note===undefined?plan.note:typeof body.note==='string'&&body.note.length<=3000?body.note:(()=>{throw Error('计划备注过长或无效')})()};
 if(next.end<next.date)throw Error('结束日期不能早于开始日期');
 if(body.budget!==undefined)next.budget=minor(body.budget);
 if(body.expenseDraft!==undefined||plan.expenseDraft){
  const draft=normalizeExpenseDraft({...body.expenseDraft??plan.expenseDraft,reviewed:true});validateItineraryWindow(draft.itinerary,next.date,next.end);
  if(body.budget!==undefined&&minor(body.budget)!==draft.totalMinor)throw Error('预算与清单合计不一致');
  Object.assign(next,{expenseDraft:draft,budget:draft.totalMinor,itinerary:draft.itinerary,items:draft.items.filter(x=>x.selected),comparisons:draft.comparisons});
 }
 if(next.budget==null||next.budget<=0)throw Error('计划预算必须大于0');
 if(body.principal!==undefined||body.interest!==undefined){if(!plan.loanId)throw Error('只有关联贷款的计划可修改预计本金利息');next.principal=body.principal===undefined?plan.principal:minor(body.principal);next.interest=body.interest===undefined?plan.interest:minor(body.interest);}
 if(plan.loanId){const loan=state.accounts.find(a=>a.id===plan.loanId);if(!loan||loan.archived||next.principal==null||next.interest==null||next.principal+next.interest!==next.budget||next.principal>loan.balance)throw Error('预计本金与利息须等于预算且不超过贷款余额');}
 next.consumptionType=consumptionTypeForWrite({...next,consumptionType:undefined});
 if(comparable(next)===comparable(plan))throw Error('计划内容未变化，请先修改后再提交');
 next.version=(plan.version??0)+1;next.revisedAt=new Date().toISOString();next.revisedBy=actor;
 const paid=state.planSummaries.find(p=>p.planId===body.planId)?.paid??0;next.reserved=Math.min(plan.reserved??0,Math.max(0,next.budget-paid));
 return applyFamilyApproval(next,beginFamilyApproval(Math.max(plan.familyApproval?.version??0,plan.version??0)+1,state.householdMembers,null,undefined,state.householdRevision));
}

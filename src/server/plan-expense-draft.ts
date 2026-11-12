import {evidenceHash} from './mcp-queries.ts';
import {accountMember,resolveFinanceMember} from '../domain/member-ownership.mjs';
export const planExpenseBasis=(p:any)=>({version:p.version??0,budget:p.budget,date:p.date,end:p.end,ownerMemberId:p.ownerMemberId,loanId:p.loanId??null,budgetStatus:p.budgetStatus,familyApproval:p.familyApproval??null});
export async function validatePlanExpense(c:any,p:any,expected?:any){
 if(!p.planId)return null;
 const {state,doc,account,db,ds}=c,plan=doc(p.planId);
 if(plan.kind!=='plan'||p.type!=='expense')throw Error('关联预算仅支持实际消费支出');
 if(plan.payload.loanId)throw Error('贷款本金不能记为消费，请在计划详情核对实际还款本金和利息');
 const bank=account(p.accountId);if(bank.kind!=='ASSET'||bank.category!=='cash'||bank.currency!=='CNY'||accountMember(bank,state).id!==resolveFinanceMember(state,p.cashMemberId,{write:true}).id)throw Error('实际付款账户与家庭成员不一致');
 const fingerprint=await evidenceHash(planExpenseBasis(plan.payload));
 if(expected&&(expected.targetPlanFingerprint!==fingerprint||expected.payload?.planId!==p.planId||(expected.payload?.prepaymentId??null)!==(p.prepaymentId??null)))throw Error('原预算或审批依据已变化，不能更换关联计划/预付款，请重新核对草稿');
 let prepayment=null,prepaid=null;
 if(p.prepaymentId){
  if(p.balanceIncluded)throw Error('抵扣预付款不再扣银行现金，不能重复使用余额已含模式');
  prepayment=await db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND id=? AND kind='PREPAYMENT' AND status='POSTED'").bind(ds??state.book.active_dataset,p.prepaymentId).first();
  if(!prepayment)throw Error('原预付款不存在');const m=JSON.parse(prepayment.metadata);
  if(m.planId!==p.planId||m.accountId!==p.accountId||prepayment.business_date>p.date)throw Error('原预付款与计划、付款账户或消费日期不一致');
  prepaid=account('prepaid:'+p.planId);if(accountMember(prepaid,state).id!==accountMember(bank,state).id)throw Error('预付款归属已变化，请核对原付款成员');
 }else if(plan.payload.budgetStatus!=='APPROVED'||plan.payload.familyApproval&&plan.payload.familyApproval.status!=='APPROVED'||['CANCELLED','COMPLETED'].includes(plan.payload.status))throw Error('原预算未通过家庭审批或已结束，不能新增实际付款');
 return {plan,prepayment,prepaid,targetPlanFingerprint:fingerprint};
}

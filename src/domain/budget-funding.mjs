import {MAX_MINOR} from './finance.mjs';
const amount=n=>{if(!Number.isSafeInteger(n)||n<0||n>MAX_MINOR)throw Error('预算备款金额无效');return n;};
const sum=(a,b)=>amount(a+b);
/** Current bank cash allocated by plan due date. Paid includes outstanding prepayments. */
export function buildBudgetFundingGoals(state){
 const cash=(state?.accounts??[]).filter(a=>!a.archived&&a.category==='cash'&&a.currency==='CNY'&&(!a.kind||a.kind==='ASSET')).reduce((n,a)=>sum(n,amount(a.balance)),0);
 let unknown=0;
 const plans=(state?.documents??[]).filter(d=>d.kind==='plan'&&!['CANCELLED','COMPLETED'].includes(d.payload.status)).flatMap(d=>{
  const p=d.payload;if(p.budget==null){unknown++;return [];}
  const paid=(state.planSummaries??[]).find(x=>x.planId===d.id)?.paid??0;
  if(!Number.isSafeInteger(paid))throw Error('预算付款汇总无效');
  const remaining=Math.max(0,amount(p.budget)-paid);amount(remaining);
  return remaining?[{id:d.id,name:p.name,date:p.date,remaining,budget:p.budget,paid,pending:p.budgetStatus!=='APPROVED'}]:[];
 }).sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
 let available=cash,totalRemaining=0;
 for(const p of plans){p.funded=Math.min(p.remaining,available);p.gap=p.remaining-p.funded;available-=p.funded;p.progress=p.funded/p.remaining*100;totalRemaining=sum(totalRemaining,p.remaining);}
 return {cash,totalRemaining,gap:Math.max(0,totalRemaining-cash),unknown,plans};
}

import {minor} from './finance.mjs';
const optional=v=>v==null||v===''?null:minor(String(v));
const sum=values=>{const n=values.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(n))throw Error('汇总金额超出精确计算范围');return n;};
export function evaluateSpending(state,input){
 const question=String(input.question??'').trim();if(!question||question.length>2000)throw Error('请描述旅行或购物想法，最多2000字');
 const date=String(input.date??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('预计日期无效');
 const target=input.planId?state.documents.find(d=>d.kind==='plan'&&d.id===input.planId):null;if(input.planId&&!target)throw Error('原计划不存在');
 const budget=optional(input.budget),income=optional(input.monthlyIncome),living=optional(input.livingExpense),emergency=optional(input.emergencyReserve);
 const loans=state.accounts.filter(a=>a.kind==='LIABILITY'&&!a.archived);let unknownLoan=false;
 const loanAmounts=loans.map(a=>{if(a.currency!=='CNY'||a.metadata?.monthly==null||a.metadata.monthly===''){unknownLoan=true;return 0;}return minor(String(a.metadata.monthly));});
 const enteredLoan=optional(input.monthlyLoan),loanMonthly=enteredLoan??(unknownLoan?null:sum(loanAmounts));
 const cash=sum(state.accounts.filter(a=>a.kind==='ASSET'&&a.category==='cash'&&a.currency==='CNY'&&!a.archived).map(a=>a.balance));
 const paid=id=>Math.max(0,state.planSummaries.find(p=>p.planId===id)?.paid??0);
 const otherPlans=sum(state.documents.filter(d=>d.kind==='plan'&&d.id!==target?.id&&!['CANCELLED','COMPLETED'].includes(d.payload.status)).map(d=>Math.max(d.payload.reserved??0,d.payload.status!=='DRAFT'&&d.payload.budgetStatus==='APPROVED'&&d.payload.budget!=null?Math.max(0,d.payload.budget-paid(d.id)):0)));
 const proposedRemaining=budget===null?null:Math.max(0,budget-(target?paid(target.id):0));
 const cashAfter=proposedRemaining===null?null:cash-otherPlans-(loanMonthly??0)-proposedRemaining;
 const freeAfter=cashAfter===null?null:cashAfter-(emergency??0);
 const monthlySurplus=income===null||living===null||loanMonthly===null?null:income-living-loanMonthly;
 const missing_inputs=[];if(budget===null)missing_inputs.push('本次预计预算');if(income===null)missing_inputs.push('固定月收入（单笔到账不能替代）');if(living===null)missing_inputs.push('每月生活费（不含房贷）');if(emergency===null)missing_inputs.push('希望保留的应急金');if(loanMonthly===null)missing_inputs.push('已确认的每月贷款合计');
 const risk_reasons=[];if(freeAfter!==null&&freeAfter<0)risk_reasons.push('扣除其他计划、一期房贷和本次支出后，无法保留指定应急金');if(monthlySurplus!==null&&monthlySurplus<0)risk_reasons.push('输入情景中的每月收入不足以覆盖生活费和房贷');
 const verdict=freeAfter!==null&&freeAfter<0?'建议推迟':missing_inputs.length?'信息不足':monthlySurplus<0?'需缩减':'可考虑';
 return {source:'rules',verdict,summary:verdict==='可考虑'?'按当前现金和你填写的情景，可以进一步考虑；请核实实际报价和其他家庭支出。':verdict==='信息不足'?'可以先看现金影响，补齐收入、生活费和应急金后再判断是否合理。':'建议先调整预算或补足资金，再决定是否执行。',missing_inputs,risk_reasons,options:[],budget_items:[],assumptions:['金额来自用户输入，不是酒店、车票或商品实时报价。','仅测算当前人民币现金；房产、基金赎回中金额和美元证券不视为可花现金。','预留与同一预算待支出取较大值，避免重复占用；不把未来工资提前计入现金。','保守计入一期已知房贷，不等同于完整现金流预测。'],inputs:{question,budgetMinor:budget,date,planId:target?.id??null,monthlyIncome:income,livingExpense:living,emergencyReserve:emergency,monthlyLoan:loanMonthly},metrics:{cash,otherPlans,loanMonthly,proposedRemaining,cashAfter,freeAfter,monthlySurplus}};
}

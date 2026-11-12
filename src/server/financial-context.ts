import {minor,decimal} from '../domain/finance.mjs';
import {annualForecast} from '../domain/planning.mjs';
import {buildBudgetFundingGoals} from '../domain/budget-funding.mjs';
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function getFinancialContext(db:D1Database,state:any,today=localToday()){
 const month=today.slice(0,7),anchor=new Date(month+'-01T00:00:00Z');const months=[];
 for(let i=3;i>=1;i--){const d=new Date(anchor);d.setUTCMonth(d.getUTCMonth()-i);months.push(d.toISOString().slice(0,7));}
 const rows:any=await db.prepare("SELECT substr(business_date,1,7) AS month,SUM(CASE WHEN kind='INCOME' THEN total_minor ELSE 0 END) AS income,SUM(CASE WHEN kind='EXPENSE' THEN total_minor ELSE 0 END) AS expense,SUM(CASE WHEN kind='INCOME' THEN 1 ELSE 0 END) AS income_count,SUM(CASE WHEN kind='EXPENSE' THEN 1 ELSE 0 END) AS expense_count FROM transactions WHERE dataset_id=? AND status='POSTED' AND business_date>=? AND business_date<? AND kind IN('INCOME','EXPENSE') GROUP BY substr(business_date,1,7)").bind(state.book.active_dataset,months[0]+'-01',month+'-01').all();
 const profile=state.documents.find((d:any)=>d.kind==='financial_profile'&&d.id==='financial-profile')?.payload??{};
 const historyReady=profile.historyComplete===true&&months.every(m=>rows.results.some((r:any)=>r.month===m&&r.income_count>0&&r.expense_count>0));
 const avg=(field:string)=>{const n=rows.results.reduce((sum:number,r:any)=>sum+(r[field]??0),0);if(!Number.isSafeInteger(n))throw Error('历史金额超出精确计算范围');return Math.floor((n+1)/3);};
 const activeRules=state.documents.filter((d:any)=>d.kind==='recurring_rule'&&d.payload.confirmedAt&&!d.payload.paused&&d.payload.start<=today&&(!d.payload.end||d.payload.end>=today)&&state.accounts.some((a:any)=>a.id===d.payload.accountId&&a.kind==='ASSET'&&a.category==='cash'&&a.currency==='CNY'&&!a.archived)).map((d:any)=>d.payload);
 const sumRules=(rules:any[])=>{const n=rules.reduce((sum:number,r:any)=>{if(!Number.isSafeInteger(r.amount)||r.amount<=0)throw Error('周期金额需核对');return sum+r.amount},0);if(!Number.isSafeInteger(n))throw Error('周期金额超出精确计算范围');return n;};
 const incomeRules=activeRules.filter((r:any)=>r.type==='income'),expenseRules=activeRules.filter((r:any)=>r.type==='expense');
 const income=incomeRules.length?sumRules(incomeRules):profile.monthlyIncomeMinor??(historyReady?avg('income'):null),emergency=profile.emergencyReserveMinor??null;
 const knownRecurringExpenseMinor=expenseRules.length?sumRules(expenseRules):null,completeLiving=profile.livingExpenseMinor??(historyReady?avg('expense'):null);
 // A rent/utility rule is a floor, not proof that all variable household spending is covered.
 const living=completeLiving==null?null:Math.max(completeLiving,knownRecurringExpenseMinor??0);
 const loans=state.accounts.filter((a:any)=>a.kind==='LIABILITY'&&!a.archived&&a.balance>0);
 let loanMonthly:number|null=0;for(const loan of loans){if(loan.currency!=='CNY'){loanMonthly=null;break;}const rules=activeRules.filter((r:any)=>r.type==='loan'&&r.loanId===loan.id);if(rules.length){loanMonthly+=sumRules(rules);continue;}if(loan.currency!=='CNY'||loan.metadata?.monthly==null||loan.metadata.monthly===''){loanMonthly=null;break;}loanMonthly+=minor(String(loan.metadata.monthly));}
 const format=(n:number|null)=>n==null?'':decimal(n);
 const plannedRecurring=state.documents.filter((d:any)=>d.kind==='recurring_rule'&&d.payload.confirmedAt&&!d.payload.paused&&(!d.payload.end||d.payload.end>=today)&&state.accounts.some((a:any)=>a.id===d.payload.accountId&&a.kind==='ASSET'&&a.category==='cash'&&a.currency==='CNY'&&!a.archived)).map((d:any)=>({id:d.id,name:d.payload.name,type:d.payload.type,amountMinor:d.payload.amount,day:d.payload.day,start:d.payload.start,end:d.payload.end??null,autoPost:d.payload.autoPost===true,source:'本人已登记的预计周期收支，不等于已经到账或扣款'}));
 const nextMonth=new Date(anchor);nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);const planningMonth=nextMonth.toISOString().slice(0,7),lastDay=new Date(Date.UTC(nextMonth.getUTCFullYear(),nextMonth.getUTCMonth()+1,0)).getUTCDate();
 const incomePlans=plannedRecurring.filter((r:any)=>r.type==='income');
 const plannedMonthRules=incomePlans.filter((r:any)=>{const occurrence=planningMonth+'-'+String(Math.min(r.day,lastDay)).padStart(2,'0');return occurrence>=r.start&&(!r.end||occurrence<=r.end)});
 const scheduledIncome=plannedMonthRules.length?sumRules(plannedMonthRules.map((r:any)=>({amount:r.amountMinor}))):null;
 const planningIncome=incomePlans.length?scheduledIncome:income;
 const funding=buildBudgetFundingGoals(state);const forecast={amount_unit:'CNY_yuan',startingCashYuan:decimal(funding.cash),currentFundingGapYuan:decimal(funding.gap),basis:'当前人民币银行现金+周期收入-周期支出-计划尚未付款部分；不含证券变现和房产，不重复扣预留与预付款，未批准预算保守纳入',months:annualForecast(state,today,12).map((r:any)=>({month:r.month,openingCashYuan:decimal(r.opening),incomeYuan:decimal(r.income),fixedExpenseYuan:decimal(r.fixed),plannedOutflowYuan:decimal(r.planned),pendingBudgetYuan:decimal(r.pending),closingCashYuan:decimal(r.closing),negative:r.negative,unknownBudgetCount:r.unknown}))};
 return {forecast,planningMonth,planningInputs:{monthlyIncome:format(planningIncome)},plannedRecurring,plannedRecurringNote:'周期计划包含未来规则，预计金额供现金流规划；不能当作已到账现金，也不能因尚未生效就声称本人未提供收入安排。',knownRecurringExpenseMinor,inputs:{monthlyIncome:format(income),livingExpense:format(living),monthlyLoan:format(loanMonthly),emergencyReserve:format(emergency)},values:{monthlyIncome:income,livingExpense:living,monthlyLoan:loanMonthly,emergencyReserve:emergency},sources:{planningIncome:incomePlans.length?planningMonth+'月预计周期收入计划；按该月有效扣款日计算，不叠加互斥规则，不代表已到账现金':'使用已确认月收入或已核对历史',monthlyIncome:incomeRules.length?'本人确认且当前生效的周期收入规则':profile.monthlyIncomeMinor!=null?'已确认的全局月度规划':historyReady?'近3个完整月份已确认流水均值':'账本数据不足，尚未推定月收入',livingExpense:living==null?'完整生活支出覆盖范围尚未确认；周期支出仅作为已知下限':expenseRules.length?'已确认完整生活支出与当前周期支出下限取较大值':profile.livingExpenseMinor!=null?'已确认的全局月度规划':historyReady?'近3个完整月份已确认流水均值':'日常流水不足或尚未确认覆盖完整性',monthlyLoan:loanMonthly==null?'贷款账户缺少已确认月供':activeRules.some((r:any)=>r.type==='loan')?'当前生效的周期贷款规则优先，其余贷款使用已核实月供':'贷款账户已记录月供',emergencyReserve:emergency==null?'尚无本人确认的应急资金保留金额，不能根据收入或余额猜测':'全局规划设置'},months,historyReady,profile};
}

/** Model-facing values use major units only; internal ledger cents stay in the store. */
export function financialContextForAI(context:any){
 return {forecast:context.forecast,amount_unit:'CNY_yuan',monthlyActiveIncomeYuan:context.inputs.monthlyIncome||null,planningMonth:context.planningMonth,monthlyPlanningIncomeYuan:context.planningInputs?.monthlyIncome||null,livingExpenseYuan:context.inputs.livingExpense||null,monthlyLoanYuan:context.inputs.monthlyLoan||null,emergencyReserveYuan:context.inputs.emergencyReserve||null,knownRecurringExpenseYuan:context.knownRecurringExpenseMinor==null?null:decimal(context.knownRecurringExpenseMinor),plannedRecurring:(context.plannedRecurring??[]).map((rule:any)=>{const {amountMinor,...rest}=rule;return {...rest,amountYuan:decimal(amountMinor)}}),plannedRecurringNote:context.plannedRecurringNote,sources:context.sources,historyMonths:context.months,historyReady:context.historyReady};
}
export function advisorAmountsForAI(base:any){
 const {inputs,metrics}=base;
 return {amount_unit:'CNY_yuan',inputs:{...inputs,...Object.fromEntries(['monthlyIncome','livingExpense','monthlyLoan','emergencyReserve'].map(key=>[key,inputs[key]==null?null:decimal(inputs[key])]))},metrics:Object.fromEntries(Object.entries(metrics).map(([key,value])=>[key,value==null?null:typeof value==='number'?decimal(value):value]))};
}

/** Receipt/proposal storage uses cents too; never pass their unsuffixed amounts to a model. */
export function expenseDraftForAI(draft:any){
 if(!draft)return null;
 const {totalMinor,items=[],...rest}=draft;
 return {...rest,amount_unit:'CNY_yuan',totalYuan:totalMinor==null?null:decimal(totalMinor),items:items.map((item:any)=>{const {amount,...cost}=item;return {...cost,amountYuan:amount==null?null:decimal(amount)}})};
}
export function researchContextForAI(proposal:any){
 if(!proposal)return null;
 const {title,summary,content,question,kind,date,end,sources,missing,budget,expenseDraft}=proposal;
 return {title,summary,content,question,kind,date,end,sources,missing,amount_unit:'CNY_yuan',budgetYuan:budget==null?null:decimal(budget),expenseDraft:expenseDraftForAI(expenseDraft)};
}

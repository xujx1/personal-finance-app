import {minor,decimal} from '../domain/finance.mjs';
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function getFinancialContext(db:D1Database,state:any,today=localToday()){
 const month=today.slice(0,7),anchor=new Date(month+'-01T00:00:00Z');const months=[];
 for(let i=3;i>=1;i--){const d=new Date(anchor);d.setUTCMonth(d.getUTCMonth()-i);months.push(d.toISOString().slice(0,7));}
 const rows:any=await db.prepare("SELECT substr(business_date,1,7) AS month,SUM(CASE WHEN kind='INCOME' THEN total_minor ELSE 0 END) AS income,SUM(CASE WHEN kind='EXPENSE' THEN total_minor ELSE 0 END) AS expense,SUM(CASE WHEN kind='INCOME' THEN 1 ELSE 0 END) AS income_count,SUM(CASE WHEN kind='EXPENSE' THEN 1 ELSE 0 END) AS expense_count FROM transactions WHERE dataset_id=? AND status='POSTED' AND business_date>=? AND business_date<? AND kind IN('INCOME','EXPENSE') GROUP BY substr(business_date,1,7)").bind(state.book.active_dataset,months[0]+'-01',month+'-01').all();
 const profile=state.documents.find((d:any)=>d.kind==='financial_profile'&&d.id==='financial-profile')?.payload??{};
 const historyReady=profile.historyComplete===true&&months.every(m=>rows.results.some((r:any)=>r.month===m&&r.income_count>0&&r.expense_count>0));
 const avg=(field:string)=>{const n=rows.results.reduce((sum:number,r:any)=>sum+(r[field]??0),0);if(!Number.isSafeInteger(n))throw Error('历史金额超出精确计算范围');return Math.floor((n+1)/3);};
 const income=profile.monthlyIncomeMinor??(historyReady?avg('income'):null),living=profile.livingExpenseMinor??(historyReady?avg('expense'):null),emergency=profile.emergencyReserveMinor??null;
 const loans=state.accounts.filter((a:any)=>a.kind==='LIABILITY'&&!a.archived&&a.balance>0);
 let loanMonthly:number|null=0;for(const loan of loans){if(loan.currency!=='CNY'||loan.metadata?.monthly==null||loan.metadata.monthly===''){loanMonthly=null;break;}loanMonthly+=minor(String(loan.metadata.monthly));}
 const format=(n:number|null)=>n==null?'':decimal(n);
 return {inputs:{monthlyIncome:format(income),livingExpense:format(living),monthlyLoan:format(loanMonthly),emergencyReserve:format(emergency)},values:{monthlyIncome:income,livingExpense:living,monthlyLoan:loanMonthly,emergencyReserve:emergency},sources:{monthlyIncome:profile.monthlyIncomeMinor!=null?'已确认的全局月度规划':historyReady?'近3个完整月份已确认流水均值':'账本数据不足，尚未推定月收入',livingExpense:profile.livingExpenseMinor!=null?'已确认的全局月度规划':historyReady?'近3个完整月份已确认流水均值':'日常流水不足或尚未确认覆盖完整性',monthlyLoan:loanMonthly==null?'贷款账户缺少已确认月供':'贷款账户已记录月供',emergencyReserve:emergency==null?'尚未设置全局应急金目标':'全局规划设置'},months,historyReady,profile};
}

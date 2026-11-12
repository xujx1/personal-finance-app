import {MAX_MINOR} from './finance.mjs';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n)||Math.abs(n)>MAX_MINOR)throw Error('周期合计超出精确金额范围');return n;};
function scheduledDay(month,day){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!Number.isInteger(day)||day<1||day>31)throw Error('周期排期日期无效');const [y,m]=month.split('-').map(Number),d=new Date(0);d.setUTCFullYear(y,m,0);return month+'-'+String(Math.min(day,d.getUTCDate())).padStart(2,'0');}
/** Read-only monthly schedule. Captured occurrences take priority over changed templates. */
export function buildRecurringMonthSummary(state,month,asOf=today()){
 const rows=[],excluded=[],docs=state?.documents??[],rules=docs.filter(d=>d.kind==='recurring_rule'),byId=new Map(),isCurrent=month===asOf.slice(0,7);
 const fail=reason=>({available:false,month,isCurrent,reason,rows,excluded,incomeMinor:null,outflowMinor:null,pendingIncomeMinor:null,pendingOutflowMinor:null,pendingAccumulationMinor:null,pendingInvestmentMinor:null,postedCount:0,pendingCount:0,overdueCount:0});
 try{
  if(!validDay(asOf)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('周期汇总月份无效');
  const append=(id,r,scheduledDate,ruleId,status)=>{
   if(!validDay(scheduledDate)||!Number.isSafeInteger(r.amount)||r.amount<=0||r.amount>MAX_MINOR||!['income','expense','loan','investment'].includes(r.type))throw Error('周期资料不完整，金额或类型待核对');const account=(state.accounts??[]).find(a=>a.id===r.accountId);if(account?.currency!=='CNY')throw Error('周期现金账户缺失或不是人民币，不能合并预计积累');
   const loanAccount=r.type==='loan'?(state.accounts??[]).find(a=>a.id===r.loanId):null,covered=[account,loanAccount].some(a=>a?.metadata?.asOf&&scheduledDate<=a.metadata.asOf);const transaction=(state.transactions??[]).find(t=>t.metadata?.occurrenceId===id),frozen=(transaction?.metadata?.accountOwners??[]).find(o=>o.accountId===account.id),ownerId=frozen?.memberId??r.cashMemberId??account.metadata?.ownerMemberId,owner=(state.financeMembers??[]).find(m=>m.id===ownerId),row={id,ruleId,name:r.name??'周期事项',type:r.type,amountMinor:r.amount,scheduledDate,actualDate:status==='POSTED'?r.date:null,status:status==='POSTED'?'POSTED':status==='SKIPPED'?'SKIPPED':covered?'COVERED':scheduledDate<=asOf?'DUE':'UPCOMING',accountId:account.id,accountName:frozen?.accountName??account.name??'现金账户',memberName:frozen?.memberName??owner?.name??(ownerId==='family'?'家庭共用':ownerId&&ownerId!==account.metadata?.ownerMemberId?'原成员（待核对）':account.metadata?.ownerLabel??'归属待核对')};byId.set(id,row);
  };
  for(const d of docs.filter(d=>d.kind==='recurring_occurrence')){const r=d.payload,date=r.scheduledDate??/:(\d{4}-\d{2}-\d{2})$/.exec(d.id)?.[1]??r.date;if(date?.slice(0,7)===month){if(!['DUE','POSTED','SKIPPED'].includes(r.status))throw Error('周期记录状态待核对');append(d.id,r,date,r.ruleId,r.status);}}
  for(const d of rules){const r=d.payload,date=scheduledDay(month,r.day),id='occurrence:'+d.id+':'+date;if([...byId.values()].some(row=>row.ruleId===d.id))continue;if(!validDay(r.start)||r.end&&!validDay(r.end))throw Error('周期规则起止日期待核对');let reason='';if(r.paused)reason='已暂停';else if(r.end&&date>r.end)reason='已结束';else if(date<r.start)reason='首期尚未到';if(reason){excluded.push({id:d.id,name:r.name,start:r.start,end:r.end??null,reason});continue;}append(id,r,date,d.id,'PENDING');}
  rows.push(...[...byId.values()].sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate)||a.id.localeCompare(b.id)));
  let incomeMinor=0,outflowMinor=0,pendingIncomeMinor=0,pendingOutflowMinor=0,pendingInvestmentMinor=0,postedCount=0,pendingCount=0,overdueCount=0,coveredCount=0;
  for(const r of rows){if(r.status==='SKIPPED')continue;if(r.type==='income')incomeMinor=add(incomeMinor,r.amountMinor);else outflowMinor=add(outflowMinor,r.amountMinor);if(r.status==='POSTED'){postedCount++;continue;}if(r.status==='COVERED'){coveredCount++;continue;}pendingCount++;if(r.status==='DUE')overdueCount++;if(r.type==='income')pendingIncomeMinor=add(pendingIncomeMinor,r.amountMinor);else{pendingOutflowMinor=add(pendingOutflowMinor,r.amountMinor);if(r.type==='investment')pendingInvestmentMinor=add(pendingInvestmentMinor,r.amountMinor);}}
  const pendingAccumulationMinor=add(add(pendingIncomeMinor,-pendingOutflowMinor),pendingInvestmentMinor);
  return {available:true,month,isCurrent,reason:'',rows,excluded,incomeMinor,outflowMinor,pendingIncomeMinor,pendingOutflowMinor,pendingInvestmentMinor,pendingAccumulationMinor,postedCount,pendingCount,overdueCount,coveredCount};
 }catch(error){return fail(error instanceof Error?error.message:'周期计划待核对');}
}
export function withRecurringProjection(state,actual,target,asOf=today()){
 const recurring=buildRecurringMonthSummary(state,actual.month,asOf),basis='以已记录的人民币非房产资产积累，加本月未入账周期收入，减生活支出和还贷。定投内部转换不减少非房产资产；未记录生活费及未付款预算不在此预计数内。';
 const result={...actual,recurring,projectedChange:null,projectedGap:null,projectedProgress:null,projectionBasis:basis};
 if(!actual.available||!recurring.available||!recurring.isCurrent||!Number.isSafeInteger(actual.change))return result;
 try{const projectedChange=add(actual.change,recurring.pendingAccumulationMinor);return {...result,projectedChange,projectedGap:target==null?null:Math.max(0,add(target,-projectedChange)),projectedProgress:target==null?null:Math.min(100,Math.max(0,projectedChange/target*100))};}catch{return {...result,projectionBasis:'预计积累金额超出精确范围，请核对。'};}
}

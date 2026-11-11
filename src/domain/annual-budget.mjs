const todayLocal=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const money=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const add=(left,right)=>{const sum=BigInt(left)+BigInt(right);if(sum>BigInt(Number.MAX_SAFE_INTEGER)||sum<BigInt(Number.MIN_SAFE_INTEGER))throw Error('年度合计超出精确金额范围，请缩小核对范围');return Number(sum);};

export function annualBudgetOverview(state,year,asOf=todayLocal()){
 if(!Number.isInteger(year)||year<1||year>9998||!validDate(asOf))throw Error('请选择有效年度');
 const yearText=String(year).padStart(4,'0'),start=yearText+'-01-01',end=yearText+'-12-31';
 const documents=Array.isArray(state?.documents)?state.documents:[],planMap=new Map();
 for(const record of documents)if(record?.kind==='plan'&&typeof record.id==='string'&&record.payload&&typeof record.payload==='object')planMap.set(record.id,record.payload);
 const aggregate=state?.planCashflowTotals;
 let monthlyActualAvailable=aggregate?.complete===true&&aggregate.source==='posted_plan_transactions'&&Array.isArray(aggregate.rows),actualNotice='';
 let actualRows=[];
 if(monthlyActualAvailable){
  if(aggregate.rows.some(row=>!row||typeof row.planId!=='string'||!row.planId||typeof row.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)||!Number.isSafeInteger(row.paidMinor)||!Number.isSafeInteger(row.consumedMinor))){monthlyActualAvailable=false;actualNotice='月度付款与消费汇总需核对，未用部分记录代替';}
  else actualRows=aggregate.rows;
 }
 if(!monthlyActualAvailable&&!actualNotice)actualNotice='尚未取得完整月度计划付款与消费汇总；不按计划开始月份推测实际发生时间';
 const bucket=()=>({approvedBudgetMinor:0,candidateBudgetMinor:0,unknownBudgetCount:0,paidMinor:monthlyActualAvailable?0:null,consumedMinor:monthlyActualAvailable?0:null});
 const months=Array.from({length:12},(_,index)=>({month:yearText+'-'+String(index+1).padStart(2,'0'),...bucket()}));
 const categoryMap=new Map(),getCategory=name=>{if(!categoryMap.has(name))categoryMap.set(name,{category:name,...bucket()});return categoryMap.get(name);};
 const yearlyActuals=new Map(),years=new Set([Number(asOf.slice(0,4)),year]);
 for(const row of actualRows){
  years.add(Number(row.month.slice(0,4)));if(!row.month.startsWith(yearText+'-'))continue;
  const month=months[Number(row.month.slice(5))-1],payload=planMap.get(row.planId),category=payload?(typeof payload.category==='string'&&payload.category?payload.category:'其他'):'计划资料缺失',categoryTotal=getCategory(category);
  month.paidMinor=add(month.paidMinor,row.paidMinor);month.consumedMinor=add(month.consumedMinor,row.consumedMinor);
  categoryTotal.paidMinor=add(categoryTotal.paidMinor,row.paidMinor);categoryTotal.consumedMinor=add(categoryTotal.consumedMinor,row.consumedMinor);
  const prior=yearlyActuals.get(row.planId)??{paidMinor:0,consumedMinor:0};prior.paidMinor=add(prior.paidMinor,row.paidMinor);prior.consumedMinor=add(prior.consumedMinor,row.consumedMinor);yearlyActuals.set(row.planId,prior);
 }
 const lifetimeAvailable=Array.isArray(state?.planSummaries),lifetimeMap=new Map();
 for(const row of lifetimeAvailable?state.planSummaries:[])if(typeof row?.planId==='string')lifetimeMap.set(row.planId,row);
 const plans=[],unassignedPlans=[];
 for(const [id,payload] of planMap){
  const date=validDate(payload.date)?payload.date:null,endDate=validDate(payload.end)?payload.end:date;
  if(date)years.add(Number(date.slice(0,4)));if(endDate)years.add(Number(endDate.slice(0,4)));
  const approved=payload.budgetStatus==='APPROVED'&&payload.status!=='DRAFT',closed=['CANCELLED','COMPLETED'].includes(payload.status),cancelled=payload.status==='CANCELLED',budgetMinor=money(payload.budget);
  const category=typeof payload.category==='string'&&payload.category?payload.category:'其他',actual=yearlyActuals.get(id),totals=lifetimeMap.get(id);
  const paid=lifetimeAvailable?(totals===undefined?0:Number.isSafeInteger(totals.paid)?totals.paid:null):null;
  const consumed=lifetimeAvailable?(totals===undefined?0:Number.isSafeInteger(totals.consumed)?totals.consumed:null):null;
  const remainder=budgetMinor!==null&&paid!==null?Math.max(0,add(budgetMinor,-paid)):null;
  const remainingNeededMinor=closed||!approved?0:remainder,reservedMinor=!closed&&approved&&remainder!==null?Math.min(money(payload.reserved)??0,remainder):0;
  const row={id,name:typeof payload.name==='string'&&payload.name?payload.name:'未命名计划',category,date,end:endDate,status:payload.status??'DRAFT',approved,cancelled,closed,budgetMinor,lifetimePaidMinor:paid,lifetimeConsumedMinor:consumed,yearPaidMinor:monthlyActualAvailable?actual?.paidMinor??0:null,yearConsumedMinor:monthlyActualAvailable?actual?.consumedMinor??0:null,remainingNeededMinor,reservedMinor,suggestedReserveMinor:remainingNeededMinor===null?null:Math.max(0,remainingNeededMinor-reservedMinor),candidateRemainingMinor:!closed&&!approved?remainder:0};
  if(!date){unassignedPlans.push(row);if(!actual)continue;}
  const intersects=date&&date<=end&&endDate>=start;
  if(!intersects&&!actual)continue;
  plans.push(row);
  if(date?.startsWith(yearText+'-')&&!cancelled){
   const month=months[Number(date.slice(5,7))-1],categoryTotal=getCategory(category);
   for(const total of [month,categoryTotal]){
    if(budgetMinor===null)total.unknownBudgetCount++;
    else{const field=approved?'approvedBudgetMinor':'candidateBudgetMinor';total[field]=add(total[field],budgetMinor);}
   }
  }
 }
 const summary={...bucket(),remainingNeededMinor:0,reservedMinor:0,suggestedReserveMinor:0,unknownRemainingCount:0,candidateRemainingMinor:0,unassignedPlanCount:unassignedPlans.length};
 for(const month of months){for(const key of ['approvedBudgetMinor','candidateBudgetMinor','unknownBudgetCount'])summary[key]=add(summary[key],month[key]);if(monthlyActualAvailable){summary.paidMinor=add(summary.paidMinor,month.paidMinor);summary.consumedMinor=add(summary.consumedMinor,month.consumedMinor);}}
 const upcoming=plans.filter(row=>!row.closed&&row.date&&row.date<=end&&row.end>=start).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 for(const row of upcoming){
  if(row.approved){
   if(row.remainingNeededMinor===null)summary.unknownRemainingCount++;
   else{summary.remainingNeededMinor=add(summary.remainingNeededMinor,row.remainingNeededMinor);summary.reservedMinor=add(summary.reservedMinor,row.reservedMinor);summary.suggestedReserveMinor=add(summary.suggestedReserveMinor,row.suggestedReserveMinor);}
  }else if(row.candidateRemainingMinor!==null)summary.candidateRemainingMinor=add(summary.candidateRemainingMinor,row.candidateRemainingMinor);
 }
 return {year,years:[...years].filter(value=>value>=1&&value<=9998).sort((a,b)=>a-b),months,categories:[...categoryMap.values()].sort((a,b)=>a.category.localeCompare(b.category,'zh-CN')),plans,upcoming,unassignedPlans,summary,monthlyActualAvailable,actualNotice};
}

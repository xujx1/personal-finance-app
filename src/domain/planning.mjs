import {minor} from './finance.mjs';
import {buildBudgetFundingGoals} from './budget-funding.mjs';
/** @param {{principal:number,rate:string|number,months:number,prepayment?:number,payment?:number|null,mode?:string}} options */
export function mortgageSchedule({principal,rate,months,prepayment=0,payment=null,mode='reduce_payment'}){
 if(!['reduce_payment','reduce_term'].includes(mode)||payment!==null&&(!Number.isSafeInteger(payment)||payment<=0)||!Number.isSafeInteger(principal)||principal<0||!Number.isInteger(months)||months<1||months>600||!Number.isSafeInteger(prepayment)||prepayment<0||prepayment>principal||!/^\d+(\.\d{1,4})?$/.test(String(rate))||Number(rate)>50)throw Error('贷款测算参数无效');
 const r=Number(rate)/1200,remaining=principal-prepayment,annuity=p=>r?Math.round(p*r/(1-(1+r)**-months)):Math.ceil(p/months),pay=remaining===0?0:mode==='reduce_term'?(payment??annuity(principal)):annuity(remaining);
 let balance=remaining,total=0;const rows=[];for(let i=0;balance>0&&i<600;i++){const interest=Math.round(balance*r);if(pay<=interest)throw Error('月供不足以覆盖利息');const paidPrincipal=Math.min(balance,pay-interest);balance-=paidPrincipal;total+=interest;rows.push({month:i+1,payment:paidPrincipal+interest,principal:paidPrincipal,interest,balance})}if(balance>0)throw Error('超过600期仍未还清');return {rows,payment:pay,interest:total,prepayment,months:rows.length,disclaimer:'等额本息情景估算；利率变化、实际计息天数和提前还款费用以银行为准，不修改真实贷款'};
}
export function annualForecast(state,today,months=12){
 if(!validPlanningDate(today)||!Number.isInteger(months)||months<3||months>12)throw Error('预测区间无效');const funding=buildBudgetFundingGoals(state);let balance=funding.cash;const results=[];const start=new Date(today+'T00:00:00Z');
 for(let i=0;i<months;i++){const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1)),month=d.toISOString().slice(0,7);let income=0,fixed=0,planned=0,unknown=0,pending=0;
  for(const rule of state.documents.filter(d=>d.kind==='recurring_rule'&&!d.payload.paused)){const r=rule.payload,date=month+'-'+String(Math.min(r.day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate())).padStart(2,'0');if(date<today||date<r.start||r.end&&date>r.end||state.documents.some(x=>x.id==='occurrence:'+rule.id+':'+date&&x.payload.status==='POSTED'))continue;if(r.type==='income')income+=r.amount;else fixed+=r.amount}
  for(const p of state.documents.filter(d=>d.kind==='plan'&&!['CANCELLED','COMPLETED'].includes(d.payload.status))){const r=p.payload;if((r.date<today?today:r.date).slice(0,7)!==month)continue;if(r.budget==null)unknown++;else{const remaining=funding.plans.find(x=>x.id===p.id)?.remaining??0;planned+=remaining;if(r.budgetStatus!=='APPROVED')pending+=remaining;}}
  const opening=balance;balance+=income-fixed-planned;if(![balance,income,fixed,planned].every(Number.isSafeInteger))throw Error('预测金额超出精确计算范围');results.push({month,opening,income,fixed,planned,pending,closing:balance,unknown,negative:balance<0})
 }return results;
}
export function thresholdAlerts({levels,previous,current,sent=[]}){const valid=x=>typeof x==='string'&&/^\d+(\.\d+)?$/.test(x);if(!valid(current)||previous!==null&&!valid(previous)||!Array.isArray(levels)||levels.some(x=>!valid(x)))throw Error('阈值价格无效');const crossed=previous===null?[]:levels.filter(x=>Number(previous)<Number(x)&&Number(current)>=Number(x)&&!sent.includes(x));return {crossed,sent:[...new Set([...sent,...crossed])]}}


const planningToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validPlanningDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

export function loanSimulationDefaults(loan){
 const metadata=loan?.metadata??{},value=key=>metadata[key]==null?'':String(metadata[key]);
 const rate=value('rate'),monthly=value('monthly'),remaining=Number(metadata.remainingMonths);
 let payment='';try{if(/^\d+(\.\d{1,2})?$/.test(monthly)&&minor(monthly)>0)payment=monthly;}catch{}
 const recordedDate=key=>validPlanningDate(metadata[key])?metadata[key]:'';
 return {rate:/^\d+(\.\d{1,4})?$/.test(rate)&&Number(rate)<=50?rate:'',monthly:payment,months:Number.isInteger(remaining)&&remaining>=1&&remaining<=600?String(remaining):'',maturityDate:recordedDate('maturityDate'),repricingDate:recordedDate('repricingDate'),day:Number.isInteger(Number(metadata.day))&&Number(metadata.day)>=1&&Number(metadata.day)<=31?String(metadata.day):'',asOf:recordedDate('asOf')};
}

export function monthlyActualCashflow(state,months=12,asOf=planningToday()){
 const coverageNote='仅统计本站已过账现金账户分录，不代表完整银行对账单。开账/余额校正单列；已含余额的历史不重复记现金。';
 const unavailable=reason=>({available:false,reason,coverageNote,rows:[],byCurrency:{},currencies:['CNY'],foreignCurrencies:[]});
 if(!Number.isInteger(months)||months<1||months>12||!validPlanningDate(asOf))return unavailable('实际流水统计区间无效');
 const aggregate=state?.cashflowTotals;
 if(aggregate?.complete!==true||aggregate.source!=='posted_cash_entries'||!Array.isArray(aggregate.rows))return unavailable('尚未取得完整本站现金分录汇总；不使用最近300条流水推算月度结果');
 const monthNames=[];for(let index=months-1;index>=0;index--){const date=new Date(asOf.slice(0,7)+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()-index);monthNames.push(date.toISOString().slice(0,7));}
 const groups=new Map(),currencies=new Set(['CNY']);
 const fresh=(month,currency)=>({month,currency,incomeMinor:0,consumptionMinor:0,principalMinor:0,interestMinor:0,prepaymentMinor:0,investmentCashMinor:0,openingAdjustmentMinor:0,transferCashMinor:0,otherCashMinor:0,cashChangeMinor:0,cashSurplusMinor:0,count:0,hasRecords:false});
 try{
  for(const record of aggregate.rows){
   if(!record||!/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month)||!['CNY','USD'].includes(record.currency)||typeof record.kind!=='string'||!record.kind||!Number.isSafeInteger(record.cashDeltaMinor)||!Number.isSafeInteger(record.principalMinor)||record.principalMinor<0||!Number.isSafeInteger(record.interestMinor)||record.interestMinor<0||!Number.isSafeInteger(record.count)||record.count<0)throw Error('现金流水汇总含未知或不精确字段');
   if(!monthNames.includes(record.month))continue;
   currencies.add(record.currency);const key=record.month+':'+record.currency,row=groups.get(key)??fresh(record.month,record.currency),delta=record.cashDeltaMinor;
   row.count+=record.count;row.hasRecords=row.count>0;row.cashChangeMinor+=delta;
   if(record.kind==='INCOME')row.incomeMinor+=delta;
   else if(['EXPENSE','PAYMENT','REFUND'].includes(record.kind))row.consumptionMinor-=delta;
   else if(record.kind==='LOAN_PAYMENT'){
    if(-delta!==record.principalMinor+record.interestMinor)throw Error('还款现金与本金利息拆分不一致，需先核对');
    row.principalMinor+=record.principalMinor;row.interestMinor+=record.interestMinor;
   }else if(['PREPAYMENT','PREPAYMENT_REFUND'].includes(record.kind))row.prepaymentMinor-=delta;
   else if(['ASSET_BUY','ASSET_SALE'].includes(record.kind))row.investmentCashMinor+=delta;
   else if(['OPENING','ADJUSTMENT'].includes(record.kind))row.openingAdjustmentMinor+=delta;
   else if(record.kind==='TRANSFER')row.transferCashMinor+=delta;
   else row.otherCashMinor+=delta;
   row.cashSurplusMinor=row.incomeMinor-row.consumptionMinor-row.principalMinor-row.interestMinor-row.prepaymentMinor+row.investmentCashMinor+row.otherCashMinor;
   if(Object.entries(row).some(([name,value])=>(name.endsWith('Minor')||name==='count')&&!Number.isSafeInteger(value)))throw Error('月度金额超出精确计算范围');
   groups.set(key,row);
  }
 }catch(error){return unavailable(error instanceof Error?error.message:'现金流水汇总需核对');}
 const ordered=[...currencies].sort((a,b)=>a==='CNY'?-1:b==='CNY'?1:a.localeCompare(b));
 const byCurrency=Object.fromEntries(ordered.map(currency=>[currency,monthNames.map(month=>groups.get(month+':'+currency)??fresh(month,currency))]));
 return {available:true,reason:'',coverageNote,rows:byCurrency.CNY,byCurrency,currencies:ordered,foreignCurrencies:ordered.filter(currency=>currency!=='CNY')};
}

/** @param {{principal:number,rate:string|number,months:number,prepayment?:number,payment?:number|null,mode?:string}} input */
export function compareMortgageScenarios(input){
 const mode=input.mode??'reduce_payment',usedMonthly=mode==='reduce_term'&&input.payment!=null;
 const assumptions={...input,mode,payment:usedMonthly?input.payment:null};
 const base=mortgageSchedule({...assumptions,prepayment:0});
 const scenario=mortgageSchedule(assumptions);
 return {base,scenario,usedMonthly,mode};
}

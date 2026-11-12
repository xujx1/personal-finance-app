import {minor} from './finance.mjs';
// Suggestions are derived views of verified account terms, never journal entries.
export function recurringSetupSuggestions(state,start){
 const rules=(state.documents??[]).filter(d=>d.kind==='recurring_rule');
 return (state.accounts??[]).filter(a=>!a.archived&&a.kind==='LIABILITY'&&a.category==='loan'&&a.currency==='CNY'&&!rules.some(r=>r.payload.loanId===a.id)).map(a=>{
  const m=a.metadata??{};let amount=null;try{const n=minor(String(m.monthly??''));if(n>0)amount=n;}catch{}
  const day=Number.isInteger(Number(m.day))&&Number(m.day)>=1&&Number(m.day)<=31?Number(m.day):'';
  const missing=['扣款现金账户','每期实际本金（到账后逐期核实）',...(amount===null?['每期还款额']:[]),...(!day?['扣款日']:[])];
  return {id:'setup:'+a.id,missing,payload:{name:a.name+'每月还款',type:'loan',loanId:a.id,accountId:'',amount,principal:null,day,start,end:null,autoPost:false,paused:false}};
 });
}

// The summary describes this month's scheduled occurrences, including ones
// already due, rather than every unpaused template across all future months.
export function recurringMonthPlan(rules,month){
 const [year,m]=month.split('-').map(Number),date=new Date(0);date.setUTCFullYear(year,m,0);
 const last=date.getUTCDate();
 const active=rules.filter(rule=>{const r=rule.payload,day=month+'-'+String(Math.min(r.day,last)).padStart(2,'0');return !r.paused&&day>=r.start&&(!r.end||day<=r.end)});
 return {active,income:active.filter(r=>r.payload.type==='income').reduce((n,r)=>n+r.payload.amount,0),outflow:active.filter(r=>r.payload.type!=='income').reduce((n,r)=>n+r.payload.amount,0)};
}

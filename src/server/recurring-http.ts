import {retiredAIResponse} from './retired-ai.ts';
import {snapshot} from './finance-store.ts';
import {accountMember} from '../domain/member-ownership.mjs';
const nextScheduledDate=(base:string,day:number)=>{let [year,month]=base.slice(0,7).split('-').map(Number);for(let i=0;i<2;i++){const value=String(year)+'-'+String(month).padStart(2,'0')+'-'+String(Math.min(day,new Date(Date.UTC(year,month,0)).getUTCDate())).padStart(2,'0');if(value>base)return value;if(++month>12){year++;month=1}}throw Error('周期日期无效')};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
// Full posted history is intentionally queried independently of the 300-row UI page.
export async function suggestRecurring(db:any){
 const state=await snapshot(db),ds=state.book.active_dataset;
 const history=await db.prepare("SELECT id,kind,business_date,total_minor,metadata FROM transactions WHERE dataset_id=? AND status='POSTED' AND kind IN('INCOME','EXPENSE','PAYMENT') ORDER BY business_date,id").bind(ds).all();
 const groups=new Map<string,any[]>();
 for(const t of history.results){const m=JSON.parse(t.metadata);if(m.fromPrepayment||m.ruleId)continue;const a=state.accounts.find((a:any)=>a.id===m.accountId&&!a.archived&&a.category==='cash'&&a.currency==='CNY');if(!a||!Number.isSafeInteger(t.total_minor)||t.total_minor<=0)continue;
  const frozen=m.accountOwners??state.documents.find((d:any)=>d.kind==='transaction_ownership'&&d.id==='transaction-ownership:'+t.id)?.payload.accountOwners;const owner=frozen?.find((o:any)=>o.accountId===a.id)?.memberId??accountMember(a,state).id;if(owner==='unknown'||owner!==accountMember(a,state).id)continue;
  const type=t.kind==='INCOME'?'income':'expense',note=String(m.note??'').trim().slice(0,300);if(!note)continue;const key=JSON.stringify([a.id,owner,type,note.replace(/20\d{2}(?:[-/.]\d{1,2}(?:[-/.]\d{1,2})?|年\d{1,2}月(?:\d{1,2}日)?)/g,'').replace(/\s+/g,'').toLowerCase()]);const rows=groups.get(key)??[];rows.push({transactionId:t.id,date:t.business_date,amountMinor:t.total_minor,note,accountId:a.id,cashMemberId:owner,type});groups.set(key,rows);
 }
 const candidates:any[]=[];
 for(const rows of groups.values()){
  // Similar amounts/days are reviewed as separate patterns, never pooled across owners/accounts.
  const clusters:any[][]=[];for(const row of rows){const cluster=clusters.find(c=>Math.abs(c[0].amountMinor-row.amountMinor)<=Math.max(100,c[0].amountMinor*.1)&&Math.abs(Number(c[0].date.slice(8))-Number(row.date.slice(8)))<=3);if(cluster)cluster.push(row);else clusters.push([row])}
  for(const c of clusters){const months=[...new Set(c.map(r=>r.date.slice(0,7)))];if(months.length<2||c.length!==months.length)continue;const sorted=c.map(r=>r.amountMinor).sort((a,b)=>a-b),amount=sorted[Math.floor(sorted.length/2)],days=c.map(r=>Number(r.date.slice(8))).sort((a,b)=>a-b),day=days[Math.floor(days.length/2)],first=c[0];
   if(state.documents.some((d:any)=>d.kind==='recurring_rule'&&d.payload.type===first.type&&d.payload.accountId===first.accountId&&(!d.payload.cashMemberId||d.payload.cashMemberId===first.cashMemberId)&&Math.abs(d.payload.amount-amount)<=Math.max(100,amount*.1)&&Math.abs(d.payload.day-day)<=3))continue;
   candidates.push({id:'history:'+first.transactionId,name:first.note,type:first.type,accountId:first.accountId,cashMemberId:first.cashMemberId,amount,day,start:nextScheduledDate([today(),c.at(-1).date].sort().at(-1)!,day),autoPost:false,evidence:c.map(({transactionId,date,amountMinor,note})=>({transactionId,date,amountMinor,note})),months:months.length,confidence:months.length>=3?'较高':'待核对'});
  }
 }
 const latest=await snapshot(db);if(latest.book.revision!==state.book.revision)throw Error('CONFLICT:账本已变化，请重试');return {candidates,source:'posted_history',complete:true,reviewRequired:true,message:candidates.length?'根据完整历史相近日期和金额归并，仅为候选；请核对后保存，不会自动扣账':'完整历史中暂无足够多月的周期候选'};
}
export function createRecurringHandlers(deps:any){const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});return {
 async GET(){try{if(!await deps.getUser())return json({error:'请先登录'},401);const db=deps.getDb();if(!db)return json({error:'数据库尚未配置'},503);return json(await suggestRecurring(db))}catch(e:any){return json({error:String(e.message).slice(0,180)},String(e.message).startsWith('CONFLICT:')?409:403)}},
 async POST(_req:Request){if(!await deps.getUser())return json({error:'请先登录'},401);return retiredAIResponse();}
 };}

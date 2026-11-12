import {minor,decimal} from './finance.mjs';
import {consumptionTypeOf,dateInRange} from './consumption.mjs';
const localDay=timestamp=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
export function researchRecordDate(record){
 const p=record?.payload??record??{};
 for(const field of ['acceptedAt','createdAt','generatedAt']){
  const value=p[field];if(value==null||value==='')continue;
  const timestamp=typeof value==='number'?value:Date.parse(value);
  if(!Number.isFinite(timestamp)||typeof value==='string'&&!dateInRange(value.slice(0,10),null,'',''))continue;
  try{return {date:localDay(timestamp),label:field==='generatedAt'?'评估时间':'保存时间',timestamp};}catch{}
 }
 if(p.date&&dateInRange(p.date,null,'',''))return {date:p.date,label:'计划日期',timestamp:Date.parse(p.date+'T00:00:00Z')};
 return {date:null,label:'时间未记录',timestamp:null};
}
/** Accepted draft snapshots retain each reviewed version, independently of later plan edits. */
export function researchRecords(state){
 const docs=state?.documents??[],records=docs.filter(d=>['investment_review','research_proposal','advice'].includes(d.kind)),seen=new Set();
 const snapshots=docs.filter(d=>d.kind==='financial_draft'&&d.payload.kind==='budget'&&d.payload.status==='ACCEPTED'&&d.payload.reviewedPayload&&typeof d.payload.reviewedPayload==='object'&&!Array.isArray(d.payload.reviewedPayload)&&!records.some(r=>r.payload.mcpDraftId===d.id)).filter(d=>{if(seen.has(d.id))return false;seen.add(d.id);return true;}).map(d=>{
  const p=structuredClone(d.payload.reviewedPayload);
  return {id:'draft-research:'+d.id,kind:'budget_research',sourceDraftId:d.id,sourcePlanId:d.payload.destinationId??null,readOnly:true,payload:{...p,title:p.name,summary:p.analysis??p.note??'',content:p.analysis??p.note??'',...(d.payload.acceptedAt?{acceptedAt:d.payload.acceptedAt}:{})}};
 });
 const projections=docs.filter(d=>d.kind==='plan'&&d.payload.mcpDraftId&&d.payload.externalAnalysis===true&&!snapshots.some(r=>r.sourceDraftId===d.payload.mcpDraftId||r.sourcePlanId===d.id)&&!records.some(r=>r.id===d.payload.adviceId||r.id===d.payload.proposalId||r.payload.planId===d.id||r.payload.mcpDraftId===d.payload.mcpDraftId)).map(d=>{
  const p=structuredClone(d.payload),saved=docs.find(r=>r.id===p.mcpDraftId&&r.kind==='financial_draft'&&r.payload.kind==='budget'&&r.payload.status==='ACCEPTED'&&r.payload.destinationId===d.id)?.payload;
  return {id:'plan-research:'+d.id,kind:'plan_research',sourceDraftId:p.mcpDraftId,sourcePlanId:d.id,readOnly:true,payload:{...p,title:p.name,summary:p.analysis??p.note??'',content:p.analysis??p.note??'',...(saved?.acceptedAt?{acceptedAt:saved.acceptedAt}:{})}};
 });
 return [...records,...snapshots,...projections].sort((a,b)=>(researchRecordDate(b).timestamp??-Infinity)-(researchRecordDate(a).timestamp??-Infinity)||a.id.localeCompare(b.id));
}
export function filterResearchRecords(records,{query='',kind='all',from='',to=''}={}){
 const needle=query.trim().toLocaleLowerCase();return records.filter(d=>{
  const p=d.payload,when=researchRecordDate(d).date;
  return (kind==='all'||consumptionTypeOf(d)===kind)&&dateInRange(when,null,from,to)&&(!needle||JSON.stringify([d.id,p.title,p.summary,p.inputs?.question,p.content,p.analysis]).toLocaleLowerCase().includes(needle));
 });
}

/** Presentation facts only: original prose remains untouched and never becomes a money source. */
export function budgetResearchFacts(payload){
 if(!payload)return null;
 let amount=null;
 // Saved plan budgets are integer minor units; editable draft totals come from their current items.
 if(typeof payload.budget==='number'&&Number.isSafeInteger(payload.budget))amount=decimal(payload.budget);
 if(amount===null&&Array.isArray(payload.expenseDraft?.items)&&payload.expenseDraft.items.length){
  try{const total=payload.expenseDraft.items.filter(x=>x.selected!==false).reduce((sum,x)=>{const price=x.unitPrice!=null?minor(String(x.unitPrice)):x.amount;const quantity=String(x.quantity??'1');if(!/^\d+(\.\d{1,4})?$/.test(quantity))throw Error('invalid quantity');const [whole,fraction='']=quantity.split('.'),q=BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0'));return sum+Number((BigInt(price)*q+5000n)/10000n);},0);if(Number.isSafeInteger(total))amount=decimal(total);}catch{}
 }
 if(amount===null&&payload.budget!=null&&payload.budget!==''){try{amount=decimal(minor(String(payload.budget)))}catch{}}
 const itinerary=payload.expenseDraft?.itinerary??payload.itinerary??[];
 return {amount,name:payload.name??payload.title??'',date:payload.date??'',end:payload.end??payload.tripEnd??payload.date??'',items:payload.expenseDraft?.items?.length??0,itinerary:itinerary.length,signature:JSON.stringify([amount,payload.name??payload.title??'',payload.date??'',payload.end??payload.tripEnd??payload.date??'',(payload.expenseDraft?.items??[]).map(x=>[x.id,x.name,x.quantity,x.unitPrice,x.selected!==false,x.itineraryId,x.merchant]),itinerary.map(x=>[x.id,x.date,x.time,x.title,x.location])])};
}
export function historicalAnalysisFacts({original,reviewed,current}={}){
 const a=budgetResearchFacts(original??reviewed),b=budgetResearchFacts(reviewed??original),c=budgetResearchFacts(current);
 return {original:a,reviewed:b,current:c,reviewChanged:Boolean(a&&b&&a.signature!==b.signature),currentChanged:Boolean(b&&c&&b.signature!==c.signature)};
}
export function researchFactSummary(record,state){
 const p=record?.payload??{},docs=state?.documents??[];
 const draft=docs.find(d=>d.kind==='financial_draft'&&d.id===(record.sourceDraftId??p.mcpDraftId));
 const plan=docs.find(d=>d.kind==='plan'&&(d.id===(record.sourcePlanId??p.planId)||d.payload.adviceId===record.id||d.payload.proposalId===record.id));
 return historicalAnalysisFacts({original:draft?.payload?.payload??p,reviewed:draft?.payload?.reviewedPayload??p,current:plan?.payload});
}

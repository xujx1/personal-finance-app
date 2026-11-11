import {canonicalBudgetText} from '../domain/rich-text.mjs';
import {normalizeProposal} from '../domain/research.mjs';
import {decimal} from '../domain/finance.mjs';
const string={type:'string'},array=(items,extra={})=>({type:'array',items,...extra}),object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function researchSchema(input,sources){
 const urls=sources.map(s=>s.url),url={type:'string',...(urls.length?{enum:urls}:{})};
 const priceFields={merchant:string,checkedAt:{type:['string','null']},priceEvidence:{type:['string','null']}};
 const candidate=object({...priceFields,unitPrice:string,sourceUrl:{type:['string','null'],enum:[null,...urls]},sourceType:{type:'string',enum:['scenario_estimate','user_quote','retrieved_reference']}});
 const expense=object({...priceFields,alternatives:array(candidate,{maxItems:8}),name:string,category:string,quantity:string,unitPrice:string,selected:{type:'boolean'},sourceUrl:{type:['string','null'],enum:[null,...urls]},sourceType:{type:'string',enum:['scenario_estimate','user_quote','retrieved_reference']},note:string});
 const days=[];if(input.date&&input.end)for(let n=Date.parse(input.date);Number.isFinite(n)&&n<=Date.parse(input.end)&&days.length<366;n+=86400000)days.push(new Date(n).toISOString().slice(0,10));
 const activity=object({date:{type:'string',...(days.length?{enum:days}:{})},time:string,title:string,notes:string,expenses:array(expense)});
 const comparison=object({title:string,merchant:string,version:string,price:{type:['string','null']},shipping:string,url,priceEvidence:{type:['string','null']},checkedAt:{type:['string','null']},comparability:{type:'string',enum:['same_sku','different_spec','unverified']},note:string});
 return object({content:string,title:string,summary:string,budget:{type:['string','null']},missing_inputs:array(string),sources:array(url,{...(urls.length?{}:{maxItems:0})}),expenseDraft:input.kind==='wealth'?{type:'null'}:object({kind:{type:'string',enum:[input.kind]},reviewed:{type:'boolean',enum:[false]},items:array(expense),itinerary:array(activity),comparisons:array(comparison,{...(urls.length?{}:{maxItems:0})})})});
}
export function researchProposal(answer,input,sources){
 let draft=answer.expenseDraft;
 if(draft&&input.kind!=='wealth'){
  const items=(draft.items??[]).map((x,i)=>({...x,id:x.id??'cost-'+i}));
  const itinerary=(draft.itinerary??[]).map((a,i)=>{const id=a.id??'activity-'+i;for(const [j,cost]of(a.expenses??[]).entries())items.push({...cost,id:id+'-cost-'+j,itineraryId:id});const {expenses,...activity}=a;return {...activity,id}});
  const verify=x=>{
   const source=sources.find(s=>s.url===x.sourceUrl),excerpt=typeof x.priceEvidence==='string'?x.priceEvidence.trim():'';
   const amount=Number(x.unitPrice),hasPrice=/(?:[¥￥]|人民币|CNY|RMB|元)/i.test(excerpt)&&!/(?:美元|美金|港元|港币|日元|欧元|USD|HKD|JPY|EUR|\$)/i.test(excerpt)&&(excerpt.match(/\d+(?:\.\d+)?/g)??[]).some(token=>Number(token)===amount);
   const trusted=x.sourceType==='retrieved_reference'&&source?.checked_at&&excerpt.length>=6&&source.snippet?.includes(excerpt)&&(!x.merchant||source.snippet.includes(x.merchant))&&hasPrice;
   return {...x,...(x.sourceType==='retrieved_reference'?{sourceType:trusted?'retrieved_reference':'scenario_estimate',checkedAt:trusted?source.checked_at:null,priceEvidence:trusted?excerpt:null}:{}),...(x.alternatives?{alternatives:x.alternatives.map(verify)}:{})};
  };
  const comparisons=(draft.comparisons??[]).map(x=>{const source=sources.find(s=>s.url===x.url),checked=verify({...x,sourceType:'retrieved_reference',sourceUrl:x.url,unitPrice:x.price});const trusted=x.price!=null&&checked.sourceType==='retrieved_reference';return {...x,price:trusted?x.price:null,checkedAt:source?.checked_at??null,priceEvidence:trusted?checked.priceEvidence:null,comparability:trusted?x.comparability:'unverified'}});
  draft={...draft,kind:input.kind,reviewed:false,items:items.map(verify),itinerary,comparisons};
 }
 const cited=new Set((Array.isArray(answer.sources)?answer.sources:[]).map(x=>typeof x==='string'?x:x?.url));
 for(const item of draft?.items??[]){if(item.sourceUrl)cited.add(item.sourceUrl);for(const alternative of item.alternatives??[])if(alternative.sourceUrl)cited.add(alternative.sourceUrl);}for(const c of draft?.comparisons??[])if(c.url)cited.add(c.url);
 const used=sources.filter(s=>cited.has(s.url)).map(({snippet,...s})=>s);
 const p={question:input.question,kind:input.kind,title:answer.title,summary:answer.summary,content:answer.content,budget:input.kind==='wealth'?null:answer.budget,date:input.date??null,end:input.end??null,sources:used,...(draft&&input.kind!=='wealth'?{expenseDraft:draft}:{})};
 const checked=normalizeProposal(p);if(checked.expenseDraft?.itinerary.some(x=>p.date&&x.date<p.date||p.end&&x.date>p.end))throw Error('行程日期必须在出游日期内');
 return {...p,...(checked.expenseDraft?{content:canonicalBudgetText(p.content,checked.budget),summary:canonicalBudgetText(p.summary,checked.budget)}:{}),budget:checked.budget===null?null:decimal(checked.budget),...(checked.expenseDraft?{expenseDraft:checked.expenseDraft}:{})};
}
export function researchValidationCode(error){
 const m=String(error?.message??'');if(error?.name==='SyntaxError')return 'JSON_INVALID';if(/来源|引用|HTTPS/.test(m))return 'SOURCE_INVALID';if(/行程|日期/.test(m))return 'ITINERARY_INVALID';if(/金额|数量|预算/.test(m))return 'AMOUNT_INVALID';if(/清单/.test(m))return 'DRAFT_INVALID';if(/文字/.test(m))return 'TEXT_INVALID';return 'OUTPUT_INVALID';
}

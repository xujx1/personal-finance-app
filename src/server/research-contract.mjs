import {normalizeProposal} from '../domain/research.mjs';
import {decimal,minor} from '../domain/finance.mjs';
const string={type:'string'},array=(items,extra={})=>({type:'array',items,...extra}),object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function researchSchema(input,sources){
 const urls=sources.map(s=>s.url),url={type:'string',...(urls.length?{enum:urls}:{})};
 const grouped=['travel','dining'].includes(input.kind);
 const priceFields={merchant:string,checkedAt:{type:['string','null']},priceEvidence:{type:['string','null']}};
 const candidate=object({name:string,version:string,note:string,...priceFields,unitPrice:string,sourceUrl:{type:['string','null'],enum:[null,...urls]},sourceType:{type:'string',enum:['scenario_estimate','user_quote','retrieved_reference']}});
 const expenseFields={...priceFields,version:string,alternatives:array(candidate,{maxItems:8}),name:string,category:string,quantity:string,unitPrice:string,selected:{type:'boolean'},sourceUrl:{type:['string','null'],enum:[null,...urls]},sourceType:{type:'string',enum:['scenario_estimate','user_quote','retrieved_reference']},note:string};
 const expense=object({scope:{type:'string',enum:grouped?['activity']:['whole_plan']},...expenseFields});
 const wholePlanExpense=object({scope:{type:'string',enum:['whole_plan']},...expenseFields});
 const days=[];if(input.date&&input.end)for(let n=Date.parse(input.date);Number.isFinite(n)&&n<=Date.parse(input.end)&&days.length<366;n+=86400000)days.push(new Date(n).toISOString().slice(0,10));
 const activity=object({date:{type:'string',...(days.length?{enum:days}:{})},time:string,title:string,notes:string,expenses:array(expense,grouped?{}:{maxItems:0})});
 const comparison=object({title:string,merchant:string,version:string,price:{type:['string','null']},shipping:string,url,priceEvidence:{type:['string','null']},checkedAt:{type:['string','null']},comparability:{type:'string',enum:['same_sku','different_spec','unverified']},note:string});
 return object({content:string,title:string,summary:string,budget:input.kind==='wealth'?{type:'null'}:string,missing_inputs:array(string),sources:array(url,{...(urls.length?{}:{maxItems:0})}),expenseDraft:input.kind==='wealth'?{type:'null'}:object({kind:{type:'string',enum:[input.kind]},reviewed:{type:'boolean',enum:[false]},items:array(expense,grouped?{maxItems:0}:{}),...(grouped?{wholePlanExpenses:array(wholePlanExpense,{maxItems:50})}:{}),itinerary:array(activity,grouped?{minItems:1}:{maxItems:0}),comparisons:array(comparison,{...(urls.length?{}:{maxItems:0})})})});
}
function structureError(field='draft_structure',message='费用清单结构无效，请按完整输出结构重新生成'){throw Object.assign(Error(message),{validationField:field});}
function validateGeneratedShape(value,schema,field='draft_structure'){
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 const type=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(!types.includes(type))structureError(field);
 if(schema.enum&&!schema.enum.includes(value))structureError(field,field==='source_url'?'清单来源不符合实际检索来源':field==='activity_date'?'行程日期不符合已知范围':'费用归属范围或结构字段无效');
 if(type==='object'){
  for(const key of Object.keys(value))if(!Object.hasOwn(schema.properties??{},key))structureError('unexpected_field','费用清单含未支持字段，不能静默丢弃费用');
  for(const key of schema.required??[])if(!Object.hasOwn(value,key))structureError(key==='wholePlanExpenses'?'whole_plan_expenses':field,key==='scope'?'费用归属范围缺失':'费用清单结构无效，请按完整输出结构重新生成');
  for(const [key,child]of Object.entries(schema.properties??{}))if(Object.hasOwn(value,key))validateGeneratedShape(value[key],child,key==='date'?'activity_date':['sourceUrl','url'].includes(key)?'source_url':key==='wholePlanExpenses'?'whole_plan_expenses':key==='expenses'?'activity_expenses':field);
 }
 if(type==='array'){
  if(schema.minItems!=null&&value.length<schema.minItems||schema.maxItems!=null&&value.length>schema.maxItems)structureError(field);
  for(const item of value)validateGeneratedShape(item,schema.items,field);
 }
}
function assertDeclaredTotals(answer,total){
 if(typeof answer.budget!=='string')structureError('declared_total','费用清单缺少明确声明总额');
 let declared;try{declared=minor(answer.budget)}catch{structureError('declared_total','费用声明总额格式无效')}
 if(declared!==total)structureError('declared_total','费用清单合计与声明总额不一致，不能静默覆盖或丢弃费用');
 const labels=/(?:当前各项估算合计|各项估算合计|本次估算总额|本稿费用合计|总预算|预算合计|费用合计|总费用|合计预算)([^\d\n]{0,12})(\d[\d,]*(?:\.\d{1,2})?)\s*(?:元|人民币|CNY|RMB)/g;
 for(const text of [answer.content,answer.summary])for(const match of String(text??'').matchAll(labels)){
  const before=String(text??'').slice(Math.max(0,match.index-12),match.index);
  if(/不超过|不得超过|上限|下限|限额|目标|历史|原来|最高|最多|控制在/.test(match[1])||/(?:历史|原|此前|已批|已批准|目标)\s*$/.test(before))continue;
  if(minor(match[2].replace(/,/g,''))!==total)structureError('declared_total','正文费用合计与费用清单不一致，不能静默覆盖费用');
 }
}
export function researchProposal(answer,input,sources){
 let draft=answer.expenseDraft;
 const consumptionRequest=input.kind!=='wealth';
 if(consumptionRequest){
  for(const key of Object.keys(answer))if(!['content','title','summary','budget','missing_inputs','sources','expenseDraft'].includes(key))structureError('unexpected_field','研究输出含未支持字段，不能静默丢弃费用');
  validateGeneratedShape(draft,researchSchema(input,sources).properties.expenseDraft);
 }
 if(draft&&input.kind!=='wealth'){
  const rawItems=draft.items??[],rawItinerary=draft.itinerary??[],grouped=['travel','dining'].includes(input.kind);
  const hasNested=rawItinerary.some(activity=>(activity.expenses??[]).length>0);
  if(rawItems.length&&hasNested)throw Error('费用结构重复：全程清单与行程费用不能同时计价，请重新生成方案');
  if(grouped&&rawItems.length)throw Error('旅行与餐饮费用须放在对应安排内，不能使用独立计价清单，请重新生成方案');
  if(!grouped&&rawItinerary.length)throw Error('购物费用使用平面清单，不得生成行程费用');
  const itinerary=rawItinerary.map((activity,i)=>{const {expenses,id,...rest}=activity;return {...rest,id:'activity-'+i}});
  const wholePlanExpenses=grouped?draft.wholePlanExpenses:[];
  const items=rawItems.map((item,i)=>{const {activityIndex,itineraryId,id,scope,...cost}=item;return {...cost,id:'cost-'+i,scope:'whole_plan',itineraryId:null}});
  if(grouped)for(const [i,activity]of rawItinerary.entries())for(const [j,rawCost]of(activity.expenses??[]).entries()){
   const {activityIndex,itineraryId,id,...cost}=rawCost;
   if(cost.scope!=='activity')throw Error('费用归属范围无效，请明确对应安排或整项费用');
   items.push({...cost,id:itinerary[i].id+'-cost-'+j,itineraryId:itinerary[i].id});
  }
  if(grouped)for(const [index,cost]of wholePlanExpenses.entries())items.push({...cost,id:'whole-plan-cost-'+index,itineraryId:null,scope:'whole_plan'});
  const verify=x=>{
   const source=sources.find(s=>s.url===x.sourceUrl),excerpt=typeof x.priceEvidence==='string'?x.priceEvidence.trim():'';
   const amount=Number(x.unitPrice),hasPrice=/(?:[¥￥]|人民币|CNY|RMB|元)/i.test(excerpt)&&!/(?:美元|美金|港元|港币|日元|欧元|USD|HKD|JPY|EUR|\$)/i.test(excerpt)&&(excerpt.match(/\d+(?:\.\d+)?/g)??[]).some(token=>Number(token)===amount);
   const trusted=x.sourceType==='retrieved_reference'&&source?.checked_at&&excerpt.length>=6&&source.snippet?.includes(excerpt)&&(!x.merchant||source.snippet.includes(x.merchant))&&hasPrice;
   return {...x,...(x.sourceType==='retrieved_reference'?{sourceType:trusted?'retrieved_reference':'scenario_estimate',checkedAt:trusted?source.checked_at:null,priceEvidence:trusted?excerpt:null}:{}),...(x.alternatives?{alternatives:x.alternatives.map(verify)}:{})};
  };
  const comparisons=(draft.comparisons??[]).map(x=>{const source=sources.find(s=>s.url===x.url),checked=verify({...x,sourceType:'retrieved_reference',sourceUrl:x.url,unitPrice:x.price});const trusted=x.price!=null&&checked.sourceType==='retrieved_reference';return {...x,price:trusted?x.price:null,checkedAt:source?.checked_at??null,priceEvidence:trusted?checked.priceEvidence:null,comparability:trusted?x.comparability:'unverified'}});
  draft={...draft,costContract:grouped?'nested_activity_v3':'flat_items_v2',kind:input.kind,reviewed:false,items:items.map(verify),itinerary,comparisons};
 }
 const cited=new Set((Array.isArray(answer.sources)?answer.sources:[]).map(x=>typeof x==='string'?x:x?.url));
 for(const item of draft?.items??[]){if(item.sourceUrl)cited.add(item.sourceUrl);for(const alternative of item.alternatives??[])if(alternative.sourceUrl)cited.add(alternative.sourceUrl);}for(const c of draft?.comparisons??[])if(c.url)cited.add(c.url);
 const used=sources.filter(s=>cited.has(s.url)).map(({snippet,...s})=>s);
 const p={question:input.question,kind:input.kind,title:answer.title,summary:answer.summary,content:answer.content,budget:input.kind==='wealth'?null:answer.budget,date:input.date??null,end:input.end??null,sources:used,...(draft&&input.kind!=='wealth'?{expenseDraft:draft}:{})};
 const checked=normalizeProposal(p);if(checked.expenseDraft?.itinerary.some(x=>p.date&&x.date<p.date||p.end&&x.date>p.end))throw Error('行程日期必须在出游日期内');
 if(consumptionRequest)try{assertDeclaredTotals(answer,checked.budget)}catch(error){
  // A retry is eligible only after the full draft and its dates have passed validation.
  let declaredValid=false;try{declaredValid=typeof answer.budget==='string'&&Number.isSafeInteger(minor(answer.budget))}catch{}
  if(error?.validationField==='declared_total'&&declaredValid&&Number.isSafeInteger(checked.budget))Object.defineProperty(error,'costReview',{value:{canonicalTotalYuan:decimal(checked.budget)}});
  throw error;
 }
 return {...p,budget:checked.budget===null?null:decimal(checked.budget),...(checked.expenseDraft?{expenseDraft:checked.expenseDraft}:{})};
}
export function researchValidationCode(error){
 if(error?.validationField==='declared_total')return 'COST_TOTAL_MISMATCH';
 if(['unexpected_field','whole_plan_expenses','activity_expenses','draft_structure','cost_preservation'].includes(error?.validationField))return 'COST_STRUCTURE_INVALID';
 const m=String(error?.message??'');if(error?.name==='SyntaxError')return 'JSON_INVALID';if(/来源|引用|HTTPS/.test(m))return 'SOURCE_INVALID';if(/行程|日期/.test(m))return 'ITINERARY_INVALID';if(/金额|数量|预算/.test(m))return 'AMOUNT_INVALID';if(/清单/.test(m))return 'DRAFT_INVALID';if(/文字/.test(m))return 'TEXT_INVALID';return 'OUTPUT_INVALID';
}

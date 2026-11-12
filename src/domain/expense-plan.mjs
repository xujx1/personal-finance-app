import {normalizeActivityImages} from './activity-images.mjs';
import {normalizePricing,validateItineraryWindow} from './executable-costs.mjs';
import {cleanItineraryNotes} from './trip-details.mjs';
import {minor,decimal} from './finance.mjs';
const text=(v,max=300,validationField='draft_text')=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Object.assign(Error('清单文字无效'),{validationField});return v.trim()};
const date=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||Number.isNaN(Date.parse(x))||new Date(x).toISOString().slice(0,10)!==x)throw Error('行程日期无效');return x};
export function classifyExpense(question,override='auto'){if(['travel','shopping','dining','general'].includes(override))return {kind:override,source:'本人调整'};const s=String(question??'');const kind=/旅行|旅游|亲子游|自驾游|机票|火车票|高铁|行程|出游|酒店预订/.test(s)?'travel':/餐饮|梭子蟹|海鲜|菜单|做饭|买菜|聚餐|一顿饭|食材/.test(s)?'dining':/购物|商品|游戏卡|京东|淘宝|拼多多|item\..*\.com|买.*(电脑|显示器|屏幕|手机|汽车|家电|卡带)|switch|比价/i.test(s)?'shopping':'general';return {kind,source:kind==='general'?'待AI复核':'关键词预识别，生成时由AI复核'}}
export function normalizeExpenseDraft(p,{requireReview=true}={}){
 if(!p||!['travel','shopping','dining','general'].includes(p.kind)||requireReview&&p.reviewed!==true||!Array.isArray(p.items)||!p.items.length||p.items.length>50)throw Object.assign(Error('请先核对并确认消费清单'),{validationField:'draft_structure'});
 const ids=new Set();const items=p.items.map((x,i)=>{const id=String(x.id??i);if(ids.has(id)||id.length>100)throw Error('清单ID重复或过长');ids.add(id);const quantity=String(x.quantity??'1');if(!/^\d+(\.\d{1,4})?$/.test(quantity)||Number(quantity)<=0)throw Error('清单数量无效');const unitPrice=x.unitPrice??(x.amount==null?'':decimal(x.amount)),unit=minor(String(unitPrice)),[a,b='']=quantity.split('.'),q=BigInt(a)*10000n+BigInt(b.padEnd(4,'0')),amount=Number((BigInt(unit)*q+5000n)/10000n);if(!Number.isSafeInteger(amount)||amount>9000000000000)throw Error('清单金额过大');return {id,itineraryId:x.itineraryId==null||x.itineraryId===''?null:text(x.itineraryId,100),name:text(x.name,100,'expense_name'),version:String(x.version??'').slice(0,200),scope:x.itineraryId?'activity':'whole_plan',category:text(x.category??'其他',40,'expense_category'),quantity,unitPrice:decimal(unit),amount,selected:x.selected!==false,sourceUrl:x.sourceUrl?https(x.sourceUrl):null,...expensePriceEvidence(x),...(x.pricing?{pricing:normalizePricing(x.pricing,x,expensePriceEvidence(x))}:{}),alternatives:(x.alternatives??[]).slice(0,8).map(a=>({name:String(a.name??'').slice(0,100),version:String(a.version??'').slice(0,200),note:String(a.note??'').slice(0,600),merchant:text(a.merchant,100,'candidate_merchant'),unitPrice:decimal(minor(String(a.unitPrice))),...expensePriceEvidence(a),...(a.pricing?{pricing:normalizePricing(a.pricing,{...a,selected:false},expensePriceEvidence(a))}:{})})),note:String(x.note??'').slice(0,600)}});
 const itinerary=(p.itinerary??[]).map((x,i)=>({id:x.id==null?'activity-'+i:text(x.id,100),date:date(x.date),time:String(x.time??'').slice(0,30),title:text(x.title,150,'activity_title'),notes:cleanItineraryNotes(String(x.notes??'').slice(0,800)),...(x.phase?{phase:['preparation','trip','follow_up'].includes(x.phase)?x.phase:(()=>{throw Error('行程阶段无效')})()}:{}),...(x.location?{location:text(x.location,400)}:{}),...(x.images!==undefined?{images:normalizeActivityImages(x.images)}:{})}));if(itinerary.length>80)throw Error('行程过长');const activityIds=new Set(itinerary.map(x=>x.id));if(activityIds.size!==itinerary.length||items.some(x=>x.itineraryId&&!activityIds.has(x.itineraryId)))throw Error('费用关联的行程无效或行程ID重复');
 const comparisons=(p.comparisons??[]).map(x=>({title:text(x.title,150),merchant:String(x.merchant??'').slice(0,100),version:String(x.version??'').slice(0,200),price:x.price==null?null:decimal(minor(String(x.price))),priceEvidence:typeof x.priceEvidence==='string'?x.priceEvidence.slice(0,1000):null,shipping:String(x.shipping??'未核实').slice(0,100),url:https(x.url),checkedAt:x.checkedAt&&Number.isFinite(Date.parse(x.checkedAt))?x.checkedAt:null,comparability:['same_sku','different_spec'].includes(x.comparability)?x.comparability:'unverified',note:String(x.note??'').slice(0,500)}));if(comparisons.length>15)throw Error('比价条目过多');
 const totalMinor=items.filter(x=>x.selected).reduce((n,x)=>n+x.amount,0);if(!Number.isSafeInteger(totalMinor)||totalMinor>9000000000000)throw Error('预算合计过大');return {kind:p.kind,...(['flat_items_v2','legacy_nested_only','nested_activity_v3'].includes(p.costContract)?{costContract:p.costContract}:{}),reviewed:p.reviewed===true,items,itinerary,comparisons,totalMinor};
}
export function reviewExpenseRequest(input){
 const draft=normalizeExpenseDraft(input.expenseDraft),start=date(input.date),end=date(input.tripEnd||input.date);
 if(end<start)throw Error('结束日期早于开始日期');
 validateItineraryWindow(draft.itinerary,start,end);
 if(input.budget!=null&&input.budget!==''&&minor(String(input.budget))!==draft.totalMinor)throw Error('预算与已确认清单合计不一致，请重新核对');
 return {draft,start,end,budget:decimal(draft.totalMinor)};
}
function https(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('清单来源须为HTTPS网页');return u.href}

export function removeExpenseActivity(draft,id){return {...draft,reviewed:false,itinerary:(draft.itinerary??[]).filter((x,i)=>(x.id??'activity-'+i)!==id),items:(draft.items??[]).filter(x=>x.itineraryId!==id)}}

export function expensePriceEvidence(x){
 const sourceUrl=x.sourceUrl?https(x.sourceUrl):null,checkedAt=x.checkedAt&&Number.isFinite(Date.parse(x.checkedAt))?x.checkedAt:null,priceEvidence=typeof x.priceEvidence==='string'?x.priceEvidence.trim().slice(0,1000):null;
 const sourceType=x.sourceType==='user_quote'?'user_quote':['retrieved_reference','external_reference'].includes(x.sourceType)&&sourceUrl&&checkedAt&&priceEvidence?x.sourceType:'scenario_estimate';
 return {merchant:String(x.merchant??'').slice(0,100),sourceUrl,sourceType,checkedAt:['retrieved_reference','external_reference'].includes(sourceType)?checkedAt:null,priceEvidence:['retrieved_reference','external_reference'].includes(sourceType)?priceEvidence:null};
}
export function updateExpenseItem(draft,index,patch){
 const original=draft.items[index],identityChanged=['merchant','name','version'].some(key=>Object.hasOwn(patch,key)&&patch[key]!==original?.[key]);
 const quantityChanged=Object.hasOwn(patch,'quantity')&&patch.quantity!==original?.quantity;
 const priceChanged=Object.hasOwn(patch,'unitPrice')&&patch.unitPrice!==original?.unitPrice;
 const identityReset=identityChanged?{version:'',note:''}:{};
 return {...draft,reviewed:false,items:draft.items.map((x,i)=>i===index?{...x,...identityReset,...patch,...(identityChanged||priceChanged||quantityChanged?{sourceType:priceChanged?'user_quote':'scenario_estimate',sourceUrl:null,checkedAt:null,priceEvidence:null,pricing:undefined}:{})}:x)};
}
export function selectExpenseAlternative(draft,index,alternativeIndex){
 const candidate=draft.items[index]?.alternatives?.[alternativeIndex];if(!candidate)throw Error('候选商家无效');
 return {...draft,reviewed:false,items:draft.items.map((x,i)=>i===index?{...x,name:String(candidate.name??'').trim()||candidate.merchant||x.category||'费用项目',version:String(candidate.version??''),note:String(candidate.note??''),unitPrice:candidate.unitPrice,pricing:candidate.pricing,...expensePriceEvidence(candidate)}:x)};
}
export function expenseDraftReviewForm(form,draft,advice){return {...form,...(advice?.status==='ACCEPTED'&&advice.planId?{planId:advice.planId}:{}),budget:decimal(normalizeExpenseDraft(draft,{requireReview:false}).totalMinor)}}

export function expenseResearchNeedsRegeneration(proposal){
 const draft=proposal?.expenseDraft;if(!draft)return false;
 const items=draft.items??[],itinerary=draft.itinerary??[];
 if(items.length&&itinerary.some(activity=>(activity.expenses??[]).length))return true;
 if(['flat_items_v2','legacy_nested_only','nested_activity_v3'].includes(draft.costContract))return false;
 const nestedOrigin=item=>itinerary.some(activity=>typeof activity.id==='string'&&String(item.id??'').startsWith(activity.id+'-cost-')&&/^\d+$/.test(String(item.id).slice((activity.id+'-cost-').length)));
 return items.some(nestedOrigin)&&items.some(item=>!nestedOrigin(item));
}

export function consumptionAdviceNeedsRiskAcknowledgement(advice){return Boolean(advice&&advice.intent!=='asset'&&advice.source==='model'&&(advice.verdict!=='可考虑'||(advice.missing_inputs??[]).length>0))}

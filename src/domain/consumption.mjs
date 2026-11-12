export const CONSUMPTION_TYPES=[{id:'travel',label:'旅游'},{id:'shopping',label:'购物'},{id:'dining',label:'餐饮'},{id:'general',label:'其他消费'},{id:'unknown',label:'未分类'}];
const ids=CONSUMPTION_TYPES.map(t=>t.id),known=ids.filter(id=>id!=='unknown');
const legacy={国内旅行:'travel',国际旅行:'travel',旅游:'travel',旅行:'travel',大件采购:'shopping',购物:'shopping',餐饮:'dining',其他消费:'general',其他:'general'};
/** Read structured fields only. A title or an investment cash receipt is never a consumption classification. */
export function consumptionTypeOf(value){
 const p=value?.payload??value?.metadata??value??{};
 if(value?.kind==='INCOME'||p.type==='income')return 'unknown';
 if(value?.kind==='investment_review'||p.kind==='wealth')return 'investment';
 if(ids.includes(p.consumptionType))return p.consumptionType;
 if(known.includes(p.expenseDraft?.kind))return p.expenseDraft.kind;
 if(known.includes(p.kind))return p.kind;
 if(known.includes(p.research?.kind))return p.research.kind;
 return Object.hasOwn(legacy,p.category)?legacy[p.category]:'unknown';
}
/** New writes validate explicit classifications and bind a budget to its structured expense kind. */
export function consumptionTypeForWrite(p){
 if(p.consumptionType!==undefined&&!ids.includes(p.consumptionType))throw Error('消费种类无效');
 if(p.type==='income'){if(p.consumptionType!==undefined&&p.consumptionType!=='unknown')throw Error('收入不能归入消费分类');return 'unknown';}
 const kind=p.expenseDraft?.kind;
 if(known.includes(kind)){if(p.consumptionType!==undefined&&p.consumptionType!==kind)throw Error('消费种类与清单分类不一致');return kind;}
 const type=consumptionTypeOf(p);return ids.includes(type)?type:'unknown';
}
const empty=v=>v==null||v==='';
const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
/** Inclusive overlap; unknown business dates remain visible until a date bound is selected. */
export function dateInRange(start,end,from,to){
 if(!empty(from)&&!valid(from)||!empty(to)&&!valid(to)||!empty(from)&&!empty(to)&&from>to)return false;
 if(!empty(start)&&!valid(start)||!empty(end)&&!valid(end))return false;
 if(empty(start))return empty(from)&&empty(to);
 const last=empty(end)?start:end;if(last<start)return false;
 return (empty(from)||last>=from)&&(empty(to)||start<=to);
}

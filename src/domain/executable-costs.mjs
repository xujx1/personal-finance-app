export const PRICE_BASES={external_quote:'外部引用报价 · 本站未核验',user_quote:'用户填写的参考金额',calculated:'按输入计算',allowance:'预算预留',included:'按已确认权益覆盖',unknown:'价格待核实'};
const text=(v,max)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)throw Error('价格依据文字无效或过长');return v.trim()};
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function normalizePricing(p,item,evidence){
 if(p==null)return undefined;
 const keys=['basis','specification','serviceDate','unit','formula','inputs','missing','conditions'];if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!keys.includes(k))||!Object.hasOwn(PRICE_BASES,p.basis))throw Error('价格依据种类或字段无效');
 const strings=(xs,name)=>{if(!Array.isArray(xs??[])||(xs??[]).length>12)throw Error('价格依据'+name+'无效');return (xs??[]).map(x=>text(x,300)).filter(Boolean)};
 const inputs=strings(p.inputs,'输入'),missing=strings(p.missing,'缺项'),formula=text(p.formula,500);
 if(p.serviceDate!=null&&!day(p.serviceDate))throw Error('价格适用日期无效');
 if(p.basis==='external_quote'&&!['retrieved_reference','external_reference'].includes(evidence.sourceType))throw Error('引用报价须提供HTTPS来源、查询时间与价格摘录；否则请标预留或未知');
 if(p.basis==='calculated'&&(!formula||!inputs.length))throw Error('计算价格须列公式与输入，未知参数请标假设');
 if(p.basis==='included'&&Number(item.unitPrice)!==0)throw Error('权益已覆盖项目请填0，额外支付须另列');
 if(p.basis==='unknown'&&(item.selected!==false||Number(item.unitPrice)!==0))throw Error('未知费用不能以0元伪装免费纳入预算；请暂不选中并填0占位，或明确预留金额');
 return {basis:p.basis,specification:text(p.specification,300),serviceDate:p.serviceDate??null,unit:text(p.unit,50),formula,inputs,missing,conditions:text(p.conditions,600)};
}
const difference=(a,b)=>(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000;
export function activityInWindow(a,start,end){
 if(a.phase==='preparation')return a.date<=start&&difference(start,a.date)<=30;
 if(a.phase==='follow_up')return a.date>=end&&difference(a.date,end)<=30;
 return a.date>=start&&a.date<=end;
}
export function validateItineraryWindow(items,start,end){if(items.some(a=>!activityInWindow(a,start,end)))throw Error('行程日期必须在预算起止范围；准备可提前30天，后续可延后30天，请明确phase');}
export function priceOverview(draft){const totals={quoted:0,calculated:0,allowance:0,included:0,unknown:0};for(const x of draft?.items??[]){const basis=x.pricing?.basis??(['retrieved_reference','external_reference'].includes(x.sourceType)?'external_quote':x.sourceType==='user_quote'?'user_quote':'allowance');if(basis==='unknown'){totals.unknown++;continue}if(x.selected===false)continue;const n=x.amount??Math.round(Number(x.quantity)*Number(x.unitPrice)*100);if(['external_quote','user_quote'].includes(basis))totals.quoted+=n;else if(basis==='calculated')totals.calculated+=n;else if(basis==='included')totals.included+=n;else totals.allowance+=n;}return totals;}

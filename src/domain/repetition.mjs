import {classifyExpense} from './expense-plan.mjs';
const normalize=value=>String(value??'').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const version=value=>{const s=String(value??'').toLowerCase();return {platform:/switch\s*2/.test(s)?'switch2':/switch/.test(s)?'switch':null,region:(s.match(/国行|港版|日版|美版|欧版/)??[])[0]??null,capacity:(s.match(/\d+\s*(?:gb|tb)/)??[])[0]?.replace(/\s/g,'')??null}};
const entity=value=>normalize(String(value??'').replace(/switch\s*2?|中文版|国行|港版|日版|美版|欧版|全新|二手|\d+\s*(?:GB|TB)|家庭聚餐|聚餐|晚餐|午餐|早餐|采购|买菜/gi,''));
const matches=(question,title)=>{const key=entity(title);return key.length>=2&&normalize(question).includes(key)};
const differentVersion=(a,b)=>{const x=version(a),y=version(b);return Object.keys(x).some(key=>x[key]&&y[key]&&x[key]!==y[key])};
export function getRepetitionHints(question,memory={},kind='auto'){
 const result={blocking:false,explicitRepeat:false,items:/** @type {Array<{kind:string,title:string,source:string,message:string,date?:string|null}>} */([])};
 if(!String(question??'').trim())return result;
 result.explicitRepeat=/送人|送礼|补货|补充装|复购|回购|重游|再去|再买|买给|帮.+买|替换旧|replacement/i.test(String(question));
 if(result.explicitRepeat)return result;
 const category=kind==='auto'?classifyExpense(question).kind:kind,seen=new Set();
 const add=(key,item)=>{if(!seen.has(key)){seen.add(key);result.items.push(item)}};
 for(const record of (Array.isArray(memory.records)?memory.records:[])){
  if(!record||typeof record.title!=='string'||!matches(question,record.title)||differentVersion(question,record.title))continue;
  if(record.completionStatus==='CANCELLED')continue;
  add('recent:'+record.id,{kind:record.paidProduct?'paid_product':'recent',title:record.title,date:record.date??null,source:record.source??'已确认消费记录',message:record.paidProduct?`曾有“${record.title}”的消费付款；请核对规格、当前持有状态与用途，历史付款不证明仍持有。`:`近期有“${record.title}”的确认记录；可考虑变化，或说明这次补货、送礼、再次安排的用途。历史反馈不代表当前库存。`});
 }
 return {...result,items:result.items.slice(0,5)};
}

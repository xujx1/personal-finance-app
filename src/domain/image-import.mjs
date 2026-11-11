import {minor} from './finance.mjs';
const safe=(x,n=300)=>String(x??'').slice(0,n).replace(/\d{9,}/g,'[已隐藏账号]');
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x?x:null;
export function validateImage(data){
 if(typeof data!=='string'||data.length>3000000)throw Error('图片最大2MB');const m=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);if(!m)throw Error('仅支持PNG、JPEG、WebP图片');
 const bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));if(bytes.length>2*1024*1024)throw Error('图片最大2MB');
 const mime=m[1],valid=mime==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)throw Error('图片内容与格式不符');return {mime,bytes};
}
export function normalizeRecognition(p){
 if(!p||!['assets','transactions','mixed'].includes(p.type)||!Array.isArray(p.rows)||p.rows.length>80||!p.rows.length)throw Error('图片识别结构无效');
 return {type:p.type,asOf:validDate(p.asOf),balanceMinor:p.balance==null?null:minor(String(p.balance)),source:'用户图片经视觉模型提取，待本人逐条核对',rows:p.rows.map((r,i)=>{
  if(!['asset','expense','income','transfer','refund'].includes(r.kind)||!['CNY','USD'].includes(r.currency??'CNY'))throw Error('候选类型或币种无效');
  return {index:i,kind:r.kind,name:safe(r.name,100),category:['cash','fund','stock','property','loan','other'].includes(r.category)?r.category:'other',currency:r.currency??'CNY',amountMinor:r.amount==null?null:minor(String(r.amount)),date:validDate(r.date),code:safe(r.code,20),quantity:/^\d+(\.\d{1,6})?$/.test(String(r.quantity))?String(r.quantity):'',cost:/^\d+(\.\d{1,6})?$/.test(String(r.cost))?String(r.cost):'',price:/^\d+(\.\d{1,6})?$/.test(String(r.price))?String(r.price):'',notes:safe(r.notes,500),status:['pending','paid','refunded','unknown'].includes(r.status)?r.status:'unknown',confidence:typeof r.confidence==='number'?Math.max(0,Math.min(1,r.confidence)):null,confirmed:false};})};
}

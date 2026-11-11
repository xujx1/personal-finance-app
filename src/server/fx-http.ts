type FxValue={rate:string;date:string;source:string;fetchedAt:number;status?:string;message?:string};
type Deps={getUser:()=>Promise<unknown>;getDb:()=>D1Database|undefined;fetcher?:typeof fetch};
function ratio(a:string,b:string){const integer=(s:string)=>{if(!/^\d+(\.\d{1,12})?$/.test(s))throw Error('汇率精度无效');const [whole,fraction='']=s.split('.');return BigInt(whole+fraction.padEnd(12,'0'))};const n=integer(a),d=integer(b);if(n<=0n||d<=0n)throw Error('汇率无效');const v=(n*1000000000000n+d/2n)/d;return `${v/1000000000000n}.${String(v%1000000000000n).padStart(12,'0')}`}
const day=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const aged=(value:FxValue)=>Date.now()-Date.parse(value.date+'T00:00:00Z')>7*86400000;
export function createFxHandlers(deps:Deps){return {async GET(){
 if(!await deps.getUser())return Response.json({error:'请先登录'},{status:401});
 const headers={'Cache-Control':'private, no-store'},db=deps.getDb();let cached:FxValue|null=null;
 try{
  if(db){const row=await db.prepare("SELECT payload FROM runtime_cache WHERE id='fx'").first<{payload:string}>();const p=row?JSON.parse(row.payload):null;if(p&&typeof p.rate==='string'&&/^\d+(\.\d{1,12})?$/.test(p.rate)&&Number(p.rate)>0&&day(p.date)&&Number.isFinite(p.fetchedAt))cached=p;}
  if(cached&&Date.now()-cached.fetchedAt<900000)return Response.json({...cached,status:aged(cached)?'stale':'cached',...(aged(cached)?{message:'参考汇率较旧，请核对原报价日期'}:{})},{headers});
  const r=await(deps.fetcher??fetch)('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',{redirect:'manual',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('汇率源暂不可用');const xml=await r.text();if(xml.length>1000000)throw Error('汇率响应过大');
  const usd=xml.match(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/),cny=xml.match(/currency=['"]CNY['"]\s+rate=['"]([\d.]+)['"]/),date=xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/);if(!usd||!cny||!date||!day(date[1]))throw Error('汇率格式不完整');
  const value:FxValue={rate:ratio(cny[1],usd[1]),date:date[1],source:'ECB日度参考价',fetchedAt:Date.now()};value.status=aged(value)?'stale':'ok';if(aged(value))value.message='参考汇率较旧，请核对原报价日期';
  if(db)await db.prepare("INSERT INTO runtime_cache VALUES('fx',?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind(JSON.stringify(value)).run();return Response.json(value,{headers});
 }catch{return Response.json(cached?{...cached,status:'stale',message:'更新失败，保留上次成功报价及原日期'}:{rate:null,status:'unavailable',source:'ECB日度参考价',message:'尚未取得有效汇率，外币资产不并入人民币总额'},{headers})}
}}}

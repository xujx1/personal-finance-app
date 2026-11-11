import {snapshot} from './finance-store.ts';
import {assertLedgerAccess,ledgerBookId} from './ledger-scope.ts';
import {parseTencent,parseFund,parseFundHistory,marketQuoteRequest} from '../domain/market.mjs';
const cacheDay=(timestamp:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
export function createMarketHandlers(deps:any){return {async GET(req:Request){
 if(!await deps.getUser())return Response.json({error:'请先登录'},{status:401});
 const db=deps.getDb();if(!db)return Response.json({error:'数据库未配置'},{status:503});
 const s=await snapshot(db),quotes:any={},now=(deps.now??Date.now)(),today=cacheDay(now);
 for(const a of s.accounts.filter((a:any)=>!a.archived&&['fund','stock'].includes(a.category)).slice(0,30)){
  req.signal.throwIfAborted();const request=marketQuoteRequest(a);
  if(!request){quotes[a.id]={status:'unavailable',message:'市场、币种或代码未核实。支持美股USD代码、内地CNY证券SH/SZ/BJ前缀代码及六位基金代码；港股暂未支持HKD折算。'};continue;}
  const cacheKey=db.ledgerScope?ledgerBookId(db)+':'+request.cacheKey:request.cacheKey;
  const prior=await db.prepare('SELECT payload FROM runtime_cache WHERE id=?').bind(cacheKey).first();let cached:any=null,lastAttempt:number|null=null;
  try{const q=prior?JSON.parse(prior.payload):null;if(q&&q.symbol===request.symbol&&q.currency===request.currency&&(!q.market||q.market===request.market)){
   if(Number.isFinite(q.lastAttemptAt)&&q.lastAttemptAt<=now)lastAttempt=q.lastAttemptAt;
   if(typeof q.price==='string'&&/^\d+(\.\d{1,8})?$/.test(q.price)&&Number(q.price)>0&&typeof q.asOf==='string'&&q.asOf&&typeof q.source==='string'&&Number.isFinite(q.fetchedAt)&&q.fetchedAt<=now)cached={...q,market:request.market};
  }}catch{}
  const fresh=cached&&cacheDay(cached.fetchedAt)===today,attempted=lastAttempt!==null&&cacheDay(lastAttempt)===today;
  if(fresh||attempted){quotes[a.id]=cached?{...cached,status:fresh?'cached':'stale',cachePolicy:'daily',message:fresh?'当日缓存，保留原报价时间':'今日更新失败，保留上次行情；下个自然日重试'}:{status:'unavailable',cachePolicy:'daily',message:'今日未取得有效行情，下个自然日重试；保留账面值'};continue;}
  try{
   const read=async(url:string)=>{const r=await(deps.fetcher??fetch)(url,{redirect:'manual',signal:AbortSignal.any([req.signal,AbortSignal.timeout(8000)])});if(!r.ok)throw Error('行情请求失败');return new TextDecoder(request.provider==='tencent'?'gbk':'utf-8').decode(await r.arrayBuffer());};
   let q:any;
   if(request.provider==='fund'){
    try{q=parseFund(await read(request.url),request.symbol);}catch{req.signal.throwIfAborted();q=parseFundHistory(await read('https://fund.eastmoney.com/pingzhongdata/'+request.symbol+'.js'),request.symbol);}
   }else q=parseTencent(await read(request.url),request.symbol,request.market);
   q={...q,fetchedAt:now,lastAttemptAt:now,cachePolicy:'daily'};
   req.signal.throwIfAborted();await assertLedgerAccess(db);await db.prepare('INSERT INTO runtime_cache VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(cacheKey,JSON.stringify(q)).run();quotes[a.id]={...q,status:'ok'};
  }catch{
   req.signal.throwIfAborted();await assertLedgerAccess(db);await db.prepare('INSERT INTO runtime_cache VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(cacheKey,JSON.stringify({...cached,symbol:request.symbol,currency:request.currency,market:request.market,lastAttemptAt:now})).run();quotes[a.id]=cached?{...cached,status:'stale',cachePolicy:'daily',message:'今日更新失败，展示上次数据及原报价时间；下个自然日重试'}:{status:'unavailable',cachePolicy:'daily',message:'未取得有效行情，保留本人核实的账面数据；下个自然日重试'};
  }
 }
 await assertLedgerAccess(db);return Response.json({quotes,checkedAt:Date.now(),ledgerUnchanged:true},{headers:{'Cache-Control':'no-store'}});
}};}

import {minor} from '../domain/finance.mjs';
import {ensureBook,snapshot} from './finance-store.ts';
import {assertLedgerAccess,ledgerBookId,ledgerWriteGuard} from './ledger-scope.ts';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const day=(v:any)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const text=(v:any,max:number)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('资料文字字段无效');return v.trim()};
export function createInitializationHandlers(deps:any){return {async POST(req:Request){
 const user=await deps.getUser();if(!user)return json({error:'请先登录'},401);if(!deps.getOwner()||deps.getOwner()!==user.userId)return json({error:'仅家庭管理员可以初始化'},403);if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 try{
  const raw=await req.text();if(raw.length>50000)return json({error:'初始化资料过长'},413);const p=JSON.parse(raw);if(p.reviewed!==true||!day(p.snapshotDate)||!Array.isArray(p.accounts)||p.accounts.length<1||p.accounts.length>60||typeof p.key!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(p.key))throw Error('请核对资料、日期并确认初始化');
  const source=text(p.source,500),db=deps.getDb();await assertLedgerAccess(db,true);const book=await ensureBook(db),bookId=ledgerBookId(db),ds=book.active_dataset,key='initialization:'+p.key;
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({...p,key:undefined}))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const prior=await db.prepare('SELECT request_hash,result_json FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,ds,key).first();if(prior)return prior.request_hash===fingerprint?json(JSON.parse(prior.result_json)):json({error:'请求标识已用于其他资料'},409);
  const state=await snapshot(db);if(state.accounts.some((a:any)=>a.category!=='system')||state.transactions.length)return json({error:'账本已有数据，不能用初始化覆盖或重复导入'},409);
  const notes=Array.isArray(p.notes)?p.notes.slice(0,30).map((v:any)=>text(v,1000)):[];
  const normalized=p.accounts.map((a:any)=>{
   const category=text(a.category,30);if(!['cash','fund','stock','property','loan','other'].includes(category)||!['CNY','USD'].includes(a.currency))throw Error('资产类型或币种无效');
   const amount=minor(text(a.amount,30)),id=crypto.randomUUID(),kind=category==='loan'?'LIABILITY':'ASSET';
   const metadata:any={asOf:p.snapshotDate,ownerSubject:user.userId,ownerLabel:String(user.displayName??'家庭管理员').slice(0,100),note:a.note?text(a.note,1500):source,status:a.status==='redeeming'?'redeeming':'holding',initializationKey:key,source};
   for(const k of ['quantity','cost','price','monthly','rate'])if(a[k]!==undefined&&a[k]!==''){const v=String(a[k]);if(!/^\d+(\.\d{1,8})?$/.test(v)||Number(v)>1e12)throw Error('持仓或贷款数值无效');metadata[k]=v}
   if(a.day!==undefined){if(!Number.isInteger(a.day)||a.day<1||a.day>31)throw Error('扣款日无效');metadata.day=a.day}
   for(const k of ['maturityDate','repricingDate'])if(a[k]){if(!day(a[k]))throw Error('贷款日期无效');metadata[k]=a[k]}
   if(a.market){if(!['US','CN','HK','OTHER'].includes(a.market))throw Error('市场无效');metadata.market=a.market}
   if(a.code)metadata.code=text(a.code,20);return {id,name:text(a.name,100),category,currency:a.currency,amount,kind,metadata};
  });
  const result={ok:true,count:normalized.length,snapshotDate:p.snapshotDate,receiptId:crypto.randomUUID()},guard=ledgerWriteGuard(db),rows:any[]=[...(guard?[guard.statement]:[]),db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)').bind(bookId,ds,key,fingerprint,book.revision,book.fence,Date.now(),JSON.stringify(result))];
  for(const a of normalized){rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(ds,a.id,a.name,a.kind,a.category,a.currency,JSON.stringify(a.metadata)));if(!a.amount)continue;const tid=crypto.randomUUID(),signed=a.kind==='LIABILITY'?-a.amount:a.amount;
   rows.push(db.prepare("INSERT INTO transactions VALUES(?,?,?,'DRAFT',?,NULL,?,?)").bind(ds,tid,'OPENING',a.amount,p.snapshotDate,JSON.stringify({accountId:a.id,reason:'本人提供资料初始化，非新发生收支',source,idempotencyKey:key})),db.prepare('INSERT INTO entries VALUES(?,?,?,?,?)').bind(ds,tid,a.id,a.currency,signed),db.prepare('INSERT INTO entries VALUES(?,?,?,?,?)').bind(ds,tid,'equity:'+a.currency,a.currency,-signed),db.prepare("UPDATE transactions SET status='POSTED' WHERE dataset_id=? AND id=?").bind(ds,tid));
  }
  rows.push(db.prepare('INSERT INTO documents VALUES(?,?,?,?)').bind(ds,result.receiptId,'initialization_receipt',JSON.stringify({source,snapshotDate:p.snapshotDate,notes,assetIds:normalized.map((a:any)=>a.id),createdAt:new Date().toISOString(),ownerSubject:user.userId})),db.prepare('UPDATE books SET revision=revision+1 WHERE id=?').bind(bookId),db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(ds,crypto.randomUUID(),new Date().toISOString(),user.userId,'initialization.commit',JSON.stringify({key,count:normalized.length,source,snapshotDate:p.snapshotDate})));
  if(guard)rows.push(db.prepare('DELETE FROM household_guards WHERE id=?').bind(guard.id));
  try{await db.batch(rows)}catch{const committed=await db.prepare('SELECT request_hash,result_json FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,ds,key).first();if(committed?.request_hash===fingerprint)return json(JSON.parse(committed.result_json));return json({error:'初始化未完成，账本或权限已变化，请刷新核对'},409)}return json(result);
 }catch(e:any){return json({error:String(e.message).slice(0,180)},422)}
}};}

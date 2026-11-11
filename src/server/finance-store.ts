import {extendFinance} from './finance-extensions.ts';
import { minor, decimal, balanceJournal } from '../domain/finance.mjs';
import {normalizeProposal} from '../domain/research.mjs';

type DB = D1Database;
const bookId='personal';
const uid=()=>crypto.randomUUID();
const text=(v:unknown,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('请填写有效内容');return v.trim();};
const date=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('日期无效');return v;};
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const parse=(v:string)=>JSON.parse(v);
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(n=>n.toString(16).padStart(2,'0')).join('');

export async function ensureBook(db:DB){
 await db.prepare("INSERT OR IGNORE INTO books VALUES(?, 'initial',0,0,0)").bind(bookId).run();
 const book:any=await db.prepare('SELECT * FROM books WHERE id=?').bind(bookId).first();
 const statements=[];
 for(const currency of ['CNY','USD'])for(const [id,name,kind] of [['equity','开账与校正','EQUITY'],['expense','消费费用','EXPENSE'],['income','收入与差额','INCOME']])statements.push(db.prepare('INSERT OR IGNORE INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(book.active_dataset,`${id}:${currency}`,name,kind,'system',currency,'{}'));
 await db.batch(statements);return book;
}
export async function snapshot(db:DB){
 const book=await ensureBook(db), ds=book.active_dataset;
 const [accounts,transactions,documents,audit,planTotals]=await Promise.all([
 db.prepare("SELECT a.*,COALESCE(SUM(CASE WHEN t.status='POSTED' THEN e.amount_minor ELSE 0 END),0) AS signed_balance FROM accounts a LEFT JOIN entries e ON e.dataset_id=a.dataset_id AND e.account_id=a.id LEFT JOIN transactions t ON t.dataset_id=e.dataset_id AND t.id=e.transaction_id WHERE a.dataset_id=? GROUP BY a.id ORDER BY a.rowid").bind(ds).all(),
 db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND status='POSTED' ORDER BY rowid DESC LIMIT 300").bind(ds).all(),
 db.prepare('SELECT * FROM documents WHERE dataset_id=?').bind(ds).all(),
 db.prepare('SELECT * FROM audit_events WHERE dataset_id=? ORDER BY rowid DESC LIMIT 100').bind(ds).all(),
 db.prepare("SELECT json_extract(metadata,'$.planId') AS planId,SUM(CASE WHEN kind IN('REFUND','PREPAYMENT_REFUND') THEN -total_minor WHEN kind='PREPAYMENT' OR kind='PAYMENT' AND COALESCE(json_extract(metadata,'$.fromPrepayment'),0)=0 THEN total_minor ELSE 0 END) AS paid,SUM(CASE WHEN kind='PAYMENT' THEN total_minor WHEN kind='REFUND' THEN -total_minor ELSE 0 END) AS consumed FROM transactions WHERE dataset_id=? AND status='POSTED' AND kind IN('PAYMENT','REFUND','PREPAYMENT','PREPAYMENT_REFUND') GROUP BY json_extract(metadata,'$.planId')").bind(ds).all()
 ]);
 // A concurrent writer means this assembled snapshot must not be used as a mutation basis.
 const latest:any=await db.prepare('SELECT * FROM books WHERE id=?').bind(bookId).first();
 if(latest.revision!==book.revision||latest.active_dataset!==ds)throw Error('CONFLICT:数据正在更新，请刷新');
 return {book,planSummaries:planTotals.results,accounts:accounts.results.map((r:any)=>({...r,metadata:parse(r.metadata),balance:r.kind==='LIABILITY'?-r.signed_balance:r.signed_balance})),transactions:transactions.results.map((r:any)=>({...r,metadata:parse(r.metadata)})),documents:documents.results.map((r:any)=>({...r,payload:parse(r.payload)})),audit:audit.results.map((r:any)=>({...r,payload:parse(r.payload)}))};
}

export async function executeCommand(db:DB,input:any,actor:string){
 const key=text(input.key,150), action=text(input.action,40), body=input.body??{};
 const fingerprint=await hash(JSON.stringify(canonical({action,body})));
 const book=await ensureBook(db),ds=book.active_dataset;
 const previous:any=await db.prepare('SELECT * FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,ds,key).first();
 if(previous){if(previous.request_hash!==fingerprint)throw Error('CONFLICT:同一请求标识的内容不同');return parse(previous.result_json);}
 if(input.revision!==book.revision)throw Error('CONFLICT:数据已经更新，请刷新后重试');
 const state=await snapshot(db);const rows:any[]=[], journals:any[]=[];let result:any={ok:true};
 const account=(id:string)=>{const a=state.accounts.find((a:any)=>a.id===id);if(!a||a.archived)throw Error('账户不存在或已归档');return a;};
 const cash=(id:string)=>{const a=account(id);if(a.category!=='cash'||a.currency!=='CNY'||a.kind!=='ASSET')throw Error('请选择人民币现金账户');return a;};
 const doc=(id:string)=>{const d=state.documents.find((d:any)=>d.id===id);if(!d)throw Error('记录不存在');return d;};
 const writeDoc=(id:string,kind:string,payload:any)=>rows.push(db.prepare('INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(dataset_id,id) DO UPDATE SET payload=excluded.payload').bind(ds,id,kind,JSON.stringify(payload)));
 const journal=(kind:string,amount:number,entries:any[],metadata:any={},original:string|null=null)=>{
  const merged=Object.values(entries.reduce((m:any,e:any)=>{const id=e.account_id;if(!m[id])m[id]={...e};else m[id].amount+=e.amount;return m;},{})).filter((e:any)=>e.amount!==0) as any[];
  balanceJournal(merged);const id=uid();journals.push({id,kind,amount,entries:merged,metadata,original,date:date(metadata.businessDate??body.date??localDate())});result.transactionId=id;return id;
 };
 const entry=(a:any,amount:number)=>({account_id:a.id,currency:a.currency,amount});
 const system=(id:string,currency='CNY')=>({id:`${id}:${currency}`,currency});
 if(action==='preferences.save'){
  const list=(v:any)=>{if(v==null)return [];if(!Array.isArray(v)||v.length>50)throw Error('偏好条目过多');return v.map((x:any)=>text(x,150));};writeDoc('preferences','preferences',{ownedProducts:list(body.ownedProducts),preferredMarkets:list(body.preferredMarkets),availabilityNotes:list(body.availabilityNotes),avoidRepetition:body.avoidRepetition!==false,source:'本人确认的偏好，不代表新消费',updatedAt:new Date().toISOString()});result.id='preferences';
 }else if(action==='financial.profile.save'){
  const optional=(v:any)=>v==null||v===''?null:minor(String(v));
  writeDoc('financial-profile','financial_profile',{monthlyIncomeMinor:optional(body.monthlyIncome),livingExpenseMinor:optional(body.livingExpense),emergencyReserveMinor:optional(body.emergencyReserve),historyComplete:body.historyComplete===true,updatedAt:new Date().toISOString()});result.id='financial-profile';
 }else if(action==='research.generated'){
  const payload=normalizeProposal(body),id=uid();writeDoc(id,'research_proposal',{...payload,sources:payload.sources.map((s:any)=>({...s,verification:'本站研究时取得的引用，正文结论仍需核实'})),status:'PENDING',createdAt:new Date().toISOString(),source:'本站研究Agent',model:body.model,missing:body.missing,factsRevision:body.factsRevision});result.id=id;
 }else if(action==='research.submit'){
  const payload=normalizeProposal(body),id=uid();writeDoc(id,'research_proposal',{...payload,status:'PENDING',createdAt:new Date().toISOString(),source:'外部Agent/MCP，来源未由本站重新核验',submittedBy:actor});result.id=id;
 }else if(action==='research.request'){
  if(!['travel','shopping','dining','wealth'].includes(body.kind))throw Error('研究类型无效');const id=uid();writeDoc(id,'research_request',{kind:body.kind,title:text(body.title,100),question:text(body.question,3000),status:'OPEN',createdAt:new Date().toISOString()});result.id=id;
 }else if(action==='research.accept'){
  const d=doc(text(body.proposalId));if(d.kind!=='research_proposal'||d.payload.kind==='wealth')throw Error('理财研究不转换为消费预算');if(d.payload.planId)return {ok:true,id:d.payload.planId};if(!d.payload.date)throw Error('请先提供方案日期');
  const id=uid();writeDoc(id,'plan',{name:d.payload.title,category:d.payload.kind==='travel'?'国内旅行':'大件采购',date:d.payload.date,end:d.payload.end,budget:d.payload.budget,status:'PLANNED',reserved:0,budgetStatus:'DRAFT',version:0,approvedAt:null,note:d.payload.summary,research:d.payload,proposalId:d.id});writeDoc(d.id,'research_proposal',{...d.payload,status:'SAVED_AS_DRAFT',planId:id});result.id=id;
 }else if(action==='advice.record'){
  const id=text(body.id),payload=body.payload;
  if(!payload||!['rules','model'].includes(payload.source)||!['可考虑','需缩减','建议推迟','信息不足'].includes(payload.verdict))throw Error('建议格式无效');
  writeDoc(id,'advice',{...payload,status:'READY',approvalRevision:book.revision+1,dataset:ds});result.id=id;
 }else if(action==='advice.accept'){
  const a=doc(text(body.adviceId));if(a.kind!=='advice')throw Error('建议不存在');
  if(a.payload.status==='ACCEPTED')return {ok:true,id:a.payload.accountId??a.payload.planId};
  if(a.payload.dataset!==ds||a.payload.approvalRevision!==book.revision||a.payload.expiresAt<=Date.now())throw Error('CONFLICT:账本或建议已变化，请重新评估');
  if(a.payload.source!=='model'||a.payload.verdict!=='可考虑')throw Error('请先取得AI评估通过，再由本人确认；规则测算不能作为审批');
  if(a.payload.intent==='asset'){
   const x=a.payload.inputs.asset;if(!x?.owned)throw Error('请先确认资产已经持有');const id=uid(),kind=x.category==='loan'?'LIABILITY':'ASSET',signed=kind==='LIABILITY'?-x.amountMinor:x.amountMinor;
   rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(ds,id,x.name,kind,x.category,x.currency,JSON.stringify({note:x.source,status:x.status,quantity:x.quantity,cost:x.cost,monthly:x.monthly,code:x.code,price:x.price,asOf:a.payload.inputs.date,adviceId:a.id})));
   if(signed)journal('OPENING',x.amountMinor,[{account_id:id,currency:x.currency,amount:signed},entry(system('equity',x.currency),-signed)],{accountId:id,reason:'本人确认AI审阅过的已有资产登记',adviceId:a.id});
   writeDoc(a.id,'advice',{...a.payload,status:'ACCEPTED',accountId:id,acceptedAt:new Date().toISOString()});result.id=id;
  }else{
  if(a.payload.inputs.budgetMinor===null)throw Error('请先填写预算并重新评估');
  const existing=a.payload.inputs.planId?doc(a.payload.inputs.planId):null;
  if(existing&&(existing.kind!=='plan'||['COMPLETED','CANCELLED'].includes(existing.payload.status)))throw Error('原计划已经结束，请重新评估');
  const id=existing?.id??uid(),old=existing?.payload??{};
  writeDoc(id,'plan',{...old,name:text(body.name??a.payload.inputs.question.slice(0,50),100),category:text(body.category??old.category??'其他',30),date:a.payload.inputs.date,end:old.end&&old.end>=a.payload.inputs.date?old.end:a.payload.inputs.date,budget:a.payload.inputs.budgetMinor,status:old.status??'PLANNED',reserved:Math.min(old.reserved??0,Math.max(0,a.payload.inputs.budgetMinor-(state.planSummaries.find((x:any)=>x.planId===id)?.paid??0))),budgetStatus:'APPROVED',version:(old.version??0)+1,approvedAt:new Date().toISOString(),note:old.note??'本人采纳消费建议，实际付款另行记录',adviceId:a.id});
  writeDoc(a.id,'advice',{...a.payload,status:'ACCEPTED',planId:id,acceptedAt:new Date().toISOString()});result.id=id;
  }
 }else if(action==='account.save'){
  const id=body.id?text(body.id):uid(), existing=state.accounts.find((a:any)=>a.id===id);
  const category=text(body.category,30);if(!['cash','fund','stock','property','loan','other'].includes(category))throw Error('资产类型无效');
  const currency=body.currency==='USD'?'USD':'CNY';const kind=category==='loan'?'LIABILITY':'ASSET';
  if(existing&&(existing.category==='system'||existing.currency!==currency||existing.kind!==kind||existing.category!==category))throw Error('不能修改账户类型或币种，请新增对应账户');
  const metadata={...existing?.metadata,code:String(body.code??existing?.metadata.code??'').slice(0,20),asOf:body.asOf?date(body.asOf):existing?.metadata.asOf??null,note:String(body.note??'').slice(0,2000),status:body.status==='redeeming'?'redeeming':'holding',quantity:String(body.quantity??''),cost:String(body.cost??''),price:String(body.price??''),monthly:String(body.monthly??''),rate:String(body.rate??''),day:Number(body.day??1)};
  rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?) ON CONFLICT(dataset_id,id) DO UPDATE SET name=excluded.name,metadata=excluded.metadata').bind(ds,id,text(body.name,100),kind,category,currency,JSON.stringify(metadata)));
  const amount=minor(String(body.amount));const target=kind==='LIABILITY'?-amount:amount;const delta=target-(existing?.signed_balance??0);
  if(delta)journal(existing?'ADJUSTMENT':'OPENING',Math.abs(delta),[{account_id:id,currency,amount:delta},entry(system('equity',currency),-delta)],{reason:String(body.reason??'手工核对余额'),accountId:id});result.id=id;
 }else if(action==='account.archive'){
  const a=account(body.id);if(a.category==='system'||a.balance!==0)throw Error('请先核对余额并归零，或转出资金，再归档');rows.push(db.prepare('UPDATE accounts SET archived=1 WHERE dataset_id=? AND id=?').bind(ds,a.id));
 }else if(action==='transaction.add'){
  const a=cash(body.accountId),n=minor(String(body.amount));if(!n)throw Error('金额必须大于0');
  const income=body.type==='income';const e=income?[entry(a,n),entry(system('income'),-n)]:[entry(a,-n),entry(system('expense'),n)];
  journal(income?'INCOME':'EXPENSE',n,e,{note:text(body.note,300),accountId:a.id,relatedAssetId:body.relatedAssetId?account(body.relatedAssetId).id:null});
 }else if(action==='plan.save'){
  const id=body.id?text(body.id):uid();const old=state.documents.find((d:any)=>d.id===id)?.payload??{};
  const budget=body.budget===''||body.budget==null?null:minor(String(body.budget));
  const status=body.status??old.status??'PLANNED';if(!['DRAFT','PLANNED','BOOKED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(status))throw Error('计划状态无效');
  const approved=body.approve===true;if(approved&&budget===null)throw Error('确认预算前请填写金额');
  const changed=old.budget!==undefined&&old.budget!==budget;
  const payload={...old,name:text(body.name,100),category:text(body.category??'其他',30),date:date(body.date),end:date(body.end??body.date),budget,status,note:String(body.note??'').slice(0,3000),reserved:['COMPLETED','CANCELLED'].includes(status)?0:old.reserved??0,budgetStatus:approved?'APPROVED':changed?'DRAFT':old.budgetStatus??'DRAFT',version:(old.version??0)+(approved?1:0),approvedAt:approved?new Date().toISOString():old.approvedAt??null};
  if(payload.end<payload.date)throw Error('结束日期不能早于开始日期');writeDoc(id,'plan',payload);result.id=id;
 }else if(action==='plan.reserve'){
  const p=doc(body.planId),amount=minor(String(body.amount));if(p.kind!=='plan'||['CANCELLED','COMPLETED'].includes(p.payload.status))throw Error('计划不可预留');
  const totalCash=state.accounts.filter((a:any)=>a.category==='cash'&&a.currency==='CNY'&&a.kind==='ASSET').reduce((n:number,a:any)=>n+a.balance,0);
  const other=state.documents.filter((d:any)=>d.kind==='plan'&&d.id!==p.id&&!['COMPLETED','CANCELLED'].includes(d.payload.status)).reduce((n:number,d:any)=>n+(d.payload.reserved??0),0);
  if(amount+other>totalCash)throw Error('预留资金超过现有现金');writeDoc(p.id,'plan',{...p.payload,reserved:amount});
 }else if(action==='plan.pay'){
  const p=doc(body.planId),a=cash(body.accountId),n=minor(String(body.amount));
  if(p.kind!=='plan'||['COMPLETED','CANCELLED'].includes(p.payload.status))throw Error('计划已结束');if(!n)throw Error('金额必须大于0');
  if(p.payload.budgetStatus!=='APPROVED')throw Error('请先确认正式预算');
  journal('PAYMENT',n,[entry(a,-n),entry(system('expense'),n)],{planId:p.id,accountId:a.id,note:String(body.note??'计划消费付款').slice(0,300),relatedAssetId:body.relatedAssetId?account(body.relatedAssetId).id:null});
  writeDoc(p.id,'plan',{...p.payload,reserved:Math.max(0,(p.payload.reserved??0)-n),status:'IN_PROGRESS'});
 }else if(action==='transaction.refund'){
  const original:any=await db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND id=? AND kind='PAYMENT' AND status='POSTED'").bind(ds,text(body.transactionId)).first();if(!original)throw Error('原付款不存在');original.metadata=parse(original.metadata);
  const a=account(original.metadata.accountId),n=minor(String(body.amount));if(!n)throw Error('金额必须大于0');
  const refunds:any=await db.prepare("SELECT COALESCE(SUM(total_minor),0) AS total FROM transactions WHERE dataset_id=? AND original_id=? AND kind='REFUND' AND status='POSTED'").bind(ds,original.id).first();const returned=refunds.total;if(returned+n>original.total_minor)throw Error('超过剩余可退金额');
  journal('REFUND',n,[entry(a,n),entry(system('expense'),-n)],{planId:original.metadata.planId,accountId:a.id,note:'原消费退款'},original.id);
 }else if(action==='loan.pay'){
  const l=account(body.loanId),a=cash(body.accountId),n=minor(String(body.principal)),interest=minor(String(body.interest));if(l.kind!=='LIABILITY'||l.currency!=='CNY')throw Error('贷款账户无效');if(n>l.balance||n+interest===0)throw Error('本金超过剩余贷款或金额无效');
  journal('LOAN_PAYMENT',n+interest,[...(n?[entry(l,n)]:[]),entry(a,-n-interest),...(interest?[entry(system('expense'),interest)]:[])],{loanId:l.id,accountId:a.id,principal:n,interest,note:'贷款实际还款'});
 }else if(!await extendFinance({action,body,state,rows,db,ds,account,cash,doc,writeDoc,journal,entry,system,result}))throw Error('暂不支持此操作');
 const resultJson=JSON.stringify(result);
 const statements=[db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)').bind(bookId,ds,key,fingerprint,input.revision,book.fence,Date.now(),resultJson),...rows];
 for(const t of journals){statements.push(db.prepare('INSERT INTO transactions VALUES(?,?,?,\'DRAFT\',?,?,?,?)').bind(ds,t.id,t.kind,t.amount,t.original,t.date,JSON.stringify({...t.metadata,idempotencyKey:key})));for(const e of t.entries)statements.push(db.prepare('INSERT INTO entries VALUES(?,?,?,?,?)').bind(ds,t.id,e.account_id,e.currency,e.amount));statements.push(db.prepare("UPDATE transactions SET status='POSTED' WHERE dataset_id=? AND id=?").bind(ds,t.id));}
 statements.push(db.prepare('UPDATE books SET revision=revision+1 WHERE id=?').bind(bookId),db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(ds,uid(),new Date().toISOString(),actor,action,JSON.stringify({key,result,body:{...body,reason:body.reason??null}})));
 try{await db.batch(statements);}catch(e:any){let after:any;try{after=await db.prepare('SELECT * FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,ds,key).first();}catch{throw Error('UNKNOWN:写入结果未确认，请保持原请求重试');}if(after&&after.request_hash===fingerprint)return parse(after.result_json);const msg=String(e?.message??'');if(/STALE|LOCKED|UNIQUE/.test(msg))throw Error('CONFLICT:数据已更新或请求重复，请刷新');if(/INSUFFICIENT/.test(msg))throw Error('现金余额不足');if(/REFUND_LIMIT/.test(msg))throw Error('超过可退金额');throw Error('UNKNOWN:写入结果未确认，请保持原请求重试');}
 return result;
}

export function publicSnapshot(state:any){return {...state,documents:state.documents.map((d:any)=>d.kind==='attachment'?{...d,payload:{name:d.payload.name,mime:d.payload.mime,size:d.payload.size,planId:d.payload.planId,createdAt:d.payload.createdAt,archived:d.payload.archived}}:d),book:{revision:state.book.revision,dataset:state.book.active_dataset},accounts:state.accounts.filter((a:any)=>a.category!=='system'),audit:state.audit.map((e:any)=>({id:e.id,created_at:e.created_at,action:e.action,actor_ref:e.actor_ref.slice(0,8)}))};}

export async function commandStatus(db:DB,key:string){const book=await ensureBook(db);const row:any=await db.prepare('SELECT result_json FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,book.active_dataset,text(key,150)).first();return row?{status:'committed',result:parse(row.result_json)}:{status:'not_found'};}

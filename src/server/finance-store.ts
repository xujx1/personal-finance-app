import {consumptionTypeOf,consumptionTypeForWrite} from '../domain/consumption.mjs';
import {getAssetTypes,assetTypeCatalogue,assetTypeForWrite,accountAssetType} from '../domain/asset-types.mjs';
import {ledgerBookId,assertLedgerAccess,ledgerWriteGuard} from './ledger-scope.ts';
import {extendFinance} from './finance-extensions.ts';
import { minor, decimal, balanceJournal } from '../domain/finance.mjs';
import {normalizeProposal} from '../domain/research.mjs';
import {normalizeExpenseDraft,expenseResearchNeedsRegeneration,consumptionAdviceNeedsRiskAcknowledgement} from '../domain/expense-plan.mjs';
import {beginFamilyApproval,currentFamilyApproval,approveFamilyPlan,applyFamilyApproval} from '../domain/family-approval.mjs';
import {normalizeLoanMetadata} from '../domain/loan.mjs';
import {normalizeDepositMetadata} from '../domain/deposit.mjs';
import {buildFinanceMembers,accountMember,resolveFinanceMember,ownerFields,captureAccountOwners,normalizeMemberProfile} from '../domain/member-ownership.mjs';

type DB = D1Database;

const uid=()=>crypto.randomUUID();
const market=(value:unknown)=>{if(value==null||value==='')return null;if(typeof value!=='string'||!['US','CN','HK','OTHER'].includes(value))throw Error('市场字段无效，请明确选择或留空');return value;};
const text=(v:unknown,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('请填写有效内容');return v.trim();};
const date=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('日期无效');return v;};
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const parse=(v:string)=>JSON.parse(v);
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(n=>n.toString(16).padStart(2,'0')).join('');

export async function ensureBook(db:DB){
 await assertLedgerAccess(db);const bookId=ledgerBookId(db);
 await db.prepare("INSERT OR IGNORE INTO books VALUES(?,?,0,0,0)").bind(bookId,bookId==='personal'?'initial':bookId+':initial').run();
 const book:any=await db.prepare('SELECT * FROM books WHERE id=?').bind(bookId).first();
 const statements=[];
 for(const currency of ['CNY','USD'])for(const [id,name,kind] of [['equity','开账与校正','EQUITY'],['expense','消费费用','EXPENSE'],['income','收入与差额','INCOME']])statements.push(db.prepare('INSERT OR IGNORE INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(book.active_dataset,`${id}:${currency}`,name,kind,'system',currency,'{}'));
 await db.batch(statements);return book;
}
export async function snapshot(db:DB){
 const book=await ensureBook(db), ds=book.active_dataset,bookId=ledgerBookId(db);
 const scope=(db as any).ledgerScope;const householdRevision=scope?(await db.prepare('SELECT revision FROM households WHERE id=? AND book_id=?').bind(scope.householdId,bookId).first() as any)?.revision:undefined;
 const [accounts,transactions,documents,audit,planTotals,cashflowTotals,planCashflowTotals,monthlyLedgerTotals,householdMembers,transactionEntries]=await Promise.all([
 db.prepare("SELECT a.*,COALESCE(SUM(CASE WHEN t.status='POSTED' THEN e.amount_minor ELSE 0 END),0) AS signed_balance FROM accounts a LEFT JOIN entries e ON e.dataset_id=a.dataset_id AND e.account_id=a.id LEFT JOIN transactions t ON t.dataset_id=e.dataset_id AND t.id=e.transaction_id WHERE a.dataset_id=? GROUP BY a.id ORDER BY a.rowid").bind(ds).all(),
 db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND status='POSTED' ORDER BY rowid DESC LIMIT 300").bind(ds).all(),
 db.prepare('SELECT * FROM documents WHERE dataset_id=?').bind(ds).all(),
 db.prepare('SELECT * FROM audit_events WHERE dataset_id=? ORDER BY rowid DESC LIMIT 100').bind(ds).all(),
 db.prepare("SELECT json_extract(metadata,'$.planId') AS planId,SUM(CASE WHEN kind IN('REFUND','PREPAYMENT_REFUND') THEN -total_minor WHEN kind IN('PREPAYMENT','LOAN_PAYMENT') OR kind='PAYMENT' AND COALESCE(json_extract(metadata,'$.fromPrepayment'),0)=0 THEN total_minor ELSE 0 END) AS paid,SUM(CASE WHEN kind='PAYMENT' THEN total_minor WHEN kind='REFUND' THEN -total_minor ELSE 0 END) AS consumed FROM transactions WHERE dataset_id=? AND status='POSTED' AND kind IN('PAYMENT','REFUND','PREPAYMENT','PREPAYMENT_REFUND','LOAN_PAYMENT') GROUP BY json_extract(metadata,'$.planId')").bind(ds).all(),
 db.prepare(`WITH cash_transactions AS (
 SELECT t.id,t.kind,t.business_date,t.metadata,a.currency,SUM(e.amount_minor) AS cash_delta
 FROM transactions t JOIN entries e ON e.dataset_id=t.dataset_id AND e.transaction_id=t.id
 JOIN accounts a ON a.dataset_id=e.dataset_id AND a.id=e.account_id
 WHERE t.dataset_id=? AND t.status='POSTED' AND a.category='cash' AND a.kind='ASSET'
 GROUP BY t.id,a.currency
 ) SELECT substr(business_date,1,7) AS month,currency,kind,SUM(cash_delta) AS cashDeltaMinor,
 SUM(CASE WHEN kind='LOAN_PAYMENT' THEN COALESCE(json_extract(metadata,'$.principal'),0) ELSE 0 END) AS principalMinor,
 SUM(CASE WHEN kind='LOAN_PAYMENT' THEN COALESCE(json_extract(metadata,'$.interest'),0) ELSE 0 END) AS interestMinor,
 COUNT(*) AS count FROM cash_transactions GROUP BY month,currency,kind ORDER BY month`).bind(ds).all(),
 db.prepare(`SELECT json_extract(metadata,'$.planId') AS planId,substr(business_date,1,7) AS month,
 SUM(CASE WHEN kind IN('REFUND','PREPAYMENT_REFUND') THEN -total_minor
 WHEN kind IN('PREPAYMENT','LOAN_PAYMENT') OR kind='PAYMENT' AND COALESCE(json_extract(metadata,'$.fromPrepayment'),0)=0 THEN total_minor ELSE 0 END) AS paidMinor,
 SUM(CASE WHEN kind='PAYMENT' THEN total_minor WHEN kind='REFUND' THEN -total_minor ELSE 0 END) AS consumedMinor
 FROM transactions WHERE dataset_id=? AND status='POSTED' AND kind IN('PAYMENT','PREPAYMENT','REFUND','PREPAYMENT_REFUND','LOAN_PAYMENT')
 AND json_extract(metadata,'$.planId') IS NOT NULL GROUP BY planId,month ORDER BY month`).bind(ds).all(),
 db.prepare(`SELECT substr(t.business_date,1,7) AS month,a.currency,a.kind AS accountKind,a.category,
 t.kind AS transactionKind,SUM(e.amount_minor) AS deltaMinor,
 SUM(CASE WHEN e.amount_minor>0 THEN e.amount_minor ELSE 0 END) AS inflowMinor,
 SUM(CASE WHEN e.amount_minor<0 THEN -e.amount_minor ELSE 0 END) AS outflowMinor,COUNT(*) AS entryCount
 FROM entries e JOIN transactions t ON t.dataset_id=e.dataset_id AND t.id=e.transaction_id
 JOIN accounts a ON a.dataset_id=e.dataset_id AND a.id=e.account_id
 WHERE t.dataset_id=? AND t.status='POSTED'
 GROUP BY month,a.currency,a.kind,a.category,t.kind ORDER BY month,a.currency,t.kind`).bind(ds).all(),
 (db as any).ledgerScope?db.prepare('SELECT user_id AS userId,display_name AS displayName,role,active,joined_at AS joinedAt FROM household_members WHERE household_id=? ORDER BY joined_at,user_id').bind((db as any).ledgerScope.householdId).all():Promise.resolve({results:[]}),
 db.prepare("SELECT e.* FROM entries e JOIN (SELECT id FROM transactions WHERE dataset_id=? AND status='POSTED' ORDER BY rowid DESC LIMIT 300) t ON t.id=e.transaction_id WHERE e.dataset_id=?").bind(ds,ds).all()
 ]);
 // A concurrent writer means this assembled snapshot must not be used as a mutation basis.
 await assertLedgerAccess(db);const latest:any=await db.prepare('SELECT * FROM books WHERE id=?').bind(bookId).first();
 const latestHouseholdRevision=scope?(await db.prepare('SELECT revision FROM households WHERE id=? AND book_id=?').bind(scope.householdId,bookId).first() as any)?.revision:undefined;if(latestHouseholdRevision!==householdRevision)throw Error('CONFLICT:家庭成员正在更新，请刷新');
 if(latest.revision!==book.revision||latest.active_dataset!==ds)throw Error('CONFLICT:数据正在更新，请刷新');
 const state:any={book,householdRevision,household:(db as any).ledgerScope??null,householdMembers:householdMembers.results.map((m:any)=>({...m,active:!!m.active})),monthlyLedgerTotals:{complete:true,source:'posted_entries',rows:monthlyLedgerTotals.results},planSummaries:planTotals.results,cashflowTotals:{complete:true,source:'posted_cash_entries',rows:cashflowTotals.results},planCashflowTotals:{complete:true,source:'posted_plan_transactions',rows:planCashflowTotals.results},accounts:accounts.results.map((r:any)=>({...r,metadata:parse(r.metadata),balance:r.kind==='LIABILITY'?-r.signed_balance:r.signed_balance})),transactions:transactions.results.map((r:any)=>({...r,metadata:parse(r.metadata),entries:transactionEntries.results.filter((e:any)=>e.transaction_id===r.id).map((e:any)=>({...e,amount:e.amount_minor}))})),documents:documents.results.map((r:any)=>({...r,payload:parse(r.payload)})),audit:audit.results.map((r:any)=>({...r,payload:parse(r.payload)}))};
 state.financeMembers=buildFinanceMembers(state,state.householdMembers);
 for(const a of state.accounts){if(a.category==='system')continue;const m=accountMember(a,state);a.metadata={...a.metadata,ownerMemberId:m.id,ownerLabel:m.name,ownerSubject:a.metadata.ownerSubject??m.userId??null};}
 for(const d of state.documents){if(d.kind!=='plan')continue;const id=d.payload.ownerMemberId??(d.payload.ownerSubject?'user:'+d.payload.ownerSubject:'unknown');const m=state.financeMembers.find((m:any)=>m.id===id||m.aliases?.includes(id));d.payload={...d.payload,ownerMemberId:m?.id??'unknown',ownerLabel:m?.name??'归属待核对'};}
 for(const p of state.documents.filter((d:any)=>d.kind==='plan'&&d.payload.familyApproval)){const a=currentFamilyApproval(p.payload.familyApproval,state.household?state.householdMembers:p.payload.familyApproval.required.map((userId:string)=>({userId,active:true})),state.householdRevision);if(a)p.payload={...p.payload,familyApproval:a,budgetStatus:a.status,approvedAt:a.status==='APPROVED'?p.payload.approvedAt:null};}
 for(const t of state.transactions){if(!Array.isArray(t.metadata.accountOwners)){const frozen=state.documents.find((d:any)=>d.kind==='transaction_ownership'&&d.id==='transaction-ownership:'+t.id);const owners=frozen?.payload.accountOwners??captureAccountOwners(state,t.entries,t.metadata);if(owners.length)t.metadata={...t.metadata,accountOwners:owners,ownershipInferred:true};}}
 return state;
}

export async function executeCommand(db:DB,input:any,actor:string,options:{signal?:AbortSignal}={}){
 options.signal?.throwIfAborted();
 const key=text(input.key,150), action=text(input.action,40), body=input.body??{};
 const approvalOnly=action==='plan.approve';await assertLedgerAccess(db,!approvalOnly);if((db as any).ledgerScope&&(db as any).ledgerScope.userId!==actor)throw Error('操作人必须是本人');const bookId=ledgerBookId(db);
 const fingerprint=await hash(JSON.stringify(canonical({action,body})));
 const book=await ensureBook(db),ds=book.active_dataset;
 const previous:any=await db.prepare('SELECT * FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,ds,key).first();
 if(previous){if(previous.request_hash!==fingerprint)throw Error('CONFLICT:同一请求标识的内容不同');return parse(previous.result_json);}
 if(input.revision!==book.revision)throw Error('CONFLICT:数据已经更新，请刷新后重试');
 const state=await snapshot(db);const rows:any[]=[], journals:any[]=[],stagedAccounts:any[]=[];let result:any={ok:true};
 // Legacy isolated ledgers have no login directory; the command actor is the only authenticated member.
 if(!state.household){state.householdMembers=[{userId:actor,displayName:'本人',active:true,role:'owner'}];state.financeMembers=buildFinanceMembers(state,state.householdMembers);}
 const chosenOwner=(requested:any,fallback:string)=>ownerFields(state,requested===undefined?fallback:requested);
 const assertCashMember=(a:any,memberId:any)=>{if(memberId!==undefined&&resolveFinanceMember(state,memberId,{write:true}).id!==accountMember(a,state).id)throw Error('资金成员与现金账户归属不一致');return a;};
 const freezeHistory=async(a:any)=>{
  const history=await db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND status='POSTED' AND json_type(metadata,'$.accountOwners') IS NULL").bind(ds).all();
  if(!history.results.length)return;const allEntries=await db.prepare('SELECT * FROM entries WHERE dataset_id=?').bind(ds).all();
  for(const t of history.results as any[]){if(state.documents.some((d:any)=>d.kind==='transaction_ownership'&&d.id==='transaction-ownership:'+t.id))continue;const metadata=parse(t.metadata),entries=allEntries.results.filter((e:any)=>e.transaction_id===t.id).map((e:any)=>({...e,amount:e.amount_minor}));const owners=captureAccountOwners(state,entries,metadata);if(!owners.some((o:any)=>o.accountId===a.id))continue;rows.push(db.prepare('INSERT OR IGNORE INTO documents VALUES(?,?,?,?)').bind(ds,'transaction-ownership:'+t.id,'transaction_ownership',JSON.stringify({transactionId:t.id,accountOwners:owners,ownershipInferred:true,capturedAt:new Date().toISOString()})));}
 };
 const account=(id:string)=>{const a=state.accounts.find((a:any)=>a.id===id);if(!a||a.archived)throw Error('账户不存在或已归档');return a;};
 const cash=(id:string)=>{const a=account(id);if(a.category!=='cash'||a.currency!=='CNY'||a.kind!=='ASSET')throw Error('请选择人民币现金账户');return assertCashMember(a,body.cashMemberId);};
 const doc=(id:string)=>{const d=state.documents.find((d:any)=>d.id===id);if(!d)throw Error('记录不存在');return d;};
 const writeDoc=(id:string,kind:string,payload:any)=>{if(state.documents.some((d:any)=>d.id===id&&d.kind==='monthly_report_archive'))throw Error('已保存月报为不可修改的归档，请另存新版');return rows.push(db.prepare('INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(dataset_id,id) DO UPDATE SET payload=excluded.payload').bind(ds,id,kind,JSON.stringify(payload)));};
 const journal=(kind:string,amount:number,entries:any[],metadata:any={},original:string|null=null)=>{
  const merged=Object.values(entries.reduce((m:any,e:any)=>{const id=e.account_id;if(!m[id])m[id]={...e};else m[id].amount+=e.amount;return m;},{})).filter((e:any)=>e.amount!==0) as any[];
  balanceJournal(merged);metadata={...metadata,accountOwners:captureAccountOwners(state,merged,metadata,stagedAccounts),recordedBy:actor};const id=uid();journals.push({id,kind,amount,entries:merged,metadata,original,date:date(metadata.businessDate??body.date??localDate())});result.transactionId=id;return id;
 };
 const entry=(a:any,amount:number)=>({account_id:a.id,currency:a.currency,amount});
 const system=(id:string,currency='CNY')=>({id:`${id}:${currency}`,currency});
 if(action==='member.save'){
  if(body.id!==undefined&&(typeof body.id!=='string'||!/^person:[A-Za-z0-9_-]{1,100}$/.test(body.id)||!state.documents.some((d:any)=>d.id===body.id&&d.kind==='financial_member')))throw Error('记账成员不存在');
  const profile=normalizeMemberProfile(body,state),id=body.id??'person:'+uid();writeDoc(id,'financial_member',{...profile,id});result.id=id;
 }else if(action==='account.owner.set'){
  const a=account(text(body.id));if(a.category==='system'||a.category==='prepayment')throw Error('此账户归属不能直接修改');const owner=chosenOwner(body.ownerMemberId,accountMember(a,state).id);if(owner.ownerMemberId!==accountMember(a,state).id)await freezeHistory(a);rows.push(db.prepare('UPDATE accounts SET metadata=? WHERE dataset_id=? AND id=?').bind(JSON.stringify({...a.metadata,...owner}),ds,a.id));result.id=a.id;
 }else if(action==='preferences.save'){
  const previous=state.documents.find((d:any)=>d.kind==='preferences')?.payload??{};
  const list=(v:any)=>{if(v==null)return [];if(!Array.isArray(v)||v.length>50)throw Error('偏好条目过多');return v.map((x:any)=>text(x,150));};
  writeDoc('preferences','preferences',{ownedProducts:list(body.ownedProducts??previous.ownedProducts),visitedDestinations:list(body.visitedDestinations??previous.visitedDestinations),mealPreferences:list(body.mealPreferences??previous.mealPreferences),preferredMarkets:list(body.preferredMarkets??previous.preferredMarkets),availabilityNotes:list(body.availabilityNotes??previous.availabilityNotes),avoidRepetition:body.avoidRepetition==null?previous.avoidRepetition!==false:body.avoidRepetition!==false,source:'本人确认的偏好，不代表新消费',updatedAt:new Date().toISOString()});result.id='preferences';
 }else if(action==='financial.profile.save'){
  const optional=(v:any)=>v==null||v===''?null:minor(String(v));
  writeDoc('financial-profile','financial_profile',{monthlyIncomeMinor:optional(body.monthlyIncome),livingExpenseMinor:optional(body.livingExpense),emergencyReserveMinor:optional(body.emergencyReserve),historyComplete:body.historyComplete===true,updatedAt:new Date().toISOString()});result.id='financial-profile';
 }else if(action==='research.generated'){
  const payload=normalizeProposal(body),id=uid();writeDoc(id,'research_proposal',{...payload,consumptionType:consumptionTypeForWrite(payload),...(body.kind==='wealth'&&body.calculation?.version===1?{calculation:body.calculation}:{}),...(body.kind==='wealth'&&typeof body.modelSummary==='string'?{modelSummary:body.modelSummary.slice(0,1500)}:{}),sources:payload.sources.map((s:any)=>({...s,verification:'本站研究时取得的引用，正文结论仍需核实'})),status:'PENDING',createdAt:new Date().toISOString(),source:'本站研究Agent',question:typeof body.question==='string'?body.question.slice(0,3000):null,model:body.model,requestFingerprint:body.requestFingerprint??null,missing:body.missing,factsRevision:body.factsRevision});result.id=id;
 }else if(action==='research.submit'){
  const payload=normalizeProposal(body),id=uid();
  // External agents supply unverified references; only the server research fetch can attest to price evidence.
  if(payload.expenseDraft)payload.expenseDraft.items=payload.expenseDraft.items.map((item:any)=>{const downgrade=(x:any)=>({...x,...(x.sourceType==='retrieved_reference'?{sourceType:'scenario_estimate',checkedAt:null,priceEvidence:null}:{}),...(x.alternatives?{alternatives:x.alternatives.map(downgrade)}:{})});return downgrade(item)});
  if(payload.expenseDraft)payload.expenseDraft.comparisons=payload.expenseDraft.comparisons.map((comparison:any)=>({...comparison,price:null,checkedAt:null,priceEvidence:null,comparability:'unverified'}));
writeDoc(id,'research_proposal',{...payload,consumptionType:consumptionTypeForWrite(payload),status:'PENDING',createdAt:new Date().toISOString(),source:'外部Agent/MCP，来源未由本站重新核验',submittedBy:actor});result.id=id;
 }else if(action==='research.request'){
  if(!['travel','shopping','dining','wealth','monthly','images','recurring','assets','onboarding'].includes(body.kind))throw Error('研究类型无效');const id=uid();writeDoc(id,'research_request',{kind:body.kind,title:text(body.title,100),question:text(body.question,3000),status:'OPEN',createdAt:new Date().toISOString()});result.id=id;
 }else if(action==='research.accept'){
  const d=doc(text(body.proposalId));if(d.kind!=='research_proposal'||d.payload.kind==='wealth')throw Error('理财研究不转换为消费预算');if(d.payload.planId)return {ok:true,id:d.payload.planId};if(!d.payload.date)throw Error('请先提供方案日期');
  const id=uid();writeDoc(id,'plan',{...ownerFields(state,'family'),name:d.payload.title,consumptionType:consumptionTypeForWrite(d.payload),category:d.payload.kind==='travel'?'国内旅行':'大件采购',date:d.payload.date,end:d.payload.end,budget:d.payload.budget,status:'PLANNED',reserved:0,budgetStatus:'DRAFT',version:0,approvedAt:null,note:d.payload.summary,research:d.payload,proposalId:d.id});writeDoc(d.id,'research_proposal',{...d.payload,status:'SAVED_AS_DRAFT',planId:id});result.id=id;
 }else if(action==='advice.record'){
  const id=text(body.id),payload=body.payload;
  if(!payload||!['rules','model'].includes(payload.source)||!['可考虑','需缩减','建议推迟','信息不足'].includes(payload.verdict))throw Error('建议格式无效');
  writeDoc(id,'advice',{...payload,consumptionType:consumptionTypeForWrite(payload),status:'READY',approvalRevision:book.revision+1,dataset:ds});result.id=id;
 }else if(action==='advice.accept'){
  const a=doc(text(body.adviceId));if(a.kind!=='advice')throw Error('建议不存在');
  const researchSource=a.payload.researchProposalId?state.documents.find((document:any)=>document.id===a.payload.researchProposalId&&document.kind==='research_proposal')?.payload:null;
  if(expenseResearchNeedsRegeneration(a.payload)||expenseResearchNeedsRegeneration(researchSource))throw Error('旧方案费用结构可能重复，请重新生成并AI复核后再采纳');
  if(a.payload.status==='ACCEPTED')return {ok:true,id:a.payload.accountId??a.payload.planId};
  const assetInput=a.payload.intent==='asset'?a.payload.inputs?.asset:null;let imageSource:any=null,imageRow:any=null;
  if(assetInput?.imageImportId!=null||assetInput?.imageRowIndex!=null){
   if(typeof assetInput.imageImportId!=='string'||!Number.isInteger(assetInput.imageRowIndex)||assetInput.imageRowIndex<0)throw Error('图片候选来源无效');
   imageSource=doc(assetInput.imageImportId);imageRow=imageSource.payload.rows?.[assetInput.imageRowIndex];
   if(imageSource.kind!=='image_import'||!imageRow||imageRow.kind!=='asset'||imageRow.currency!==assetInput.currency||imageRow.category!==assetInput.category)throw Error('图片资产候选不匹配，请重新核对原始候选');
   if(imageRow.confirmed){const existing=state.accounts.find((x:any)=>x.id===imageRow.accountId);if(!existing)throw Error('图片候选已处理，请核对历史资产');return {ok:true,id:existing.id};}
  }

  if(a.payload.dataset!==ds||a.payload.approvalRevision!==book.revision||a.payload.expiresAt<=Date.now())throw Error('CONFLICT:账本或建议已变化，请重新评估');
  if(a.payload.source!=='model'||a.payload.intent==='asset'&&a.payload.verdict!=='可考虑')throw Error('请先取得AI评估通过，再由本人确认；规则测算不能作为审批');
  const riskRequired=consumptionAdviceNeedsRiskAcknowledgement(a.payload);
  if(riskRequired&&body.acknowledgeRisk!==true)throw Error('请先了解未核实资料及资金风险，并由本人明确确认后提交家庭审批');
  const riskAcknowledgement=riskRequired?{riskAcknowledgedBy:actor,riskAcknowledgedAt:new Date().toISOString()}:{};
  if(a.payload.intent==='asset'){
   const x=a.payload.inputs.asset;if(!x?.owned)throw Error('请先确认资产已经持有');const id=uid(),kind=x.category==='loan'?'LIABILITY':'ASSET',signed=kind==='LIABILITY'?-x.amountMinor:x.amountMinor;const owner=chosenOwner(body.ownerMemberId??x.ownerMemberId??a.payload.inputs.ownerMemberId,'user:'+actor);stagedAccounts.push({id,name:x.name,kind,category:x.category,currency:x.currency,metadata:owner});
   rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(ds,id,x.name,kind,x.category,x.currency,JSON.stringify({...owner,...(['cash','term_deposit'].includes(x.category)?normalizeDepositMetadata(x,{required:x.category==='term_deposit'}):{}),...(x.category==='loan'?normalizeLoanMetadata(x):{}),note:x.source,status:x.status,market:market(x.market),quantity:x.quantity,cost:x.cost,monthly:x.monthly,code:x.code,price:x.price,asOf:a.payload.inputs.date,adviceId:a.id})));
   if(signed)journal('OPENING',x.amountMinor,[{account_id:id,currency:x.currency,amount:signed},entry(system('equity',x.currency),-signed)],{accountId:id,reason:'本人确认AI审阅过的已有资产登记',adviceId:a.id,businessDate:a.payload.inputs.date});
   if(imageSource)writeDoc(imageSource.id,'image_import',{...imageSource.payload,rows:imageSource.payload.rows.map((row:any,index:number)=>index===x.imageRowIndex?{...row,confirmed:true,accountId:id,confirmedAt:new Date().toISOString()}:row)});
   writeDoc(a.id,'advice',{...a.payload,status:'ACCEPTED',accountId:id,acceptedAt:new Date().toISOString()});result.id=id;
  }else{
  if(a.payload.inputs.budgetMinor===null)throw Error('请先填写预算并重新评估');
  if(!a.payload.expenseDraft)throw Error('请先核对消费清单并重新AI评估，旧建议不能直接批准预算');
  const existing=a.payload.inputs.planId?doc(a.payload.inputs.planId):null;
  if(existing&&(existing.kind!=='plan'||['COMPLETED','CANCELLED'].includes(existing.payload.status)))throw Error('原计划已经结束，请重新评估');
  const id=existing?.id??uid(),old=existing?.payload??{};
  const expenseDraft=a.payload.expenseDraft?normalizeExpenseDraft(a.payload.expenseDraft):null;
  const requestedPlanOwner=body.ownerMemberId??a.payload.inputs.ownerMemberId;const planOwner=requestedPlanOwner===undefined&&existing?{ownerMemberId:old.ownerMemberId,ownerLabel:old.ownerLabel,ownerSubject:old.ownerSubject??null}:chosenOwner(requestedPlanOwner,'family');
  if(expenseDraft&&expenseDraft.totalMinor!==a.payload.inputs.budgetMinor)throw Error('清单与审批预算不一致，请重新评估');
  writeDoc(id,'plan',applyFamilyApproval({...old,...planOwner,...riskAcknowledgement,name:text(body.name??a.payload.inputs.question.slice(0,50),100),category:text(body.category??old.category??'其他',30),date:a.payload.inputs.date,end:a.payload.expenseEnd??(old.end&&old.end>=a.payload.inputs.date?old.end:a.payload.inputs.date),consumptionType:consumptionTypeForWrite({expenseDraft}),...(expenseDraft?{expenseDraft,itinerary:expenseDraft.itinerary,items:expenseDraft.items.filter((x:any)=>x.selected),comparisons:expenseDraft.comparisons}:{}),budget:a.payload.inputs.budgetMinor,status:old.status??'PLANNED',reserved:Math.min(old.reserved??0,Math.max(0,a.payload.inputs.budgetMinor-Number(state.planSummaries.find((x:any)=>x.planId===id)?.paid??0))),budgetStatus:'APPROVED',version:(old.version??0)+1,approvedAt:new Date().toISOString(),note:old.note??'本人采纳消费建议，实际付款另行记录',adviceId:a.id},beginFamilyApproval((old.familyApproval?.version??old.version??0)+1,state.householdMembers,actor,undefined,state.householdRevision)));
  writeDoc(a.id,'advice',{...a.payload,...riskAcknowledgement,status:'ACCEPTED',planId:id,acceptedAt:new Date().toISOString()});result.id=id;
  }
 }else if(action==='account.save'){
  const id=body.id?text(body.id):uid(), existing=state.accounts.find((a:any)=>a.id===id);
  const category=text(body.category,30);if(!['cash','term_deposit','fund','stock','property','loan','other'].includes(category))throw Error('资产类型无效');
  const currency=body.currency==='USD'?'USD':'CNY';const kind=category==='loan'?'LIABILITY':'ASSET';
  if(existing&&(existing.category==='system'||existing.currency!==currency||existing.kind!==kind||existing.category!==category))throw Error('不能修改账户类型或币种，请新增对应账户');
  if(body.day!==''&&body.day!=null&&(!Number.isInteger(Number(body.day))||Number(body.day)<1||Number(body.day)>31))throw Error('每月扣款日期无效');
  const depositMetadata=['cash','term_deposit'].includes(category)?normalizeDepositMetadata({...existing?.metadata,...Object.fromEntries(['bank','startDate','annualRate','maturityDate'].filter(k=>body[k]!==undefined).map(k=>[k,body[k]]))},{required:category==='term_deposit'}):{};
  const owner=body.ownerMemberId===undefined&&existing?{ownerMemberId:accountMember(existing,state).id,ownerLabel:accountMember(existing,state).name,ownerSubject:existing.metadata.ownerSubject??null}:chosenOwner(body.ownerMemberId,existing?accountMember(existing,state).id:'user:'+actor);if(existing&&owner.ownerMemberId!==accountMember(existing,state).id)await freezeHistory(existing);
  const assetTypeId=assetTypeForWrite(state,body.assetTypeId??existing?.metadata.assetTypeId,{category,kind,name:body.name,metadata:existing?.metadata??{}},existing?accountAssetType(existing,state)?.id:undefined);
  const metadata={...existing?.metadata,...depositMetadata,...owner,...(existing&&!existing.metadata.assetTypeId&&assetTypeId===accountAssetType(existing,state)?.id?{}:{assetTypeId}),market:body.market===undefined?existing?.metadata.market??null:market(body.market),code:String(body.code??existing?.metadata.code??'').slice(0,20),asOf:body.asOf?date(body.asOf):existing?.metadata.asOf??null,note:String(body.note??existing?.metadata.note??'').slice(0,2000),status:(body.status??existing?.metadata.status)==='redeeming'?'redeeming':'holding',quantity:String(body.quantity??existing?.metadata.quantity??''),cost:String(body.cost??existing?.metadata.cost??''),price:String(body.price??existing?.metadata.price??''),monthly:String(body.monthly??existing?.metadata.monthly??''),rate:String(body.rate??existing?.metadata.rate??''),day:body.day===''?null:body.day!=null?Number(body.day):existing?.metadata.day??null,maturityDate:body.maturityDate===''?null:body.maturityDate?date(body.maturityDate):existing?.metadata.maturityDate??null,repricingDate:body.repricingDate===''?null:body.repricingDate?date(body.repricingDate):existing?.metadata.repricingDate??null};
  if(category==='loan')Object.assign(metadata,normalizeLoanMetadata({...existing?.metadata,...Object.fromEntries(['rate','annualRate','startDate','maturityDate'].filter(k=>body[k]!==undefined).map(k=>[k,body[k]])),...(body.rate!==undefined&&body.annualRate===undefined?{annualRate:body.rate}:{})}));
  stagedAccounts.push({id,name:text(body.name,100),kind,category,currency,metadata});
  rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?) ON CONFLICT(dataset_id,id) DO UPDATE SET name=excluded.name,metadata=excluded.metadata').bind(ds,id,text(body.name,100),kind,category,currency,JSON.stringify(metadata)));
  const amount=minor(String(body.amount));const target=kind==='LIABILITY'?-amount:amount;const delta=target-(existing?.signed_balance??0);
  if(delta)journal(existing?'ADJUSTMENT':'OPENING',Math.abs(delta),[{account_id:id,currency,amount:delta},entry(system('equity',currency),-delta)],{reason:String(body.reason??'手工核对余额'),accountId:id});result.id=id;
 }else if(action==='account.archive'){
  const a=account(body.id);if(a.category==='system'||a.balance!==0)throw Error('请先核对余额并归零，或转出资金，再归档');rows.push(db.prepare('UPDATE accounts SET archived=1 WHERE dataset_id=? AND id=?').bind(ds,a.id));
 }else if(action==='transaction.add'||action==='transaction.record'){
  if(action==='transaction.record'){
   if(body.confirmed!==true)throw Error('请先确认该笔收入已经到账或支出已经支付');
   if(!['income','expense'].includes(body.type))throw Error('请选择实际收入或支出');
   if(date(body.date)>localDate())throw Error('不能提前记未来收支，请填写已实际发生的日期');
  }
  const a=cash(body.accountId),n=minor(String(body.amount));if(action==='transaction.record'&&a.metadata.asOf&&body.date<=a.metadata.asOf)throw Error('该日期已被银行余额快照覆盖，请通过历史图片核对确认余额覆盖范围');if(!n)throw Error('金额必须大于0');
  const income=body.type==='income';const e=income?[entry(a,n),entry(system('income'),-n)]:[entry(a,-n),entry(system('expense'),n)];
  journal(income?'INCOME':'EXPENSE',n,e,{consumptionType:consumptionTypeForWrite(body),note:text(body.note,300),accountId:a.id,relatedAssetId:body.relatedAssetId?account(body.relatedAssetId).id:null});
 }else if(action==='plan.approve'){
  if(Object.keys(body).some(k=>!['planId','version','confirmed'].includes(k)))throw Error('只能提交本人审批，审批人字段无效');if(body.confirmed!==true)throw Error('请本人确认审批');const p=doc(text(body.planId));if(p.kind!=='plan'||['COMPLETED','CANCELLED'].includes(p.payload.status))throw Error('计划不存在或已结束');writeDoc(p.id,'plan',approveFamilyPlan(p.payload,state.householdMembers,actor,body.version,undefined,state.householdRevision));result.id=p.id;
 }else if(action==='plan.schedule'){
  if(body.confirmed!==true)throw Error('请本人确认未来预算计划');const budget=minor(String(body.budget));if(!budget)throw Error('计划预算必须大于0');const when=date(body.date);if(when<=localDate())throw Error('请填写未来计划日期');const principal=body.principal==null?null:minor(String(body.principal)),interest=body.interest==null?null:minor(String(body.interest));const loan=body.loanId?account(text(body.loanId)):null;if(loan&&(loan.kind!=='LIABILITY'||loan.currency!=='CNY'))throw Error('贷款账户无效');if(loan&&(principal===null||interest===null||principal+interest!==budget||principal>loan.balance))throw Error('预计本金与利息须等于计划预算且不超过贷款余额');if(!loan&&(principal!==null||interest!==null))throw Error('请关联贷款账户');const id=uid();const payload:any={...chosenOwner(body.ownerMemberId,'user:'+actor),name:text(body.name,100),consumptionType:consumptionTypeForWrite(body),category:loan?'提前还贷':'未来计划',date:when,end:when,budget,status:'PLANNED',budgetStatus:'APPROVED',version:1,reserved:0,approvedAt:new Date().toISOString(),scheduleOnly:true,loanId:loan?.id??null,principal,interest,repaymentMode:loan?'reduce_monthly_keep_term':null,note:loan?'预计本金和利息，期限不变减少月供；只作计划，实际还款另行确认':'本人确认的未来计划，尚未付款'};Object.assign(payload,applyFamilyApproval(payload,beginFamilyApproval(1,state.householdMembers,actor,undefined,state.householdRevision)));writeDoc(id,'plan',payload);result.id=id;
 }else if(action==='plan.cancel'){
  if(Object.keys(body).some(k=>!['planId','version','confirmed'].includes(k)))throw Error('取消字段无效');if(body.confirmed!==true)throw Error('请确认同时取消计划和预算');const p=doc(text(body.planId));if(p.kind!=='plan')throw Error('计划不存在');
  if(body.version!==(p.payload.version??0))throw Error('CONFLICT:计划版本已变化，请刷新后重新确认');if(['COMPLETED','CANCELLED'].includes(p.payload.status))throw Error('计划已结束，不能再次取消');
  const cancelledPlan={id:p.id,name:p.payload.name,status:'CANCELLED',reserved:0,version:(p.payload.version??0)+1,cancelledAt:new Date().toISOString(),cancelledBy:actor};const {id,...cancelledPayload}=cancelledPlan;writeDoc(p.id,'plan',{...p.payload,...cancelledPayload});Object.assign(result,{id,revision:book.revision+1,dataset:ds,cancelledPlan});
 }else if(action==='plan.save'){
  const id=body.id?text(body.id):uid();const old=state.documents.find((d:any)=>d.id===id)?.payload??{};if(old.status==='CANCELLED')throw Error('已取消计划保留历史，不可重新编辑恢复');
  const budget=body.budget===''||body.budget==null?null:minor(String(body.budget));
  const status=body.status??old.status??'PLANNED';if(status==='CANCELLED')throw Error('取消请使用取消计划按钮并单独确认');if(!['DRAFT','PLANNED','BOOKED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(status))throw Error('计划状态无效');
  const approved=body.approve===true;if(approved&&budget===null)throw Error('确认预算前请填写金额');
  const datesChanged=old.date!==undefined&&(old.date!==body.date||old.end!==(body.end??body.date));
  if(old.expenseDraft&&(datesChanged||old.budget!==budget))throw Error('已审核行程或预算变更请通过AI重新评估');
  const changed=old.budget!==undefined&&(old.budget!==budget||datesChanged);
  const planOwner=body.ownerMemberId===undefined&&old.ownerMemberId?{ownerMemberId:old.ownerMemberId,ownerLabel:old.ownerLabel,ownerSubject:old.ownerSubject??null}:chosenOwner(body.ownerMemberId,'family');
  const payload={...old,...planOwner,consumptionType:consumptionTypeForWrite({...body,consumptionType:body.consumptionType??old.consumptionType,expenseDraft:old.expenseDraft}),name:text(body.name,100),category:text(body.category??'其他',30),date:date(body.date),end:date(body.end??body.date),budget,status,note:String(body.note??'').slice(0,3000),reserved:['COMPLETED','CANCELLED'].includes(status)?0:old.reserved??0,budgetStatus:approved?'APPROVED':changed?'DRAFT':old.budgetStatus??'DRAFT',version:(old.version??0)+(approved?1:0),approvedAt:approved?new Date().toISOString():old.approvedAt??null};
  if(payload.end<payload.date)throw Error('结束日期不能早于开始日期');const meaningfullyChanged=(consumptionTypeOf(old)!==payload.consumptionType||['name','category','date','end','budget','ownerMemberId','ownerSubject','note'].some(k=>(old[k]??null)!==((payload as any)[k]??null)));if(old.familyApproval&&meaningfullyChanged)Object.assign(payload,applyFamilyApproval(payload,beginFamilyApproval((old.familyApproval.version??old.version??0)+1,state.householdMembers,null,undefined,state.householdRevision)));else if(approved&&state.household)Object.assign(payload,applyFamilyApproval(payload,beginFamilyApproval((old.familyApproval?.version??old.version??0)+1,state.householdMembers,actor,undefined,state.householdRevision)));writeDoc(id,'plan',payload);result.id=id;
 }else if(action==='plan.reserve'){
  const p=doc(body.planId),amount=minor(String(body.amount));if(p.kind!=='plan'||['CANCELLED','COMPLETED'].includes(p.payload.status))throw Error('计划不可预留');
  const totalCash=state.accounts.filter((a:any)=>a.category==='cash'&&a.currency==='CNY'&&a.kind==='ASSET').reduce((n:number,a:any)=>n+a.balance,0);
  const other=state.documents.filter((d:any)=>d.kind==='plan'&&d.id!==p.id&&!['COMPLETED','CANCELLED'].includes(d.payload.status)).reduce((n:number,d:any)=>n+(d.payload.reserved??0),0);
  if(amount+other>totalCash)throw Error('预留资金超过现有现金');writeDoc(p.id,'plan',{...p.payload,reserved:amount});
 }else if(action==='plan.pay'){
  const p=doc(body.planId),a=cash(body.accountId),n=minor(String(body.amount));
  if(p.kind!=='plan'||['COMPLETED','CANCELLED'].includes(p.payload.status))throw Error('计划已结束');if(!n)throw Error('金额必须大于0');
  if(p.payload.loanId)throw Error('贷款计划请使用实际还款，不能将本金记为消费');
  if(p.payload.budgetStatus!=='APPROVED')throw Error('请先确认正式预算');
  journal('PAYMENT',n,[entry(a,-n),entry(system('expense'),n)],{consumptionType:consumptionTypeOf(p),planId:p.id,accountId:a.id,note:String(body.note??'计划消费付款').slice(0,300),relatedAssetId:body.relatedAssetId?account(body.relatedAssetId).id:null});
  writeDoc(p.id,'plan',{...p.payload,reserved:Math.max(0,(p.payload.reserved??0)-n),status:'IN_PROGRESS'});
 }else if(action==='transaction.refund'){
  const original:any=await db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND id=? AND kind='PAYMENT' AND status='POSTED'").bind(ds,text(body.transactionId)).first();if(!original)throw Error('原付款不存在');original.metadata=parse(original.metadata);
  const a=assertCashMember(account(original.metadata.accountId),body.cashMemberId),n=minor(String(body.amount));if(!n)throw Error('金额必须大于0');
  const refunds:any=await db.prepare("SELECT COALESCE(SUM(total_minor),0) AS total FROM transactions WHERE dataset_id=? AND original_id=? AND kind='REFUND' AND status='POSTED'").bind(ds,original.id).first();const returned=refunds.total;if(returned+n>original.total_minor)throw Error('超过剩余可退金额');
  journal('REFUND',n,[entry(a,n),entry(system('expense'),-n)],{consumptionType:consumptionTypeOf(original),planId:original.metadata.planId,accountId:a.id,note:'原消费退款'},original.id);
 }else if(action==='loan.pay'){
  const l=account(body.loanId),a=cash(body.accountId),n=minor(String(body.principal)),interest=minor(String(body.interest));if(l.kind!=='LIABILITY'||l.currency!=='CNY')throw Error('贷款账户无效');if(n>l.balance||n+interest===0)throw Error('本金超过剩余贷款或金额无效');
  const planned=body.planId?doc(body.planId):null;if(planned&&(planned.kind!=='plan'||planned.payload.loanId!==l.id||planned.payload.budgetStatus!=='APPROVED'||['COMPLETED','CANCELLED'].includes(planned.payload.status)))throw Error('贷款计划无效或未批准');if(date(body.date??localDate())>localDate())throw Error('不能提前记录未来实际还款');
  journal('LOAN_PAYMENT',n+interest,[...(n?[entry(l,n)]:[]),entry(a,-n-interest),...(interest?[entry(system('expense'),interest)]:[])],{loanId:l.id,accountId:a.id,principal:n,interest,planId:planned?.id??null,note:'贷款实际还款'});if(planned){const paid=Number(state.planSummaries.find((x:any)=>x.planId===planned.id)?.paid??0)+n+interest;const complete=paid>=planned.payload.budget;writeDoc(planned.id,'plan',{...planned.payload,status:complete?'COMPLETED':'IN_PROGRESS',reserved:complete?0:Math.max(0,(planned.payload.reserved??0)-n-interest)});}
 }else if(!await extendFinance({action,body,state,rows,db,ds,account,cash,doc,writeDoc,journal,entry,system,result,assertCashMember,stagedAccounts,actor}))throw Error('暂不支持此操作');
 const resultJson=JSON.stringify(result);
 const accessGuard=ledgerWriteGuard(db,approvalOnly,state.householdRevision);const statements=[...(accessGuard?[accessGuard.statement]:[]),db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)').bind(bookId,ds,key,fingerprint,input.revision,book.fence,Date.now(),resultJson),...rows];
 for(const t of journals){statements.push(db.prepare('INSERT INTO transactions VALUES(?,?,?,\'DRAFT\',?,?,?,?)').bind(ds,t.id,t.kind,t.amount,t.original,t.date,JSON.stringify({...t.metadata,idempotencyKey:key})));for(const e of t.entries)statements.push(db.prepare('INSERT INTO entries VALUES(?,?,?,?,?)').bind(ds,t.id,e.account_id,e.currency,e.amount));statements.push(db.prepare("UPDATE transactions SET status='POSTED' WHERE dataset_id=? AND id=?").bind(ds,t.id));}
 statements.push(db.prepare('UPDATE books SET revision=revision+1 WHERE id=?').bind(bookId),db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(ds,uid(),new Date().toISOString(),actor,action,JSON.stringify({key,result,body:{...body,reason:body.reason??null}})));
 if(accessGuard)statements.push(db.prepare('DELETE FROM household_guards WHERE id=?').bind(accessGuard.id));
 options.signal?.throwIfAborted();
 try{await db.batch(statements);}catch(e:any){let after:any;try{after=await db.prepare('SELECT * FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,ds,key).first();}catch{throw Error('UNKNOWN:写入结果未确认，请保持原请求重试');}if(after&&after.request_hash===fingerprint)return parse(after.result_json);const msg=String(e?.message??'');if(/STALE|LOCKED|UNIQUE/.test(msg))throw Error('CONFLICT:数据已更新或请求重复，请刷新');if(/INSUFFICIENT/.test(msg))throw Error('现金余额不足');if(/REFUND_LIMIT/.test(msg))throw Error('超过可退金额');throw Error('UNKNOWN:写入结果未确认，请保持原请求重试');}
 return result;
}

export function publicSnapshot(state:any){return {...state,assetTypes:getAssetTypes(state),assetTypeVersion:assetTypeCatalogue(state).version,documents:state.documents.map((d:any)=>d.kind==='monthly_report_archive'?{...d,payload:{month:d.payload.month,version:d.payload.version,fingerprint:d.payload.fingerprint,createdAt:d.payload.createdAt,sourceRevision:d.payload.sourceRevision}}:d.kind==='attachment'?{...d,payload:{name:d.payload.name,mime:d.payload.mime,size:d.payload.size,planId:d.payload.planId,createdAt:d.payload.createdAt,archived:d.payload.archived}}:d),book:{revision:state.book.revision,dataset:state.book.active_dataset},accounts:state.accounts.filter((a:any)=>a.category!=='system'),audit:state.audit.map((e:any)=>({id:e.id,created_at:e.created_at,action:e.action,actor_ref:e.actor_ref.slice(0,8)}))};}

export async function commandStatus(db:DB,key:string){const book=await ensureBook(db),bookId=ledgerBookId(db);const row:any=await db.prepare('SELECT result_json FROM commands WHERE book_id=? AND dataset_id=? AND idempotency_key=?').bind(bookId,book.active_dataset,text(key,150)).first();await assertLedgerAccess(db);return row?{status:'committed',result:parse(row.result_json)}:{status:'not_found'};}

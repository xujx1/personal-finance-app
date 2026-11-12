import {ledgerBookId,assertLedgerAccess} from './ledger-scope.ts';
import {accountMember,captureAccountOwners,memberMatchesTransaction,resolveFinanceMember} from '../domain/member-ownership.mjs';
import {buildMonthlyReport} from '../domain/monthly-report.mjs';
import {buildAssetGoalOverview,getAssetGoal} from '../domain/asset-goals.mjs';
import {annualForecast} from '../domain/planning.mjs';

export const strictKeys=(p:any,keys:string[])=>{if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!keys.includes(k)))throw Error('工具参数包含不允许的字段')};
const date=(v:any)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('日期无效');return v};
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const evidenceHash=async(v:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(v)))))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function unchanged(db:any,state:any){await assertLedgerAccess(db);const b:any=await db.prepare('SELECT revision,active_dataset FROM books WHERE id=?').bind(ledgerBookId(db)).first();if(b?.revision!==state.book.revision||b?.active_dataset!==state.book.active_dataset)throw Error('CONFLICT:账本已变化，请重新读取全部分页或月报依据');}
export async function listLedgerTransactions(db:any,state:any,args:any={}){
 strictKeys(args,['from','through','limit','cursor','memberId','accountId','expected_revision']);
 const from=args.from==null?'0001-01-01':date(args.from),through=args.through==null?'9999-12-31':date(args.through),limit=args.limit??50;if(from>through||!Number.isInteger(limit)||limit<1||limit>100)throw Error('流水区间或分页大小无效');
 if(args.expected_revision!=null&&args.expected_revision!==state.book.revision)throw Error('CONFLICT:分页依据已变化，请重新读取');
 const memberId=args.memberId??'all',accountId=args.accountId??null;
 if(memberId!=='all'&&resolveFinanceMember(state,memberId).id==='unknown'&&memberId!=='unknown')throw Error('家庭成员不存在');
 if(accountId!==null&&!state.accounts.some((a:any)=>a.id===accountId&&a.category!=='system'))throw Error('账户不属于当前家庭');
 const scope={from,through,memberId,accountId};let offset=0;
 if(args.cursor){try{const c=JSON.parse(atob(args.cursor));if(c.revision!==state.book.revision||JSON.stringify(c.scope)!==JSON.stringify(scope)||!Number.isSafeInteger(c.offset)||c.offset<0)throw Error();offset=c.offset;}catch{throw Error('CONFLICT:分页标识无效或依据已变化，请从首页重读');}}
 const ds=state.book.active_dataset,rows:any=await db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND status='POSTED' AND business_date>=? AND business_date<=? ORDER BY business_date,id LIMIT ? OFFSET ?").bind(ds,from,through,limit+1,offset).all(),page=rows.results.slice(0,limit),ids=page.map((t:any)=>t.id);
 const entries:any=ids.length?await db.prepare('SELECT * FROM entries WHERE dataset_id=? AND transaction_id IN('+ids.map(()=>'?').join(',')+')').bind(ds,...ids).all():{results:[]};
 const result=page.map((t:any)=>{const metadata=JSON.parse(t.metadata),journalEntries=entries.results.filter((e:any)=>e.transaction_id===t.id),frozen=state.documents.find((d:any)=>d.id==='transaction-ownership:'+t.id)?.payload.accountOwners;return {...t,metadata:{...metadata,accountOwners:metadata.accountOwners??frozen??captureAccountOwners(state,journalEntries,metadata)},entries:journalEntries};}).filter((t:any)=>memberMatchesTransaction(t,memberId,state)&&(!accountId||t.entries.some((e:any)=>e.account_id===accountId)||t.metadata.accountId===accountId)).map((t:any)=>({id:t.id,kind:t.kind,date:t.business_date,totalMinor:t.total_minor,amountUnit:'minor currency units; see entries.currency',note:t.metadata.note??t.metadata.reason??'',balanceIncluded:t.metadata.balanceIncluded===true,accountId:t.metadata.accountId??null,planId:t.metadata.planId??null,accountOwners:t.metadata.accountOwners,entries:t.entries.map((e:any)=>({accountId:e.account_id,currency:e.currency,amountMinor:e.amount_minor}))}));
 await unchanged(db,state);const more=rows.results.length>limit;
 return {data_revision:state.book.revision,rows:result,complete:!more,nextCursor:more?btoa(JSON.stringify({revision:state.book.revision,scope,offset:offset+limit})):null,units:'All *Minor fields are integer CNY cents / USD cents; never yuan.',coverage:'仅本站已过账记录；完成所有分页才表示本次筛选读取完整，不能视为完整银行对账单。'};
}
const add=(a:number,b:number)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error('月报金额超出精确范围');return n};
export async function getMonthlyContext(db:any,state:any,month:string){
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('月份无效');
 const report=buildMonthlyReport(state,month);if(!report.available)throw Error(report.reason);
 const ds=state.book.active_dataset,raw:any=await db.prepare(`SELECT t.id,t.kind,t.metadata,e.account_id,e.currency,e.amount_minor FROM transactions t JOIN entries e ON e.dataset_id=t.dataset_id AND e.transaction_id=t.id JOIN accounts a ON a.dataset_id=e.dataset_id AND a.id=e.account_id WHERE t.dataset_id=? AND t.status='POSTED' AND substr(t.business_date,1,7)=? AND a.category='cash' AND a.kind='ASSET' ORDER BY t.id,e.account_id`).bind(ds,month).all();
 const groups=new Map<string,any>();
 const group=(memberId:string,memberName:string,currency:string)=>{const key=memberId+':'+currency;if(!groups.has(key))groups.set(key,{memberId,memberName,currency,incomeMinor:0,spendingMinor:0,refundMinor:0,loanPrincipalMinor:0,loanInterestMinor:0,businessCashNetMinor:0,openingCorrectionMinor:0,transferNetMinor:0,includedHistoryIncomeMinor:0,includedHistorySpendingMinor:0,entryCount:0});return groups.get(key)};
 for(const r of raw.results){const metadata=JSON.parse(r.metadata),frozen=metadata.accountOwners??state.documents.find((d:any)=>d.id==='transaction-ownership:'+r.id)?.payload.accountOwners,a=state.accounts.find((a:any)=>a.id===r.account_id),owner=frozen?.find((o:any)=>o.accountId===r.account_id),memberId=owner?.memberId??accountMember(a,state).id,key=memberId+':'+r.currency;
  const g=group(memberId,owner?.memberName??accountMember(a,state).name,r.currency);g.entryCount++;
  if(['OPENING','ADJUSTMENT'].includes(r.kind))g.openingCorrectionMinor=add(g.openingCorrectionMinor,r.amount_minor);
  else if(r.kind==='TRANSFER')g.transferNetMinor=add(g.transferNetMinor,r.amount_minor);
  else{g.businessCashNetMinor=add(g.businessCashNetMinor,r.amount_minor);if(r.kind==='INCOME')g.incomeMinor=add(g.incomeMinor,r.amount_minor);if(['EXPENSE','PAYMENT'].includes(r.kind)&&r.amount_minor<0)g.spendingMinor=add(g.spendingMinor,-r.amount_minor);if(['REFUND','PREPAYMENT_REFUND'].includes(r.kind))g.refundMinor=add(g.refundMinor,r.amount_minor);if(r.kind==='LOAN_PAYMENT'){g.loanPrincipalMinor=add(g.loanPrincipalMinor,metadata.principal??0);g.loanInterestMinor=add(g.loanInterestMinor,metadata.interest??0);}}
  groups.set(key,g);
 }
 // Covered historical receipts have equity/income-or-expense entries and no
 // bank entry. Attribute their journal activity without inventing cash movement.
 const included:any=await db.prepare("SELECT id,kind,total_minor,metadata FROM transactions WHERE dataset_id=? AND status='POSTED' AND substr(business_date,1,7)=? AND kind IN('INCOME','EXPENSE') AND json_extract(metadata,'$.balanceIncluded')=1").bind(ds,month).all();
 for(const t of included.results){const m=JSON.parse(t.metadata),a=state.accounts.find((a:any)=>a.id===m.accountId),frozen=m.accountOwners??state.documents.find((d:any)=>d.id==='transaction-ownership:'+t.id)?.payload.accountOwners,owner=frozen?.find((o:any)=>o.accountId===m.accountId),g=group(owner?.memberId??accountMember(a,state).id,owner?.memberName??accountMember(a,state).name,a?.currency??'CNY');g.entryCount++;if(t.kind==='INCOME'){g.incomeMinor=add(g.incomeMinor,t.total_minor);g.includedHistoryIncomeMinor=add(g.includedHistoryIncomeMinor,t.total_minor)}else{g.spendingMinor=add(g.spendingMinor,t.total_minor);g.includedHistorySpendingMinor=add(g.includedHistorySpendingMinor,t.total_minor)}}
 // Revenue/expense recognition is distinct from cash movement (notably
 // prepaid consumption and loan interest). Freeze the original funding owner.
 const journal:any=await db.prepare(`SELECT t.id,t.metadata,a.kind,e.currency,e.amount_minor FROM transactions t JOIN entries e ON e.dataset_id=t.dataset_id AND e.transaction_id=t.id JOIN accounts a ON a.dataset_id=e.dataset_id AND a.id=e.account_id WHERE t.dataset_id=? AND t.status='POSTED' AND substr(t.business_date,1,7)=? AND a.kind IN('INCOME','EXPENSE') ORDER BY t.id,e.account_id`).bind(ds,month).all();
 const journalGroups=new Map<string,any>();
 for(const r of journal.results){const m=JSON.parse(r.metadata),frozen=m.accountOwners??state.documents.find((d:any)=>d.id==='transaction-ownership:'+r.id)?.payload.accountOwners,owner=frozen?.find((o:any)=>o.accountId===m.accountId),a=state.accounts.find((a:any)=>a.id===m.accountId),memberId=owner?.memberId??accountMember(a,state).id,key=memberId+':'+r.currency,g=journalGroups.get(key)??{memberId,memberName:owner?.memberName??accountMember(a,state).name,currency:r.currency,confirmedIncomeMinor:0,confirmedExpenseMinor:0};if(r.kind==='INCOME')g.confirmedIncomeMinor=add(g.confirmedIncomeMinor,-r.amount_minor);else g.confirmedExpenseMinor=add(g.confirmedExpenseMinor,r.amount_minor);journalGroups.set(key,g)}
 const memberJournalActivity=[...journalGroups.values()].sort((a,b)=>(a.memberId+a.currency).localeCompare(b.memberId+b.currency));
 const memberCashflow=[...groups.values()].sort((a,b)=>(a.memberId+a.currency).localeCompare(b.memberId+b.currency));
 const planRows=state.planCashflowTotals?.complete===true?state.planCashflowTotals.rows:[];
 const plans=state.documents.filter((d:any)=>d.kind==='plan'&&(d.payload.date?.slice(0,7)<=month&&(d.payload.end??d.payload.date)?.slice(0,7)>=month||planRows.some((r:any)=>r.planId===d.id&&r.month===month))).map((d:any)=>{const p=d.payload,actual=planRows.find((r:any)=>r.planId===d.id&&r.month===month);return {id:d.id,name:p.name,ownerMemberId:p.ownerMemberId,date:p.date,end:p.end,status:p.status,approvalStatus:p.budgetStatus,budgetMinor:p.budget,paidThisMonthMinor:actual?.paidMinor??0,consumedThisMonthMinor:actual?.consumedMinor??0};}).sort((a:any,b:any)=>a.id.localeCompare(b.id));
 const goal=getAssetGoal(state),monthlyAccumulation=buildAssetGoalOverview(state,(a:any)=>a.currency==='CNY'?a.balance:null,month).monthly;
 const rules=state.documents.filter((d:any)=>d.kind==='recurring_rule').map((d:any)=>({id:d.id,...d.payload})).sort((a:any,b:any)=>a.id.localeCompare(b.id));
 const accounts=state.accounts.filter((a:any)=>a.category!=='system').map((a:any)=>({id:a.id,currency:a.currency,balanceMinor:a.balance,category:a.category,ownerMemberId:accountMember(a,state).id})).sort((a:any,b:any)=>a.id.localeCompare(b.id));
 const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),forecast=annualForecast(state,asOf,3);
 const basis={month,report,memberCashflow,memberJournalActivity,plans,goal,monthlyAccumulation,rules,accounts,forecast,asOf};
 await unchanged(db,state);
 return {...basis,basisFingerprint:await evidenceHash(basis),data_revision:state.book.revision,units:'金额字段Minor以及goal中的金额为整数分；monthlyAccumulation.change/opening/closing/corrections为人民币分；forecast中的opening/income/fixed/planned/pending/closing及rules.amount/principal均为CNY分；rules.day是每月日期，百分比为百分数。按币种单列，不推定历史汇率。',coverage:'全量本站过账分录，真实银行流水覆盖完整性未知。成员归属优先使用历史冻结快照；incomeMinor/spendingMinor包含已含余额的历史收支，其includedHistory字段单列且不计入businessCashNetMinor。memberJournalActivity为按原付款成员确认的收入/费用（含预付转消费及贷款利息），不得再与memberCashflow重复相加。资产增加不是收益；开账校正和内部转账分列。预测从当前现金与asOf出发，不是历史月末银行余额。'};
}

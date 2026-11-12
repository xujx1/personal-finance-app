import {extendMemberships} from './memberships.ts';
import {extendPensionClassification} from './pension-classification.ts';
import {extendPensionInvestment} from './pension-investment.ts';
import {extendPension} from './pension.ts';
import {consumptionTypeOf,consumptionTypeForWrite} from '../domain/consumption.mjs';
import {normalizeAssetTypes,assetTypeCatalogue} from '../domain/asset-types.mjs';
import {extendAssetTrade} from './asset-trade.ts';
import {extendMcpDraft} from './mcp-draft.ts';
import {extendMonthlyReports} from './monthly-report-document.ts';
import {extendSkills} from '../domain/skill-catalog.mjs';
import {beginFamilyApproval,applyFamilyApproval} from '../domain/family-approval.mjs';
import {normalizeAssetGoalInput,getAssetGoal} from '../domain/asset-goals.mjs';
import {minor,decimal} from '../domain/finance.mjs';
import {accountMember,ownerFields} from '../domain/member-ownership.mjs';
const txt=(x:any,n=200)=>{if(typeof x!=='string'||!x.trim()||x.length>n)throw Error('内容无效');return x.trim()};
const day=(x:any)=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||new Date(x).toISOString().slice(0,10)!==x)throw Error('日期无效');return x};
const positive=(x:any)=>{const n=minor(String(x));if(!n)throw Error('金额必须大于0');return n};
export async function extendFinance(c:any){
 if(extendMemberships(c))return true;
 if(extendPensionClassification(c))return true;
 if(extendPensionInvestment(c))return true;
 if(extendPension(c))return true;
 if(await extendMonthlyReports(c))return true;
 if(extendSkills(c))return true;
 if(await extendMcpDraft(c))return true;
 const {action,body,state,rows,db,ds,account,cash,doc,writeDoc,journal,entry,system,result,assertCashMember,stagedAccounts}=c;
 const metadata=(a:any,v:any)=>rows.push(db.prepare('UPDATE accounts SET metadata=? WHERE dataset_id=? AND id=?').bind(JSON.stringify(v),ds,a.id));

 if(action==='import.record'){
  const id=crypto.randomUUID();writeDoc(id,'image_import',{...body.payload,imageHash:txt(body.imageHash,100),createdAt:new Date().toISOString()});result.id=id;return true;
 }
 if(action==='import.confirm'){
  const d=doc(body.id),i=Number(body.index),r=d.payload.rows?.[i];
  if(d.kind!=='image_import'||!r||r.confirmed||body.confirmed!==true)throw Error('候选不存在、已处理或未确认');
  if(!['expense','income'].includes(r.kind))throw Error('资产请转AI投资助手；转账和退款请关联原始交易单独处理');
  const bank=cash(body.accountId),n=positive(body.amount??(r.amountMinor==null?'':decimal(r.amountMinor))),date=day(body.date??r.date);
  if(r.status==='pending'||r.currency!==bank.currency)throw Error('待付款或币种不符不能入账');
  const included=body.mode==='already_in_balance';if(!included&&body.mode!=='apply_balance')throw Error('请确认余额覆盖范围');
  if(!included&&bank.metadata.asOf&&date<=bank.metadata.asOf&&!body.snapshotOverrideReason)throw Error('该日期已被银行余额快照覆盖；请按历史已含余额录入，或说明为何是快照之后的新交易');
  if(included&&(!body.snapshotDate||date>day(body.snapshotDate)))throw Error('请核对快照日期与历史覆盖范围');
  const duplicate=await db.prepare("SELECT id FROM transactions WHERE dataset_id=? AND status='POSTED' AND business_date=? AND total_minor=? AND kind IN('EXPENSE','INCOME','PAYMENT') LIMIT 1").bind(ds,date,n).first();
  if(duplicate&&!body.duplicateReason)throw Error('同日同金额存在疑似重复记录，请核对并填写不同交易的理由');
  const income=r.kind==='income',basis=included?system('equity'):bank;
  journal(income?'INCOME':'EXPENSE',n,[entry(basis,income?n:-n),entry(system(income?'income':'expense'),income?-n:n)],{consumptionType:consumptionTypeForWrite({...r,type:r.kind,...(body.consumptionType!==undefined?{consumptionType:body.consumptionType}:{})}),businessDate:date,accountId:bank.id,note:txt(body.name??r.name,300),balanceIncluded:included,snapshotDate:included?body.snapshotDate:null,imageImport:d.id,rowIndex:i,duplicateReason:body.duplicateReason?txt(body.duplicateReason):null});
  if(included)metadata(bank,{...bank.metadata,asOf:body.snapshotDate});
  writeDoc(d.id,'image_import',{...d.payload,rows:d.payload.rows.map((x:any,j:number)=>j===i?{...x,confirmed:true,confirmedAt:new Date().toISOString()}:x)});result.id=d.id;return true;
 }

 if(action==='plan.details'){
  const p=doc(body.planId);if(p.kind!=='plan')throw Error('计划不存在');
  const options=(body.options??[]).map((x:any)=>({id:txt(x.id,30),name:txt(x.name,100),amount:minor(String(x.amount)),note:String(x.note??'').slice(0,2000)})),items=(body.items??[]).map((x:any)=>({name:txt(x.name,100),amount:minor(String(x.amount)),commitment:minor(String(x.commitment??'0')),due:x.due?day(x.due):null,payer:String(x.payer??'').slice(0,100),refundable:x.refundable===true,note:String(x.note??'').slice(0,500)}));
  if(p.payload.expenseDraft){const reviewed=p.payload.expenseDraft.items.filter((x:any)=>x.selected);if(items.length!==reviewed.length||items.some((x:any,i:number)=>x.name!==reviewed[i].name||x.amount!==reviewed[i].amount))throw Error('消费清单变更请返回AI重新评估');for(let i=0;i<items.length;i++)items[i]={...reviewed[i],...items[i]};}
  if(options.length>10||items.length>50||new Set(options.map((x:any)=>x.id)).size!==options.length)throw Error('明细或候选数量无效');
  if(items.reduce((n:number,x:any)=>n+x.amount,0)>(p.payload.budget??0))throw Error('明细总额超过正式预算，请重新AI评估');
  const chosen=options.find((x:any)=>x.id===body.selected);if(body.selected&&(!chosen||chosen.amount!==p.payload.budget))throw Error('执行方案金额与正式预算不一致，请重新AI评估');
  const payload={...p.payload,options,items,selectedOption:body.selected||null};if(p.payload.familyApproval&&JSON.stringify([p.payload.options??[],p.payload.items??[],p.payload.selectedOption??null])!==JSON.stringify([options,items,body.selected||null]))Object.assign(payload,applyFamilyApproval(payload,beginFamilyApproval(p.payload.familyApproval.version+1,state.householdMembers,null,undefined,state.householdRevision)));writeDoc(p.id,'plan',payload);result.id=p.id;return true;
 }
 if(action==='plan.prepay'){
  const p=doc(body.planId),bank=cash(body.accountId),n=positive(body.amount);if(p.kind!=='plan'||p.payload.budgetStatus!=='APPROVED'||['COMPLETED','CANCELLED'].includes(p.payload.status))throw Error('计划未批准或已结束');
  if(p.payload.loanId)throw Error('贷款计划不能使用消费预付款，请记录实际贷款还款');
  const id='prepaid:'+p.id,a={id,currency:'CNY'},existing=state.accounts.find((x:any)=>x.id===id),payer=accountMember(bank,state);if(existing&&accountMember(existing,state).id!==payer.id)throw Error('预付款归属与付款账户不同，请按个人归属分别安排计划');const owner=ownerFields(state,payer.id);stagedAccounts.push({...a,name:'预付款：'+p.payload.name,kind:'ASSET',category:'prepayment',metadata:{planId:p.id,...owner}});rows.push(db.prepare('INSERT OR IGNORE INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(ds,id,'预付款：'+p.payload.name,'ASSET','prepayment','CNY',JSON.stringify({planId:p.id,...owner})));
  journal('PREPAYMENT',n,[entry(bank,-n),entry(a,n)],{consumptionType:consumptionTypeOf(p),accountId:bank.id,planId:p.id,note:txt(body.note??'预订预付款，尚未确认消费')});writeDoc(p.id,'plan',{...p.payload,reserved:Math.max(0,(p.payload.reserved??0)-n),status:'BOOKED'});return true;
 }
 if(action==='plan.consume'||action==='plan.prepay.refund'){
  const refund=action==='plan.prepay.refund';let original:any;
  if(refund||body.transactionId)original=await db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND id=? AND kind='PREPAYMENT' AND status='POSTED'").bind(ds,body.transactionId).first();
  else original=await db.prepare("SELECT * FROM transactions WHERE dataset_id=? AND kind='PREPAYMENT' AND status='POSTED' AND json_extract(metadata,'$.planId')=? ORDER BY rowid LIMIT 1").bind(ds,body.planId).first();
  if(!original)throw Error('未找到原始预付款');const m=JSON.parse(original.metadata);if(!refund&&m.planId!==body.planId)throw Error('预付款不属于本计划');const a=account('prepaid:'+m.planId),bank=cash(m.accountId),n=positive(body.amount);
  const used:any=await db.prepare("SELECT COALESCE(SUM(total_minor),0) AS n FROM transactions WHERE dataset_id=? AND status='POSTED' AND (kind='PREPAYMENT_REFUND' AND original_id=? OR kind='PAYMENT' AND json_extract(metadata,'$.prepaymentId')=?)").bind(ds,original.id,original.id).first();
  if(n>a.balance||n+used.n>original.total_minor)throw Error('超过原预付款尚未消费或退款的金额');
  journal(refund?'PREPAYMENT_REFUND':'PAYMENT',n,[entry(a,-n),entry(refund?bank:system('expense'),n)],{consumptionType:m.consumptionType!==undefined?consumptionTypeOf({metadata:m}):consumptionTypeOf(state.documents.find((d:any)=>d.id===m.planId&&d.kind==='plan')),planId:m.planId,accountId:bank.id,prepaymentId:original.id,fromPrepayment:!refund,note:refund?'原预付款退款到账':'确认预付款已消费，不再扣现金'},refund?original.id:null);return true;
 }

 if(action==='reminder.save'){
  const id=body.id?txt(body.id):crypto.randomUUID(),old=body.id?doc(id).payload:{};if(!['date','price'].includes(body.type))throw Error('提醒类型无效');
  const levels=body.type==='price'?(body.levels??[]).map((x:any)=>{positive(x);return String(x)}):[];if(body.type==='price'&&(!/^[A-Z][A-Z0-9.]{0,9}$/.test(body.symbol??'')||!levels.length||levels.length>10))throw Error('股票代码或阈值无效');
  writeDoc(id,'reminder',{...old,name:txt(body.name,100),type:body.type,planId:body.planId?(doc(body.planId).kind==='plan'?body.planId:null):null,date:body.type==='date'?day(body.date):null,symbol:body.symbol??null,levels,enabled:body.enabled!==false});result.id=id;return true;
 }
 if(action==='reminder.check'){const d=doc(body.id);if(d.kind!=='reminder')throw Error('提醒不存在');writeDoc(d.id,'reminder',{...d.payload,previous:body.previous,sent:body.sent,checkedDate:body.checkedDate});return true}
 if(action==='notification.record'){const id=txt(body.id,200);writeDoc(id,'notification',{title:txt(body.title,100),message:txt(body.message,2000),date:day(body.date),read:false});result.id=id;return true}
 if(action==='notification.read'){const d=doc(body.id);if(d.kind!=='notification')throw Error('通知不存在');writeDoc(d.id,'notification',{...d.payload,read:true});return true}
 if(action==='asset.types.save'){
  if(Object.keys(body).some(k=>!['types','baseVersion'].includes(k)))throw Error('类型维护字段无效');const current=assetTypeCatalogue(state);if(body.baseVersion!==current.version)throw Error('CONFLICT:资产类型版本已变化，请刷新');const types=normalizeAssetTypes(body.types,state);
  const updated={...state,documents:state.documents.filter((d:any)=>d.kind!=='asset_type_catalog').concat({id:'asset-types',kind:'asset_type_catalog',payload:{types}})};const goal=getAssetGoal(state);if([3,4].includes(goal.schemaVersion))normalizeAssetGoalInput({...goal,targets:goal.targets.map((t:any)=>({...t,target:decimal(t.target)})),monthlyTarget:goal.monthlyTarget==null?null:decimal(goal.monthlyTarget)},updated);
  writeDoc('asset-types','asset_type_catalog',{types,version:current.version+1,updatedAt:new Date().toISOString()});result.id='asset-types';return true;
 }
 if(action==='savings.goal.save'){
  const id=body.id?txt(body.id):crypto.randomUUID();if(body.id&&doc(id).kind!=='savings_goal')throw Error('目标类型不符');if([2,3,4].includes(body.schemaVersion)){if(body.id&&![2,3,4].includes(doc(id).payload.schemaVersion))throw Error('旧目标保留历史，请新建分类目标');writeDoc(id,'savings_goal',{...normalizeAssetGoalInput(body,state),updatedAt:new Date().toISOString()});result.id=id;return true;}if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)throw Error('请选择目标资产');
  const ids=new Set();const items=body.items.map((x:any)=>{const a=account(x.accountId);if(a.kind!=='ASSET'||a.category==='prepayment'||ids.has(a.id))throw Error('目标资产无效或重复');ids.add(a.id);return {accountId:a.id,target:positive(x.amount),date:day(x.date)}});writeDoc(id,'savings_goal',{name:txt(body.name,100),items,updatedAt:new Date().toISOString()});result.id=id;return true;
 }
 if(action==='attachment.record'){const id=crypto.randomUUID();writeDoc(id,'attachment',{...body,createdAt:new Date().toISOString(),archived:false});result.id=id;return true}
 if(action==='attachment.archive'){const d=doc(body.id);if(d.kind!=='attachment')throw Error('附件不存在');writeDoc(d.id,'attachment',{...d.payload,archived:true});return true}
 if(action==='cash.transfer'){


  const a=account(body.fromId),b=account(body.toId),n=positive(body.amount);
  if(a.category!=='cash'||b.category!=='cash'||a.kind!=='ASSET'||b.kind!=='ASSET'||a.id===b.id||a.currency!==b.currency)throw Error('转账须在两个同币种现金账户之间');assertCashMember(a,body.cashMemberId??body.fromMemberId);assertCashMember(b,body.toMemberId);
  journal('TRANSFER',n,[entry(a,-n),entry(b,n)],{accountId:a.id,toId:b.id,note:txt(body.note??'本人账户内部转账')});return true;
 }
 if(extendAssetTrade(c))return true;
 if(action==='recurring.save'){
  const id=body.id?txt(body.id):crypto.randomUUID(),existing=body.id?doc(id):null,old=existing?.payload??{};if(existing&&existing.kind!=='recurring_rule')throw Error('规则类型不符');
  if(body.confirmed!==true)throw Error('请本人明确确认周期规则');
  if(!['income','expense','loan','investment'].includes(body.type))throw Error('规则类型无效');const bank=cash(body.accountId);
  const n=positive(body.amount),d=Number(body.day);if(!Number.isInteger(d)||d<1||d>31)throw Error('每月日期无效');
  const start=day(body.start),end=body.end?day(body.end):null;if(end&&end<start)throw Error('结束日期无效');
  if(body.type==='loan'&&account(body.loanId).currency!=='CNY')throw Error('周期贷款规则仅支持人民币贷款');
  if(body.type==='loan'&&account(body.loanId).kind!=='LIABILITY')throw Error('贷款账户无效');
  if(body.type==='loan'&&body.autoPost===true)throw Error('贷款每期本金和利息需按实际核实，不能固定本金自动入账');
  if(body.type==='investment'&&body.autoPost===true)throw Error('定投份额需每期核实，当前请使用待确认规则');
  if(body.type==='investment'&&(!['fund','stock'].includes(account(body.assetId).category)||account(body.assetId).currency!=='CNY'))throw Error('请选择人民币基金或股票账户');
  writeDoc(id,'recurring_rule',{name:txt(body.name,100),type:body.type,accountId:body.accountId,cashMemberId:accountMember(bank,state).id,loanId:body.loanId??null,assetId:body.assetId??null,amount:n,principal:null,day:d,start,end,autoPost:body.autoPost===true,paused:body.paused===true,version:(old.version??0)+1,confirmedAt:new Date().toISOString()});result.id=id;return true;
 }
 const loanBalances=new Map<string,number>();
 const post=(r:any,id:string,date:string)=>{
  const bank=cash(r.accountId),n=r.amount;assertCashMember(bank,r.cashMemberId);if(bank.metadata.asOf&&date<=bank.metadata.asOf)throw Error('该期已被银行余额快照覆盖，请核对历史流水，不能重复扣减');if(!Number.isSafeInteger(n)||n<=0)throw Error('实际发生金额无效');const meta={accountId:bank.id,ruleId:r.ruleId,occurrenceId:id,note:r.name};
  if(r.type==='loan'){const l=account(r.loanId),p=r.principal;if(l.metadata.asOf&&date<=l.metadata.asOf)throw Error('该期已被贷款余额快照覆盖，不能重复扣减本金');if(!Number.isSafeInteger(p)||p<0||p>n)throw Error('请核实本期实际本金，本金不能大于还款额');const remaining=loanBalances.get(l.id)??l.balance;if(p>remaining)throw Error('本期本金超过贷款余额，请调整规则');loanBalances.set(l.id,remaining-p);journal('LOAN_PAYMENT',n,[entry(bank,-n),...(p?[entry(l,p)]:[]),...(n-p?[entry(system('expense'),n-p)]:[])],{...meta,loanId:l.id,principal:p,interest:n-p,businessDate:date})}
  else if(r.type==='investment'){const a=account(r.assetId);journal('ASSET_BUY',n,[entry(bank,-n),entry(a,n)],{...meta,assetId:a.id,businessDate:date})}
  else{const income=r.type==='income';journal(income?'INCOME':'EXPENSE',n,[entry(bank,income?n:-n),entry(system(income?'income':'expense'),income?-n:n)],{...meta,businessDate:date})}
  writeDoc(id,'recurring_occurrence',{...r,status:'POSTED',date,postedAt:new Date().toISOString()});
 };
 if(action==='recurring.confirm'){
  const d=doc(body.id);if(d.kind!=='recurring_occurrence')throw Error('待确认记录不存在');if(d.payload.status==='POSTED'){result.id=d.id;return true}if(body.confirmed!==true)throw Error('请确认已实际发生');if(d.payload.type==='loan'&&(body.principal==null||body.principal===''))throw Error('请填写本期已核实的实际本金');const actualDate=day(body.date??d.payload.date);if(actualDate>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()))throw Error('不能提前确认未来银行扣款');const actual={...d.payload,...(body.accountId?{accountId:cash(body.accountId).id,cashMemberId:accountMember(cash(body.accountId),state).id}:{}),scheduledDate:d.payload.scheduledDate??d.payload.date,...(body.amount?{amount:positive(body.amount)}:{}),...(d.payload.type==='loan'?{principal:minor(String(body.principal))}:{})};post(actual,d.id,actualDate);result.id=d.id;return true;
 }
 if(action==='recurring.run'){
  const through=day(body.through??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()));let count=0;
  if(through>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()))throw Error('不能提前执行未来扣款');
  for(const d of state.documents.filter((d:any)=>d.kind==='recurring_rule'&&!d.payload.paused)){
   const r=d.payload;let month=r.start.slice(0,7);for(let i=0;month<=through.slice(0,7)&&i<120;i++){
    const [y,m]=month.split('-').map(Number),date=month+'-'+String(Math.min(r.day,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0'),id='occurrence:'+d.id+':'+date;
    if(date>=r.start&&date<=through&&(!r.end||date<=r.end)&&!state.documents.some((x:any)=>x.id===id||(x.kind==='recurring_occurrence'&&x.payload.ruleId===d.id&&(x.payload.scheduledDate??/:(\d{4}-\d{2}-\d{2})$/.exec(x.id)?.[1]??x.payload.date)?.slice(0,7)===month))){
     if(++count>12)throw Error('单次最多补充12期，请缩小补记截止日期');const data={...r,ruleId:d.id,date};if(r.autoPost===true&&typeof r.confirmedAt==='string'&&r.confirmedAt&&['income','expense'].includes(r.type)&&!(cash(r.accountId).metadata.asOf&&date<=cash(r.accountId).metadata.asOf))post(data,id,date);else writeDoc(id,'recurring_occurrence',{...data,status:'DUE'});
    }month=m===12?String(y+1)+'-01':String(y)+'-'+String(m+1).padStart(2,'0');
   }
  }result.count=count;return true;
 }
 return false;
}

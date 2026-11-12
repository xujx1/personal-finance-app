import {isPensionAccount,pensionSummary} from '../domain/pension.mjs';
import {getAssetTypes,accountAssetType} from '../domain/asset-types.mjs';
import {decimal,minor,convert} from '../domain/finance.mjs';
import {getAssetGoal,buildAssetGoalOverview,assetGoalBucket} from '../domain/asset-goals.mjs';
import {marketQuoteRequest} from '../domain/market.mjs';
import {buildAiPortfolio,aiPortfolioActiveAccount} from '../domain/ai-portfolio.mjs';
import {ledgerBookId,assertLedgerAccess} from './ledger-scope.ts';
import {getFinancialContext,financialContextForAI} from './financial-context.ts';
import {getConsumptionMemory} from './consumption-memory.ts';

export function financialTools(db:any,state:any){
 const scalar=(x:any)=>typeof x==='string'||typeof x==='number'?String(x):null;
 const account=(a:any)=>({...((isPensionAccount(a))?{pension:pensionSummary(a),liquidity:'restricted',withdrawableYuan:'0.00',pensionAmountUnit:'value/cost/profit/contributed/remaining/annualLimit/withdrawable/cashBalance/productValue use CNY minor units; holdings amounts and recordedRealizedProfit use yuan strings; year and withdrawalAge are not money',restriction:'个人规划年龄前不提取，未知出生日期不推算领取日；不是法定领取资格判定'}:{}),id:a.id,name:a.name,kind:a.kind,category:a.category,assetTypeId:accountAssetType(a,state)?.id??null,assetTypeName:accountAssetType(a,state)?.name??null,goalBucket:assetGoalBucket(a,state),currency:a.currency,amountMajor:decimal(a.balance),amount_unit:'major original currency',goalExcluded:['property','prepayment','system'].includes(a.category),quantity:scalar(a.metadata?.quantity),cost:scalar(a.metadata?.cost),monthly:scalar(a.metadata?.monthly),rate:scalar(a.metadata?.rate),status:a.metadata?.status??'holding',market:a.metadata?.market??null,code:a.metadata?.code??null,ownerMemberId:a.metadata?.ownerMemberId??null,asOf:a.metadata?.asOf??null,source:'本人账本快照'});
 const securities=()=>state.accounts.filter((a:any)=>aiPortfolioActiveAccount(a)&&['stock','fund'].includes(a.category));
 const readQuotes=async()=>{
   const quotes=[];
   for(const a of securities()){
    const target=marketQuoteRequest(a),symbol=target?.symbol??String(a.metadata?.code??'').trim().toUpperCase();
    let cached:any=null;
    if(target){const cacheKey=db.ledgerScope?ledgerBookId(db)+':'+target.cacheKey:target.cacheKey;const row=await db.prepare('SELECT payload FROM runtime_cache WHERE id=?').bind(cacheKey).first();try{cached=row?JSON.parse(row.payload):null}catch{}}
    const usable=target&&cached&&cached.symbol===symbol&&cached.currency===target.currency&&(!cached.market||cached.market===target.market)&&typeof cached.price==='string'&&/^\d+(\.\d{1,8})?$/.test(cached.price)&&Number(cached.price)>0&&typeof cached.source==='string'&&typeof cached.asOf==='string';
    quotes.push({accountId:a.id,symbol,price:usable?cached.price:null,currency:usable?cached.currency:a.currency,market:usable?(cached.market??target?.market):target?.market??null,source:usable?cached.source:null,asOf:usable?cached.asOf:null,fetchedAt:usable?cached.fetchedAt??null:null,status:usable?'cached_snapshot':'unavailable',kind:usable?cached.kind??null:null,estimate:usable?cached.estimate??null:null});
   }
   await assertLedgerAccess(db);return {revision:state.book.revision,quotes,note:'仅只读缓存快照，保留来源、原报价/净值日期和估值状态；未请求最新行情，不能视为即时价格'};
 };
 const readPortfolio=async()=>{const quotes=await readQuotes();let fx=null;try{const row:any=await db.prepare("SELECT payload FROM runtime_cache WHERE id='fx'").first();fx=row?JSON.parse(row.payload):null}catch{}const summary=buildAiPortfolio(state,quotes.quotes,fx);await assertLedgerAccess(db);return summary;};
 return {
  get_assets:async()=>{const summary=await readPortfolio();return {revision:state.book.revision,amount_unit:'major original currency',assets:state.accounts.filter(aiPortfolioActiveAccount).map(account),assetTypes:getAssetTypes(state),summary,note:'所有金额为原币主币单位十进制字符串；summary.nonPropertyCurrentCny是全部非房产参考资产，不能代替自选目标的完成额。目标以get_savings_goals中的currentYuan和分项targets为准；房产、预付款不作储蓄目标，赎回中不等于现金。'}} ,
  get_liabilities:async()=>({revision:state.book.revision,liabilities:state.accounts.filter((a:any)=>a.kind==='LIABILITY'&&!a.archived).map(account)}),
  get_budgets:async()=>({revision:state.book.revision,budgets:state.documents.filter((d:any)=>d.kind==='plan').map((d:any)=>{const paid=state.planSummaries?.find((p:any)=>p.planId===d.id)?.paid??0;return {id:d.id,name:d.payload.name,status:d.payload.status,budgetStatus:d.payload.budgetStatus,amount_unit:'CNY_yuan',budgetYuan:d.payload.budget==null?null:decimal(d.payload.budget),paidYuan:decimal(paid),remainingYuan:d.payload.budget==null?null:decimal(Math.max(0,d.payload.budget-paid)),date:d.payload.date,end:d.payload.end??null,source:'本人账本计划快照'};}),note:'预算与未付金额不是现金扣款；已取消计划保留状态，不能当新增支出'}),
  get_holdings:async()=>({revision:state.book.revision,holdings:securities().map(account),note:'已登记的股票和基金持仓；成本、数量与估值日期均来自本人账本，不代表即时行情'}),
  get_market_quotes:readQuotes,
  get_savings_goals:async()=>{const goal=getAssetGoal(state),summary=await readPortfolio(),model=buildAssetGoalOverview(state,(a:any)=>{const v=summary.valuations.find((v:any)=>v.accountId===a.id);if(!v)return null;const value=minor(v.currentReferenceAmountMajor);return a.currency==='CNY'?value:a.currency==='USD'&&summary.fx?convert(value,summary.fx.rate):null;});return {revision:state.book.revision,amount_unit:'CNY_yuan',assetTypes:getAssetTypes(state),goals:[{schemaVersion:goal.schemaVersion,name:goal.name,totalTargetYuan:decimal(goal.totalTarget),bucketTargetsYuan:Object.fromEntries(Object.entries(goal.bucketTargets).map(([key,value])=>[key,decimal(value as number)])),targets:model.buckets.map((b:any)=>({scope:b.scope??'group:'+b.id,label:b.label,...(b.assetTypeIds?{assetTypeIds:b.assetTypeIds}:{}),targetYuan:decimal(b.target),currentYuan:b.complete?decimal(b.current):null,progress:b.progress})),currentYuan:model.complete?decimal(model.current):null,gapYuan:model.gap==null?null:decimal(model.gap),progress:model.progress,monthlyTargetYuan:goal.monthlyTarget==null?null:decimal(goal.monthlyTarget),deadline:goal.deadline}],note:'本人维护的非房产资产目标；自选目标只累计所选类型或组合，新版组合返回assetTypeIds，目标范围与全部非房产资产不可混用。引用缓存估值及原始时间，不是成交承诺。'}} ,
  get_recent_consumption:async()=>getConsumptionMemory(db,state),
  get_cashflow_context:async()=>{const value=financialContextForAI(await getFinancialContext(db,state));await assertLedgerAccess(db);return value}
 };
}

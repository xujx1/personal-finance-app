import {decimal} from '../domain/finance.mjs';
import {getAssetGoal} from '../domain/asset-goals.mjs';
import {marketQuoteRequest} from '../domain/market.mjs';
import {buildAiPortfolio,aiPortfolioActiveAccount} from '../domain/ai-portfolio.mjs';
import {ledgerBookId,assertLedgerAccess} from './ledger-scope.ts';
import {getFinancialContext,financialContextForAI} from './financial-context.ts';
import {getConsumptionMemory} from './consumption-memory.ts';

export function financialTools(db:any,state:any){
 const scalar=(x:any)=>typeof x==='string'||typeof x==='number'?String(x):null;
 const account=(a:any)=>({id:a.id,name:a.name,kind:a.kind,category:a.category,currency:a.currency,amountMajor:decimal(a.balance),amount_unit:'major original currency',goalExcluded:['property','prepayment','system'].includes(a.category),quantity:scalar(a.metadata?.quantity),cost:scalar(a.metadata?.cost),monthly:scalar(a.metadata?.monthly),rate:scalar(a.metadata?.rate),status:a.metadata?.status??'holding',market:a.metadata?.market??null,code:a.metadata?.code??null,ownerMemberId:a.metadata?.ownerMemberId??null,asOf:a.metadata?.asOf??null,source:'本人账本快照'});
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
 return {
  get_assets:async()=>{const quotes=await readQuotes();let fx=null;try{const row:any=await db.prepare("SELECT payload FROM runtime_cache WHERE id='fx'").first();fx=row?JSON.parse(row.payload):null}catch{}const summary=buildAiPortfolio(state,quotes.quotes,fx);await assertLedgerAccess(db);return {revision:state.book.revision,amount_unit:'major original currency',assets:state.accounts.filter(aiPortfolioActiveAccount).map(account),summary,note:'所有金额为原币主币单位十进制字符串；资产行是本人账本快照，summary逐项区分缓存行情参考估值与快照。非房产目标只参考summary.nonPropertyCurrentCny；不把房产或预付款计入四类非房产目标，赎回中不等于银行现金。'}} ,
  get_liabilities:async()=>({revision:state.book.revision,liabilities:state.accounts.filter((a:any)=>a.kind==='LIABILITY'&&!a.archived).map(account)}),
  get_budgets:async()=>({revision:state.book.revision,budgets:state.documents.filter((d:any)=>d.kind==='plan').map((d:any)=>{const paid=state.planSummaries?.find((p:any)=>p.planId===d.id)?.paid??0;return {id:d.id,name:d.payload.name,status:d.payload.status,budgetStatus:d.payload.budgetStatus,amount_unit:'CNY_yuan',budgetYuan:d.payload.budget==null?null:decimal(d.payload.budget),paidYuan:decimal(paid),remainingYuan:d.payload.budget==null?null:decimal(Math.max(0,d.payload.budget-paid)),date:d.payload.date,end:d.payload.end??null,source:'本人账本计划快照'};}),note:'预算与未付金额不是现金扣款；已取消计划保留状态，不能当新增支出'}),
  get_holdings:async()=>({revision:state.book.revision,holdings:securities().map(account),note:'已登记的股票和基金持仓；成本、数量与估值日期均来自本人账本，不代表即时行情'}),
  get_market_quotes:readQuotes,
  get_savings_goals:async()=>{const goal=getAssetGoal(state);return {revision:state.book.revision,amount_unit:'CNY_yuan',goals:[{schemaVersion:2,name:goal.name,totalTargetYuan:decimal(goal.totalTarget),bucketTargetsYuan:Object.fromEntries(Object.entries(goal.bucketTargets).map(([key,value])=>[key,decimal(value as number)])),monthlyTargetYuan:goal.monthlyTarget==null?null:decimal(goal.monthlyTarget),deadline:goal.deadline}],note:'本人明确的四类非房产资产目标，不代表已经存入；月目标或期限未设置时如实说明'}} ,
  get_recent_consumption:async()=>getConsumptionMemory(db,state),
  get_cashflow_context:async()=>{const value=financialContextForAI(await getFinancialContext(db,state));await assertLedgerAccess(db);return value}
 };
}

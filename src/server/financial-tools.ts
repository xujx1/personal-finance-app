import {getAssetGoal} from '../domain/asset-goals.mjs';
import {marketQuoteRequest} from '../domain/market.mjs';
import {ledgerBookId,assertLedgerAccess} from './ledger-scope.ts';
import {getFinancialContext} from './financial-context.ts';
import {getConsumptionMemory} from './consumption-memory.ts';

export function financialTools(db:any,state:any){
 const account=(a:any)=>({id:a.id,name:a.name,category:a.category,currency:a.currency,amountMinor:a.balance,quantity:a.metadata?.quantity??null,cost:a.metadata?.cost??null,monthly:a.metadata?.monthly??null,rate:a.metadata?.rate??null,asOf:a.metadata?.asOf??null,source:'本人账本快照'});
 const securities=()=>state.accounts.filter((a:any)=>a.kind==='ASSET'&&!a.archived&&['stock','fund'].includes(a.category));
 return {
  get_assets:async()=>({revision:state.book.revision,assets:state.accounts.filter((a:any)=>a.kind==='ASSET'&&!a.archived).map(account),note:'原币和本人快照；不把证券、房产和赎回中资产当国内现金'}),
  get_liabilities:async()=>({revision:state.book.revision,liabilities:state.accounts.filter((a:any)=>a.kind==='LIABILITY'&&!a.archived).map(account)}),
  get_budgets:async()=>({revision:state.book.revision,budgets:state.documents.filter((d:any)=>d.kind==='plan').map((d:any)=>{const paid=state.planSummaries?.find((p:any)=>p.planId===d.id)?.paid??0;return {id:d.id,name:d.payload.name,status:d.payload.status,budgetStatus:d.payload.budgetStatus,budgetMinor:d.payload.budget,paidMinor:paid,remainingMinor:d.payload.budget==null?null:Math.max(0,d.payload.budget-paid),date:d.payload.date,end:d.payload.end??null,source:'本人账本计划快照'};}),note:'预算与未付金额不是现金扣款；已取消计划保留状态，不能当新增支出'}),
  get_holdings:async()=>({revision:state.book.revision,holdings:securities().map(account),note:'已登记的股票和基金持仓；成本、数量与估值日期均来自本人账本，不代表即时行情'}),
  get_market_quotes:async()=>{
   const quotes=[];
   for(const a of securities()){
    const target=marketQuoteRequest(a),symbol=target?.symbol??String(a.metadata?.code??'').trim().toUpperCase();
    let cached:any=null;
    if(target){const cacheKey=db.ledgerScope?ledgerBookId(db)+':'+target.cacheKey:target.cacheKey;const row=await db.prepare('SELECT payload FROM runtime_cache WHERE id=?').bind(cacheKey).first();try{cached=row?JSON.parse(row.payload):null}catch{}}
    const usable=target&&cached&&cached.symbol===symbol&&cached.currency===target.currency&&(!cached.market||cached.market===target.market)&&typeof cached.price==='string'&&/^\d+(\.\d{1,8})?$/.test(cached.price)&&Number(cached.price)>0&&typeof cached.source==='string'&&typeof cached.asOf==='string';
    quotes.push({accountId:a.id,symbol,price:usable?cached.price:null,currency:usable?cached.currency:a.currency,source:usable?cached.source:null,asOf:usable?cached.asOf:null,fetchedAt:usable?cached.fetchedAt??null:null,status:usable?'cached_snapshot':'unavailable',kind:usable?cached.kind??null:null,estimate:usable?cached.estimate??null:null});
   }
   await assertLedgerAccess(db);return {revision:state.book.revision,quotes,note:'仅只读缓存快照，保留来源、原报价/净值日期和估值状态；未请求最新行情，不能视为即时价格'};
  },
  get_savings_goals:async()=>({revision:state.book.revision,goals:[getAssetGoal(state)],note:'本人明确的四类非房产资产目标，不代表已经存入；月目标或期限未设置时如实说明'}),
  get_recent_consumption:async()=>getConsumptionMemory(db,state),
  get_cashflow_context:async()=>getFinancialContext(db,state)
 };
}

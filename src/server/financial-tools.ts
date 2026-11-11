import {getFinancialContext} from './financial-context.ts';import {getConsumptionMemory} from './consumption-memory.ts';
export function financialTools(db:any,state:any){const account=(a:any)=>({id:a.id,name:a.name,category:a.category,currency:a.currency,amountMinor:a.balance,quantity:a.metadata.quantity??null,cost:a.metadata.cost??null,monthly:a.metadata.monthly??null,rate:a.metadata.rate??null,asOf:a.metadata.asOf??null});return {
 get_assets:async()=>({revision:state.book.revision,assets:state.accounts.filter((a:any)=>a.kind==='ASSET'&&!a.archived).map(account),note:'原币和本人快照；不把证券、房产和赎回中资产当国内现金'}),
 get_liabilities:async()=>({revision:state.book.revision,liabilities:state.accounts.filter((a:any)=>a.kind==='LIABILITY'&&!a.archived).map(account)}),
 get_savings_goals:async()=>({revision:state.book.revision,goals:state.documents.filter((d:any)=>d.kind==='savings_goal').map((d:any)=>({id:d.id,...d.payload})),note:'本人定义的目标，不代表已经存入；缺少目标时如实说明'}),
 get_recent_consumption:async()=>getConsumptionMemory(db,state),
 get_cashflow_context:async()=>getFinancialContext(db,state)
};}

import {expandAssetAccounts} from './asset-view.mjs';
import {MAX_MINOR,decimal,convert} from './finance.mjs';
import {marketQuoteRequest,safeQuotedBalance,positionValue} from './market.mjs';
const excludedCategories=['property','prepayment','system'];
const sum=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n)||Math.abs(n)>MAX_MINOR)throw Error('资产汇总超过精确金额上限');return n};
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
export function aiPortfolioActiveAccount(a){return a.kind==='ASSET'&&!a.archived&&a.balance!==0&&!['closed','cleared'].includes(a.metadata?.status)&&!(['stock','fund'].includes(a.category)&&typeof a.metadata?.quantity==='string'&&/^0+(\.0+)?$/.test(a.metadata.quantity))}
function checkedFx(fx){
 if(!fx||typeof fx.rate!=='string'||!/^\d+(\.\d{1,12})?$/.test(fx.rate)||Number(fx.rate)<=0||!day(fx.date)||typeof fx.source!=='string'||!fx.source.trim()||fx.status==='unavailable'||fx.fetchedAt!=null&&!Number.isFinite(fx.fetchedAt))return null;
 return {rate:fx.rate,date:fx.date,source:fx.source,status:fx.status??'cached_reference',...(Number.isFinite(fx.fetchedAt)?{fetchedAt:fx.fetchedAt}:{})};
}
function matchedQuote(account,quote){
 const target=marketQuoteRequest(account);return target&&quote&&quote.accountId===account.id&&quote.symbol===target.symbol&&quote.currency===target.currency&&quote.market===target.market&&quote.status!=='unavailable'&&typeof quote.price==='string'&&/^\d+(\.\d{1,8})?$/.test(quote.price)&&Number(quote.price)>0&&typeof quote.source==='string'&&quote.source.trim()&&typeof quote.asOf==='string'&&quote.asOf.trim();
}
/** Pure arithmetic: internal exact cents become explicit major-currency decimal strings at this boundary. */
export function buildAiPortfolio(state,quotes=[],fx=null){
 const list=Array.isArray(quotes)?quotes:Array.isArray(quotes?.quotes)?quotes.quotes:Object.entries(quotes??{}).map(([accountId,q])=>({...q,accountId}));
 const verifiedFx=checkedFx(fx),byCurrency={},snapshotByCurrency={},valuations=[],missingConversion=[];let currentCny=0,snapshotCny=0;
 const bucket=(map,currency)=>map[currency]??(map[currency]={cash:0,fund:0,stock:0,redeeming:0,property:0,termDeposit:0,other:0,nonProperty:0});
 for(const a of expandAssetAccounts(state).filter(aiPortfolioActiveAccount)){
  if(!Number.isSafeInteger(a.balance)||a.balance<0||a.balance>MAX_MINOR)throw Error('资产账面金额无效');
  const quote=list.find(q=>matchedQuote(a,q));let current=a.balance,quoted=false;
  if(quote)try{const calculated=positionValue(a.metadata?.quantity,quote.price);if(safeQuotedBalance(a,quote)===calculated){current=calculated;quoted=true}}catch{}
  const goalExcluded=excludedCategories.includes(a.category);
  const addBuckets=(map,n)=>{const b=bucket(map,a.currency),key={cash:'cash',fund:'fund',stock:'stock',property:'property',term_deposit:'termDeposit'}[a.category]??'other';b[key]=sum(b[key],n);if(a.metadata?.status==='redeeming')b.redeeming=sum(b.redeeming,n);if(!goalExcluded)b.nonProperty=sum(b.nonProperty,n)};
  addBuckets(byCurrency,current);addBuckets(snapshotByCurrency,a.balance);
  valuations.push({accountId:a.id,currency:a.currency,goalExcluded,snapshotAmountMajor:decimal(a.balance),currentReferenceAmountMajor:decimal(current),valuationBasis:quoted?'matched_cached_quote':'ledger_snapshot',snapshotAsOf:a.metadata?.asOf??null,...(a.projection?{holdingAccountId:a.projection.parentAccountId,restricted:true}:{}),...(quoted?{quote:{price:quote.price,currency:quote.currency,market:quote.market,source:quote.source,asOf:quote.asOf,status:quote.status??'cached_reference'}}:{})});
  if(goalExcluded)continue;
  if(a.currency==='CNY'){currentCny=sum(currentCny,current);snapshotCny=sum(snapshotCny,a.balance)}
  else if(a.currency==='USD'&&verifiedFx){currentCny=sum(currentCny,convert(current,verifiedFx.rate));snapshotCny=sum(snapshotCny,convert(a.balance,verifiedFx.rate))}
  else missingConversion.push(a.id);
 }
 const majors=map=>Object.fromEntries(Object.entries(map).map(([currency,totals])=>[currency,Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,decimal(value)]))]));
 return {amount_unit:'major_currency_decimal_strings',byCurrency:majors(byCurrency),snapshotByCurrency:majors(snapshotByCurrency),nonPropertyCurrentCny:missingConversion.length?null:decimal(currentCny),nonPropertySnapshotCny:missingConversion.length?null:decimal(snapshotCny),fx:verifiedFx,valuations,missingConversion,note:'每个币种的金额均为元/美元等主币单位十进制字符串。byCurrency使用匹配的缓存行情参考估值，缺少匹配行情或数量时保留账本快照并逐项标明。房产、预付款和系统账户不计入四类非房产资产目标；已归档、已清仓及零数量账户排除。养老金按底层产品及受限资金余额拆分统计，父账户不重复计入；受限余额不计银行现金。赎回中金额是基金/证券等资产的子集，不是额外资产，也不是已到账现金。人民币折算仅使用带来源和日期的已缓存汇率，不假设固定汇率；行情/汇率均非实时成交承诺。'};
}

import {decimal} from './finance.mjs';
import {aiPortfolioActiveAccount} from './ai-portfolio.mjs';
import {positionValue} from './market.mjs';
const SCALE=100000000n;
const scaled=value=>{const text=String(value??'');if(!/^\d+(?:\.\d{1,8})?$/.test(text))throw Error('数量无效');const [whole,fraction='']=text.split('.');return BigInt(whole)*SCALE+BigInt(fraction.padEnd(8,'0'))};
const quantity=value=>{const whole=value/SCALE,fraction=String(value%SCALE).padStart(8,'0').replace(/0+$/,'');return String(whole)+(fraction?'.'+fraction:'')};
const percent=(value,total)=>total>0?(Number((BigInt(value)*1000000n+BigInt(total)/2n)/BigInt(total))/10000).toFixed(4):null;
const aliases={NVDA:['英伟达','輝達'],BABA:['阿里巴巴','阿里'],TCOM:['携程集团','携程'],VOO:['先锋标普500ETF']};
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function parseInvestmentOrders(question,knownSymbols=[]){
 const aliasMap=new Map(knownSymbols.map(symbol=>[symbol.toUpperCase(),symbol.toUpperCase()]));
 for(const symbol of knownSymbols)for(const alias of aliases[symbol]??[])aliasMap.set(alias,symbol);
 const token=[...aliasMap.keys()].sort((a,b)=>b.length-a.length).map(escaped).join('|');
 const symbolPattern='(?:'+(token?token+'|':'')+'[A-Z][A-Z0-9.\\-]{0,9})',number='\\d+(?:\\.\\d{1,8})?';
 const pairSource='('+number+')\\s*(?:股|shares?\\s*)?\\s*('+symbolPattern+')|('+symbolPattern+')\\s*('+number+')\\s*(?:股|shares?)';
 const pairAtStart=new RegExp('^\\s*(?:'+pairSource+')','i'),pairAnywhere=new RegExp(pairSource,'i');
 const connector=/^\s*(?:以及|和|与|及|加|、|\+|＋|&|and\b)\s*/i;
 const retained=/(?:保留|剩余|留下|继续持有|当前持有|现有持仓|目前持仓|持仓|\bkeep\b|\bretain\b|\bremaining\b|\bholdings\b|\bcurrently holding\b)/i;
 const negated=/(?:不要|不准备|不打算|不考虑|不计划|不想|不会|不建议|不|勿|别|避免)(?:现在|目前|近期|再)?\s*$|(?:not(?:\s+(?:planning|intending|going))?\s*(?:to)?|do\s+not|don't|never|avoid)\s*$/i;
 const orders=[],missing=[],text=String(question??'');let seenAction=false;
 const verbPattern=/卖出|卖掉|减持|出售|卖|买入|换入|购入|增持|买|\bsell\b|\bbuy\b/gi;
 for(const clause of text.split(/[，,。;；！？!?\n]|\.(?=\s|$)/)){
  const allVerbs=[...clause.matchAll(verbPattern)];
  const verbs=allVerbs.filter((verb,index)=>{const following=clause.slice(verb.index+verb[0].length,allVerbs[index+1]?.index??clause.length);return !/^\s*(?:金额|款项|所得|成本|费用|价格|股数|数量|比例)/.test(following)||pairAnywhere.test(following)});
  if(!verbs.length){if(seenAction&&pairAnywhere.test(clause)&&!retained.test(clause))missing.push('有未明确买卖方向的证券股数，请逐项说明');if(seenAction&&/^\s*(?:还是|或者|或|or\b)/i.test(clause))missing.push('买卖表述包含备选，未把互斥方案合并计算');continue}
  if(/(?:还是|或者|或|\bor\b)/i.test(clause))missing.push('买卖表述包含备选，未把互斥方案合并计算');
  const prefix=clause.slice(0,verbs[0].index);
  if(pairAnywhere.test(prefix)&&!retained.test(prefix))missing.push('买卖方向前有未归属的证券股数，请逐项说明');
  for(let i=0;i<verbs.length;i++){
   const verb=verbs[i],side=/卖|减持|出售|sell/i.test(verb[0])?'sell':'buy';seenAction=true;
   if(negated.test(clause.slice(0,verb.index))){missing.push('买卖表述包含否定，未建立肯定的交易假设');continue}
   let remainder=clause.slice(verb.index+verb[0].length,verbs[i+1]?.index??clause.length);
   if(verbs[i+1])remainder=remainder.replace(/(?:并且|并|然后|接着|同时|再|只|then)\s*$/i,'');
   const retainedAt=remainder.search(retained);if(retainedAt>=0)remainder=remainder.slice(0,retainedAt).replace(/(?:而|并且|并|同时|then)\s*$/i,'');
   let count=0;
   while(remainder.trim()){
    const match=pairAtStart.exec(remainder);
    if(!match){missing.push('买卖项目未符合明确的证券与股数清单，请澄清未解析的内容');break}
    const raw=match[2]??match[3],symbol=aliasMap.get(raw)??aliasMap.get(raw.toUpperCase())??raw.toUpperCase(),amount=match[1]??match[4];
    if(scaled(amount)<=0n)missing.push(symbol+'股数必须大于零');else orders.push({side,symbol,quantity:quantity(scaled(amount))});
    count++;remainder=remainder.slice(match[0].length);
    if(!remainder.trim()||/^(?:是否|能否)?(?:合适|合理|可行|划算|适合)(?:呢|吗)?$/.test(remainder.trim()))break;
    const join=connector.exec(remainder);if(!join){missing.push('买卖项目后仍有未解析内容，请分开说明交易与持仓');break}
    remainder=remainder.slice(join[0].length);if(!remainder.trim())missing.push('连接词后的交易项目缺少明确股数或证券');
   }
   if(!count)missing.push('买卖方向后的证券与股数未明确，未猜测数量');
  }
 }
 if(!seenAction)missing.push('未识别明确的买卖方向和股数，未生成交易假设');
 return {orders,missing};
}
/** @param {string} question @param {{state?:any,quotes?:any[],cashflowForecast?:any}} [options] */
export function calculateInvestmentScenario(question,{state,quotes=[],cashflowForecast=null}={}){
 const accounts=(state?.accounts??[]).filter(aiPortfolioActiveAccount),holdings=accounts.filter(account=>account.kind==='ASSET'&&account.currency==='USD'&&['stock','fund'].includes(account.category));
 const knownSymbols=[...new Set(holdings.map(account=>String(account.metadata?.code??'').trim().toUpperCase()).filter(Boolean))];
 const parsed=parseInvestmentOrders(question,knownSymbols),missing=[...parsed.missing],warnings=[];
 const positions=new Map();
 for(const account of holdings){const symbol=String(account.metadata?.code??'').trim().toUpperCase();if(!symbol)continue;let count;try{count=scaled(account.metadata?.quantity)}catch{missing.push(symbol+'持仓数量未核实');continue}
  const quote=quotes.find(value=>value.accountId===account.id&&value.symbol===symbol&&value.currency==='USD'&&value.status!=='unavailable'&&(!value.market||value.market===account.metadata?.market)&&typeof value.price==='string'&&/^\d+(?:\.\d{1,8})?$/.test(value.price)&&Number(value.price)>0&&value.source&&value.asOf);
  if(!quote){missing.push(symbol+'缺少可核验的美元单价、来源或报价时间');continue}
  if(positions.has(symbol)&&positions.get(symbol).price!==quote.price){missing.push(symbol+'多个账户报价不一致，未混用价格');continue}
  const old=positions.get(symbol);positions.set(symbol,{symbol,before:(old?.before??0n)+count,after:(old?.after??0n)+count,price:quote.price,quote:{source:quote.source,asOf:quote.asOf,status:quote.status??'snapshot'}});
  if(['stale','unavailable'].includes(quote.status))warnings.push(symbol+'使用保留日期的历史报价，成交价仍需核实');
 }
 let sell=0,buy=0;
 const orders=parsed.orders.map(order=>{const holding=positions.get(order.symbol);if(!holding){missing.push(order.symbol+'未取得登记持仓及同币种报价');return {...order,unitPrice:null,amount:null,quote:null}}
  const amount=positionValue(order.quantity,holding.price),count=scaled(order.quantity);holding.after+=order.side==='sell'?-count:count;if(holding.after<0n)missing.push(order.symbol+'卖出数量超过已登记持仓');if(order.side==='sell')sell+=amount;else buy+=amount;
  return {...order,unitPrice:holding.price,amount:decimal(amount),quote:holding.quote};
 });
 const available=accounts.filter(account=>account.kind==='ASSET'&&account.category==='cash'&&account.currency==='USD').reduce((sum,account)=>sum+Math.max(0,account.balance??0),0);
 const complete=orders.length>0&&missing.length===0;
 let portfolio=null;
 if(complete){const rows=[...positions.values()].map(position=>({...position,beforeValue:positionValue(quantity(position.before),position.price),afterValue:positionValue(quantity(position.after),position.price)}));const before=rows.reduce((sum,row)=>sum+row.beforeValue,0),after=rows.reduce((sum,row)=>sum+row.afterValue,0);portfolio={beforeValue:decimal(before),afterValue:decimal(after),positions:rows.map(row=>({symbol:row.symbol,beforeQuantity:quantity(row.before),afterQuantity:quantity(row.after),unitPrice:row.price,beforeValue:decimal(row.beforeValue),afterValue:decimal(row.afterValue),beforeWeightPercent:percent(row.beforeValue,before),afterWeightPercent:percent(row.afterValue,after),quote:row.quote}))}}
 const gap=buy-sell;
 return {version:1,status:complete?'complete':'incomplete',currency:'USD',orders,sellProceeds:complete?decimal(sell):null,buyCost:complete?decimal(buy):null,grossFundingGap:complete?decimal(Math.max(0,gap)):null,availableCash:decimal(available),additionalCashRequiredBeforeFees:complete?decimal(Math.max(0,gap-available)):null,feesKnown:false,fees:null,portfolio,missing:[...new Set(missing)],warnings:[...new Set(warnings)],...(cashflowForecast?{cashflowRisk:cashflowForecast}:{}),note:'服务器按同一组报价与数量计算的只读情景；未计手续费、税费、点差及汇兑成本，不执行交易，人民币基金赎回不算美元现金。'};
}
export function investmentCalculationSummary(calculation){const negative=calculation?.cashflowRisk?.months?.find(month=>month.negative===true),fundingWarning=negative?' 人民币现金预测'+negative.month+'月底为'+negative.closingCashYuan+'元，存在备款缺口，不能据此认定提前还款资金充足。':'';if(!calculation||calculation.status!=='complete')return '交易情景资料不完整，尚不能核算换仓差额与集中度；请核对明确股数、持仓及报价。'+fundingWarning;return '按同一组参考报价，卖出预计 USD '+calculation.sellProceeds+'，买入预计 USD '+calculation.buyCost+'；未计费用的资金差额 USD '+calculation.grossFundingGap+'，账内可用美元现金 USD '+calculation.availableCash+'，仍需补足 USD '+calculation.additionalCashRequiredBeforeFees+'。手续费、税费与汇兑成本未知；以下为只读假设，不执行交易。'+fundingWarning}

const price=x=>{if(typeof x!=='string'||!/^\d+(\.\d{1,8})?$/.test(x)||Number(x)<=0)throw Error('价格无效');return x};
export function parseTencent(raw,symbol,market='US'){
 const m=/="([^"]+)"/.exec(raw);if(!m)throw Error('行情格式无效');const p=m[1].split('~');
 const expected=symbol.toUpperCase(),actual=String(p[2]??'').toUpperCase();
 if(p.length<31||!(actual===expected||market==='US'&&actual.startsWith(expected+'.')))throw Error('行情代码不符');
 if(!['US','CN'].includes(market))throw Error('市场暂不支持');
 const sourceCurrency=p.find(value=>['USD','CNY','HKD'].includes(value));if(sourceCurrency&&sourceCurrency!==(market==='US'?'USD':'CNY'))throw Error('行情币种与登记市场不符');
 const asOf=p[30];if(!asOf||!(/^(\d{14}|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/.test(asOf)))throw Error('行情来源时间无效');
 return {symbol,price:price(p[3]),currency:market==='US'?'USD':'CNY',market,source:'腾讯公开行情',asOf,kind:'public_quote',delay:'公共报价延迟和时区未由数据商保证；不是实时成交承诺',fetchedAt:Date.now()};
}
export function parseFund(raw,code){const m=/^\s*jsonpgz\((\{[\s\S]*\})\);?\s*$/.exec(raw);if(!m)throw Error('基金格式无效');const p=JSON.parse(m[1]);if(p.fundcode!==code||!/^\d{4}-\d{2}-\d{2}$/.test(p.jzrq))throw Error('基金代码或净值日期无效');return {symbol:code,price:price(p.dwjz),currency:'CNY',market:'CN',source:'天天基金公开数据',asOf:p.jzrq,kind:'published_nav',delay:'公布净值，通常为已结束交易日；估值不是最终净值',estimate:p.gsz&&p.gztime?{price:price(p.gsz),asOf:String(p.gztime),kind:'intraday_estimate'}:null,fetchedAt:Date.now()}}
export function parseFundHistory(raw,code){
 const identity=/\bvar\s+fS_code\s*=\s*"(\d{6})"\s*;/.exec(raw),trend=/\bvar\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\])\s*;/.exec(raw);
 if(identity?.[1]!==code||!trend)throw Error('基金历史代码或格式无效');
 const rows=JSON.parse(trend[1]);if(!Array.isArray(rows)||!rows.length)throw Error('基金历史净值为空');
 const last=rows.at(-1);if(!Number.isSafeInteger(last?.x)||last.x<=0||typeof last.y!=='number')throw Error('基金净值日期或价格无效');
 const asOf=new Date(last.x+8*3600000).toISOString().slice(0,10);
 return {symbol:code,price:price(String(last.y)),currency:'CNY',market:'CN',source:'天天基金公开历史净值',sourceUrl:'https://fund.eastmoney.com/pingzhongdata/'+code+'.js',asOf,kind:'published_nav',delay:'已公布单位净值；历史日期按北京时间保留，不代表盘中成交价格',estimate:null,fetchedAt:Date.now()};
}
export function positionValue(quantity,unitPrice){const scaled=(s,places)=>{if(!/^\d+(\.\d{1,8})?$/.test(String(s)))throw Error('数量或单价无效');const [a,b='']=String(s).split('.');return BigInt(a)*10n**BigInt(places)+BigInt(b.padEnd(places,'0'))};const q=scaled(quantity,8),p=scaled(unitPrice,8),n=(q*p*100n+5000000000000000n)/10000000000000000n;if(n>9000000000000n)throw Error('持仓金额过大');return Number(n)}

export function reconcilePositionSnapshot(account){
 const metadata=account?.metadata??{};
 const decimal=value=>typeof value==='string'&&value.length<=100&&/^\d+(\.\d{1,8})?$/.test(value)?value:null;
 const quantity=decimal(metadata.quantity),storedPrice=decimal(metadata.price),unitCost=decimal(metadata.cost);
 const value=(count,unit)=>{if(count===null||unit===null)return null;try{return positionValue(count,unit)}catch{return null}};
 const registeredMinor=Number.isSafeInteger(account?.balance)&&account.balance>=0&&account.balance<=9000000000000?account.balance:null;
 const calculatedSnapshotMinor=value(quantity,storedPrice),totalCostMinor=value(quantity,unitCost);
 const discrepancyMinor=registeredMinor!==null&&calculatedSnapshotMinor!==null?calculatedSnapshotMinor-registeredMinor:null;
 const date=metadata.asOf,asOf=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:null;
 return {quantity,storedPrice,unitCost,unitCostMinor:value('1',unitCost),storedUnitPriceMinor:value('1',storedPrice),currency:typeof account?.currency==='string'&&/^[A-Z]{3}$/.test(account.currency)?account.currency:null,registeredMinor,calculatedSnapshotMinor,discrepancyMinor,totalCostMinor,status:discrepancyMinor===null?'unknown':discrepancyMinor===0?'matched':'discrepancy',market:['US','CN','HK','OTHER'].includes(metadata.market)?metadata.market:'未核实',asOf};
}

export function safeQuotedBalance(account,quote){
 const quantity=account.metadata?.quantity;
 if(['stock','fund'].includes(account.category)&&typeof quantity==='string'&&/^0+(\.0{1,8})?$/.test(quantity))return 0;
 if(!quote?.price||quote.currency!==account.currency||!quantity||!['stock','fund'].includes(account.category))return account.balance;
 const expected=account.metadata?.market;
 if(account.category==='stock'&&!['US','CN'].includes(expected)||account.category==='fund'&&expected&&expected!=='CN')return account.balance;
 if(quote.market&&expected&&quote.market!==expected)return account.balance;
 if(expected==='US'&&quote.currency!=='USD'||expected==='CN'&&quote.currency!=='CNY'||account.category==='fund'&&quote.currency!=='CNY')return account.balance;
 try{return positionValue(quantity,quote.price)}catch{return account.balance}
}

export function marketQuoteRequest(account){
 const code=String(account.metadata?.code??'').trim().toUpperCase(),market=account.metadata?.market;
 if(account.category==='fund'&&account.currency==='CNY'&&(!market||market==='CN')&&/^\d{6}$/.test(code))return {url:'https://fundgz.1234567.com.cn/js/'+code+'.js',cacheKey:'quote:fund:'+code,symbol:code,market:'CN',currency:'CNY',provider:'fund'};
 if(account.category==='stock'&&market==='US'&&account.currency==='USD'&&/^[A-Z][A-Z0-9.\-]{0,9}$/.test(code))return {url:'https://qt.gtimg.cn/q=us'+encodeURIComponent(code),cacheKey:'quote:stock:'+code,symbol:code,market:'US',currency:'USD',provider:'tencent'};
 if(account.category==='stock'&&market==='CN'&&account.currency==='CNY'&&/^(SH|SZ|BJ)\d{6}$/.test(code))return {url:'https://qt.gtimg.cn/q='+code.toLowerCase(),cacheKey:'quote:stock:'+code.toLowerCase(),symbol:code.slice(2),market:'CN',currency:'CNY',provider:'tencent'};
 return null;
}

export function visibleAssetAccounts(accounts,includeClosed=false){
 return accounts.filter(a=>includeClosed||!a.archived&&a.balance!==0&&!(['stock','fund'].includes(a.category)&&typeof a.metadata?.quantity==='string'&&/^0+(\.0{1,8})?$/.test(a.metadata.quantity)));
}
export function categoryValuation(accounts,category,valueCNY){
 return accounts.filter(a=>category==='all'||a.category===category).reduce((sum,a)=>{const value=valueCNY(a);if(value==null)sum.missing++;else sum.amountMinor+=value;return sum;},{amountMinor:0,missing:0});
}

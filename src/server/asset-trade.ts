import {minor,MAX_MINOR} from '../domain/finance.mjs';
import {accountMember,ownerFields} from '../domain/member-ownership.mjs';
const SCALE=100000000n, CENTS_SCALE=SCALE*SCALE/100n;
const units=(v:any)=>{if(typeof v!=='string'||v.length>100||!/^\d+(\.\d{1,8})?$/.test(v))throw Error('数量或成本无效，最多八位小数');const [a,b='']=v.split('.');return BigInt(a)*SCALE+BigInt(b.padEnd(8,'0'))};
const textUnits=(n:bigint)=>{const tail=(n%SCALE).toString().padStart(8,'0').replace(/0+$/,'');return (n/SCALE).toString()+(tail?'.'+tail:'')};
const text=(v:any,n=200)=>{if(typeof v!=='string'||!v.trim()||v.length>n)throw Error('交易资料无效');return v.trim()};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=(v:any)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('实际成交日期无效');return v};

/** Records actual trades only. The enclosing command atomically commits cash,
 * holdings, quantity metadata, journal and receipt under the family guard. */
export function extendAssetTrade(c:any){
 if(c.action!=='asset.trade')return false;
 const {body,state,account,assertCashMember,rows,db,ds,stagedAccounts,journal,entry,system,result}=c;
 const mode=body.mode,explicit=mode!==undefined||body.newAsset!==undefined;
 if(mode!==undefined&&!['buy','liquidate'].includes(mode))throw Error('买入或清仓操作无效');
 if(explicit&&(body.actualConfirmed!==true||body.balanceUncovered!==true))throw Error('请确认成交已完成且尚未包含在当前登记余额中');
 const sell=mode==='liquidate'||mode===undefined&&body.side==='sell';
 if(body.side!==undefined&&body.side!==(sell?'sell':'buy')||mode===undefined&&!['buy','sell'].includes(body.side))throw Error('交易方向无效');
 const businessDate=date(body.date??today());if(businessDate>today())throw Error('不能提前记录未来买入或清仓');
 const bank=account(body.accountId),n=minor(String(body.amount)),fee=minor(String(body.fee||'0'));
 if(n<=0)throw Error('实际成交金额必须大于0');
 if(bank.kind!=='ASSET'||bank.category!=='cash')throw Error('请选择银行现金账户');
 assertCashMember(bank,body.cashMemberId);
 if(explicit&&bank.metadata.asOf&&businessDate<bank.metadata.asOf)throw Error('该日期已被银行余额快照覆盖，不能重复收付款');
 let a:any;
 if(body.newAsset!==undefined){
  if(mode!=='buy'||sell||body.assetId)throw Error('首次买入不能同时选择原资产或清仓');
  const p=body.newAsset;if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['name','category','currency','ownerMemberId','market','code'].includes(k)))throw Error('新持仓字段无效');
  if(!['fund','stock'].includes(p.category)||!['CNY','USD'].includes(p.currency)||p.category==='fund'&&p.currency!=='CNY'||!['CN','US','HK','OTHER'].includes(p.market))throw Error('基金股票类型、市场或币种无效');
  if(p.market==='US'&&p.currency!=='USD'||p.market==='CN'&&p.currency!=='CNY')throw Error('市场与币种不符');
  const name=text(p.name,100),code=text(p.code,30).toUpperCase(),owner=ownerFields(state,p.ownerMemberId);
  if(state.accounts.some((x:any)=>x.category===p.category&&x.currency===p.currency&&accountMember(x,state).id===owner.ownerMemberId&&(x.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()||String(x.metadata.code??'').toUpperCase()===code&&x.metadata.market===p.market)))throw Error('该成员已有同名或同代码持仓，请选择已有持仓买入');
  const q=units(body.quantity);if(q<=0n)throw Error('首次买入必须填写实际成交数量');
  a={id:crypto.randomUUID(),name,category:p.category,currency:p.currency,kind:'ASSET',balance:0,metadata:{...owner,code,market:p.market,quantity:'0',cost:'0',asOf:businessDate,source:'本人确认实际买入，现金同步扣除'}};
 }else a=account(body.assetId);
 if(a.kind!=='ASSET'||['cash','system','prepayment','term_deposit'].includes(a.category)||a.currency!==bank.currency)throw Error('请选择已登记资产及同币种银行现金账户');
 if(mode!==undefined&&!['fund','stock'].includes(a.category))throw Error('此买入清仓入口仅用于基金或股票');
 if(explicit&&(a.metadata.asOf&&businessDate<a.metadata.asOf||a.metadata.lastTradeAt&&businessDate<a.metadata.lastTradeAt))throw Error('交易日期早于持仓快照或上次交易，请先核对历史');
 const m={...a.metadata},oldQ=m.quantity!=null&&m.quantity!==''?units(String(m.quantity)):null;
 if(mode==='liquidate'&&(a.balance<=0||oldQ===0n))throw Error('该持仓已经清仓或账面与数量需先核对');
 const carrying=sell?(mode==='liquidate'?a.balance:minor(String(body.carrying))):n;
 if(sell&&(carrying<=0||carrying>a.balance||fee>n))throw Error('出售账面金额或费用超限');
 if(bank.balance+(sell?n-fee:-n-fee)>MAX_MINOR||!sell&&(n+fee>MAX_MINOR||a.balance+n>MAX_MINOR))throw Error('成交合计或记账后余额超出金额上限');
 const q=mode==='liquidate'?oldQ:body.quantity!==undefined&&body.quantity!==''?units(String(body.quantity)):null;
 if(mode==='buy'&&q===null)throw Error('买入必须填写本次实际成交数量');
 if(q!==null&&q<=0n||oldQ!==null&&(q===null||sell&&q>oldQ))throw Error('请填写有效的本次数量，不能超过持有数量');
 if(oldQ!==null&&q!==null){if(sell&&((q===oldQ)!==(carrying===a.balance)))throw Error('全部卖出数量和账面金额须一致');m.quantity=textUnits(sell?oldQ-q:oldQ+q)}
 else if(mode==='liquidate')m.quantity='0'; // Unknown original shares are never invented.
 let costBasis:number|null=null,realizedProfit:number|null=null;
 if(oldQ!==null&&q!==null&&a.metadata.cost!=null&&a.metadata.cost!==''){
  const oldCost=units(String(a.metadata.cost)),basis=(oldCost*q+CENTS_SCALE/2n)/CENTS_SCALE;
  if(basis>9000000000000n)throw Error('成交成本超出精确范围');costBasis=Number(basis);
  if(sell)realizedProfit=n-fee-costBasis;
  else m.cost=textUnits((oldCost*oldQ+BigInt(n+fee)*CENTS_SCALE+(oldQ+q)/2n)/(oldQ+q));
 }
 if(!sell&&a.balance===0&&oldQ===0n&&q!==null){m.price=textUnits((BigInt(n)*CENTS_SCALE+q/2n)/q);m.asOf=businessDate}
 if(body.newAsset){stagedAccounts.push({...a,metadata:m});rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(ds,a.id,a.name,a.kind,a.category,a.currency,JSON.stringify(m)))}
 const entries=sell?[entry(a,-carrying),entry(bank,n-fee),...(fee?[entry(system('expense',a.currency),fee)]:[]),...(n!==carrying?[entry(system('income',a.currency),carrying-n)]:[])]:[entry(a,n),entry(bank,-n-fee),...(fee?[entry(system('expense',a.currency),fee)]:[])];
 const liquidated=sell&&carrying===a.balance;
 journal(sell?'ASSET_SALE':'ASSET_BUY',n,entries,{assetId:a.id,accountId:bank.id,fee,carrying,costBasis,realizedProfit,quantity:q===null?null:textUnits(q),liquidated,mode:mode??null,note:body.note?text(body.note,300):sell?'本人确认资产变现到账':'本人确认买入到账',profitBasis:'账面差额，原始投资成本另行核对'});
 rows.push(db.prepare('UPDATE accounts SET metadata=? WHERE dataset_id=? AND id=?').bind(JSON.stringify({...m,status:liquidated?'closed':'holding',lastTradeAt:businessDate}),ds,a.id));
 result.assetId=a.id;return true;
}

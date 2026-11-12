import {normalizePension,isPensionAccount} from '../domain/pension.mjs';
import {getAssetTypes} from '../domain/asset-types.mjs';
import {minor,decimal,MAX_MINOR} from '../domain/finance.mjs';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const text=(v:any,max=100)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw Error('养老金交易资料无效');return v.trim()};
const key=(v:string)=>v.normalize('NFKC').toLocaleLowerCase();
const signed=(s:string)=>s.startsWith('-')?-minor(s.slice(1)):minor(s);
const money=(n:number)=>n<0?'-'+decimal(-n):decimal(n);
export function extendPensionInvestment(c:any){
 if(c.action!=='pension.trade')return false;
 const {body,state,account,rows,db,ds,journal,entry,system,result,writeDoc,actor}=c;
 const allowed=['assetId','mode','holdingId','product','amount','fee','date','full','carryingValue','costBasis','actualConfirmed','balanceUncovered','note'];
 if(Object.keys(body).some(k=>!allowed.includes(k))||body.actualConfirmed!==true||body.balanceUncovered!==true)throw Error('请核对账户内交易已成交且未重复包含在当前快照中');
 const a=account(body.assetId);if(!isPensionAccount(a)||a.kind!=='ASSET'||a.currency!=='CNY')throw Error('请选择有效个人养老金账户');
 const date=body.date;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today()||date<(a.metadata.asOf??'')||date<(a.metadata.lastContributionAt??'')||date<(a.metadata.lastInvestmentAt??''))throw Error('交易日期不能在未来或早于已核对快照、充值和账户内交易');
 if(!['buy','sell'].includes(body.mode))throw Error('请选择账户内买入或卖出');
 const gross=minor(text(body.amount)),fee=body.fee==null||body.fee===''?0:minor(text(body.fee)),p=normalizePension(a.metadata.pension,decimal(a.balance));
 if(gross<=0)throw Error('实际成交金额必须大于0');
 const beforeCash=minor(p.cashBalance),holdings=p.holdings.map((h:any)=>({...h}));let h=holdings.find((h:any)=>h.id===body.holdingId),cash=beforeCash,carrying=0,costBasis=0,realized=0,delta=0;
 if(body.mode==='buy'){
  if(body.full!==undefined||body.carryingValue!==undefined||body.costBasis!==undefined)throw Error('买入不能指定卖出成本');
  if(gross+fee>MAX_MINOR||gross+fee>cash)throw Error('养老金内可投资余额不足；卖出回款或实际充值后再记录');
  if(body.product!==undefined){
   if(body.holdingId||!body.product||typeof body.product!=='object'||Array.isArray(body.product)||Object.keys(body.product).some(k=>!['name','kind','assetTypeId','code'].includes(k)))throw Error('新产品资料或目标持仓无效');
   const product=body.product,name=text(product.name),kind=product.kind,base=({fund:'fund',insurance:'other',deposit:'term_deposit',other:'other'} as Record<string,string>)[kind];if(!base)throw Error('养老金产品种类无效');
   const type=getAssetTypes(state).find((t:any)=>t.id===(product.assetTypeId??base)&&t.enabled&&t.baseCategory===base&&t.id!=='personal_pension');if(!type)throw Error('产品资产类型不属于本家庭、已停用或性质不符');
   const code=product.code?text(product.code,30):undefined;if(holdings.some((x:any)=>key(x.name)===key(name)||code&&x.code===code&&x.kind===kind))throw Error('已有同名或同代码养老金产品，请选择已有持仓');
   if(holdings.length>=50)throw Error('养老金产品数量已达上限');
   h={id:'holding_'+crypto.randomUUID().replaceAll('-',''),name,kind,assetTypeId:type.id,...(code?{code}:{}),value:'0.00',cost:'0.00'};holdings.push(h);
  }else if(!h)throw Error('请选择本养老金账户的已有持仓或新产品');
  h.value=decimal(minor(h.value)+gross);h.cost=decimal(minor(h.cost)+gross+fee);delete h.yesterdayProfit;cash-=gross+fee;delta=-fee;
 }else{
  if(body.product!==undefined||!h||typeof body.full!=='boolean')throw Error('请选择本养老金账户的卖出持仓并核对全部或部分卖出');
  if(fee>gross)throw Error('卖出手续费不能超过成交额');
  if(body.full){if(body.carryingValue!==undefined||body.costBasis!==undefined)throw Error('全部卖出按原完整持仓核对，不另填部分成本');carrying=minor(h.value);costBasis=minor(h.cost);}
  else{carrying=minor(text(body.carryingValue));costBasis=minor(text(body.costBasis));if(carrying<=0||carrying>=minor(h.value)||costBasis>minor(h.cost))throw Error('部分卖出须核对未超过持仓的账面价值与成本；全部卖出请选择对应选项');}
  cash+=gross-fee;delta=gross-fee-carrying;realized=gross-fee-costBasis;
  if(body.full)holdings.splice(holdings.indexOf(h),1);else{h.value=decimal(minor(h.value)-carrying);h.cost=decimal(minor(h.cost)-costBasis);delete h.yesterdayProfit;}
 }
 const nextBalance=a.balance+delta;if(!Number.isSafeInteger(cash)||cash<0||cash>MAX_MINOR||nextBalance<0||nextBalance>MAX_MINOR)throw Error('交易后养老金余额超出金额上限');
 const nextRealized=signed(p.realizedProfit??'0.00')+realized;if(!Number.isSafeInteger(nextRealized)||Math.abs(nextRealized)>MAX_MINOR)throw Error('已记录交易收益超出金额上限');
 const pension=normalizePension({...p,cashBalance:decimal(cash),holdings,realizedProfit:money(nextRealized)},decimal(nextBalance));
 const id=crypto.randomUUID(),valuationGain=body.mode==='sell'?gross-carrying:0;
 if(delta!==0||fee!==0||valuationGain!==0)journal(body.mode==='buy'?'PENSION_BUY':'PENSION_SALE',gross,[entry(a,delta),...(fee?[entry(system('expense'),fee)]:[]),...(valuationGain?[entry(system('income'),-valuationGain)]:[])],{assetId:a.id,accountId:a.id,pensionTradeId:id,pensionInternal:true,businessDate:date,note:'养老金账户内'+(body.mode==='buy'?'买入':'卖出')+'；资金未转出账户'});
 writeDoc(id,'pension_trade',{assetId:a.id,mode:body.mode,holdingId:h.id,productName:h.name,productKind:h.kind??null,assetTypeId:h.assetTypeId??null,amountMinor:gross,feeMinor:fee,carryingValueMinor:carrying,costBasisMinor:costBasis,realizedProfitMinor:realized,cashBeforeMinor:beforeCash,cashAfterMinor:cash,balanceBeforeMinor:a.balance,balanceAfterMinor:nextBalance,businessDate:date,journalId:result.transactionId??null,note:typeof body.note==='string'?body.note.slice(0,300):'',createdAt:new Date().toISOString(),createdBy:actor,source:'本人核对已成交；账户内买卖不占用年度缴费额度，不代表提取或银行交易'});
 rows.push(db.prepare('UPDATE accounts SET metadata=? WHERE dataset_id=? AND id=?').bind(JSON.stringify({...a.metadata,pension,lastInvestmentAt:date}),ds,a.id));result.id=id;result.assetId=a.id;return true;
}

const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const balanceKinds=['ASSET','LIABILITY','INCOME','EXPENSE','EQUITY'];
const labels={PENSION_BUY:'养老金账户内买入',PENSION_SALE:'养老金账户内卖出',OPENING:'开账登记',ADJUSTMENT:'余额校正',TRANSFER:'内部转账',INCOME:'实际收入到账',EXPENSE:'实际消费支出',PAYMENT:'消费确认或付款',REFUND:'消费退款',LOAN_PAYMENT:'贷款实际还本付息',PREPAYMENT:'预付款转为资产',PREPAYMENT_REFUND:'预付款退款',ASSET_BUY:'资产买入或转换',ASSET_SALE:'资产变现或转换'};
const safeAdd=(left,right)=>{const sum=BigInt(left)+BigInt(right);if(sum>BigInt(Number.MAX_SAFE_INTEGER)||sum<BigInt(Number.MIN_SAFE_INTEGER))throw Error('月报金额超出精确计算范围');return Number(sum);};
const fresh=currency=>({currency,openingAssetsMinor:0,closingAssetsMinor:0,assetChangeMinor:0,openingLiabilitiesMinor:0,closingLiabilitiesMinor:0,liabilityChangeMinor:0,openingNetWorthMinor:0,closingNetWorthMinor:0,netWorthChangeMinor:0,openingCashMinor:0,closingCashMinor:0,cashChangeMinor:0,businessCashInflowMinor:0,businessCashOutflowMinor:0,businessCashNetMinor:0,openingCorrectionCashMinor:0,transferCashMinor:0,journalIncomeMinor:0,journalExpenseMinor:0,hasMonthRecords:false,hasRecordedHistory:false,hasPriorRecordedHistory:false,entryCount:0,activities:[]});
const activity=kind=>({kind,label:labels[kind]??'其他已入账事项（'+kind+'）',assetChangeMinor:0,liabilityChangeMinor:0,netWorthChangeMinor:0,cashInflowMinor:0,cashOutflowMinor:0,cashChangeMinor:0,journalIncomeMinor:0,journalExpenseMinor:0,entryCount:0});

export function buildMonthlyReport(state,month){
 const basisNote='按本站已过账分录的业务日期重建历史账面余额，不代表完整银行对账单或历史市场估值。本站首笔分录之前的真实资产与银行期初未知，不向历史补零。资产增加与净资产变动不是投资收益；不回填今天报价，也不把未知历史汇率补成CNY。';
 const unavailable=reason=>({available:false,month,reason,basisNote,months:[],currencies:[]});
 if(typeof month!=='string'||!MONTH.test(month))return unavailable('请选择有效月份');
 const data=state?.monthlyLedgerTotals;
 if(data?.complete!==true||data.source!=='posted_entries'||!Array.isArray(data.rows))return unavailable('尚未取得完整过账分录汇总，不能用当前余额或最近300条流水推算历史月报');
 const currencies=new Map([['CNY',fresh('CNY')]]),activityMaps=new Map(),journalBalances=new Map(),months=new Set([month]);
 try{
  for(const row of data.rows){
   if(!row||typeof row.month!=='string'||!MONTH.test(row.month)||!['CNY','USD'].includes(row.currency)||!balanceKinds.includes(row.accountKind)||typeof row.category!=='string'||typeof row.transactionKind!=='string'||!Number.isSafeInteger(row.deltaMinor)||!Number.isSafeInteger(row.inflowMinor)||row.inflowMinor<0||!Number.isSafeInteger(row.outflowMinor)||row.outflowMinor<0||!Number.isSafeInteger(row.entryCount)||row.entryCount<1||BigInt(row.inflowMinor)-BigInt(row.outflowMinor)!==BigInt(row.deltaMinor))throw Error('完整分录汇总有缺失或不精确字段，月报暂不可用');
   const balanceKey=row.month+':'+row.currency;journalBalances.set(balanceKey,(journalBalances.get(balanceKey)??0n)+BigInt(row.deltaMinor));
   months.add(row.month);if(!currencies.has(row.currency))currencies.set(row.currency,fresh(row.currency));
   if(row.month>month)continue;
   const result=currencies.get(row.currency),prior=row.month<month,asset=row.accountKind==='ASSET'?row.deltaMinor:0,liability=row.accountKind==='LIABILITY'?-row.deltaMinor:0,cash=row.accountKind==='ASSET'&&row.category==='cash'?row.deltaMinor:0;
   result.hasRecordedHistory=true;
   result.closingAssetsMinor=safeAdd(result.closingAssetsMinor,asset);result.closingLiabilitiesMinor=safeAdd(result.closingLiabilitiesMinor,liability);result.closingCashMinor=safeAdd(result.closingCashMinor,cash);
   if(prior){result.hasPriorRecordedHistory=true;result.openingAssetsMinor=safeAdd(result.openingAssetsMinor,asset);result.openingLiabilitiesMinor=safeAdd(result.openingLiabilitiesMinor,liability);result.openingCashMinor=safeAdd(result.openingCashMinor,cash);continue;}
   result.hasMonthRecords=true;result.entryCount=safeAdd(result.entryCount,row.entryCount);
   if(!activityMaps.has(row.currency))activityMaps.set(row.currency,new Map());
   const activities=activityMaps.get(row.currency),item=activities.get(row.transactionKind)??activity(row.transactionKind);
   item.entryCount=safeAdd(item.entryCount,row.entryCount);item.assetChangeMinor=safeAdd(item.assetChangeMinor,asset);item.liabilityChangeMinor=safeAdd(item.liabilityChangeMinor,liability);
   if(row.accountKind==='ASSET'&&row.category==='cash'){
    item.cashInflowMinor=safeAdd(item.cashInflowMinor,row.inflowMinor);item.cashOutflowMinor=safeAdd(item.cashOutflowMinor,row.outflowMinor);item.cashChangeMinor=safeAdd(item.cashChangeMinor,cash);
    if(['OPENING','ADJUSTMENT'].includes(row.transactionKind))result.openingCorrectionCashMinor=safeAdd(result.openingCorrectionCashMinor,cash);
    else if(row.transactionKind==='TRANSFER')result.transferCashMinor=safeAdd(result.transferCashMinor,cash);
    else{result.businessCashInflowMinor=safeAdd(result.businessCashInflowMinor,row.inflowMinor);result.businessCashOutflowMinor=safeAdd(result.businessCashOutflowMinor,row.outflowMinor);}
   }
   if(row.accountKind==='INCOME'){item.journalIncomeMinor=safeAdd(item.journalIncomeMinor,-row.deltaMinor);result.journalIncomeMinor=safeAdd(result.journalIncomeMinor,-row.deltaMinor);}
   if(row.accountKind==='EXPENSE'){item.journalExpenseMinor=safeAdd(item.journalExpenseMinor,row.deltaMinor);result.journalExpenseMinor=safeAdd(result.journalExpenseMinor,row.deltaMinor);}
   activities.set(row.transactionKind,item);
  }
  if([...journalBalances.values()].some(value=>value!==0n))throw Error('月度分录按币种不平衡，不能据此生成历史余额');
  for(const result of currencies.values()){
   result.assetChangeMinor=safeAdd(result.closingAssetsMinor,-result.openingAssetsMinor);result.liabilityChangeMinor=safeAdd(result.closingLiabilitiesMinor,-result.openingLiabilitiesMinor);
   result.openingNetWorthMinor=safeAdd(result.openingAssetsMinor,-result.openingLiabilitiesMinor);result.closingNetWorthMinor=safeAdd(result.closingAssetsMinor,-result.closingLiabilitiesMinor);result.netWorthChangeMinor=safeAdd(result.closingNetWorthMinor,-result.openingNetWorthMinor);
   result.cashChangeMinor=safeAdd(result.closingCashMinor,-result.openingCashMinor);result.businessCashNetMinor=safeAdd(result.businessCashInflowMinor,-result.businessCashOutflowMinor);
   result.activities=[...(activityMaps.get(result.currency)?.values()??[])].map(item=>({...item,netWorthChangeMinor:safeAdd(item.assetChangeMinor,-item.liabilityChangeMinor)})).sort((a,b)=>a.kind.localeCompare(b.kind));
   if(safeAdd(safeAdd(result.businessCashNetMinor,result.openingCorrectionCashMinor),result.transferCashMinor)!==result.cashChangeMinor)throw Error('现金期初期末与本月分录无法核对');
  }
 }catch(error){return unavailable(error instanceof Error?error.message:'月报分录需核对');}
 return {available:true,month,reason:'',basisNote,months:[...months].sort().reverse(),currencies:[...currencies.values()].sort((a,b)=>a.currency==='CNY'?-1:b.currency==='CNY'?1:a.currency.localeCompare(b.currency))};
}

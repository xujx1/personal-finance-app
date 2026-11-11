import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,publicSnapshot} from '../src/server/finance-store.ts';
import {openTestDatabase} from './helpers/d1.mjs';
import {buildMonthlyReport} from '../src/domain/monthly-report.mjs';

async function fixture(t){
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());await snapshot(db);
 const account=(id,kind,category,currency='CNY')=>sqlite.prepare("INSERT INTO accounts VALUES('initial',?,?,?,?,?,0,'{}')").run(id,'fake-'+id,kind,category,currency);
 account('bank','ASSET','cash');account('bank2','ASSET','cash');account('stock','ASSET','stock');account('prepaid','ASSET','prepayment');account('other','ASSET','other');account('loan','LIABILITY','loan');account('usd','ASSET','stock','USD');
 let sequence=0;
 const post=(kind,date,entries,original=null)=>{const id='fake-'+sequence++,total=entries.filter(row=>row[2]>0).reduce((sum,row)=>sum+row[2],0);sqlite.prepare("INSERT INTO transactions VALUES('initial',?,?,'DRAFT',?,?,?,'{}')").run(id,kind,total,original,date);for(const [accountId,currency,amount] of entries)sqlite.prepare("INSERT INTO entries VALUES('initial',?,?,?,?)").run(id,accountId,currency,amount);sqlite.prepare("UPDATE transactions SET status='POSTED' WHERE id=?").run(id);return id;};
 post('OPENING','2026-01-01',[['bank','CNY',100000],['equity:CNY','CNY',-100000]]);
 post('OPENING','2026-01-01',[['loan','CNY',-50000],['equity:CNY','CNY',50000]]);
 post('OPENING','2026-01-01',[['usd','USD',3000],['equity:USD','USD',-3000]]);
 post('INCOME','2026-01-02',[['bank','CNY',10000],['income:CNY','CNY',-10000]]);
 post('ADJUSTMENT','2026-01-03',[['stock','CNY',20000],['equity:CNY','CNY',-20000]]);
 post('TRANSFER','2026-02-01',[['bank','CNY',-5000],['bank2','CNY',5000]]);
 post('LOAN_PAYMENT','2026-02-02',[['bank','CNY',-12000],['loan','CNY',10000],['expense:CNY','CNY',2000]]);
 post('PREPAYMENT','2026-02-03',[['bank','CNY',-8000],['prepaid','CNY',8000]]);
 const consumed=post('PAYMENT','2026-02-04',[['prepaid','CNY',-3000],['expense:CNY','CNY',3000]]);
 post('ASSET_BUY','2026-02-05',[['bank','CNY',-10000],['stock','CNY',10000]]);
 post('INCOME','2026-02-06',[['bank','CNY',40000],['income:CNY','CNY',-40000]]);
 post('EXPENSE','2026-02-07',[['bank','CNY',-5000],['expense:CNY','CNY',5000]]);
 post('REFUND','2026-02-08',[['bank','CNY',1000],['expense:CNY','CNY',-1000]],consumed);
 post('ADJUSTMENT','2026-02-09',[['stock','CNY',700],['equity:CNY','CNY',-700]]);
 post('OPENING','2026-02-10',[['other','CNY',1000],['equity:CNY','CNY',-1000]]);
 return {db,sqlite,post};
}

test('snapshot exposes complete monthly journal totals including historical archived assets and both currencies',async t=>{
 const {db,sqlite}=await fixture(t);sqlite.prepare("UPDATE accounts SET archived=1 WHERE id='stock'").run();
 sqlite.prepare("INSERT INTO transactions VALUES('initial','pending-fake','INCOME','DRAFT',999,NULL,'2026-02-11','{}')").run();
 sqlite.prepare("INSERT INTO entries VALUES('initial','pending-fake','bank','CNY',999)").run();sqlite.prepare("INSERT INTO entries VALUES('initial','pending-fake','income:CNY','CNY',-999)").run();
 const state=await snapshot(db);assert.equal(state.monthlyLedgerTotals.complete,true);assert.equal(state.monthlyLedgerTotals.source,'posted_entries');
 const opening=state.monthlyLedgerTotals.rows.find(row=>row.month==='2026-01'&&row.currency==='USD'&&row.accountKind==='ASSET');assert.equal(opening.deltaMinor,3000);
 const stored=state.monthlyLedgerTotals.rows.find(row=>row.month==='2026-01'&&row.category==='stock');assert.equal(stored.deltaMinor,20000);
 assert.deepEqual(publicSnapshot(state).monthlyLedgerTotals,state.monthlyLedgerTotals);
 assert.equal(state.monthlyLedgerTotals.rows.find(row=>row.month==='2026-02'&&row.currency==='CNY'&&row.accountKind==='ASSET'&&row.category==='cash'&&row.transactionKind==='INCOME').deltaMinor,40000);
});

test('monthly report reconstructs historical opening and closing balances without current quotes or fake FX',async t=>{
 const {db}=await fixture(t),state=await snapshot(db);state.accounts=[{kind:'ASSET',balance:999999999,currency:'CNY'}];state.quotes={fake:{price:'9999.99'}};state.fx={rate:'999'};
 const before=JSON.stringify(state),report=buildMonthlyReport(state,'2026-02'),cny=report.currencies.find(row=>row.currency==='CNY'),usd=report.currencies.find(row=>row.currency==='USD');
 assert.equal(report.available,true);assert.equal(cny.openingAssetsMinor,130000);assert.equal(cny.closingAssetsMinor,152700);assert.equal(cny.assetChangeMinor,22700);
 assert.equal(cny.openingLiabilitiesMinor,50000);assert.equal(cny.closingLiabilitiesMinor,40000);assert.equal(cny.liabilityChangeMinor,-10000);
 assert.equal(cny.openingNetWorthMinor,80000);assert.equal(cny.closingNetWorthMinor,112700);assert.equal(cny.netWorthChangeMinor,32700);
 assert.equal(usd.openingAssetsMinor,3000);assert.equal(usd.closingAssetsMinor,3000);assert.equal(usd.assetChangeMinor,0);
 const first=buildMonthlyReport(state,'2026-01').currencies.find(row=>row.currency==='CNY');assert.equal(first.hasPriorRecordedHistory,false);assert.equal(first.openingAssetsMinor,0);
 assert.equal(report.currencies.length,2);assert.equal(JSON.stringify(state),before);assert.match(report.basisNote,/不是投资收益|不代表投资收益/);
});

test('business cashflow excludes openings corrections and internal transfer gross flows while consumption stays separate',async t=>{
 const {db}=await fixture(t),report=buildMonthlyReport(await snapshot(db),'2026-02'),cny=report.currencies.find(row=>row.currency==='CNY');
 assert.equal(cny.openingCashMinor,110000);assert.equal(cny.closingCashMinor,116000);assert.equal(cny.businessCashInflowMinor,41000);assert.equal(cny.businessCashOutflowMinor,35000);assert.equal(cny.businessCashNetMinor,6000);
 const transfer=cny.activities.find(row=>row.kind==='TRANSFER');assert.equal(transfer.cashInflowMinor,5000);assert.equal(transfer.cashOutflowMinor,5000);assert.equal(transfer.netWorthChangeMinor,0);
 const prepaid=cny.activities.find(row=>row.kind==='PREPAYMENT');assert.equal(prepaid.cashOutflowMinor,8000);assert.equal(prepaid.assetChangeMinor,0);
 const consumed=cny.activities.find(row=>row.kind==='PAYMENT');assert.equal(consumed.cashOutflowMinor,0);assert.equal(consumed.journalExpenseMinor,3000);
 const loan=cny.activities.find(row=>row.kind==='LOAN_PAYMENT');assert.equal(loan.liabilityChangeMinor,-10000);assert.equal(loan.journalExpenseMinor,2000);assert.equal(loan.netWorthChangeMinor,-2000);
 assert.equal(cny.activities.find(row=>row.kind==='ASSET_BUY').netWorthChangeMinor,0);
 assert.equal(cny.activities.find(row=>row.kind==='ADJUSTMENT').netWorthChangeMinor,700);
});

test('historical month balances survive more than 300 newer transactions and carry forward quiet months',async t=>{
 const {db,post}=await fixture(t);for(let index=0;index<305;index++)post('INCOME','2026-04-01',[['bank','CNY',1],['income:CNY','CNY',-1]]);
 const state=await snapshot(db);assert.equal(state.transactions.length,300);
 const historical=buildMonthlyReport(state,'2026-02').currencies.find(row=>row.currency==='CNY');assert.equal(historical.closingAssetsMinor,152700);
 const march=buildMonthlyReport(state,'2026-03').currencies.find(row=>row.currency==='CNY');assert.equal(march.openingAssetsMinor,152700);assert.equal(march.closingAssetsMinor,152700);assert.equal(march.hasMonthRecords,false);assert.equal(march.hasRecordedHistory,true);
});

test('missing or malformed full-history data stays unavailable rather than using present balances or recent feed',()=>{
 assert.equal(buildMonthlyReport({accounts:[{balance:999}],transactions:[]},'2026-02').available,false);
 const empty=buildMonthlyReport({monthlyLedgerTotals:{complete:true,source:'posted_entries',rows:[]}},'2026-02');assert.equal(empty.available,true);assert.ok(empty.currencies.every(row=>!row.hasRecordedHistory));
 const bad={month:'2026-02',currency:'CNY',accountKind:'ASSET',category:'cash',transactionKind:'INCOME',deltaMinor:100,inflowMinor:99,outflowMinor:0,entryCount:1};
 assert.equal(buildMonthlyReport({monthlyLedgerTotals:{complete:true,source:'posted_entries',rows:[bad]}},'2026-02').available,false);
 assert.equal(buildMonthlyReport({monthlyLedgerTotals:{complete:true,source:'posted_entries',rows:[{...bad,inflowMinor:100}]}},'2026-02').available,false);
 assert.equal(buildMonthlyReport({monthlyLedgerTotals:{complete:true,source:'posted_entries',rows:[]}},'2026-13').available,false);
});

test('explicit asset market survives rename while a ticker alone never infers a market',async t=>{
 const {executeCommand}=await import('../src/server/finance-store.ts');
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());
 const run=async body=>{const state=await snapshot(db);return executeCommand(db,{key:crypto.randomUUID(),revision:state.book.revision,action:'account.save',body},'fake-owner');};
 const created=await run({name:'fake-market-position',category:'stock',currency:'USD',amount:'30.02',code:'FAKE',market:'US'});
 await run({id:created.id,name:'fake-renamed-position',category:'stock',currency:'USD',amount:'30.02'});
 let state=await snapshot(db);assert.equal(state.accounts.find(account=>account.id===created.id).metadata.market,'US');assert.equal(state.transactions.length,1);
 const unknown=await run({name:'fake-unverified-market',category:'stock',currency:'USD',amount:'1.00',code:'FAKE'});
 state=await snapshot(db);assert.equal(state.accounts.find(account=>account.id===unknown.id).metadata.market,null);
 await assert.rejects(run({id:created.id,name:'fake-invalid-market',category:'stock',currency:'USD',amount:'30.02',market:'NASDAQ'}),/市场/);
});

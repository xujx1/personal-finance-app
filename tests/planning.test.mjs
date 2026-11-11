import test from 'node:test';import assert from 'node:assert/strict';import {mortgageSchedule,annualForecast,thresholdAlerts} from '../src/domain/planning.mjs';import {parseTencent,parseFund,positionValue} from '../src/domain/market.mjs';
test('mortgage simulation balances principal and prepayment reduces interest without modifying a loan',()=>{const base=mortgageSchedule({principal:100000,rate:'3.2',months:12}),reduced=mortgageSchedule({principal:100000,rate:'3.2',months:12,prepayment:20000});assert.equal(base.rows.reduce((n,x)=>n+x.principal,0),100000);assert.equal(reduced.rows.reduce((n,x)=>n+x.principal,0),80000);assert.ok(base.interest>reduced.interest);assert.equal(base.rows.at(-1).balance,0);assert.throws(()=>mortgageSchedule({principal:100,rate:'3',months:12,prepayment:101}))});
test('forecast counts one plan remaining and recurring occurrence once',()=>{const s={accounts:[{category:'cash',currency:'CNY',balance:100000}],documents:[{id:'p',kind:'plan',payload:{name:'模拟',date:'2026-12-01',budget:20000,reserved:20000,status:'PLANNED'}},{id:'r',kind:'recurring_rule',payload:{type:'income',amount:10000,day:10,start:'2026-11-01',end:null,paused:false}}],planSummaries:[{planId:'p',paid:5000}],transactions:[]};const f=annualForecast(s,'2026-11-11',3);assert.equal(f[0].closing,100000);assert.equal(f[1].closing,95000);assert.equal(f[1].planned,15000)});
test('price thresholds only fire on first upward crossing and merge levels',()=>{let r=thresholdAlerts({symbol:'BABA',levels:['150','170','185'],previous:'140',current:'190',sent:[]});assert.deepEqual(r.crossed,['150','170','185']);assert.equal(thresholdAlerts({symbol:'BABA',levels:['150','170'],previous:'140',current:'190',sent:r.sent}).crossed.length,0);assert.equal(thresholdAlerts({symbol:'BABA',levels:['150'],previous:null,current:'190',sent:[]}).crossed.length,0)});
test('quote parsers preserve actual publication time and distinguish fund estimates',()=>{const parts=Array(40).fill('');parts[1]='模拟阿里';parts[2]='BABA';parts[3]='102.72';parts[30]='20261110160000';const q=parseTencent('v_usBABA="'+parts.join('~')+'";','BABA');assert.equal(q.price,'102.72');assert.ok(q.delay);const f=parseFund('jsonpgz({"fundcode":"008163","name":"模拟基金","jzrq":"2026-11-10","dwjz":"1.2345","gsz":"1.2400","gztime":"2026-11-11 15:00"});','008163');assert.equal(f.kind,'published_nav');assert.equal(f.price,'1.2345');assert.equal(f.estimate.price,'1.2400');assert.equal(positionValue('4','168.80'),67520)});

test('monthly cashflow uses full-book aggregates and keeps prepayments refunds debt and conversions distinct',async()=>{
 const {monthlyActualCashflow}=await import('../src/domain/planning.mjs');
 const state={transactions:[{kind:'INCOME',total_minor:999999999}],cashflowTotals:{complete:true,source:'posted_cash_entries',rows:[
  {month:'2026-10',currency:'CNY',kind:'INCOME',cashDeltaMinor:100000,principalMinor:0,interestMinor:0,count:2},
  {month:'2026-10',currency:'CNY',kind:'EXPENSE',cashDeltaMinor:-20000,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-10',currency:'CNY',kind:'PREPAYMENT',cashDeltaMinor:-30000,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-10',currency:'CNY',kind:'TRANSFER',cashDeltaMinor:0,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-10',currency:'CNY',kind:'LOAN_PAYMENT',cashDeltaMinor:-12000,principalMinor:10000,interestMinor:2000,count:1},
  {month:'2026-10',currency:'CNY',kind:'ASSET_BUY',cashDeltaMinor:-15000,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-10',currency:'CNY',kind:'OPENING',cashDeltaMinor:500000,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-11',currency:'CNY',kind:'PAYMENT',cashDeltaMinor:0,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-11',currency:'CNY',kind:'REFUND',cashDeltaMinor:5000,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-11',currency:'CNY',kind:'PREPAYMENT_REFUND',cashDeltaMinor:10000,principalMinor:0,interestMinor:0,count:1},
  {month:'2026-11',currency:'USD',kind:'INCOME',cashDeltaMinor:20000,principalMinor:0,interestMinor:0,count:1},
 ]}};
 const before=JSON.stringify(state),result=monthlyActualCashflow(state,3,'2026-11-11');
 assert.equal(result.available,true);assert.deepEqual(result.currencies,['CNY','USD']);
 const october=result.rows.find(row=>row.month==='2026-10');
 assert.equal(october.incomeMinor,100000);assert.equal(october.consumptionMinor,20000);assert.equal(october.principalMinor,10000);assert.equal(october.interestMinor,2000);assert.equal(october.prepaymentMinor,30000);
 assert.equal(october.investmentCashMinor,-15000);assert.equal(october.cashSurplusMinor,23000);assert.equal(october.openingAdjustmentMinor,500000);assert.equal(october.cashChangeMinor,523000);
 const november=result.rows.find(row=>row.month==='2026-11');assert.equal(november.consumptionMinor,-5000);assert.equal(november.prepaymentMinor,-10000);assert.equal(november.cashSurplusMinor,15000);
 assert.equal(result.byCurrency.USD.find(row=>row.month==='2026-11').incomeMinor,20000);
 assert.equal(result.rows.find(row=>row.month==='2026-09').hasRecords,false);
 assert.equal(JSON.stringify(state),before);
});

test('monthly cashflow never substitutes limited recent transactions or asserts complete bank coverage',async()=>{
 const {monthlyActualCashflow}=await import('../src/domain/planning.mjs');
 assert.equal(monthlyActualCashflow({transactions:[{kind:'INCOME',total_minor:5000}]},12,'2026-11-11').available,false);
 assert.equal(monthlyActualCashflow({cashflowTotals:{complete:false,source:'posted_cash_entries',rows:[]}},12,'2026-11-11').available,false);
 const result=monthlyActualCashflow({cashflowTotals:{complete:true,source:'posted_cash_entries',rows:[]}},3,'2026-01-01');
 assert.equal(result.available,true);assert.deepEqual(result.rows.map(row=>row.month),['2025-11','2025-12','2026-01']);assert.ok(result.rows.every(row=>!row.hasRecords));
 assert.match(result.coverageNote,/不代表完整银行对账单/);
});

test('monthly cashflow rejects imprecise aggregates and does not silently lose an unknown cash movement',async()=>{
 const {monthlyActualCashflow}=await import('../src/domain/planning.mjs');
 const row={month:'2026-11',currency:'CNY',kind:'MISC',cashDeltaMinor:-123,principalMinor:0,interestMinor:0,count:1};
 const result=monthlyActualCashflow({cashflowTotals:{complete:true,source:'posted_cash_entries',rows:[row]}},3,'2026-11-11');
 assert.equal(result.rows.at(-1).otherCashMinor,-123);assert.equal(result.rows.at(-1).cashSurplusMinor,-123);
 for(const invalid of [{...row,cashDeltaMinor:0.1},{...row,month:'2026-13'},{...row,cashDeltaMinor:Number.MAX_SAFE_INTEGER+1}])assert.equal(monthlyActualCashflow({cashflowTotals:{complete:true,source:'posted_cash_entries',rows:[invalid]}},3,'2026-11-11').available,false);
 const mismatched={...row,kind:'LOAN_PAYMENT',cashDeltaMinor:-1200,principalMinor:1000,interestMinor:100};
 assert.equal(monthlyActualCashflow({cashflowTotals:{complete:true,source:'posted_cash_entries',rows:[mismatched]}},3,'2026-11-11').available,false);
});

test('loan simulation defaults retain verified rate monthly payment and dates without guessing unknown terms',async()=>{
 const {loanSimulationDefaults}=await import('../src/domain/planning.mjs');
 const defaults=loanSimulationDefaults({metadata:{rate:'3.20',monthly:'1500.00',remainingMonths:120,maturityDate:'2036-11-11',repricingDate:'2027-01-01',day:15,asOf:'2026-11-10'}});
 assert.deepEqual(defaults,{rate:'3.20',monthly:'1500.00',months:'120',maturityDate:'2036-11-11',repricingDate:'2027-01-01',day:'15',asOf:'2026-11-10'});
 assert.deepEqual(loanSimulationDefaults({metadata:{rate:'unknown',monthly:'',maturityDate:'2036-02-30'}}),{rate:'',monthly:'',months:'',maturityDate:'',repricingDate:'',day:'',asOf:''});
 assert.equal(loanSimulationDefaults({metadata:{maturityDate:'2036-11-11'}}).months,'');
});

test('known-payment and zero-interest mortgage scenarios retain every cent of principal',()=>{
 const base=mortgageSchedule({principal:100000,rate:'3.2',months:24,payment:7000,mode:'reduce_term'}),reduced=mortgageSchedule({principal:100000,rate:'3.2',months:24,payment:7000,mode:'reduce_term',prepayment:20000});
 assert.equal(base.rows.reduce((sum,row)=>sum+row.principal,0),100000);assert.equal(reduced.rows.reduce((sum,row)=>sum+row.principal,0)+20000,100000);assert.ok(reduced.months<base.months);assert.equal(reduced.rows.at(-1).balance,0);
 const full=mortgageSchedule({principal:100000,rate:'3.2',months:24,payment:7000,mode:'reduce_term',prepayment:100000});assert.equal(full.payment,0);assert.equal(full.months,0);assert.equal(full.interest,0);
 const zero=mortgageSchedule({principal:100003,rate:'0',months:7});assert.equal(zero.rows.reduce((sum,row)=>sum+row.principal,0),100003);assert.equal(zero.interest,0);
 assert.throws(()=>mortgageSchedule({principal:100000,rate:'3',months:12,payment:1000.5,mode:'reduce_term'}));
 assert.throws(()=>mortgageSchedule({principal:100000,rate:'3',months:12,mode:'unknown'}));
});

test('zero prepayment compares identical schedules in each mode despite a different recorded monthly payment',async()=>{
 const {compareMortgageScenarios}=await import('../src/domain/planning.mjs');
 for(const mode of ['reduce_payment','reduce_term']){
  const input={principal:10000000,rate:'3',months:120,payment:120000,prepayment:0,mode},before=JSON.stringify(input);
  const result=compareMortgageScenarios(input);
  assert.deepEqual(result.scenario.rows,result.base.rows,mode);
  assert.equal(result.scenario.payment,result.base.payment,mode);
  assert.equal(result.scenario.months,result.base.months,mode);
  assert.equal(result.scenario.interest,result.base.interest,mode);
  assert.equal(result.usedMonthly,mode==='reduce_term');
  if(mode==='reduce_term')assert.equal(result.base.payment,120000);
  else assert.notEqual(result.base.payment,120000);
  assert.equal(JSON.stringify(input),before);
 }
});

test('positive prepayment comparisons retain the same mode baseline and conserve principal',async()=>{
 const {compareMortgageScenarios}=await import('../src/domain/planning.mjs');
 for(const mode of ['reduce_payment','reduce_term']){
  const input={principal:10000000,rate:'3',months:120,payment:120000,mode},zero=compareMortgageScenarios({...input,prepayment:0}),reduced=compareMortgageScenarios({...input,prepayment:2000000});
  assert.deepEqual(reduced.base,zero.base);
  assert.equal(reduced.scenario.rows.reduce((total,row)=>total+row.principal,0)+2000000,input.principal);
  assert.equal(reduced.scenario.rows.at(-1).balance,0);
  assert.ok(reduced.scenario.interest<reduced.base.interest);
 }
});

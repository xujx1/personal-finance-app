import test from 'node:test';
import assert from 'node:assert/strict';
import {financialTools} from '../src/server/financial-tools.ts';
import {openTestDatabase} from './helpers/d1.mjs';
import {snapshot} from '../src/server/finance-store.ts';

test('investment read tools expose budgets and securities without changing snapshot or account balances', async t => {
  const {db, sqlite} = openTestDatabase(); t.after(() => sqlite.close());
  const state = await snapshot(db);
  state.accounts = [
    {id:'cash',name:'模拟现金',kind:'ASSET',category:'cash',currency:'CNY',balance:10000,metadata:{}},
    {id:'stock',name:'模拟证券',kind:'ASSET',category:'stock',currency:'USD',balance:25000,metadata:{code:'BABA',quantity:'10',cost:'20.00',asOf:'2026-11-10'}},
    {id:'archived',name:'已归档证券',kind:'ASSET',category:'fund',archived:1,currency:'CNY',balance:40000,metadata:{}},
  ];
  state.documents = [{id:'budget',kind:'plan',payload:{name:'模拟旅行',budget:6000,status:'PLANNED',budgetStatus:'APPROVED',date:'2026-12-01'}}];
  state.planSummaries = [{planId:'budget',paid:2000}];
  const before = JSON.stringify(state), tools = financialTools(db,state);
  const budgets = await tools.get_budgets(), holdings = await tools.get_holdings();
  assert.equal(budgets.budgets[0].budgetYuan,'60.00');assert.equal(budgets.budgets[0].budgetMinor,undefined);
  assert.equal(budgets.budgets[0].remainingYuan,'40.00');
  assert.deepEqual(holdings.holdings.map(x => x.id),['stock']);
  assert.equal(holdings.holdings[0].quantity,'10');
  assert.equal(holdings.holdings[0].cost,'20.00');
  assert.equal(holdings.holdings[0].source,'本人账本快照');
  assert.equal(holdings.holdings[0].asOf,'2026-11-10');
  assert.equal(JSON.stringify(state),before);
});

test('market tool reports cached source and original publication time without treating snapshots as live prices', async t => {
  const {db,sqlite}=openTestDatabase(); t.after(()=>sqlite.close());
  const state=await snapshot(db);
  state.accounts=[{id:'stock',kind:'ASSET',category:'stock',currency:'USD',balance:100,metadata:{code:'BABA',market:'US'}},{id:'missing',kind:'ASSET',category:'fund',currency:'CNY',balance:100,metadata:{code:'000001'}}];
  await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('quote:stock:BABA',JSON.stringify({symbol:'BABA',price:'120.30',currency:'USD',source:'模拟公共来源',asOf:'20261110160000',fetchedAt:1234,kind:'public_quote'})).run();
  const quotes=await financialTools(db,state).get_market_quotes();
  assert.equal(quotes.quotes[0].price,'120.30');
  assert.equal(quotes.quotes[0].source,'模拟公共来源');
  assert.equal(quotes.quotes[0].asOf,'20261110160000');
  assert.equal(quotes.quotes[0].status,'cached_snapshot');
  assert.equal(quotes.quotes[1].status,'unavailable');
  assert.equal(quotes.quotes[1].price,null);
  assert.equal(quotes.quotes[1].asOf,null);
  assert.equal((await snapshot(db)).transactions.length,0);
});

test('AI financial read uses the same explicit four-bucket goal as the dashboard even before saving settings',async t=>{const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const state=await snapshot(db);const goals=await financialTools(db,state).get_savings_goals();assert.equal(goals.goals[0].schemaVersion,2);assert.equal(Object.values(goals.goals[0].bucketTargetsYuan).reduce((n,v)=>n+Number(v),0),4000000);assert.equal(goals.goals[0].monthlyTargetYuan,null);});

 test('model-facing assets holdings liabilities and budget amounts use explicit major strings with authoritative portfolio totals',async t=>{const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const state=await snapshot(db);state.accounts=[{id:'bank',name:'模拟银行',kind:'ASSET',category:'cash',currency:'CNY',balance:5753202,metadata:{}},{id:'fund',name:'模拟基金',kind:'ASSET',category:'fund',currency:'CNY',balance:3979066,metadata:{status:'redeeming'}},{id:'stock',name:'模拟股票',kind:'ASSET',category:'stock',currency:'USD',balance:7000000,metadata:{market:'US',code:'DEMO',quantity:'10'}},{id:'home',name:'模拟房产',kind:'ASSET',category:'property',currency:'CNY',balance:300000000,metadata:{}},{id:'loan',name:'模拟贷款',kind:'LIABILITY',category:'loan',currency:'CNY',balance:9000000,metadata:{monthly:'2000.00'}}];await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('quote:stock:DEMO',JSON.stringify({symbol:'DEMO',market:'US',currency:'USD',price:'7435.80',source:'模拟行情',asOf:'2026-11-12',fetchedAt:1234})).run();await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('fx',JSON.stringify({rate:'6.674',date:'2026-11-12',source:'模拟汇率',fetchedAt:1234})).run();const tools=financialTools(db,state),assets=await tools.get_assets(),holdings=await tools.get_holdings(),liabilities=await tools.get_liabilities();assert.equal(assets.assets.find(a=>a.id==='fund').amountMajor,'39790.66');assert.equal(assets.assets.find(a=>a.id==='home').goalExcluded,true);assert.equal(assets.summary.byCurrency.USD.stock,'74358.00');assert.equal(assets.summary.nonPropertyCurrentCny,'593587.97');assert.equal(holdings.holdings.find(a=>a.id==='stock').amountMajor,'70000.00');assert.equal(liabilities.liabilities[0].amountMajor,'90000.00');assert.equal(JSON.stringify({assets,holdings,liabilities}).includes('amountMinor'),false);assert.equal((await tools.get_market_quotes()).quotes.find(q=>q.accountId==='stock').market,'US');});
test('asset summary reads only current family quote cache and checks membership after cached FX read',async t=>{const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const {familyContext}=await import('../src/server/family-service.ts'),{scopeDb}=await import('../src/server/ledger-scope.ts');const user={userId:'portfolio-owner',email:'portfolio@example.test'},scope=await familyContext(db,user,{bootstrapOwnerEmail:user.email}),scoped=scopeDb(db,scope),state=await snapshot(scoped);state.accounts=[{id:'stock',name:'模拟股票',kind:'ASSET',category:'stock',currency:'USD',balance:10000,metadata:{code:'DEMO',market:'US',quantity:'1'}}];const quote={symbol:'DEMO',market:'US',currency:'USD',price:'200.00',source:'别的家庭全局旧缓存',asOf:'2026-11-12'};await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('quote:stock:DEMO',JSON.stringify(quote)).run();const tools=financialTools(scoped,state),summary=(await tools.get_assets()).summary;assert.equal(summary.byCurrency.USD.stock,'100.00');assert.equal(summary.valuations[0].valuationBasis,'ledger_snapshot');const intercepted={...scoped,prepare(sql){const s=scoped.prepare(sql),first=s.first;s.first=async()=>{const value=await first();if(sql==="SELECT payload FROM runtime_cache WHERE id='fx'")sqlite.prepare('UPDATE household_members SET active=0 WHERE user_id=?').run(user.userId);return value;};return s;}};await assert.rejects(financialTools(intercepted,state).get_assets(),/成员|权限/);});
test('direct ChatGPT financial cashflow tool returns major-only context without internal minor totals',async t=>{const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const s=await snapshot(db);s.accounts=[{id:'bank',kind:'ASSET',category:'cash',currency:'CNY',balance:5753202,metadata:{}}];s.documents=[{id:'profile',kind:'financial_profile',payload:{monthlyIncomeMinor:2636000}}];const value=await financialTools(db,s).get_cashflow_context();assert.equal(value.amount_unit,'CNY_yuan');assert.equal(value.forecast.startingCashYuan,'57532.02');assert.equal(Object.hasOwn(value,'values'),false);assert.equal(Object.hasOwn(value,'knownRecurringExpenseMinor'),false);});

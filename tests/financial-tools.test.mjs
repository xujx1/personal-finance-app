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
  assert.equal(budgets.budgets[0].budgetMinor,6000);
  assert.equal(budgets.budgets[0].remainingMinor,4000);
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

test('AI financial read uses the same explicit four-bucket goal as the dashboard even before saving settings',async t=>{const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const state=await snapshot(db);const goals=await financialTools(db,state).get_savings_goals();assert.equal(goals.goals[0].schemaVersion,2);assert.equal(Object.values(goals.goals[0].bucketTargets).reduce((n,v)=>n+v,0),400000000);assert.equal(goals.goals[0].monthlyTarget,null);});

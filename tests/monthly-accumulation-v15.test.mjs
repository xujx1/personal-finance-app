import test from 'node:test';import assert from 'node:assert/strict';
import {buildAssetGoalOverview} from '../src/domain/asset-goals.mjs';
const pair=(kind,n,category='cash',currency='CNY')=>[{month:'2026-11',accountKind:'ASSET',category,currency,transactionKind:kind,deltaMinor:n,inflowMinor:Math.max(0,n),outflowMinor:Math.max(0,-n),entryCount:1},{month:'2026-11',accountKind:kind==='OPENING'||kind==='ADJUSTMENT'?'EQUITY':n>0?'INCOME':'EXPENSE',category:'system',currency,transactionKind:kind,deltaMinor:-n,inflowMinor:Math.max(0,-n),outflowMinor:Math.max(0,n),entryCount:1}];
const state=rows=>({accounts:[],documents:[{kind:'savings_goal',payload:{schemaVersion:2,bucketTargets:{stock:100000000,deposits:100000000,broadIndex:100000000,preciousMetals:100000000},monthlyTarget:1500000}}],monthlyLedgerTotals:{complete:true,source:'posted_entries',rows}});
test('current-month non-salary income and expense update target even without prior-month opening',()=>{
 const m=buildAssetGoalOverview(state([...pair('OPENING',3000000),...pair('INCOME',1000000),...pair('INCOME',800000),...pair('EXPENSE',-300000),...pair('ADJUSTMENT',9000000)]),a=>a.balance,'2026-11').monthly;
 assert.equal(m.available,true);assert.equal(m.change,1500000);assert.equal(m.progress,100);assert.equal(m.opening,null);assert.match(m.basis,/人民币|CNY/);
});
test('foreign opening does not block CNY accumulation and no historical FX is invented',()=>{
 const m=buildAssetGoalOverview(state([...pair('OPENING',500000,'stock','USD'),...pair('INCOME',150000)]),a=>a.balance,'2026-11').monthly;
 assert.equal(m.available,true);assert.equal(m.change,150000);assert.equal(m.progress,10);
});
test('foreign business changes are excluded explicitly while RMB target stays usable',()=>{
 const m=buildAssetGoalOverview(state([...pair('INCOME',150000),...pair('INCOME',90000,'cash','USD')]),a=>a.balance,'2026-11').monthly;
 assert.equal(m.change,150000);assert.equal(m.foreignExcluded,true);assert.match(m.reason,/外币/);
});

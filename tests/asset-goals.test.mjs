import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '../src/domain/asset-goals.mjs';
const account=(id,category,name,balance=10000,metadata={})=>({id,kind:'ASSET',category,name,balance,currency:'CNY',metadata});
const ledgerRow=(month,category,deltaMinor,transactionKind='INCOME',accountKind='ASSET',currency='CNY')=>({month,category,deltaMinor,transactionKind,accountKind,currency,inflowMinor:Math.max(0,deltaMinor),outflowMinor:Math.max(0,-deltaMinor),entryCount:1});
const pair=(...args)=>{const row=ledgerRow(...args);return [row,{...row,accountKind:row.transactionKind==='OPENING'?'EQUITY':'INCOME',category:'system',deltaMinor:-row.deltaMinor,inflowMinor:row.outflowMinor,outflowMinor:row.inflowMinor}];};

test('four equal million-yuan default buckets exclude property without requiring a saved document',()=>{
 assert.equal(typeof module.buildAssetGoalOverview,'function','asset goal model is available');
 const model=module.buildAssetGoalOverview({accounts:[],documents:[]},a=>a.balance,'2026-11');
 assert.equal(model.goal.totalTarget,400000000);assert.equal(model.goal.monthlyTarget,null);
 assert.equal(model.goal.isDefault,true);assert.deepEqual(model.buckets.map(x=>x.target),[100000000,100000000,100000000,100000000]);
});
test('each eligible asset is counted once and uncertain funds count toward total only',()=>{
 assert.equal(typeof module.buildAssetGoalOverview,'function');
 const accounts=[account('s','stock','普通股票'),account('n','fund','纳斯达克100指数'),account('g','fund','黄金ETF'),account('b','cash','银行存款'),account('t','fund','储蓄国债'),account('f','fund','未分类基金'),account('p','property','住宅'),account('pre','prepayment','酒店'),{...account('l','loan','贷款'),kind:'LIABILITY'},account('sys','system','系统'),{...account('a','stock','归档'),archived:1},account('z','stock','清仓',999,{quantity:'0'})];
 const model=module.buildAssetGoalOverview({accounts,documents:[]},a=>a.balance,'2026-11');
 assert.equal(model.current,60000);assert.equal(model.unassigned,10000);assert.equal(model.buckets.reduce((n,x)=>n+x.current,0),50000);
 assert.equal(model.buckets.find(x=>x.id==='deposits').current,20000);assert.deepEqual(model.unassignedNames,['未分类基金']);
});
test('unknown currency conversions mark total and affected bucket incomplete rather than zero completion',()=>{
 assert.equal(typeof module.buildAssetGoalOverview,'function');
 const model=module.buildAssetGoalOverview({accounts:[account('x','stock','外币股票'),account('b','cash','银行存款')],documents:[]},a=>a.id==='x'?null:a.balance,'2026-11');
 assert.equal(model.complete,false);assert.equal(model.progress,null);assert.equal(model.gap,null);assert.equal(model.current,10000);assert.equal(model.buckets.find(x=>x.id==='stock').progress,null);
});
test('v2 goal inputs are exact minor amounts with optional month and date and strict bucket identity',()=>{
 assert.equal(typeof module.normalizeAssetGoalInput,'function');
 const body={schemaVersion:2,bucketTargets:{stock:'1000000',deposits:'1000000',broadIndex:'1000000',preciousMetals:'1000000'},monthlyTarget:null,deadline:null};
 const parsed=module.normalizeAssetGoalInput(body);assert.equal(parsed.bucketTargets.stock,100000000);assert.equal(parsed.monthlyTarget,null);assert.equal(parsed.deadline,null);
 assert.equal(module.normalizeAssetGoalInput({...body,monthlyTarget:'2500.50',deadline:'2028-02-29'}).monthlyTarget,250050);
 for(const patch of [{bucketTargets:{...body.bucketTargets,stock:'0'}},{bucketTargets:{...body.bucketTargets,extra:'1'}},{monthlyTarget:'-1'},{deadline:'2027-02-29'}])assert.throws(()=>module.normalizeAssetGoalInput({...body,...patch}));
});
test('legacy goals remain visible and only latest valid v2 goal config becomes active',()=>{
 assert.equal(typeof module.buildAssetGoalOverview,'function');
 const payload={schemaVersion:2,bucketTargets:{stock:10,deposits:20,broadIndex:30,preciousMetals:40},monthlyTarget:50,deadline:null};
 const documents=[{id:'old',kind:'savings_goal',payload:{name:'旧逐项目标',items:[{accountId:'s',target:100}]}},{id:'new',kind:'savings_goal',payload:{...payload,updatedAt:'2026-11-02'}},{id:'invalid',kind:'savings_goal',payload:{...payload,bucketTargets:{},updatedAt:'2026-11-03'}}];
 const model=module.buildAssetGoalOverview({accounts:[],documents},a=>a.balance,'2026-11');assert.equal(model.goal.id,'new');assert.equal(model.goal.totalTarget,100);assert.equal(model.legacyGoals.length,1);
});
test('monthly accumulation excludes openings and balance corrections with or without prior history',()=>{
 assert.equal(typeof module.buildAssetGoalOverview,'function');
 const rows=[...pair('2026-10','cash',100000,'OPENING'),...pair('2026-11','cash',20000),...pair('2026-11','cash',500000,'OPENING'),...pair('2026-11','cash',300000,'ADJUSTMENT'),...pair('2026-11','property',90000)];
 const state={accounts:[],documents:[],monthlyLedgerTotals:{complete:true,source:'posted_entries',rows}};
 const model=module.buildAssetGoalOverview(state,a=>a.balance,'2026-11');assert.equal(model.monthly.available,true);assert.equal(model.monthly.change,20000);assert.equal(model.monthly.progress,null);assert.match(model.monthly.reason,/月目标/);
 const noPrior=module.buildAssetGoalOverview({...state,monthlyLedgerTotals:{...state.monthlyLedgerTotals,rows:rows.filter(x=>x.month==='2026-11')}},a=>a.balance,'2026-11');assert.equal(noPrior.monthly.available,true);assert.equal(noPrior.monthly.change,20000);assert.equal(noPrior.monthly.opening,null);assert.match(noPrior.monthly.reason,/期初/);
});
test('monthly target compares supported journal accumulation and leaves missing history or foreign FX unresolved',()=>{
 assert.equal(typeof module.buildAssetGoalOverview,'function');
 const payload={schemaVersion:2,bucketTargets:{stock:100,deposits:100,broadIndex:100,preciousMetals:100},monthlyTarget:10000,deadline:null};
 const rows=[...pair('2026-10','cash',100000,'OPENING'),...pair('2026-11','cash',2500)];
 const state={accounts:[],documents:[{id:'v2',kind:'savings_goal',payload}],monthlyLedgerTotals:{complete:true,source:'posted_entries',rows}};
 assert.equal(module.buildAssetGoalOverview(state,a=>a.balance,'2026-11').monthly.progress,25);
 assert.equal(module.buildAssetGoalOverview({...state,monthlyLedgerTotals:{...state.monthlyLedgerTotals,rows:[...rows,...pair('2026-10','stock',100,'OPENING','ASSET','USD')]}},a=>a.balance,'2026-11').monthly.available,true);
 assert.equal(module.buildAssetGoalOverview({...state,monthlyLedgerTotals:undefined},a=>a.balance,'2026-11').monthly.progress,null);
});
test('sector funds remain unassigned and gold mining shares remain stocks while term deposits join banks',()=>{
 const accounts=[account('sector','fund','纳斯达克生物科技指数'),account('miner','stock','山东黄金'),account('gold-sector','fund','黄金矿业股票基金'),account('term','term_deposit','银行三年定期')];
 const model=module.buildAssetGoalOverview({accounts,documents:[]},a=>a.balance,'2026-11');
 assert.equal(model.buckets.find(x=>x.id==='stock').current,10000);assert.equal(model.buckets.find(x=>x.id==='deposits').current,10000);assert.equal(model.buckets.find(x=>x.id==='preciousMetals').current,0);assert.equal(model.unassigned,20000);
});

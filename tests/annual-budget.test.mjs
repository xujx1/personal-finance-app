import test from 'node:test';
import assert from 'node:assert/strict';
import {annualBudgetOverview} from '../src/domain/annual-budget.mjs';
const plan=(id,payload)=>({id,kind:'plan',payload:{name:id,category:'旅行',status:'PLANNED',budgetStatus:'APPROVED',date:'2026-12-01',end:'2026-12-01',budget:10000,reserved:0,...payload}});
const fixture=()=>({documents:[
 plan('active',{date:'2026-12-30',end:'2027-01-02',reserved:2000}),
 plan('candidate',{category:'购物',budgetStatus:'DRAFT',budget:5000,reserved:5000}),
 plan('cancelled',{status:'CANCELLED',date:'2026-05-01',end:'2026-05-01',budget:20000,reserved:10000}),
 plan('completed',{status:'COMPLETED',date:'2026-02-01',end:'2026-02-01',budget:8000,reserved:4000}),
 plan('unknown',{budget:null}),
 ],planSummaries:[{planId:'active',paid:3000,consumed:1000},{planId:'cancelled',paid:3000,consumed:3000},{planId:'completed',paid:8000,consumed:8000}],planCashflowTotals:{complete:true,source:'posted_plan_transactions',rows:[
 {planId:'active',month:'2026-11',paidMinor:3000,consumedMinor:0},
 {planId:'active',month:'2026-12',paidMinor:0,consumedMinor:1000},
 {planId:'active',month:'2027-01',paidMinor:0,consumedMinor:2000},
 {planId:'cancelled',month:'2026-05',paidMinor:4000,consumedMinor:4000},
 {planId:'cancelled',month:'2026-11',paidMinor:-1000,consumedMinor:-1000},
 {planId:'completed',month:'2026-02',paidMinor:8000,consumedMinor:8000},
 ]}});

test('annual budgets count each start-month budget once and keep lifetime remaining separate from actual timing',()=>{
 const state=fixture(),before=JSON.stringify(state),result=annualBudgetOverview(state,2026,'2026-11-11');
 assert.equal(result.summary.approvedBudgetMinor,18000);assert.equal(result.summary.candidateBudgetMinor,5000);assert.equal(result.summary.unknownBudgetCount,1);
 assert.equal(result.summary.paidMinor,14000);assert.equal(result.summary.consumedMinor,12000);
 assert.equal(result.summary.remainingNeededMinor,7000);assert.equal(result.summary.reservedMinor,2000);assert.equal(result.summary.suggestedReserveMinor,5000);
 assert.equal(result.months.find(row=>row.month==='2026-12').approvedBudgetMinor,10000);
 assert.equal(result.months.find(row=>row.month==='2026-11').paidMinor,2000);
 assert.equal(result.months.find(row=>row.month==='2026-11').consumedMinor,-1000);
 assert.equal(result.plans.find(row=>row.id==='unknown').budgetMinor,null);
 assert.equal(JSON.stringify(state),before);
 const next=annualBudgetOverview(state,2027,'2026-11-11');assert.equal(next.summary.approvedBudgetMinor,0);assert.equal(next.summary.consumedMinor,2000);assert.equal(next.plans.find(row=>row.id==='active').remainingNeededMinor,7000);
});

test('cancelled and completed plans release reservations while historical actuals and refund months remain visible',()=>{
 const result=annualBudgetOverview(fixture(),2026,'2026-11-11');
 assert.deepEqual(result.upcoming.map(row=>row.id).sort(),['active','candidate','unknown']);
 for(const id of ['cancelled','completed']){const row=result.plans.find(row=>row.id===id);assert.equal(row.reservedMinor,0);assert.equal(row.remainingNeededMinor,0);assert.equal(row.suggestedReserveMinor,0);}
 assert.equal(result.plans.find(row=>row.id==='cancelled').yearPaidMinor,3000);
 assert.equal(result.plans.find(row=>row.id==='completed').yearConsumedMinor,8000);
 assert.equal(result.categories.find(row=>row.category==='购物').candidateBudgetMinor,5000);
 assert.equal(result.categories.find(row=>row.category==='旅行').paidMinor,14000);
});

test('candidate alternatives are never added to formal budgets or counted as available reservations',()=>{
 const state=fixture();state.documents[0].payload.options=[{amount:500000},{amount:900000}];
 state.documents[0].payload.reserved=9000;
 const result=annualBudgetOverview(state,2026,'2026-11-11');
 assert.equal(result.summary.approvedBudgetMinor,18000);assert.equal(result.summary.reservedMinor,7000);assert.equal(result.summary.suggestedReserveMinor,0);
 assert.equal(result.plans.find(row=>row.id==='candidate').reservedMinor,0);
 assert.equal(result.plans.find(row=>row.id==='candidate').candidateRemainingMinor,5000);
});

test('missing complete monthly aggregates never borrow dates or amounts from the recent transaction feed',()=>{
 const state=fixture();delete state.planCashflowTotals;state.transactions=[{kind:'PAYMENT',business_date:'2026-11-11',total_minor:999999}];
 const result=annualBudgetOverview(state,2026,'2026-11-11');
 assert.equal(result.monthlyActualAvailable,false);assert.equal(result.summary.paidMinor,null);assert.equal(result.summary.consumedMinor,null);
 assert.ok(result.months.every(row=>row.paidMinor===null&&row.consumedMinor===null));
 assert.equal(result.plans.find(row=>row.id==='active').lifetimePaidMinor,3000);assert.equal(result.summary.remainingNeededMinor,7000);
 delete state.planSummaries;
 const unknown=annualBudgetOverview(state,2026,'2026-11-11');assert.equal(unknown.plans.find(row=>row.id==='active').remainingNeededMinor,null);assert.ok(unknown.summary.unknownRemainingCount>0);
});

test('orphan actuals remain accounted for and malformed financial aggregates cannot masquerade as zero',()=>{
 const state={documents:[],planSummaries:[],planCashflowTotals:{complete:true,source:'posted_plan_transactions',rows:[{planId:'missing-plan',month:'2026-04',paidMinor:-200,consumedMinor:-200}]}};
 const result=annualBudgetOverview(state,2026,'2026-11-11');assert.equal(result.summary.paidMinor,-200);assert.equal(result.categories.find(row=>row.category==='计划资料缺失').consumedMinor,-200);
 state.planCashflowTotals.rows[0].paidMinor=0.1;
 const invalid=annualBudgetOverview(state,2026,'2026-11-11');assert.equal(invalid.monthlyActualAvailable,false);assert.equal(invalid.summary.paidMinor,null);
 assert.throws(()=>annualBudgetOverview(fixture(),2026.5,'2026-11-11'));
});

test('a known plan with an unclassified category keeps its actuals under other rather than a missing-plan label',()=>{
 const state=fixture();delete state.documents[0].payload.category;
 const result=annualBudgetOverview(state,2026,'2026-11-11');
 assert.equal(result.categories.find(row=>row.category==='其他').paidMinor,3000);
 assert.equal(result.categories.some(row=>row.category==='计划资料缺失'),false);
});

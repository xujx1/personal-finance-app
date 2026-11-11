import test from 'node:test';
import assert from 'node:assert/strict';
import * as funding from '../src/domain/budget-funding.mjs';
import {annualForecast} from '../src/domain/planning.mjs';
const bank=(id,balance,extra={})=>({id,kind:'ASSET',category:'cash',currency:'CNY',balance,...extra});
const plan=(id,date,budget,extra={})=>({id,kind:'plan',payload:{name:id,date,budget,status:'PLANNED',budgetStatus:'APPROVED',...extra}});
test('mortgage funding goal uses available banks and due order, never property or stock values',()=>{
 const state={accounts:[bank('a',5000000),bank('b',2000000),bank('usd',90000000,{currency:'USD'}),bank('arch',80000000,{archived:1}),bank('stock',90000000,{category:'stock'}),bank('home',90000000,{category:'property'})],documents:[plan('mortgage','2027-01-09',18000000),plan('trip','2026-12-12',1000000)],planSummaries:[]};
 const result=funding.buildBudgetFundingGoals(state);
 assert.equal(result.cash,7000000);assert.equal(result.totalRemaining,19000000);assert.equal(result.gap,12000000);
 assert.deepEqual(result.plans.map(x=>[x.id,x.funded,x.gap]),[['trip',1000000,0],['mortgage',6000000,12000000]]);
});
test('prepaid and paid amounts reduce cash still needed once; reservations never do',()=>{
 const state={accounts:[bank('a',40000)],documents:[plan('p','2027-01-09',100000,{reserved:30000}),plan('cancel','2026-11-12',999999,{status:'CANCELLED'}),plan('done','2026-11-12',999999,{status:'COMPLETED'}),plan('unknown','2027-01-10',null)],planSummaries:[{planId:'p',paid:50000,consumed:20000}]};
 const result=funding.buildBudgetFundingGoals(state);assert.equal(result.totalRemaining,50000);assert.equal(result.gap,10000);assert.equal(result.unknown,1);assert.equal(result.plans[0].remaining,50000);
 const forecast=annualForecast(state,'2026-11-12',3);assert.equal(forecast[2].planned,50000);assert.equal(forecast[2].closing,-10000);assert.equal(forecast[2].unknown,1);
});
test('pending approval budgets remain visible as forecast risk without becoming approved',()=>{
 const state={accounts:[bank('a',10000)],documents:[plan('p','2026-11-20',20000,{budgetStatus:'PENDING_APPROVAL'})],planSummaries:[]};
 const goal=funding.buildBudgetFundingGoals(state);assert.equal(goal.plans[0].pending,true);assert.equal(goal.gap,10000);
 const row=annualForecast(state,'2026-11-12',3)[0];assert.equal(row.pending,20000);assert.equal(row.closing,-10000);
});

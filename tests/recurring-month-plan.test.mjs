import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringMonthPlan} from '../src/domain/recurring.mjs';
test('current month plan excludes dates outside effective range and clamps monthly day to the actual month end',()=>{
 const r=(id,changes={})=>({id,payload:{type:'income',amount:10000,day:31,start:'2026-01-01',end:null,paused:false,...changes}}),rules=[r('active'),r('ended',{end:'2026-01-31'}),r('future',{start:'2026-03-01'}),r('paused',{paused:true}),r('starts-after-due',{day:10,start:'2026-02-11'}),r('ends-before-due',{end:'2026-02-27'}),r('month-end-expense',{type:'expense',amount:2500,end:'2026-02-28'})];
 const p=recurringMonthPlan(rules,'2026-02');assert.deepEqual(p.active.map(x=>x.id),['active','month-end-expense']);assert.equal(p.income,10000);assert.equal(p.outflow,2500);
 assert.equal(recurringMonthPlan([r('leap',{start:'2028-02-29',end:'2028-02-29'})],'2028-02').income,10000);
});

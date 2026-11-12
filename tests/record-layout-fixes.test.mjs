import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringActivePlan} from '../src/domain/recurring.mjs';
import {activeMemberFilterOptions} from '../src/domain/member-ownership.mjs';
test('ordinary monthly plan includes all four currently effective rules even when this month due day passed before setup',()=>{
 const r=(type,amount,day,patch={})=>({payload:{type,amount,day,start:'2026-11-12',end:null,paused:false,...patch}}),rules=[r('income',2300000,10),r('income',336000,15),r('loan',750000,1),r('loan',202800,20),r('income',100000,10,{start:'2026-12-01'}),r('expense',10000,3,{end:'2026-11-11',start:'2026-01-01'}),r('income',10000,15,{paused:true})],p=recurringActivePlan(rules,'2026-11-12');assert.equal(p.income,2636000);assert.equal(p.outflow,952800);assert.equal(p.active.length,4);assert.equal(p.income-p.outflow,1683200);
});
test('member filter separates aggregate from shared and hides inactive/unknown choices without deleting ownership history',()=>{
 const state={financeMembers:[{id:'family',name:'家庭共用',active:true,selectable:true},{id:'user:a',name:'A',active:true,selectable:true},{id:'user:b',name:'B',active:false,selectable:false},{id:'unknown',name:'归属待确认',active:false,selectable:false}],accounts:[{id:'old',metadata:{ownerMemberId:'user:b',ownerLabel:'B'}}]},before=JSON.stringify(state),choices=activeMemberFilterOptions(state);assert.deepEqual(choices.map(v=>v.id),['family','user:a']);assert.equal(JSON.stringify(state),before);assert.notEqual(choices[0].id,'all');
});

import {dateInRange} from '../src/domain/consumption.mjs';
test('undated and end-only historical records remain visible without date limits and cannot pretend to meet a bounded range',()=>{assert.equal(dateInRange(null,'2026-11-20','',''),true);assert.equal(dateInRange(null,'2026-11-20','2026-11-01',''),false);assert.equal(dateInRange(null,'bad-date','',''),false)});

import {recurringConfiguredPlan} from '../src/domain/recurring.mjs';
test('configured monthly totals include future first occurrence dates without pretending those receipts have already posted',()=>{
 const rule=(type,amount,start,patch={})=>({payload:{type,amount,start,day:1,end:null,paused:false,...patch}}),rules=[rule('income',2300000,'2026-12-10'),rule('income',336000,'2026-11-15'),rule('loan',750000,'2026-12-01'),rule('loan',202800,'2026-11-20'),rule('income',10000,'2026-12-20',{paused:true}),rule('expense',10000,'2026-01-01',{end:'2026-11-11'})],before=JSON.stringify(rules),p=recurringConfiguredPlan(rules,'2026-11-12');assert.equal(p.income,2636000);assert.equal(p.outflow,952800);assert.equal(p.enabled.length,4);assert.equal(recurringActivePlan(rules,'2026-11-12').active.length,0);assert.equal(JSON.stringify(rules),before);
});

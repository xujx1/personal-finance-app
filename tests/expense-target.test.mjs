import test from 'node:test';
import assert from 'node:assert/strict';
import {expenseTargetPlans,selectExpenseTarget} from '../src/domain/expense-target.mjs';
const state={book:{active_dataset:'family-a'},viewer:{canWrite:true},financeMembers:[{id:'common',name:'家庭共用',kind:'shared',active:true}],documents:[
 {id:'trip',dataset_id:'family-a',kind:'plan',payload:{name:'已有旅行',status:'PLANNED',ownerMemberId:'common'}},
 {id:'foreign',dataset_id:'family-b',kind:'plan',payload:{name:'另一家庭',status:'PLANNED'}},
 {id:'done',kind:'plan',payload:{status:'COMPLETED'}},
 {id:'cancelled',kind:'plan',payload:{status:'CANCELLED'}},
 {id:'research',kind:'research_proposal',payload:{status:'PLANNED'}}]};
test('only active scoped budgets can be explicitly selected as an update target',()=>{
 assert.deepEqual(expenseTargetPlans(state).map(row=>row.id),['trip']);
 assert.deepEqual(expenseTargetPlans({...state,book:{dataset:'family-a'}}).map(row=>row.id),['trip']);
 for(const id of ['foreign','done','cancelled','research','unknown'])assert.throws(()=>selectExpenseTarget({intent:'expense'},state,id),/原预算已变化/);
});
test('selecting an existing budget retains the edited research question, dates and cost amount, and its original owner',()=>{
 const form={intent:'expense',question:'新的已调整攻略',date:'2026-11-14',tripEnd:'2026-11-15',budget:'2500.00'};
 const selected=selectExpenseTarget(form,state,'trip');
 assert.deepEqual(selected.form,{...form,planId:'trip'});
 assert.equal(selected.ownerMemberId,'common');assert.equal(selected.planName,'已有旅行');
 assert.equal(form.planId,undefined);assert.equal(state.documents.length,5);
});
test('a read-only visitor and the asset-entry flow cannot link a budget target',()=>{
 assert.throws(()=>selectExpenseTarget({intent:'expense'},{...state,viewer:{canWrite:false}},'trip'),/不能修改/);
 assert.throws(()=>selectExpenseTarget({intent:'asset'},state,'trip'),/不能修改/);
});
test('explicitly switching back to a new plan clears the old target without losing adjusted costs',()=>{
 const selected=selectExpenseTarget({intent:'expense',planId:'trip',budget:'2500.00',question:'保留当前方案'},state,'');
 assert.equal(selected.form.planId,undefined);assert.equal(selected.form.budget,'2500.00');assert.equal(selected.form.question,'保留当前方案');assert.equal(selected.planName,'');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSelectedResearchCostsPreserved} from '../src/server/research-repair.mjs';

const fee=(name,price,scope='activity')=>({name,category:'交通',merchant:'示例商家',version:'估算',quantity:'1',unitPrice:price,selected:true,scope});
const proposal=()=>({expenseDraft:{items:[],wholePlanExpenses:[fee('往返燃油','250','whole_plan')],itinerary:[{date:'2026-11-14',time:'12:00',title:'午餐',expenses:[fee('午餐','200')]},{date:'2026-11-15',time:'12:00',title:'午餐',expenses:[fee('午餐','200')]}]}});
const clone=value=>structuredClone(value);
test('a totals repair may add a missing train fare without changing any selected cost or repeated meal',()=>{
 const before=proposal(),after=clone(before);
 after.expenseDraft.itinerary.push({date:'2026-11-14',time:'19:00',title:'妈妈乘高铁',expenses:[fee('妈妈高铁','150')]});
 assert.equal(assertSelectedResearchCostsPreserved(before,after),true);
 assert.deepEqual(before,proposal());
});
test('numeric formatting and reordering do not look like cost changes',()=>{
 const before=proposal(),after=clone(before);
 after.expenseDraft.wholePlanExpenses[0].quantity='1.0000';
 after.expenseDraft.wholePlanExpenses[0].unitPrice='250.00';
 after.expenseDraft.itinerary.reverse();
 assert.equal(assertSelectedResearchCostsPreserved(before,after),true);
});
test('a repair cannot remove, unselect, rename, change the unit price, quantity, scope or merchant of an existing chosen cost',()=>{
 for(const patch of [{selected:false},{name:'改名绕过'},{unitPrice:'100'},{quantity:'2'},{scope:'whole_plan'},{merchant:'另一商家'},{version:'另一规格'},{category:'别的类别'}]){
  const before=proposal(),after=clone(before);Object.assign(after.expenseDraft.itinerary[0].expenses[0],patch);
  assert.throws(()=>assertSelectedResearchCostsPreserved(before,after),error=>error.validationField==='cost_preservation'&&!error.message.includes('250'));
 }
 const before=proposal(),after=clone(before);after.expenseDraft.wholePlanExpenses=[];
 assert.throws(()=>assertSelectedResearchCostsPreserved(before,after),/原已选/);
});
test('moving a selected fee to another day or duplicating it in the same activity is rejected',()=>{
 for(const action of ['move','duplicate','time']){
  const before=proposal(),after=clone(before),cost=after.expenseDraft.itinerary[0].expenses[0];
  if(action==='move'){after.expenseDraft.itinerary[0].expenses=[];after.expenseDraft.itinerary[1].expenses.push(cost)}
  if(action==='duplicate')after.expenseDraft.itinerary[0].expenses.push(clone(cost));
  if(action==='time')after.expenseDraft.itinerary[0].time='18:00';
  assert.throws(()=>assertSelectedResearchCostsPreserved(before,after),/原已选/);
 }
});
test('flat shopping costs receive the same preservation guard and cannot be duplicated to reconcile a total',()=>{
 const before={expenseDraft:{items:[fee('2K显示器','899','whole_plan')],itinerary:[]}},after=clone(before);
 assert.equal(assertSelectedResearchCostsPreserved(before,after),true);
 after.expenseDraft.items.push(clone(after.expenseDraft.items[0]));
 assert.throws(()=>assertSelectedResearchCostsPreserved(before,after),error=>error.validationField==='cost_preservation');
});
test('a known chosen expense cannot be cloned under a new parent or under another scope',()=>{
 for(const scope of ['activity','whole_plan']){
  const before=proposal(),after=clone(before),copied=clone(after.expenseDraft.itinerary[0].expenses[0]);
  copied.scope=scope;
  if(scope==='activity')after.expenseDraft.itinerary.push({date:'2026-11-15',time:'20:00',title:'额外活动',expenses:[copied]});
  else after.expenseDraft.wholePlanExpenses.push(copied);
  assert.throws(()=>assertSelectedResearchCostsPreserved(before,after),error=>error.validationField==='cost_preservation');
 }
});

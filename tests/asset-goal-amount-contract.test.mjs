import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAssetGoalInput,getAssetGoal} from '../src/domain/asset-goals.mjs';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {openTestDatabase} from './helpers/d1.mjs';

const input=version=>({schemaVersion:version,name:'保留目标',monthlyTarget:'1500.01',deadline:null,...(version===2?{bucketTargets:{stock:'12345.67',deposits:'1',broadIndex:'1',preciousMetals:'1'}}:{targets:[version===3?{scope:'type:cash',target:'12345.67'}:{id:'cash_goal',name:'现金目标',assetTypeIds:['cash'],target:'12345.67'}]})});
const withTarget=(body,value)=>body.schemaVersion===2?{...body,bucketTargets:{...body.bucketTargets,stock:value}}:{...body,targets:body.targets.map(row=>({...row,target:value}))};
const invalidAmounts=[12345,1500,1500.01,true,false,{},[],['12345'],null,'','0','-1','1e3',' 1','1 ','1.001','90000000000.01'];

async function fixture(t){
 const x=openTestDatabase();t.after(()=>x.sqlite.close());
 const command=async(action,body)=>executeCommand(x.db,{action,body,key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision},'owner');
 const bank=await command('account.save',{name:'验证银行',category:'cash',currency:'CNY',amount:'100.00',asOf:'2026-11-01'});
 const handlers=createFinanceHandlers({getUser:async()=>({userId:'owner'}),getOwner:()=> 'owner',getDb:()=>x.db});
 const save=async body=>handlers.POST(new Request('http://localhost/api/finance',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({action:'savings.goal.save',body,key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision})}));
 const stored=()=>Object.fromEntries(['books','accounts','transactions','entries','documents','commands','audit_events'].map(table=>[table,x.sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 return {...x,bank,save,stored};
}

for(const version of [2,3,4]){
 test(`v${version} goal API rejects non-string/invalid targets and monthly amounts without any write`,async t=>{
  const f=await fixture(t),initial=await f.save(input(version));assert.equal(initial.status,200);
  const id=(await initial.json()).id,before=f.stored();
  for(const value of invalidAmounts){
   for(const body of [withTarget({...input(version),id},value),...(value===null||value===''?[]:[{...input(version),id,monthlyTarget:value}])]){
    const response=await f.save(body);
    assert.equal(response.status,422,`must reject ${JSON.stringify(body)}`);
    assert.deepEqual(f.stored(),before,'invalid goal must not change revision, target, accounts, journal, receipt or audit');
   }
  }
 });

 test(`v${version} goal accepts exact yuan strings and rereads persisted minor numbers`,async t=>{
  const f=await fixture(t),before=await snapshot(f.db),response=await f.save(input(version));assert.equal(response.status,200);
  const result=await response.json(),after=await snapshot(f.db),goal=getAssetGoal(after);
  assert.equal(goal.id,result.id);assert.equal(goal.schemaVersion,version);
  assert.equal(version===2?goal.bucketTargets.stock:goal.targets[0].target,1234567);
  assert.equal(goal.monthlyTarget,150001);assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.transactions,before.transactions);
  for(const value of [null,''])assert.equal(normalizeAssetGoalInput({...input(version),monthlyTarget:value}).monthlyTarget,null);
  const atLimit=withTarget(input(version),version===2?'89999999997.00':'90000000000.00');
  assert.equal(getAssetGoal({documents:[{id:'limit',kind:'savings_goal',payload:normalizeAssetGoalInput({...atLimit,monthlyTarget:'0.01'})}]}).totalTarget,9000000000000);
  assert.throws(()=>normalizeAssetGoalInput(withTarget(input(version),'90000000000.01')));
  if(version===2)assert.throws(()=>normalizeAssetGoalInput(withTarget(input(version),'90000000000.00')),/上限/);
 });
}

test('legacy goal save rejects numeric and coercible item amounts without changing a saved goal',async t=>{
 const f=await fixture(t),body={name:'历史项目目标',items:[{accountId:f.bank.id,amount:'12.34',date:'2027-01-01'}]},response=await f.save(body);assert.equal(response.status,200);
 const id=(await response.json()).id,before=f.stored();
 for(const value of invalidAmounts){
  const rejected=await f.save({...body,id,items:[{...body.items[0],amount:value}]});assert.equal(rejected.status,422,`must reject ${JSON.stringify(value)}`);assert.deepEqual(f.stored(),before);
 }
 const stored=(await snapshot(f.db)).documents.find(doc=>doc.id===id);assert.equal(stored.payload.items[0].target,1234);
});

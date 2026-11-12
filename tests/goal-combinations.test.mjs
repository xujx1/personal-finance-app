import test from 'node:test';
import assert from 'node:assert/strict';
import {getAssetTypes,normalizeAssetTypes} from '../src/domain/asset-types.mjs';
import {normalizeAssetGoalInput,getAssetGoal,buildAssetGoalOverview} from '../src/domain/asset-goals.mjs';
import {openTestDatabase} from './helpers/d1.mjs';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {normalizeSetupDraft,validateSetupDraft} from '../src/domain/setup-draft.mjs';

const custom={id:'education',name:'教育储备',baseCategory:'cash',goalBucket:null,enabled:true};
const state=()=>({accounts:[],documents:[{id:'asset-types',kind:'asset_type_catalog',payload:{version:1,types:[...getAssetTypes({}),custom]}}]});
const input=()=>({schemaVersion:4,name:'家庭目标',targets:[{id:'safety',name:'安心储备',assetTypeIds:['cash','term_deposit','treasury','education'],target:'1000000.01'},{id:'growth',name:'长期成长',assetTypeIds:['stock','broad_index'],target:'2000000'}],monthlyTarget:'15000',deadline:null});
const account=(id,type,balance)=>({id,name:id,kind:'ASSET',category:type==='stock'?'stock':type==='broad_index'?'fund':type==='education'||type==='cash'?'cash':'other',currency:'CNY',balance,metadata:{assetTypeId:type}});
test('named goal combinations persist exact type sets and count only selected assets once',()=>{
 const s=state(),p=normalizeAssetGoalInput(input(),s);assert.equal(p.schemaVersion,4);assert.equal(p.targets[0].target,100000001);assert.deepEqual(p.targets[0].assetTypeIds,input().targets[0].assetTypeIds);s.documents.push({id:'goal',kind:'savings_goal',payload:p});s.accounts=[account('bank','cash',10000),account('child','education',20000),account('shares','stock',30000),account('unselected','other',40000)];
 const m=buildAssetGoalOverview(s,a=>a.balance,'2026-11');assert.equal(m.current,60000);assert.equal(m.unassigned,40000);assert.equal(m.buckets[0].label,'安心储备');assert.equal(m.buckets[0].current,30000);assert.equal(m.buckets[1].current,30000);assert.deepEqual(m.buckets[0].assetTypeIds,p.targets[0].assetTypeIds);assert.equal(getAssetGoal(s).totalTarget,300000001);
});
test('new accounts, renamed types and new catalogue entries never change chosen combination membership',()=>{
 const s=state(),p=normalizeAssetGoalInput(input(),s);s.documents.push({id:'goal',kind:'savings_goal',payload:p});s.documents[0].payload.types=s.documents[0].payload.types.map(t=>t.id==='education'?{...t,name:'宝宝储备'}:t).concat({...custom,id:'new_type',name:'新增类型'});s.accounts=[account('later','education',10000),account('new','new_type',50000)];
 const m=buildAssetGoalOverview(s,a=>a.balance,'2026-11');assert.equal(m.current,10000);assert.equal(m.unassigned,50000);assert.match(m.buckets[0].hint,/宝宝储备/);assert.equal(m.goal.schemaVersion,4);
});
test('combination validation rejects missing, repeated, disabled, ineligible and foreign type sets before any accounts exist',()=>{
 const s=state();s.documents[0].payload.types.push({...custom,id:'disabled',name:'停用类型',enabled:false});
 for(const assetTypeIds of [[],['foreign'],['property'],['loan'],['prepayment'],['disabled'],['cash','cash']])assert.throws(()=>normalizeAssetGoalInput({...input(),targets:[{name:'测试',assetTypeIds,target:'1'}]},s));
 for(const targets of [[input().targets[0],{...input().targets[1],assetTypeIds:['education']}],[input().targets[0],{...input().targets[1],id:'safety'}],[input().targets[0],{...input().targets[1],name:'安心储备'}],[{name:' ',assetTypeIds:['cash'],target:'1'}],[{name:'x',assetTypeIds:['cash'],target:'0'}]])assert.throws(()=>normalizeAssetGoalInput({...input(),targets},s));
});
test('types referenced by a combination cannot be disabled even without linked accounts',()=>{
 const s=state();s.documents.push({id:'goal',kind:'savings_goal',payload:normalizeAssetGoalInput(input(),s)});assert.throws(()=>normalizeAssetTypes(getAssetTypes(s).map(t=>t.id==='education'?{...t,enabled:false}:t),s),/目标使用/);
});
test('v4 goal command roundtrips without changing any financial journal or account',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'owner');await send('asset.types.save',{baseVersion:0,types:getAssetTypes(state())});const before=await snapshot(x.db),r=await send('savings.goal.save',input()),after=await snapshot(x.db);assert.equal(getAssetGoal(after).id,r.id);assert.equal(getAssetGoal(after).schemaVersion,4);assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.transactions,before.transactions);
});
test('MCP setup accepts named type combinations, rejects mixed shapes and retains legacy scope drafts',()=>{
 const data={name:'自选组合',targets:[{name:'教育与日常',assetTypeIds:['cash','education'],target:'10000.00'}],monthlyTarget:'15000.00',deadline:null},p={section:'goals',data,analysis:'本人明确的类型组合'};assert.deepEqual(normalizeSetupDraft(p).data,data);assert.doesNotThrow(()=>validateSetupDraft(p,state()));
 for(const targets of [[{...data.targets[0],scope:'group:stock'}],[data.targets[0],{scope:'type:stock',target:'1'}],[{...data.targets[0],assetTypeIds:['foreign']}],[{...data.targets[0],assetTypeIds:['cash','cash']}],[{...data.targets[0],assetTypeIds:['cash'],target:100}]])assert.throws(()=>validateSetupDraft({...p,data:{...data,targets}},state()));
 assert.doesNotThrow(()=>normalizeSetupDraft({...p,data:{...data,targets:[{scope:'type:cash',target:'1'}]}}));
});

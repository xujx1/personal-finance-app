import test from 'node:test';
import assert from 'node:assert/strict';
import {getAssetTypes,accountAssetType,normalizeAssetTypes,assetTypeForWrite} from '../src/domain/asset-types.mjs';
import {normalizeAssetGoalInput,buildAssetGoalOverview,getAssetGoal,assetGoalBucket} from '../src/domain/asset-goals.mjs';
import {openTestDatabase} from './helpers/d1.mjs';
import {executeCommand,snapshot,publicSnapshot} from '../src/server/finance-store.ts';
import {createMcpHandler} from '../src/server/mcp-http.ts';
import {financialTools} from '../src/server/financial-tools.ts';
import {familyCommand,familyContext} from '../src/server/family-service.ts';
import {scopeDb} from '../src/server/ledger-scope.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';

const custom={id:'custom_savings',name:'教育储备',baseCategory:'cash',goalBucket:'deposits',enabled:true};
const types=()=>[...getAssetTypes({}),custom];
const stateFor=(catalog=types())=>({accounts:[],documents:[{id:'asset-types',kind:'asset_type_catalog',payload:{version:1,types:catalog}}]});
const bank=(id,assetTypeId,balance=10000)=>({id,name:id,category:'cash',currency:'CNY',kind:'ASSET',balance,metadata:assetTypeId?{assetTypeId}:{}});
test('legacy type identity is stable when another default type changes goal grouping',()=>{
 const account={id:'old-index',name:'纳斯达克100指数基金',category:'fund',kind:'ASSET',balance:10000,metadata:{}},state=stateFor();state.accounts=[account];const id=accountAssetType(account,state).id;
 const changed=normalizeAssetTypes(types().map(t=>t.id==='fund'?{...t,goalBucket:'broadIndex'}:t),state);assert.equal(accountAssetType(account,stateFor(changed)).id,id);assert.equal(id,'broad_index');
});
test('optional asset type infers correct fund subtype when caller has no ledger kind yet',()=>{
 for(const [name,id]of [['纳斯达克100指数基金','broad_index'],['黄金ETF基金','metals_fund']])assert.equal(assetTypeForWrite({},undefined,{category:'fund',name,metadata:{}}),id);
});
test('untyped legacy ETFs and explicit old goal categories retain their original combinations',()=>{
 for(const [category,name,metadata,group]of [['stock','黄金ETF',{},'preciousMetals'],['stock','国债ETF',{},'deposits'],['fund','主动股票基金',{goalBucket:'stock'},'stock'],['other','其他投资',{goalBucket:'broadIndex'},'broadIndex']]){const account={category,name,metadata,kind:'ASSET',balance:100000};assert.equal(assetGoalBucket(account,{documents:[]}),group);const model=buildAssetGoalOverview({accounts:[account],documents:[]},a=>a.balance,'2026-11');assert.equal(model.buckets.find(b=>b.id===group).current,100000);}
});
test('overlap validation includes possible future untyped legacy assets, not only current account rows',()=>{
 for(const [type,group]of [['stock','preciousMetals'],['stock','deposits'],['fund','stock'],['other','broadIndex']])assert.throws(()=>normalizeAssetGoalInput({schemaVersion:3,targets:[{scope:'type:'+type,target:'1000'},{scope:'group:'+group,target:'1000'}]},{documents:[],accounts:[]}),/重复/);
});
test('renaming a default combination keeps both its original legacy group and configured group in overlap checks',()=>{
 const state=stateFor(types().map(t=>t.id==='broad_index'?{...t,goalBucket:'preciousMetals'}:t));for(const group of ['broadIndex','preciousMetals'])assert.throws(()=>normalizeAssetGoalInput({schemaVersion:3,targets:[{scope:'type:broad_index',target:'1000'},{scope:'group:'+group,target:'1000'}]},state),/重复/);
});
test('accepted type/group targets remain valid after later legacy or explicitly typed assets arrive',()=>{
 const future=[['stock','黄金ETF',{}],['stock','国债ETF',{}],['stock','普通股票',{}],['stock','纳斯达克100 ETF',{}],['fund','纳斯达克100基金',{}],['fund','黄金ETF基金',{}],['fund','主动股票基金',{goalBucket:'stock'}],['fund','普通基金',{}],['other','其他投资',{goalBucket:'broadIndex'}],['other','其他投资',{goalBucket:'stock'}]].map(([category,name,metadata])=>({category,name,metadata,kind:'ASSET',balance:10000,currency:'CNY'}));
 for(const type of getAssetTypes({}).filter(t=>!['property','loan','prepayment'].includes(t.baseCategory)))for(const modifiedGroup of [null,'stock','deposits','broadIndex','preciousMetals']){
  const state=stateFor(getAssetTypes({}).map(t=>t.id===type.id?{...t,goalBucket:modifiedGroup}:t));for(const group of ['stock','deposits','broadIndex','preciousMetals']){let goal;try{goal=normalizeAssetGoalInput({schemaVersion:3,targets:[{scope:'type:'+type.id,target:'1000'},{scope:'group:'+group,target:'1000'}]},state)}catch{continue}const later={...state,accounts:[...future,{category:type.baseCategory,name:'未来显式类型资产',metadata:{assetTypeId:type.id},kind:'ASSET',balance:10000}],documents:[...state.documents,{id:'goal',kind:'savings_goal',payload:goal}]};assert.equal(getAssetGoal(later).schemaVersion,3,type.id+' configured='+modifiedGroup+' with group='+group);}
 }
});
test('legacy optional-type drafts and same-type edits preserve their original combination',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'owner');const p={name:'黄金ETF',category:'stock',currency:'CNY',amount:'1000',ownerMemberId:'user:owner',asOf:'2026-11-12',owned:true},d=await send('mcp.draft.submit',{kind:'asset',payload:p});const saved=await send('mcp.draft.accept',{draftId:d.id,confirmed:true,actualConfirmed:true,reviewedPayload:p});let state=await snapshot(x.db),a=state.accounts.find(a=>a.id===saved.id);assert.equal(assetGoalBucket(a,state),'preciousMetals');await send('account.save',{id:a.id,name:a.name,category:'stock',currency:'CNY',amount:'1000',assetTypeId:accountAssetType(a,state).id});state=await snapshot(x.db);a=state.accounts.find(a=>a.id===saved.id);assert.equal(assetGoalBucket(a,state),'preciousMetals');
});
test('default catalogue initializes without writes and custom type labels resolve independently of ledger category',()=>{
 const state=stateFor();assert.ok(getAssetTypes({}).some(t=>t.id==='term_deposit'));assert.equal(accountAssetType(bank('a',custom.id),state).name,'教育储备');assert.equal(accountAssetType(bank('a'),state).baseCategory,'cash');assert.equal(accountAssetType({category:'fund',kind:'ASSET',name:'纳斯达克100指数',metadata:{}},state).id,'broad_index');
});
test('dictionary rejects duplicate names, changing ledger nature, removal and disabling in-use type',()=>{
 const state=stateFor();state.accounts=[bank('a',custom.id)];
 for(const catalog of [types().map(t=>t.id===custom.id?{...t,baseCategory:'stock'}:t),types().map(t=>t.id===custom.id?{...t,enabled:false}:t),types().filter(t=>t.id!==custom.id),[...types(),{...custom,id:'another'}]])assert.throws(()=>normalizeAssetTypes(catalog,state));
 const renamed=normalizeAssetTypes(types().map(t=>t.id===custom.id?{...t,name:'宝宝教育金'}:t),state);assert.equal(renamed.find(t=>t.id===custom.id).name,'宝宝教育金');
});
test('v3 selectable targets reject duplicate/overlap/foreign types and preserve v2 defaults',()=>{
 const state=stateFor(),body={schemaVersion:3,name:'资产目标',targets:[{scope:'type:'+custom.id,target:'1000000.01'},{scope:'group:stock',target:'2000000'}],monthlyTarget:'15000'};
 const p=normalizeAssetGoalInput(body,state);assert.equal(p.targets[0].target,100000001);assert.equal(p.monthlyTarget,1500000);
 for(const targets of [[...body.targets,body.targets[0]],[{scope:'type:'+custom.id,target:'1'},{scope:'group:deposits',target:'1'}],[{scope:'type:foreign',target:'1'}],[{scope:'type:property',target:'1'}],[{scope:'type:loan',target:'1'}]])assert.throws(()=>normalizeAssetGoalInput({...body,targets},state));
 assert.equal(getAssetGoal({documents:[]}).totalTarget,400000000);
});
test('selected type target counts only that type while total accumulation remains non-property',()=>{
 const state=stateFor(),p=normalizeAssetGoalInput({schemaVersion:3,targets:[{scope:'type:'+custom.id,target:'1000'}],monthlyTarget:'15000'},state);state.documents.push({id:'goal',kind:'savings_goal',payload:{...p,updatedAt:'2026-11-12'}});state.accounts=[bank('education',custom.id,40000),bank('normal','cash',60000),{...bank('house'),category:'property',balance:500000}];
 const m=buildAssetGoalOverview(state,a=>a.balance,'2026-11');assert.equal(m.buckets.length,1);assert.equal(m.buckets[0].current,40000);assert.equal(m.current,40000);assert.equal(m.goal.totalTarget,100000);assert.equal(m.unassigned,60000);
});
test('real command saves household dictionary and v3 goal; typed asset drafts validate on submit and adoption',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'owner');
 await send('asset.types.save',{baseVersion:0,types:types()});let s=await snapshot(x.db);assert.equal(publicSnapshot(s).assetTypes.find(t=>t.id===custom.id).name,'教育储备');
 const asset={name:'模拟教育金',category:'cash',assetTypeId:custom.id,currency:'CNY',amount:'1000.00',ownerMemberId:'user:owner',asOf:'2026-11-12',owned:true};const d=await send('mcp.draft.submit',{kind:'asset',payload:asset});await send('mcp.draft.accept',{draftId:d.id,confirmed:true,actualConfirmed:true,reviewedPayload:asset});
 await send('savings.goal.save',{schemaVersion:3,targets:[{scope:'type:'+custom.id,target:'1000000'}],monthlyTarget:'15000'});s=await snapshot(x.db);assert.equal(s.accounts.find(a=>a.name===asset.name).metadata.assetTypeId,custom.id);assert.equal(getAssetGoal(s).monthlyTarget,1500000);
 const before=await snapshot(x.db);for(const id of ['foreign','stock','prepayment'])await assert.rejects(send('mcp.draft.submit',{kind:'asset',payload:{...asset,assetTypeId:id}}));await assert.rejects(send('asset.types.save',{baseVersion:0,types:types()}),/CONFLICT/);assert.deepEqual(await snapshot(x.db),before);
 const handler=createMcpHandler({getIdentity:async()=>({id:'owner',canWrite:true}),getDb:()=>x.db});const rpc=await(await handler(new Request('https://fixture.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_financial_context',arguments:{}}})}))).json();assert.ok(rpc.result.structuredContent.assetTypes.some(t=>t.id===custom.id));assert.equal(rpc.result.structuredContent.goals[0].schemaVersion,3);
});
test('MCP asset drafts without optional type preserve clear broad-index and metals classification after adoption',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'owner');
 for(const [name,typeId]of [['纳斯达克100指数基金','broad_index'],['黄金ETF基金','metals_fund']]){const p={name,category:'fund',currency:'CNY',amount:'1000',ownerMemberId:'user:owner',asOf:'2026-11-12',owned:true},d=await send('mcp.draft.submit',{kind:'asset',payload:p});await send('mcp.draft.accept',{draftId:d.id,confirmed:true,actualConfirmed:true,reviewedPayload:p});const a=(await snapshot(x.db)).accounts.find(a=>a.name===name);assert.equal(accountAssetType(a,await snapshot(x.db)).id,typeId);assert.equal(assetGoalBucket(a,await snapshot(x.db)),typeId==='broad_index'?'broadIndex':'preciousMetals');}
});
test('financial facts identify selected target and its exact progress instead of whole-portfolio total',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const state=stateFor(),goal=normalizeAssetGoalInput({schemaVersion:3,targets:[{scope:'type:'+custom.id,target:'2000'}]},state);state.documents.push({id:'goal',kind:'savings_goal',payload:goal});state.accounts=[bank('education',custom.id,100000),bank('daily','cash',100000)];state.book={revision:1};const tools=financialTools(x.db,state),goals=await tools.get_savings_goals(),assets=await tools.get_assets();
 assert.equal(goals.goals[0].currentYuan,'1000.00');assert.equal(goals.goals[0].progress,50);assert.equal(goals.goals[0].targets[0].label,custom.name);assert.equal(assets.assets[0].assetTypeId,custom.id);assert.ok(assets.assetTypes.some(t=>t.id===custom.id));assert.match(assets.note,/不能代替自选目标/);
});
test('type disabled after draft submission is rejected at adoption without partial account creation',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'owner');await send('asset.types.save',{baseVersion:0,types:types()});
 const p={name:'模拟待核对资产',category:'cash',assetTypeId:custom.id,currency:'CNY',amount:'1000',ownerMemberId:'user:owner',asOf:'2026-11-12',owned:true},d=await send('mcp.draft.submit',{kind:'asset',payload:p});await send('asset.types.save',{baseVersion:1,types:types().map(t=>t.id===custom.id?{...t,enabled:false}:t)});const before=await snapshot(x.db);await assert.rejects(send('mcp.draft.accept',{draftId:d.id,confirmed:true,actualConfirmed:true,reviewedPayload:p}),/停用/);assert.deepEqual(await snapshot(x.db),before);
});
test('two real families isolate custom types; foreign IDs and readonly dictionary writes fail atomically',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const config={restrictCreation:false};
 async function create(name,id){const user={userId:'type-'+name,email:name+'@example.test',displayName:name};await familyCommand(x.db,user,{action:'create',name},config);const db=scopeDb(x.db,await familyContext(x.db,user,config)),send=async(action,body)=>executeCommand(db,{key:crypto.randomUUID(),revision:(await snapshot(db)).book.revision,action,body},user.userId);await send('asset.types.save',{baseVersion:0,types:[...getAssetTypes({}),{...custom,id,name:name+'私有类型'}]});return {user,db,send};}
 const a=await create('a','custom_a'),b=await create('b','custom_b'),beforeA=await snapshot(a.db),beforeB=await snapshot(b.db);assert.ok(!JSON.stringify(publicSnapshot(beforeA).assetTypes).includes('b私有类型'));assert.ok(!JSON.stringify(publicSnapshot(beforeB).assetTypes).includes('a私有类型'));
 await assert.rejects(b.send('mcp.draft.submit',{kind:'asset',payload:{name:'跨家庭应拒绝',category:'cash',assetTypeId:'custom_a',currency:'CNY',amount:'1',ownerMemberId:'user:'+b.user.userId,asOf:'2026-11-12',owned:true}}));assert.deepEqual(await snapshot(a.db),beforeA);assert.deepEqual(await snapshot(b.db),beforeB);
 const scope=await familyContext(x.db,a.user,config),invite=await familyCommand(x.db,a.user,{action:'invite',revision:scope.revision},config),reader={userId:'type-reader',email:'reader@example.test',displayName:'只读成员'};await familyCommand(x.db,reader,{action:'accept',token:invite.token},config);const db=scopeDb(x.db,await familyContext(x.db,reader,config));const response=await createFinanceHandlers({getUser:async()=>reader,getDb:()=>db,getOwner:()=>a.user.userId}).POST(new Request('https://fixture.test/api/finance',{method:'POST',body:JSON.stringify({key:crypto.randomUUID(),revision:(await snapshot(db)).book.revision,action:'asset.types.save',body:{baseVersion:1,types:publicSnapshot(await snapshot(db)).assetTypes}})}));assert.equal(response.status,403);
});

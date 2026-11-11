import test from 'node:test';
import assert from 'node:assert/strict';
import * as market from '../src/domain/market.mjs';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {openTestDatabase} from './helpers/d1.mjs';

test('hidden cleared positions do not erase history and missing quantity is not a cleared holding',()=>{
 const positions=[{id:'zero',category:'stock',balance:500,metadata:{quantity:'0'}},{id:'empty',category:'cash',balance:0},{id:'archived',balance:100,archived:1},{id:'unverified',category:'stock',balance:500,metadata:{quantity:''}}];
 assert.equal(typeof market.visibleAssetAccounts,'function');
 assert.deepEqual(market.visibleAssetAccounts(positions).map(a=>a.id),['unverified']);
 assert.equal(market.visibleAssetAccounts(positions,true).length,4);
 assert.equal(positions.length,4);
});
test('category total uses current CNY valuation and counts unconverted assets explicitly',()=>{
 assert.equal(typeof market.categoryValuation,'function');
 const accounts=[{id:'one',category:'stock'},{id:'two',category:'stock'},{id:'cash',category:'cash'}];
 assert.deepEqual(market.categoryValuation(accounts,'stock',a=>a.id==='one'?12345:null),{amountMinor:12345,missing:1});
});
test('term deposit stores audited principal and terms without posting forecast interest or cash',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());
 const body={name:'模拟银行定期',category:'term_deposit',currency:'CNY',amount:'10000.00',bank:'模拟银行',startDate:'2026-01-01',annualRate:'2.00',maturityDate:'2027-01-01'};
 const result=await executeCommand(db,{key:'deposit-open',revision:0,action:'account.save',body},'test');
 let s=await snapshot(db);const a=s.accounts.find(a=>a.id===result.id);
 assert.equal(a.balance,1000000);assert.equal(a.metadata.bank,'模拟银行');assert.equal(a.metadata.annualRate,'2.00');assert.equal(s.transactions.length,1);
 await executeCommand(db,{key:'deposit-edit',revision:s.book.revision,action:'account.save',body:{id:a.id,name:'模拟银行定期改名',category:'term_deposit',currency:'CNY',amount:'10000.00'}},'test');
 s=await snapshot(db);assert.equal(s.accounts.find(a=>a.id===result.id).metadata.startDate,'2026-01-01');assert.equal(s.transactions.length,1);
 await assert.rejects(executeCommand(db,{key:'deposit-invalid',revision:s.book.revision,action:'account.save',body:{...body,maturityDate:'2025-12-31'}},'test'),/到期/);
});
test('cash account bank terms stay optional and do not change its cash category',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());
 const result=await executeCommand(db,{key:'cash-terms',revision:0,action:'account.save',body:{name:'模拟活期',category:'cash',currency:'CNY',amount:'1.00',bank:'模拟银行',startDate:'2026-11-11',annualRate:'0.10'}},'test');
 const a=(await snapshot(db)).accounts.find(a=>a.id===result.id);assert.equal(a.category,'cash');assert.equal(a.metadata.bank,'模拟银行');assert.equal(a.metadata.annualRate,'0.10');
});
test('image asset confirmation marks its source row atomically and cannot open the same candidate twice',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());let state=await snapshot(db);
 await db.prepare('INSERT INTO documents VALUES(?,?,?,?)').bind(state.book.active_dataset,'image-source','image_import',JSON.stringify({rows:[{kind:'asset',category:'fund',currency:'CNY',confirmed:false,index:0}]})).run();
 const review=async(id)=>{state=await snapshot(db);return executeCommand(db,{key:id,revision:state.book.revision,action:'advice.record',body:{id,payload:{intent:'asset',source:'model',verdict:'可考虑',expiresAt:Date.now()+60000,inputs:{date:'2026-11-11',asset:{name:'模拟图片基金',category:'fund',currency:'CNY',amountMinor:10000,owned:true,source:'模拟图',imageImportId:'image-source',imageRowIndex:0}}}}},'test');};
 await review('image-review-one');state=await snapshot(db);const first=await executeCommand(db,{key:'image-accept-one',revision:state.book.revision,action:'advice.accept',body:{adviceId:'image-review-one'}},'test');
 state=await snapshot(db);assert.equal(state.documents.find(d=>d.id==='image-source').payload.rows[0].accountId,first.id);assert.equal(state.documents.find(d=>d.id==='image-source').payload.rows[0].confirmed,true);
 await review('image-review-two');state=await snapshot(db);const second=await executeCommand(db,{key:'image-accept-two',revision:state.book.revision,action:'advice.accept',body:{adviceId:'image-review-two'}},'test');
 assert.equal(second.id,first.id);state=await snapshot(db);assert.equal(state.transactions.filter(t=>t.kind==='OPENING').length,1);assert.equal(state.accounts.filter(a=>a.category==='fund').length,1);
});

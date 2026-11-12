import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './helpers/d1.mjs';
import {executeCommand,snapshot,publicSnapshot} from '../src/server/finance-store.ts';
import {createReviewHandlers} from '../src/server/review-http.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {createMcpHandler} from '../src/server/mcp-http.ts';

test('report API and finance command save immutable monthly document, index only in generic snapshot and MCP can list it',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'owner');await send('account.save',{name:'模拟银行',category:'cash',currency:'CNY',amount:'1000'});const deps={getUser:async()=>({userId:'owner'}),getDb:()=>x.db,getOwner:()=> 'owner'},api=createReviewHandlers(deps);
 const current=await(await api.GET(new Request('https://fixture.test/api/reviews?month=2026-11'))).json();assert.ok(current.document?.fingerprint);
 const before=await snapshot(x.db),r=await createFinanceHandlers(deps).POST(new Request('https://fixture.test/api/finance',{method:'POST',body:JSON.stringify({key:crypto.randomUUID(),revision:before.book.revision,action:'monthly.report.save',body:{month:'2026-11',expectedFingerprint:current.document.fingerprint}})}));assert.equal(r.status,200);const {id}=await r.json();assert.ok(id);
 const state=await snapshot(x.db);assert.deepEqual(state.accounts,before.accounts);assert.deepEqual(state.transactions,before.transactions);const projected=publicSnapshot(state).documents.find(d=>d.id===id);assert.equal(projected.kind,'monthly_report_archive');assert.equal(projected.payload.document,undefined);
 const frozen=await(await api.GET(new Request('https://fixture.test/api/reviews?month=2026-11&archive='+encodeURIComponent(id)))).json();assert.equal(frozen.archived,true);assert.equal(frozen.document.fingerprint,current.document.fingerprint);
 const archiveBefore=JSON.stringify((await snapshot(x.db)).documents.find(d=>d.id===id));
 for(const [action,body] of [['plan.save',{id,name:'覆盖归档',date:'2026-11-01',budget:'1',approve:true}],['reminder.save',{id,type:'date',name:'覆盖归档',date:'2026-11-01'}]])await assert.rejects(send(action,body),/归档|不可修改/);
 assert.equal(JSON.stringify((await snapshot(x.db)).documents.find(d=>d.id===id)),archiveBefore);
 const handler=createMcpHandler({getIdentity:async()=>({id:'owner',canWrite:true}),getDb:()=>x.db}),response=await(await handler(new Request('https://fixture.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_reviews',arguments:{kind:'monthly_report_archive',month:'2026-11'}}})}))).json();assert.ok(!response.result.isError);assert.equal(response.result.structuredContent.rows[0].id,id);
 assert.equal((await api.GET(new Request('https://fixture.test/api/reviews?month=2026-10&archive='+encodeURIComponent(id)))).status,403);assert.equal((await api.GET(new Request('https://fixture.test/api/reviews?month=2026-11&archive=foreign'))).status,403);
 assert.equal((await createFinanceHandlers({...deps,getUser:async()=>({userId:'readonly'})}).POST(new Request('https://fixture.test/api/finance',{method:'POST',body:JSON.stringify({key:crypto.randomUUID(),revision:state.book.revision,action:'monthly.report.save',body:{month:'2026-11',expectedFingerprint:current.document.fingerprint}})}))).status,403);
});

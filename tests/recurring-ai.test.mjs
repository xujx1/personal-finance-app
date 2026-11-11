import test from 'node:test';import assert from 'node:assert/strict';
import {reviewRecurringCandidates} from '../src/server/recurring-ai.ts';
const config={baseUrl:'https://model.example/v1',model:'test-model',key:'test-key'};
const candidates=[{id:'history:a',name:'兼职到账',type:'income',accountId:'bank-b',cashMemberId:'person:b',amount:50000,day:10,months:3,evidence:[{transactionId:'a',date:'2026-09-10',amountMinor:50000,note:'兼职到账'},{transactionId:'b',date:'2026-10-10',amountMinor:50000,note:'兼职到账'},{transactionId:'c',date:'2026-11-10',amountMinor:50000,note:'兼职到账'}],autoPost:false}];
test('AI only annotates server-evidenced recurring candidates, never changes cash account or amounts',async()=>{
 const r=await reviewRecurringCandidates(candidates,config,{fetcher:async(_url,options)=>{const p=JSON.parse(options.body);assert.ok(p.messages[1].content.includes('兼职到账'));assert.ok(!p.messages[1].content.includes('bank-b'));return Response.json({choices:[{message:{content:JSON.stringify({recommendations:[{id:'history:a',name:'兼职收入',reason:'三个月相同日期与金额，建议核对',confidence:'high',amount:999999,accountId:'bank-a'}]})},finish_reason:'stop'}]});}});
 assert.equal(r.method,'ai_reviewed');assert.equal(r.candidates[0].name,'兼职收入');assert.equal(r.candidates[0].amount,50000);assert.equal(r.candidates[0].accountId,'bank-b');assert.equal(r.candidates[0].cashMemberId,'person:b');assert.deepEqual(r.candidates[0].evidence,candidates[0].evidence);assert.equal(r.candidates[0].autoPost,false);
});
test('AI invented IDs cannot create rules and malformed responses fall back honestly',async()=>{
 const r=await reviewRecurringCandidates(candidates,config,{fetcher:async()=>Response.json({choices:[{message:{content:'{"recommendations":[{"id":"invented","name":"fake","reason":"fake","confidence":"high"}]}'},finish_reason:'stop'}]})});
 assert.equal(r.method,'rules');assert.deepEqual(r.candidates,candidates);assert.match(r.message,/AI|规则/);
});
test('no history or missing model never calls an external service',async()=>{
 for(const [cs,cfg] of [[[],config],[candidates,{}]]){const r=await reviewRecurringCandidates(cs,cfg,{fetcher:async()=>{throw Error('must not call');}});assert.equal(r.method,'rules');}
});
test('aborted recurring analysis does not silently return a usable AI result',async()=>{
 const abort=new AbortController();abort.abort();await assert.rejects(reviewRecurringCandidates(candidates,config,{signal:abort.signal}));
});

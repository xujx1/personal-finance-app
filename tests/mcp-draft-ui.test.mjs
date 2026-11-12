import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../src/domain/mcp-draft-ui.mjs';

const owner={viewer:{canWrite:true}};
const draft={id:'external-1',kind:'financial_draft',payload:{kind:'cashflow',status:'PENDING',payload:{type:'income',accountId:'bank-b',cashMemberId:'member-b',amount:'1234.56',date:'2026-11-12'}}};
test('external draft review preserves amount and selected member/account and requires uncovered actual payment',()=>{
 assert.throws(()=>ui.mcpDraftAcceptBody(owner,draft,draft.payload.payload,{reviewed:true,actual:true}),/余额/);
 const body=ui.mcpDraftAcceptBody(owner,draft,{...draft.payload.payload,balanceIncluded:false},{reviewed:true,actual:true});
 assert.deepEqual(body,{draftId:'external-1',confirmed:true,actualConfirmed:true,reviewedPayload:{...draft.payload.payload,balanceIncluded:false}});
});
test('external draft review cannot be accepted by read-only members or without human review',()=>{
 assert.throws(()=>ui.mcpDraftAcceptBody({viewer:{canWrite:false}},draft,{},{}),/本人/);
 assert.throws(()=>ui.mcpDraftAcceptBody(owner,draft,{},{}),/核对/);
 assert.throws(()=>ui.mcpDraftAcceptBody(owner,{...draft,payload:{...draft.payload,status:'ACCEPTED'}},{},{}),/处理/);
});
test('external asset registration requires actual ownership, without converting original currency amounts',()=>{
 const asset={id:'a',kind:'financial_draft',payload:{kind:'asset',status:'PENDING'}};
 assert.throws(()=>ui.mcpDraftAcceptBody(owner,asset,{owned:false},{reviewed:true,actual:true}),/持有/);
 const payload={owned:true,amount:'88.90',currency:'USD',ownerMemberId:'member-b',asOf:'2026-11-12'};
 assert.deepEqual(ui.mcpDraftAcceptBody(owner,asset,payload,{reviewed:true,actual:true}).reviewedPayload,payload);
});
test('budget review recalculates reviewed item total without a second AI call',()=>{
 const budget={id:'b',kind:'financial_draft',payload:{kind:'budget',status:'PENDING'}};
 const payload={name:'旅行',expenseDraft:{kind:'travel',items:[{id:'hotel',name:'住宿',quantity:'2',unitPrice:'123.45'}],itinerary:[],comparisons:[]}};
 const result=ui.mcpDraftAcceptBody(owner,budget,payload,{reviewed:true});
 assert.equal(result.reviewedPayload.budget,'246.90');
 assert.equal(result.reviewedPayload.expenseDraft.reviewed,true);
 assert.equal(result.actualConfirmed,undefined);
});

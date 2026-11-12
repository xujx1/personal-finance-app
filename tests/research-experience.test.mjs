import test from 'node:test';
import assert from 'node:assert/strict';
import * as research from '../src/domain/research-records.mjs';
const payload=(price,extra={})=>({name:'动物园预算',date:'2026-11-15',end:'2026-11-15',analysis:'原分析预算300，尚待采用',expenseDraft:{kind:'travel',items:[{id:'a',name:'门票',quantity:'1',unitPrice:price}],itinerary:[]},...extra});
test('adopted research separates original, reviewed and current facts without rewriting any prose or ledger',()=>{
 const original=payload('300.00'),reviewed=payload('250.00'),current=payload('240.00',{budget:24000});
 const state={accounts:[{balance:123}],transactions:[],documents:[{id:'draft',kind:'financial_draft',payload:{kind:'budget',status:'ACCEPTED',payload:original,reviewedPayload:reviewed,destinationId:'plan'}},{id:'plan',kind:'plan',payload:current}]},before=structuredClone(state);
 const record=research.researchRecords(state)[0],facts=research.researchFactSummary(record,state);
 assert.equal(facts.original.amount,'300.00');assert.equal(facts.reviewed.amount,'250.00');assert.equal(facts.current.amount,'240.00');assert.equal(facts.reviewChanged,true);assert.equal(facts.currentChanged,true);assert.equal(record.payload.content,original.analysis);assert.deepEqual(state,before);
});
test('fact comparison catches itinerary changes and never fabricates a reviewed amount from prose',()=>{
 const a=payload('390.00'),b={...payload('390.00'),date:'2026-11-16'};
 const facts=research.researchFactSummary({kind:'advice',payload:{analysis:'旧估算410',expenseDraft:a.expenseDraft,planId:'p'}},{documents:[{id:'p',kind:'plan',payload:b}]});
 assert.equal(facts.reviewed.amount,'390.00');assert.equal(facts.original.amount,'390.00');assert.equal(facts.currentChanged,true);assert.equal(facts.reviewed.amount.includes('410'),false);
});
test('session research view restores filters, page and expanded history safely',async()=>{
 const {normalizeResearchView}=await import('../src/domain/research-view.mjs');
 assert.deepEqual(normalizeResearchView({query:'动物园',kind:'travel',from:'2026-11-01',to:'2026-12-01',page:3,open:true,scrollY:600}),{query:'动物园',kind:'travel',from:'2026-11-01',to:'2026-12-01',page:3,open:true,scrollY:600});
 assert.equal(normalizeResearchView({page:-1,scrollY:NaN}).page,1);
 assert.equal(normalizeResearchView().open,false);
});

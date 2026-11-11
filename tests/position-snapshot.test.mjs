import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePositionSnapshot} from '../src/domain/market.mjs';
const position=(metadata={},balance=3002)=>({id:'fake-position',kind:'ASSET',category:'stock',currency:'USD',balance,metadata:{quantity:'3',price:'10.01',cost:'8.00',asOf:'2026-11-01',market:'US',...metadata}});

test('stored snapshot reconciliation preserves the registered value and detects an exact one-cent difference',()=>{
 const account=position(),before=JSON.stringify(account),result=reconcilePositionSnapshot(account);
 assert.equal(result.registeredMinor,3002);assert.equal(result.calculatedSnapshotMinor,3003);assert.equal(result.discrepancyMinor,1);assert.equal(result.status,'discrepancy');
 assert.equal(result.totalCostMinor,2400);assert.equal(result.currency,'USD');assert.equal(result.market,'US');assert.equal(result.asOf,'2026-11-01');
 assert.equal(JSON.stringify(account),before);
});

test('a separate current market quote cannot change the stored-snapshot comparison',()=>{
 const account=position(),before=reconcilePositionSnapshot(account);
 const state={account,quote:{price:'15.00',asOf:'2026-11-11',source:'fake public quote'}};
 assert.equal(reconcilePositionSnapshot(state.account).calculatedSnapshotMinor,3003);assert.equal(reconcilePositionSnapshot(state.account).discrepancyMinor,1);
 assert.deepEqual(reconcilePositionSnapshot({...account,quote:state.quote}),before);
 assert.equal(reconcilePositionSnapshot(position({},3003)).status,'matched');
});

test('snapshot multiplication and total cost round once after exact fractional quantity arithmetic',()=>{
 const result=reconcilePositionSnapshot(position({quantity:'3',price:'0.005',cost:'0.005'},2));
 assert.equal(result.calculatedSnapshotMinor,2);assert.equal(result.totalCostMinor,2);assert.equal(result.discrepancyMinor,0);assert.equal(result.status,'matched');
 const fraction=reconcilePositionSnapshot(position({quantity:'0.12345678',price:'8.10000001',cost:'0'},100));
 assert.equal(fraction.calculatedSnapshotMinor,100);assert.equal(fraction.totalCostMinor,0);
 const zero=reconcilePositionSnapshot(position({quantity:'0'},0));assert.equal(zero.calculatedSnapshotMinor,0);assert.equal(zero.totalCostMinor,0);
});

test('missing or malformed quantities prices costs and registered values stay explicitly unknown',()=>{
 for(const metadata of [{quantity:''},{quantity:null},{quantity:'1e3'},{quantity:'-3'},{quantity:'1.123456789'},{price:''},{price:{}},{price:'NaN'}]){
  const result=reconcilePositionSnapshot(position(metadata));assert.equal(result.status,'unknown');assert.equal(result.calculatedSnapshotMinor,null);assert.equal(result.discrepancyMinor,null);assert.equal(result.registeredMinor,3002);
 }
 const noCost=reconcilePositionSnapshot(position({cost:''}));assert.equal(noCost.totalCostMinor,null);assert.equal(noCost.calculatedSnapshotMinor,3003);
 for(const balance of [undefined,3.1,-1,Number.MAX_SAFE_INTEGER+1]){const account=position();account.balance=balance;const result=reconcilePositionSnapshot(account);assert.equal(result.registeredMinor,null);assert.equal(result.discrepancyMinor,null);assert.equal(result.status,'unknown');}
 assert.equal(reconcilePositionSnapshot(null).status,'unknown');
});

test('unverified market and missing snapshot date remain unknown rather than inferred from currency',()=>{
 for(const market of [undefined,'','NASDAQ','malformed'])assert.equal(reconcilePositionSnapshot(position({market})).market,'未核实');
 for(const market of ['US','CN','HK','OTHER'])assert.equal(reconcilePositionSnapshot(position({market})).market,market);
 assert.equal(reconcilePositionSnapshot(position({asOf:'2026-02-30'})).asOf,null);
 assert.equal(reconcilePositionSnapshot(position({asOf:null})).asOf,null);
});

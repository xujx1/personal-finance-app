import test from 'node:test';
import assert from 'node:assert/strict';
import * as market from '../src/domain/market.mjs';
test('asset categories rank by the displayed CNY totals, retaining stable equal and zero totals without mutating the catalogue',()=>{
 const types=['cash','stock','property','loan','fund','other'].map(id=>({id,name:id})),accounts=[{type:'cash',value:5000},{type:'stock',value:12000},{type:'property',value:350000000},{type:'loan',value:79000000},{type:'stock',value:3000}],before=JSON.stringify({types,accounts});
 assert.equal(typeof market.rankedAssetCategories,'function');const rows=market.rankedAssetCategories(types,accounts,a=>a.type,a=>a.value);
 assert.deepEqual(rows.map(r=>r.id),['property','loan','stock','cash','fund','other']);assert.equal(rows.find(r=>r.id==='stock').amountMinor,15000);assert.equal(JSON.stringify({types,accounts}),before);
});
test('ranking recalculates from the selected member and preserves missing valuation warnings at the end of zero totals',()=>{
 assert.equal(typeof market.rankedAssetCategories,'function');const types=['cash','fund','stock','other'].map(id=>({id})),accounts=[{member:'a',type:'cash',value:100},{member:'a',type:'fund',value:200},{member:'b',type:'cash',value:1000},{member:'b',type:'stock',value:null}];
 const rank=rows=>market.rankedAssetCategories(types,rows,a=>a.type,a=>a.value);assert.deepEqual(rank(accounts).map(x=>x.id),['cash','fund','other','stock']);assert.equal(rank(accounts).find(x=>x.id==='stock').missing,1);assert.deepEqual(rank(accounts.filter(a=>a.member==='a')).map(x=>x.id),['fund','cash','stock','other']);
});

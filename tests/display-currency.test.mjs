import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCurrencyMode,effectiveDisplayCurrency,displayRateIsStale,usableDisplayRate,convertDisplayMinor,displayMoney,aggregateDisplayAmounts} from '../src/domain/display-currency.mjs';
const quote={rate:'7.100000000000',date:'2026-11-13',source:'ECB daily reference rate',status:'ok'};

test('English defaults to USD, Chinese defaults to CNY, and a manual currency overrides language',()=>{
 assert.equal(effectiveDisplayCurrency('en-US'),'USD');assert.equal(effectiveDisplayCurrency('zh-CN'),'CNY');assert.equal(effectiveDisplayCurrency('en-US','CNY'),'CNY');assert.equal(effectiveDisplayCurrency('zh-CN','USD'),'USD');assert.equal(effectiveDisplayCurrency('en-US','auto'),'USD');assert.equal(normalizeCurrencyMode('EUR'),'auto');
});
test('both directions use the real CNY-per-USD ratio instead of relabeling amounts',()=>{
 assert.equal(convertDisplayMinor(710000,'CNY','USD',quote.rate),100000);assert.equal(convertDisplayMinor(100000,'USD','CNY',quote.rate),710000);assert.equal(convertDisplayMinor(12345,'USD','USD',null),12345);
 assert.equal(displayMoney(710000,'CNY','USD',quote,'en-US'),'≈ $1,000.00');assert.equal(displayMoney(100000,'USD','CNY',quote,'zh-CN'),'≈ ¥7,100.00');assert.equal(displayMoney(12345,'USD','USD',null,'en-US'),'$123.45');
});
test('conversion rounds once in integer minor units, including negative half-cent ties and twelve-digit rates',()=>{
 assert.equal(convertDisplayMinor(1,'CNY','USD','2'),1);assert.equal(convertDisplayMinor(-1,'CNY','USD','2'),-1);assert.equal(convertDisplayMinor(-1,'CNY','USD','3'),0);
 assert.equal(convertDisplayMinor(7123456789012,'CNY','USD','7.123456789012'),1000000000000);assert.equal(convertDisplayMinor(Number.MAX_SAFE_INTEGER,'USD','CNY','999'),null);
});
test('missing and malformed rates never become zero or a 1:1 exchange rate',()=>{
 for(const rate of [null,undefined,0,-1,'0','-7','NaN','Infinity','1e3','7.1234567890123',{},'7USD'])assert.equal(convertDisplayMinor(12345,'CNY','USD',rate),null,String(rate));
 assert.equal(convertDisplayMinor(null,'CNY','USD',7),null);assert.equal(convertDisplayMinor(100,'HKD','USD',7),null);assert.equal(convertDisplayMinor(0,'CNY','USD',null),0);
 const fallback=displayMoney(710000,'CNY','USD',null,'en-US');assert.match(fallback,/CN¥7,100\.00/);assert.match(fallback,/USD conversion unavailable/);assert.doesNotMatch(fallback,/\$7,100/);
});
test('a conversion quote requires a valid date and source, and stale quotes retain their date',()=>{
 assert.equal(usableDisplayRate(quote),quote.rate);for(const changes of [{source:''},{date:'2026-02-30'},{status:'unavailable'},{rate:'0'},{date:undefined}])assert.equal(usableDisplayRate({...quote,...changes}),null);
 assert.equal(usableDisplayRate({...quote,status:'stale'}),quote.rate);assert.equal(displayRateIsStale(quote,Date.parse('2026-11-14')),false);assert.equal(displayRateIsStale(quote,Date.parse('2026-11-21')),true);assert.equal(displayMoney(100,'CNY','USD',{...quote,source:''},'en-US').includes('conversion unavailable'),true);
});
test('mixed totals convert native USD directly and show missing coverage rather than losing native USD',()=>{
 assert.deepEqual(aggregateDisplayAmounts([{amount:710000,currency:'CNY'},{amount:12345,currency:'USD'}],'USD',quote),{amount:112345,missing:0});
 assert.deepEqual(aggregateDisplayAmounts([{amount:710000,currency:'CNY'},{amount:12345,currency:'USD'}],'USD',null),{amount:12345,missing:1});
 assert.deepEqual(aggregateDisplayAmounts([{amount:710000,currency:'CNY'}],'USD',null),{amount:null,missing:1});assert.deepEqual(aggregateDisplayAmounts([],'USD',null),{amount:0,missing:0});
 assert.deepEqual(aggregateDisplayAmounts([{amount:Number.MAX_SAFE_INTEGER,currency:'USD'},{amount:1,currency:'USD'}],'USD',null),{amount:null,missing:0});
});
test('formatting never mutates a saved snapshot or an exchange quote',()=>{
 const stored={amount:710000,currency:'CNY',month:'2026-01',revision:12},before=JSON.stringify({stored,quote});displayMoney(stored.amount,stored.currency,'USD',quote,'en-US');aggregateDisplayAmounts([stored],'USD',quote);assert.equal(JSON.stringify({stored,quote}),before);
});

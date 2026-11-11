import test from 'node:test';
import assert from 'node:assert/strict';
import { minor, decimal, convert, balanceJournal, forecastPlans } from '../src/domain/finance.mjs';

test('decimal strings are converted exactly and malformed cash rejected',()=>{
 assert.equal(minor('0.10')+minor('0.20'),30);
 for(const s of ['1.005','NaN','1e3','-1','Infinity','90000000000.01'])assert.throws(()=>minor(s));
 assert.equal(decimal(123456), '1234.56');
});
test('conversion uses exact decimal rate and half-up rounding',()=>{
 assert.equal(convert(10000,'6.5'),65000);
 assert.equal(convert(1,'7.25'),7);
 assert.equal(convert(2,'7.25'),15);
 assert.throws(()=>convert(100,'0'));
});
test('journals balance per currency and cannot be empty',()=>{
 assert.throws(()=>balanceJournal([]));
 assert.throws(()=>balanceJournal([{currency:'CNY',amount:100},{currency:'USD',amount:-100}]));
 assert.equal(balanceJournal([{currency:'CNY',amount:100},{currency:'CNY',amount:-100}]),true);
});
test('forecast includes unpaid plans once and marks unknown amounts',()=>{
 const plans=[{status:'PLANNED',date:'2026-12-01',budget:100000,paid:20000},{status:'CANCELLED',date:'2026-12-01',budget:50000,paid:0},{status:'PLANNED',date:'2026-12-02',budget:null,paid:0}];
 assert.deepEqual(forecastPlans(plans,'2026-11-01','2026-12-31'),{outflow:80000,unknown:1});
});

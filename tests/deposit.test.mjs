import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../src/domain/deposit.mjs').catch(()=>({}));
test('term interest is a separate exact ACT/365 simple estimate, not principal',async()=>{
 const deposit=await load();assert.equal(typeof deposit.estimatedDepositInterest,'function');
 const a={category:'term_deposit',balance:1000000,metadata:{bank:'模拟银行',startDate:'2026-01-01',maturityDate:'2027-01-01',annualRate:'2.00'}};
 assert.equal(deposit.estimatedDepositInterest(a),20000);assert.equal(a.balance,1000000);
 assert.equal(deposit.estimatedDepositInterest({...a,metadata:{...a.metadata,maturityDate:'2026-01-02',annualRate:'1.825'}}),50);
 assert.equal(deposit.estimatedDepositInterest({...a,metadata:{...a.metadata,annualRate:''}}),null);
});
test('deposit dates rates and required bank details reject impossible terms',async()=>{
 const deposit=await load();assert.equal(typeof deposit.normalizeDepositMetadata,'function');
 const valid={bank:' 模拟银行 ',startDate:'2026-01-01',annualRate:'2.00',maturityDate:'2027-01-01'};
 assert.equal(deposit.normalizeDepositMetadata(valid,{required:true}).bank,'模拟银行');
 for(const patch of [{bank:''},{startDate:'2026-02-30'},{annualRate:'-2'},{annualRate:'100.1'},{annualRate:'NaN'},{maturityDate:'2026-01-01'}])assert.throws(()=>deposit.normalizeDepositMetadata({...valid,...patch},{required:true}));
 assert.deepEqual(deposit.normalizeDepositMetadata({}),{bank:'',startDate:null,annualRate:'',maturityDate:null});
});

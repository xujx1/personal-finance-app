import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './helpers/d1.mjs';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {annualForecast} from '../src/domain/planning.mjs';

async function setup(t){
 const x=openTestDatabase();t.after(()=>x.sqlite.close());
 const send=async(action,body,key=crypto.randomUUID(),revision)=>(executeCommand(x.db,{key,revision:revision??(await snapshot(x.db)).book.revision,action,body},'owner'));
 const bank=await send('account.save',{name:'模拟银行',category:'cash',currency:'CNY',amount:'1000.00'});
 const plan=await send('plan.save',{name:'模拟旅行',category:'国内旅行',date:'2026-11-14',end:'2026-11-15',budget:'300.00',approve:true});
 await send('plan.reserve',{planId:plan.id,amount:'300.00'});
 return {...x,send,bank,plan};
}
test('取消同一计划释放预算预留，保留实际付款及账目，并幂等重试',async t=>{
 const x=await setup(t);await x.send('plan.pay',{planId:x.plan.id,accountId:x.bank.id,amount:'20.00',date:'2026-11-12'});
 const before=await snapshot(x.db),p=before.documents.find(d=>d.id===x.plan.id).payload,key=crypto.randomUUID();
 const result=await x.send('plan.cancel',{planId:x.plan.id,version:p.version,confirmed:true},key,before.book.revision);
 const after=await snapshot(x.db),cancelled=after.documents.find(d=>d.id===x.plan.id).payload;
 assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.reserved,0);assert.equal(cancelled.budget,p.budget);assert.equal(cancelled.version,p.version+1);assert.equal(cancelled.cancelledBy,'owner');assert.ok(cancelled.cancelledAt);
 assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.transactions,before.transactions);assert.deepEqual(after.planSummaries,before.planSummaries);
 assert.equal(annualForecast(after,'2026-11-12')[0].planned,0);assert.equal(annualForecast(before,'2026-11-12')[0].planned,28000);assert.equal(annualForecast(after,'2026-11-12')[0].closing-annualForecast(before,'2026-11-12')[0].closing,28000);
 assert.deepEqual(await x.send('plan.cancel',{planId:x.plan.id,version:p.version,confirmed:true},key,before.book.revision),result);assert.equal((await snapshot(x.db)).book.revision,after.book.revision);
});
test('取消必须显式确认且版本一致，失败不改变账目',async t=>{
 const x=await setup(t),before=await snapshot(x.db),p=before.documents.find(d=>d.id===x.plan.id).payload;
 await assert.rejects(x.send('plan.cancel',{planId:x.plan.id,version:p.version}),/确认/);
 await assert.rejects(x.send('plan.cancel',{planId:x.plan.id,version:p.version-1,confirmed:true}),/CONFLICT/);
 await assert.rejects(x.send('plan.save',{id:x.plan.id,...p,budget:'300.00',status:'CANCELLED'}),/取消/);
 assert.deepEqual(await snapshot(x.db),before);
});
test('已取消计划不可由编辑、付款或旧审批复活',async t=>{
 const x=await setup(t),p=(await snapshot(x.db)).documents.find(d=>d.id===x.plan.id).payload;
 await x.send('plan.cancel',{planId:x.plan.id,version:p.version,confirmed:true});const before=await snapshot(x.db);
 await assert.rejects(x.send('plan.save',{id:x.plan.id,...p,budget:'300.00',status:'PLANNED'}),/取消/);
 await assert.rejects(x.send('plan.pay',{planId:x.plan.id,accountId:x.bank.id,amount:'1.00',date:'2026-11-12'}));
 await assert.rejects(x.send('plan.approve',{planId:x.plan.id,version:p.version,confirmed:true}));
 assert.deepEqual(await snapshot(x.db),before);
});
test('公开接口仅管理员能取消；拒绝外站来源',async t=>{
 const x=await setup(t),p=(await snapshot(x.db)).documents.find(d=>d.id===x.plan.id).payload;
 const post=(user,origin='https://fixture.test')=>createFinanceHandlers({getUser:async()=>({userId:user}),getDb:()=>x.db,getOwner:()=> 'owner'}).POST(new Request('https://fixture.test/api/finance',{method:'POST',headers:{origin},body:JSON.stringify({key:crypto.randomUUID(),revision:2,action:'plan.cancel',body:{planId:x.plan.id,version:p.version,confirmed:true}})}));
 const before=await snapshot(x.db);assert.equal((await post('reader')).status,403);assert.equal((await post('owner','https://else.test')).status,403);assert.deepEqual(await snapshot(x.db),before);
 const r=await createFinanceHandlers({getUser:async()=>({userId:'owner'}),getDb:()=>x.db,getOwner:()=> 'owner'}).POST(new Request('https://fixture.test/api/finance',{method:'POST',body:JSON.stringify({key:crypto.randomUUID(),revision:before.book.revision,action:'plan.cancel',body:{planId:x.plan.id,version:p.version,confirmed:true}})}));assert.equal(r.status,200);
});

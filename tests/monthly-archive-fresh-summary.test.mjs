import test from 'node:test';import assert from 'node:assert/strict';
import {openTestDatabase} from './helpers/d1.mjs';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {getMonthlyContext} from '../src/server/mcp-queries.ts';
import {buildMonthlyReportDocument} from '../src/server/monthly-report-document.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
test('server refuses new monthly archives with missing or stale summaries even with a fresh document fingerprint',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date());
 const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'owner');await send('account.save',{name:'样本月报银行',category:'cash',currency:'CNY',amount:'1000'});
 const api=createFinanceHandlers({getUser:async()=>({userId:'owner'}),getDb:()=>x.db,getOwner:()=> 'owner'});
 async function save(){const s=await snapshot(x.db),doc=await buildMonthlyReportDocument(x.db,s,month);const r=await api.POST(new Request('https://test.invalid/api/finance',{method:'POST',body:JSON.stringify({key:crypto.randomUUID(),revision:s.book.revision,action:'monthly.report.save',body:{month,expectedFingerprint:doc.fingerprint}})}));return {status:r.status,value:await r.json()}}
 const before=await snapshot(x.db);assert.equal((await save()).status,422,'numbers alone must not create a new AI report');assert.deepEqual(await snapshot(x.db),before);
 const basis=await getMonthlyContext(x.db,before,month);x.sqlite.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(before.book.active_dataset,'checked-review','monthly_review',JSON.stringify({month,title:'样本月刊',summary:'已核对结论',sections:[{heading:'收支',body:'样本记录'}],acceptedAt:new Date().toISOString(),basisFingerprint:basis.basisFingerprint,basis}));
 const first=await save();assert.equal(first.status,200);const original=JSON.stringify((await snapshot(x.db)).documents.find(d=>d.id===first.value.id));await send('account.save',{name:'补充已有资产',category:'other',currency:'CNY',amount:'10'});const stale=await snapshot(x.db);assert.equal((await save()).status,422,'fresh preview fingerprint cannot bless an outdated summary');assert.deepEqual(await snapshot(x.db),stale);assert.equal(JSON.stringify(stale.documents.find(d=>d.id===first.value.id)),original);
});

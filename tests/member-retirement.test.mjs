import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './helpers/d1.mjs';
import {familyContext,familyCommand} from '../src/server/family-service.ts';
import {scopeDb} from '../src/server/ledger-scope.ts';
import {snapshot,executeCommand} from '../src/server/finance-store.ts';
import {createFamilyHandlers} from '../src/server/family-route.ts';
import {createRetirementBackup,retireFamilyLogin} from '../src/server/member-retirement.ts';
import {buildRecurringMonthSummary} from '../src/domain/recurring-monthly.mjs';
import {accountMember,resolveFinanceMember} from '../src/domain/member-ownership.mjs';
const owner={userId:'retirement-owner',displayName:'Sample owner',email:'owner@example.test'},member={userId:'retirement-member',displayName:'Sample spouse'},foreign={userId:'foreign-owner',displayName:'Other family'};
const config={ownerSubject:owner.userId};
async function setup(t){
 const x=openTestDatabase();t.after(()=>x.sqlite.close());
 const c=await familyContext(x.db,owner,config),invite=await familyCommand(x.db,owner,{action:'invite',revision:c.revision},config);
 await familyCommand(x.db,member,{action:'accept',token:invite.token},config);
 const db=scopeDb(x.db,await familyContext(x.db,owner,config)),send=async(action,body={})=>executeCommand(db,{key:crypto.randomUUID(),revision:(await snapshot(db)).book.revision,action,body},owner.userId);
 const bank=await send('account.save',{name:'Spouse bank',category:'cash',currency:'CNY',amount:'412.34',ownerMemberId:'user:'+member.userId});
 const plan=await send('plan.save',{name:'Approved day trip',date:'2026-12-01',budget:'20.00',approve:true,ownerMemberId:'user:'+member.userId});
 let s=await snapshot(db),p=s.documents.find(d=>d.id===plan.id).payload;
 const md=scopeDb(x.db,await familyContext(x.db,member,config));
 await executeCommand(md,{key:crypto.randomUUID(),revision:s.book.revision,action:'plan.approve',body:{planId:plan.id,version:p.familyApproval.version,confirmed:true}},member.userId);
 const pending=await send('plan.save',{name:'Pending meal',date:'2026-12-02',budget:'8.00',approve:true});
 await send('transaction.add',{type:'expense',accountId:bank.id,cashMemberId:'user:'+member.userId,amount:'2.34',date:'2026-11-12',note:'Sample expense'});
 await send('recurring.save',{name:'Sample recurring',type:'income',accountId:bank.id,cashMemberId:'user:'+member.userId,amount:'3.00',day:15,start:'2026-12-01',confirmed:true});
 return {...x,ledger:db,send,bank:bank.id,plan:plan.id,pending:pending.id,memberDb:md};
}
const request=(backup,extra={})=>({userId:member.userId,name:'Sample spouse',backupDigest:backup.digest,confirmed:true,...extra});
test('full backup includes long documents and all transactions, excludes other households, and restores locally',async t=>{
 const x=await setup(t),ds=(await snapshot(x.ledger)).book.active_dataset;
 x.sqlite.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(ds,'long','research_proposal',JSON.stringify({text:'a'.repeat(18000)}));
 for(let i=0;i<305;i++){const id='historical-'+i;x.sqlite.prepare("INSERT INTO transactions VALUES(?,?,?,'DRAFT',?,NULL,?,?)").run(ds,id,'EXPENSE',100,'2026-10-01','{}');for(const [account,amount] of [['equity:CNY',-100],['expense:CNY',100]])x.sqlite.prepare('INSERT INTO entries VALUES(?,?,?,?,?)').run(ds,id,account,'CNY',amount);x.sqlite.prepare("UPDATE transactions SET status='POSTED' WHERE dataset_id=? AND id=?").run(ds,id);}
 await familyCommand(x.db,foreign,{action:'create',name:'Foreign'},{});
 const fd=scopeDb(x.db,await familyContext(x.db,foreign,{}));await executeCommand(fd,{key:'foreign',revision:0,action:'account.save',body:{name:'FOREIGN_SECRET',category:'cash',currency:'CNY',amount:'1.00'}},foreign.userId);
 const b=await createRetirementBackup(x.db,owner,config);
 assert.equal(b.tables.documents.find(d=>d.id==='long').payload.length,18011);
 assert.equal(b.tables.transactions.length,307);assert.equal(b.tables.household_members.length,2);assert.ok(!JSON.stringify(b).includes('FOREIGN_SECRET'));assert.match(b.digest,/^[a-f0-9]{64}$/);
 const y=openTestDatabase();t.after(()=>y.sqlite.close());const commandGuard=y.sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='command_guard'").get().sql;y.sqlite.exec('DROP TRIGGER command_guard');
 // Rebuild a separate DB from the exact raw rows; immutable journals are inserted as drafts then posted.
 for(const table of ['books','households','household_members','household_invites','accounts','transactions','entries','documents','audit_events','commands']){
  if(table==='households')await familyContext(y.db,{userId:'restore-bootstrap'},{});
  for(const row of b.tables[table]){const value=table==='transactions'?{...row,status:'DRAFT'}:row,keys=Object.keys(value);y.sqlite.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?')})`).run(...Object.values(value));}
 }
 for(const row of b.tables.transactions)y.sqlite.prepare("UPDATE transactions SET status='POSTED' WHERE dataset_id=? AND id=?").run(row.dataset_id,row.id);
 y.sqlite.exec(commandGuard);const restored=await createRetirementBackup(y.db,owner,config);assert.equal(restored.digest,b.digest);
});
test('retirement preserves journals, calendar eligibility and original closed votes while pending plans require a fresh owner vote',async t=>{
 const x=await setup(t),before=await snapshot(x.ledger),backup=await createRetirementBackup(x.db,owner,config),old=before.documents.find(d=>d.id===x.plan).payload;
 const r=await retireFamilyLogin(x.db,owner,request(backup),config),after=await snapshot(x.ledger);
 assert.equal(await familyContext(x.db,member,config),null);assert.equal(after.householdMembers.filter(m=>m.active).length,1);
 assert.deepEqual(after.transactions,before.transactions);assert.deepEqual(after.accounts.map(a=>[a.id,a.balance]),before.accounts.map(a=>[a.id,a.balance]));
 const person=resolveFinanceMember(after,'user:'+member.userId);assert.equal(person.id,r.profileId);assert.equal(person.userId,null);assert.equal(person.selectable,true);assert.equal(accountMember(after.accounts.find(a=>a.id===x.bank),after).id,r.profileId);
 const approved=after.documents.find(d=>d.id===x.plan).payload;assert.equal(approved.budgetStatus,'APPROVED');assert.deepEqual(approved.familyApproval.approvals,old.familyApproval.approvals);assert.equal(approved.approvedAt,old.approvedAt);
 assert.deepEqual(approved.loginRetirements[0].previousApproval,old.familyApproval);
 const pending=after.documents.find(d=>d.id===x.pending).payload;assert.equal(pending.budgetStatus,'PENDING_APPROVAL');assert.deepEqual(pending.familyApproval.required,[owner.userId]);assert.deepEqual(pending.familyApproval.approvals,[]);
 await assert.rejects(snapshot(x.memberDb),/失效|权限/);
 await x.send('transaction.add',{type:'expense',accountId:x.bank,cashMemberId:r.profileId,amount:'1.00',note:'After retirement'});
 const edited=await x.send('plan.save',{id:x.plan,name:'Changed day trip',date:'2026-12-01',budget:'21.00'});assert.ok(edited.ok);
 assert.equal((await snapshot(x.ledger)).documents.find(d=>d.id===x.plan).payload.budgetStatus,'PENDING_APPROVAL');
 const p=after.documents.find(d=>d.kind==='recurring_rule');if(p)assert.equal(resolveFinanceMember(after,p.payload.cashMemberId).id,r.profileId);
});
test('rejected decisions remain rejected and later membership changes still invalidate compatibility',async t=>{
 const x=await setup(t);let s=await snapshot(x.ledger),p=s.documents.find(d=>d.id===x.pending).payload;
 await executeCommand(x.memberDb,{key:crypto.randomUUID(),revision:s.book.revision,action:'plan.reject',body:{planId:x.pending,version:p.familyApproval.version,reason:'Original spouse rejection',confirmed:true}},member.userId);
 await retireFamilyLogin(x.db,owner,request(await createRetirementBackup(x.db,owner,config)),config);
 s=await snapshot(x.ledger);p=s.documents.find(d=>d.id===x.pending).payload;assert.equal(p.budgetStatus,'REJECTED');assert.equal(p.familyApproval.rejections[0].userId,member.userId);
 const c=await familyContext(x.db,owner,config),i=await familyCommand(x.db,owner,{action:'invite',revision:c.revision},config);await familyCommand(x.db,{userId:'new-member'},{action:'accept',token:i.token},config);
 assert.equal((await snapshot(x.ledger)).documents.find(d=>d.id===x.plan).payload.budgetStatus,'PENDING_APPROVAL');
});
test('missing/stale backup, foreign/owner targets and viewers cannot retire; retry is idempotent',async t=>{
 const x=await setup(t),b=await createRetirementBackup(x.db,owner,config);
 await assert.rejects(createRetirementBackup(x.db,member,config),/管理员/);
 for(const extra of [{backupDigest:undefined},{confirmed:false},{userId:owner.userId},{userId:foreign.userId}])await assert.rejects(retireFamilyLogin(x.db,owner,request(b,extra),config));
 await assert.rejects(retireFamilyLogin(x.db,member,request(b),config),/管理员/);
 await x.send('preferences.save',{});await assert.rejects(retireFamilyLogin(x.db,owner,request(b),config),/备份|变化/);
 const current=await createRetirementBackup(x.db,owner,config),r=await retireFamilyLogin(x.db,owner,request(current),config),after=await createRetirementBackup(x.db,owner,config);
 assert.deepEqual(await retireFamilyLogin(x.db,owner,request(current),config),r);assert.equal((await createRetirementBackup(x.db,owner,config)).digest,after.digest);
});
test('concurrent ledger write rolls back membership, profiles and approvals together',async t=>{
 const x=await setup(t),b=await createRetirementBackup(x.db,owner,config),before=await snapshot(x.ledger);let injected=false;
 const intercepted={prepare:sql=>x.db.prepare(sql),async batch(rows){if(!injected){injected=true;x.sqlite.prepare('UPDATE books SET revision=revision+1').run()}return x.db.batch(rows)}};
 await assert.rejects(retireFamilyLogin(intercepted,owner,request(b),config));
 const after=await snapshot(x.ledger);assert.equal(after.householdMembers.filter(m=>m.active).length,2);assert.deepEqual(after.documents,before.documents);assert.deepEqual(after.accounts,before.accounts);
});
test('HTTP backup and retirement reject anonymous, foreign origin, and member access',async t=>{
 const x=await setup(t),env={DB:x.db,OWNER_SUBJECT_ID:owner.userId};
 const h=createFamilyHandlers({getUser:async()=>member,env});assert.equal((await h.GET(new Request('https://fixture.test/api/family?retirement_backup=1'))).status,403);
 const anon=createFamilyHandlers({getUser:async()=>null,env});assert.equal((await anon.GET(new Request('https://fixture.test/api/family?retirement_backup=1'))).status,401);
 const own=createFamilyHandlers({getUser:async()=>owner,env}),backup=await createRetirementBackup(x.db,owner,config);
 assert.equal((await own.POST(new Request('https://fixture.test/api/family',{method:'POST',headers:{origin:'https://foreign.test'},body:JSON.stringify({action:'retire',...request(backup)})}))).status,403);
});

test('retired spouse keeps a separate pension, recurring ownership and editable profile; archives and audit are unchanged',async t=>{
 const x=await setup(t),profile=await x.send('member.save',{name:'Existing spouse profile',linkedUserId:member.userId});
 const pension={name:'Sample restricted pension',category:'other',assetTypeId:'personal_pension',currency:'CNY',amount:'11.00',ownerMemberId:profile.id,asOf:'2026-11-12',owned:true,pension:{annualLimit:'12000.00',withdrawalAge:70,cashBalance:'1.00',contributions:[{year:2026,amount:'12.00'}],holdings:[{name:'Sample broad index',kind:'fund',value:'10.00',cost:'11.00'}]}};
 const draft=await x.send('mcp.draft.submit',{kind:'asset',payload:pension});const account=await x.send('mcp.draft.accept',{draftId:draft.id,confirmed:true,actualConfirmed:true,reviewedPayload:pension});
 const ds=(await snapshot(x.ledger)).book.active_dataset;
 const archived=JSON.stringify({month:'2026-10',html:'<p>Immutable original report</p>',ownerMemberId:'user:'+member.userId});x.sqlite.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(ds,'archived-report','monthly_report_archive',archived);
 const before=await createRetirementBackup(x.db,owner,config),result=await retireFamilyLogin(x.db,owner,request(before),config);assert.equal(result.profileId,profile.id);
 const after=await createRetirementBackup(x.db,owner,config);assert.equal(after.tables.documents.find(d=>d.id==='archived-report').payload,archived);
 for(const row of before.tables.audit_events)assert.deepEqual(after.tables.audit_events.find(d=>d.id===row.id),row);
 for(const row of before.tables.transactions)assert.deepEqual(after.tables.transactions.find(d=>d.id===row.id),row);
 await x.send('member.save',{id:profile.id,name:'Spouse finance profile',linkedUserId:null});let state=await snapshot(x.ledger);const person=resolveFinanceMember(state,'user:'+member.userId);assert.equal(person.id,profile.id);assert.equal(person.selectable,true);assert.equal(person.name,'Spouse finance profile');assert.equal(accountMember(state.accounts.find(a=>a.id===account.id),state).id,profile.id);
 await assert.rejects(x.send('member.save',{id:profile.id,name:'Bad relink',linkedUserId:owner.userId}),/关联/);
 await x.send('pension.contribute',{assetId:account.id,accountId:x.bank,cashMemberId:profile.id,amount:'1.00',date:'2026-11-16',actualConfirmed:true,balanceUncovered:true});
 state=await snapshot(x.ledger);assert.equal(state.accounts.find(a=>a.id===account.id).balance,1200);
 const rules=state.documents.filter(d=>d.kind==='recurring_rule');assert.equal(rules.length,1);assert.equal(resolveFinanceMember(state,rules[0].payload.cashMemberId).id,profile.id);assert.equal(buildRecurringMonthSummary(state,'2026-12','2026-12-01').rows[0].memberName,'Spouse finance profile');
});

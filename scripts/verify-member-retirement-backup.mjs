#!/usr/bin/env node
// Offline verification only. Never connects to or restores a production database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openTestDatabase} from '../tests/helpers/d1.mjs';
import {ensureFamilySchema} from '../src/server/family-service.ts';
import {currentFamilyApproval} from '../src/domain/family-approval.mjs';
const [beforePath,afterPath]=process.argv.slice(2);if(!beforePath)throw Error('Provide a private backup path and optionally a post-migration backup');
const order=['books','households','household_members','household_invites','accounts','transactions','entries','documents','audit_events','commands'];
async function readAndRestore(filename){
 const backup=JSON.parse(fs.readFileSync(filename,'utf8')), {digest,...data}=backup;
 assert.equal(data.format,'PFC-FAMILY-RETIREMENT-1');assert.equal(createHash('sha256').update(JSON.stringify(data)).digest('hex'),digest,'backup integrity digest');assert.deepEqual(Object.keys(data.tables).sort(),[...order].sort());
 const x=openTestDatabase();await ensureFamilySchema(x.db);const guard=x.sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='command_guard'").get().sql;x.sqlite.exec('DROP TRIGGER command_guard');
 try{
  for(const table of order){const columns=x.sqlite.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);for(const row of data.tables[table]){assert.deepEqual(Object.keys(row).sort(),[...columns].sort(),'complete row schema: '+table);const values=columns.map(c=>table==='transactions'&&c==='status'?'DRAFT':row[c]);x.sqlite.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?')})`).run(...values)}}
  for(const row of data.tables.transactions)x.sqlite.prepare("UPDATE transactions SET status='POSTED' WHERE dataset_id=? AND id=?").run(row.dataset_id,row.id);
  x.sqlite.exec(guard);assert.equal(x.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(x.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(x.sqlite.prepare('SELECT COUNT(*) n FROM (SELECT transaction_id,currency FROM entries GROUP BY dataset_id,transaction_id,currency HAVING SUM(amount_minor)<>0)').get().n,0);
  for(const table of order)assert.equal(x.sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,data.tables[table].length);
 }finally{x.sqlite.close()}
 return backup;
}
const before=await readAndRestore(beforePath);let result={backupDigest:before.digest,restoreVerified:true,counts:Object.fromEntries(order.map(t=>[t,before.tables[t].length]))};
if(afterPath){
 const after=await readAndRestore(afterPath),b=before.tables,a=after.tables,byId=(rows,id)=>rows.find(r=>r.id===id),parseDocs=rows=>rows.map(d=>({...d,payload:JSON.parse(d.payload)}));
 assert.deepEqual(a.transactions,b.transactions,'all original transactions unchanged');assert.deepEqual(a.entries,b.entries,'all journal entries and balances unchanged');assert.deepEqual(a.household_invites,b.household_invites,'invitations preserved');
 for(const table of ['commands','audit_events'])for(const row of b[table]){const key=table==='commands'?'idempotency_key':'id';assert.deepEqual(a[table].find(r=>r[key]===row[key]),row,'historical '+table+' retained')}
 assert.equal(a.books[0].id,b.books[0].id);assert.equal(a.books[0].active_dataset,b.books[0].active_dataset);assert.equal(a.books[0].revision,b.books[0].revision+1);assert.equal(a.books[0].fence,b.books[0].fence+1);
 assert.deepEqual({...a.households[0],revision:b.households[0].revision},b.households[0]);assert.equal(a.households[0].revision,b.households[0].revision+1);
 const source=b.household_members.find(m=>m.active===1&&a.household_members.some(n=>n.user_id===m.user_id&&n.active===0));assert.ok(source,'exact retired member exists');assert.equal(b.household_members.filter(m=>m.active===1).length-a.household_members.filter(m=>m.active===1).length,1);
 for(const row of b.household_members)assert.deepEqual(a.household_members.find(m=>m.user_id===row.user_id),row.user_id===source.user_id?{...row,active:0}:row);
 const docs=parseDocs(a.documents),receipt=docs.find(d=>d.kind==='login_retirement'&&d.payload.retiredUserId===source.user_id);assert.ok(receipt);assert.equal(receipt.payload.backupDigest,before.digest);
 const profile=docs.find(d=>d.id===receipt.payload.profileId);assert.equal(profile.kind,'financial_member');assert.equal(profile.payload.linkedUserId,null);assert.equal(profile.payload.retiredUserId,source.user_id);
 const ownerKeys=['ownerMemberId','ownerSubject','ownerLabel'],without=(obj,keys)=>Object.fromEntries(Object.entries(obj).filter(([key])=>!keys.includes(key)));
 assert.equal(a.accounts.length,b.accounts.length);
 for(const row of b.accounts){const next=byId(a.accounts,row.id);assert.ok(next);assert.deepEqual(without(next,['metadata']),without(row,['metadata']));const om=JSON.parse(row.metadata),nm=JSON.parse(next.metadata);assert.deepEqual(without(nm,ownerKeys),without(om,ownerKeys),'asset details retained');if(row.metadata!==next.metadata){assert.equal(nm.ownerMemberId,profile.id);assert.equal(nm.ownerSubject,null);assert.ok(om.ownerSubject===source.user_id||om.ownerMemberId==='user:'+source.user_id||parseDocs(b.documents).some(d=>d.id===om.ownerMemberId&&d.payload.linkedUserId===source.user_id),'only target ownership changes')}}
 const members=rows=>rows.map(m=>({userId:m.user_id,active:m.active,joinedAt:m.joined_at}));let preservedDecisions=0,pendingReconfirmed=0;
 for(const row of b.documents){const next=byId(a.documents,row.id);assert.ok(next,'every original document retained');assert.equal(next.kind,row.kind);if(row.payload===next.payload)continue;
  const old=JSON.parse(row.payload),now=JSON.parse(next.payload);
  if(row.kind==='financial_member'){assert.equal(next.id,profile.id);assert.deepEqual(without(now,['name','linkedUserId','retiredUserId','retiredAt','retiredBy']),without(old,['name','linkedUserId','retiredUserId','retiredAt','retiredBy']));continue}
  assert.equal(row.kind,'plan','only current plans and the target profile may be amended');assert.deepEqual(without(now,['familyApproval','loginRetirements','budgetStatus','approvedAt']),without(old,['familyApproval','loginRetirements','budgetStatus','approvedAt']));
  assert.deepEqual(now.loginRetirements.at(-1).previousApproval,old.familyApproval,'original approval retained');
  const previous=currentFamilyApproval(old.familyApproval,members(b.household_members),b.households[0].revision),current=currentFamilyApproval(now.familyApproval,members(a.household_members),a.households[0].revision);
  if(['APPROVED','REJECTED'].includes(previous.status)){assert.equal(current.status,previous.status);assert.deepEqual(current.approvals,previous.approvals);assert.deepEqual(current.rejections,previous.rejections);assert.equal(now.approvedAt,old.approvedAt);preservedDecisions++}else{assert.equal(current.status,'PENDING_APPROVAL');assert.deepEqual(current.approvals,[]);assert.ok(!current.required.includes(source.user_id));pendingReconfirmed++}
 }
 result={...result,postBackupDigest:after.digest,allOriginalRecordsRetained:true,journalsAndBalancesUnchanged:true,onlyOneLoginRetired:true,preservedDecisions,pendingReconfirmed,afterCounts:Object.fromEntries(order.map(t=>[t,a[t].length]))};
}
console.log(JSON.stringify(result,null,2));

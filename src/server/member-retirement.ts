import {familyContext,familyWriteGuard,type FamilyUser,type FamilyConfig} from './family-service.ts';
import {buildFinanceMembers,accountMember,captureAccountOwners} from '../domain/member-ownership.mjs';
import {approvalMembershipFingerprint,beginFamilyApproval,currentFamilyApproval} from '../domain/family-approval.mjs';

const columns:Record<string,string[]>={
 books:['id','active_dataset','revision','fence','maintenance_until'],
 households:['id','name','owner_subject','book_id','revision','created_at'],
 household_members:['household_id','user_id','display_name','role','active','joined_at'],
 household_invites:['id','household_id','token_hash','expires_at','status','accepted_by','created_at'],
 accounts:['dataset_id','id','name','kind','category','currency','archived','metadata'],
 transactions:['dataset_id','id','kind','status','total_minor','original_id','business_date','metadata'],
 entries:['dataset_id','transaction_id','account_id','currency','amount_minor'],
 commands:['book_id','dataset_id','idempotency_key','request_hash','expected_revision','expected_fence','now_ms','result_json'],
 documents:['dataset_id','id','kind','payload'],audit_events:['dataset_id','id','created_at','actor_ref','action','payload']
};
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function administrator(db:any,user:FamilyUser,config:FamilyConfig){const scope=await familyContext(db,user,config);if(!scope?.canWrite)throw Error('仅家庭管理员可备份或停用登录');return scope;}
export async function createRetirementBackup(db:any,user:FamilyUser,config:FamilyConfig={}){
 const scope=await administrator(db,user,config);
 const tables=Object.entries(columns).map(([table,keys])=>{
  const where=table==='books'?`${table}.id=b.id`:table==='households'?`${table}.id=h.id`:table.startsWith('household_')?`${table}.household_id=h.id`:`${table}.dataset_id=b.active_dataset${table==='commands'?` AND ${table}.book_id=b.id`:''}`;
  return `'${table}',json((SELECT COALESCE(json_group_array(json_object(${keys.map(k=>`'${k}',${k}`).join(',')})),'[]') FROM (SELECT * FROM ${table} WHERE ${where} ORDER BY rowid)))`;
 }).join(',');
 // A single SQL read includes all rows and long JSON values; UI snapshot limits do not apply.
 const row=await db.prepare(`SELECT json_object('format','PFC-FAMILY-RETIREMENT-1','tables',json_object(${tables})) AS payload FROM books b JOIN households h ON h.book_id=b.id WHERE b.id=? AND h.id=? AND h.owner_subject=? AND EXISTS(SELECT 1 FROM household_members m WHERE m.household_id=h.id AND m.user_id=? AND m.active=1 AND m.role='owner')`).bind(scope.bookId,scope.householdId,user.userId,user.userId).first();
 if(!row||typeof row.payload!=='string'||row.payload.length>25000000)throw Error('无法生成完整备份，请使用数据库级备份');
 const value=JSON.parse(row.payload);return {...value,digest:await digest(row.payload)};
}
export async function retireFamilyLogin(db:any,user:FamilyUser,input:any,config:FamilyConfig={}){
 const scope=await administrator(db,user,config);
 if(input?.confirmed!==true||typeof input.userId!=='string'||input.userId===user.userId||typeof input.backupDigest!=='string'||!/^[a-f0-9]{64}$/.test(input.backupDigest))throw Error('请先下载完整备份并确认停用其他成员登录');
 const backup=await createRetirementBackup(db,user,config),tables=backup.tables,book=tables.books[0],family=tables.households[0],receiptId='login-retirement:'+input.userId;
 const previous=tables.documents.find((d:any)=>d.id===receiptId&&d.kind==='login_retirement');
 if(previous){const receipt=JSON.parse(previous.payload);if(receipt.backupDigest!==input.backupDigest)throw Error('该登录已停用，请核对原迁移回执');return receipt.result;}
 if(backup.digest!==input.backupDigest)throw Error('CONFLICT:账本或家庭状态已变化，请重新下载完整备份');
 const target=tables.household_members.find((m:any)=>m.user_id===input.userId&&m.active===1&&m.role!=='owner');if(!target)throw Error('请选择本家庭有效的非管理员登录成员');
 const name=String(input.name??target.display_name).trim();if(!name||name.length>60||['家庭共用','归属待确认'].includes(name))throw Error('请填写有效的记账成员称呼');
 const ds=book.active_dataset,now=new Date().toISOString(),migrationId=crypto.randomUUID();
 const documents=tables.documents.map((d:any)=>({...d,payload:JSON.parse(d.payload)}));
 const linked=documents.filter((d:any)=>d.kind==='financial_member'&&d.payload.linkedUserId===target.user_id);if(linked.length>1)throw Error('成员档案关联异常，请先核对');
 const profileId=linked[0]?.id??'person:'+crypto.randomUUID(),oldProfile=linked[0]?.payload??{};
 const members=tables.household_members.map((m:any)=>({userId:m.user_id,displayName:m.display_name,active:m.active===1,role:m.role,joinedAt:m.joined_at})),remaining=members.map((m:any)=>m.userId===target.user_id?{...m,active:false}:m);
 const state:any={accounts:tables.accounts.map((a:any)=>({...a,metadata:JSON.parse(a.metadata)})),documents,householdMembers:members};state.financeMembers=buildFinanceMembers(state,members);
 const guard=familyWriteGuard(db,scope,family.revision),result={ok:true,profileId,retiredUserId:target.user_id,backupDigest:backup.digest,migrationId,retiredAt:now};
 const statements=[guard.statement,db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)').bind(book.id,ds,'retire-login:'+migrationId,backup.digest,book.revision,book.fence,Date.now(),JSON.stringify(result))];
 const put=(id:string,kind:string,payload:any)=>statements.push(db.prepare('INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(dataset_id,id) DO UPDATE SET payload=excluded.payload').bind(ds,id,kind,JSON.stringify(payload)));
 // Old identities remain aliases for reporting, never login authorization or voting rights.
 put(profileId,'financial_member',{...oldProfile,id:profileId,name,linkedUserId:null,retiredUserId:target.user_id,retiredAt:now,retiredBy:user.userId});
 const owned=state.accounts.filter((a:any)=>a.category!=='system'&&accountMember(a,state).userId===target.user_id),ownedIds=new Set(owned.map((a:any)=>a.id));
 for(const a of owned)statements.push(db.prepare('UPDATE accounts SET metadata=? WHERE dataset_id=? AND id=?').bind(JSON.stringify({...a.metadata,ownerMemberId:profileId,ownerSubject:null,ownerLabel:name}),ds,a.id));
 // Preserve inferred historical ownership before current metadata changes; posted journals are immutable.
 for(const t of tables.transactions){const meta=JSON.parse(t.metadata);if(t.status!=='POSTED'||Array.isArray(meta.accountOwners)||documents.some((d:any)=>d.id==='transaction-ownership:'+t.id))continue;
  const entries=tables.entries.filter((e:any)=>e.transaction_id===t.id).map((e:any)=>({...e,amount:e.amount_minor}));
  const owners=captureAccountOwners(state,entries,meta);if(owners.some((o:any)=>ownedIds.has(o.accountId)))put('transaction-ownership:'+t.id,'transaction_ownership',{transactionId:t.id,accountOwners:owners,ownershipInferred:true,capturedAt:now});
 }
 let preservedDecisions=0,restartedApprovals=0;
 for(const d of documents.filter((d:any)=>d.kind==='plan'&&d.payload.familyApproval)){
  const old=d.payload,approval=currentFamilyApproval(old.familyApproval,members,family.revision);
  const history=[...(old.loginRetirements??[]),{migrationId,retiredUserId:target.user_id,at:now,previousApproval:old.familyApproval}];
  if(['APPROVED','REJECTED'].includes(approval.status)){
   preservedDecisions++;put(d.id,d.kind,{...old,loginRetirements:history,familyApproval:{...approval,retirementCompatibility:{migrationId,status:approval.status,membershipFingerprint:approvalMembershipFingerprint(remaining)}}});
  }else{
   restartedApprovals++;const next=beginFamilyApproval((approval.version??0)+1,remaining,null,now,family.revision+1);
   put(d.id,d.kind,{...old,loginRetirements:history,familyApproval:next,budgetStatus:next.status,approvedAt:null});
  }
 }
 put(receiptId,'login_retirement',{...result,result,sourceDisplayName:target.display_name,preservedDecisions,restartedApprovals,accountCount:owned.length,backupCounts:Object.fromEntries(Object.entries(tables).map(([k,v]:any)=>[k,v.length]))});
 statements.push(db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(ds,migrationId,now,user.userId,'family.login.retire',JSON.stringify({sourceUserId:target.user_id,profileId,backupDigest:backup.digest,preservedDecisions,restartedApprovals,accountCount:owned.length})),
  db.prepare('UPDATE household_members SET active=0 WHERE household_id=? AND user_id=?').bind(scope.householdId,target.user_id),
  db.prepare('UPDATE households SET revision=revision+1 WHERE id=?').bind(scope.householdId),
  db.prepare('UPDATE books SET revision=revision+1,fence=fence+1 WHERE id=?').bind(book.id),
  db.prepare('DELETE FROM household_guards WHERE id=?').bind(guard.id));
 try{await db.batch(statements)}catch{throw Error('CONFLICT:迁移未执行，原数据保持不变；请刷新并重新备份');}
 return result;
}

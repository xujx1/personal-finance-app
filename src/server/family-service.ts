export type FamilyUser={userId:string;displayName?:string;email?:string};
export type FamilyConfig={ownerSubject?:string;bootstrapOwnerEmail?:string;restrictCreation?:boolean};
export type FamilyScope={householdId:string;bookId:string;ownerSubject:string;userId:string;name:string;revision:number;canWrite:boolean};
const schema=[
 `CREATE TABLE IF NOT EXISTS households(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner_subject TEXT NOT NULL,book_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS household_members(household_id TEXT NOT NULL REFERENCES households(id),user_id TEXT NOT NULL,display_name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('owner','viewer')),active INTEGER NOT NULL CHECK(active IN(0,1)),joined_at INTEGER NOT NULL,PRIMARY KEY(household_id,user_id))`,
 `CREATE UNIQUE INDEX IF NOT EXISTS household_one_active ON household_members(user_id) WHERE active=1`,
 `CREATE TABLE IF NOT EXISTS household_invites(id TEXT PRIMARY KEY,household_id TEXT NOT NULL REFERENCES households(id),token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN('pending','revoked','accepted')),accepted_by TEXT,created_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS household_guards(id TEXT PRIMARY KEY,allowed INTEGER NOT NULL CHECK(allowed=1))`
];
const initialized=new WeakMap<object,Promise<void>>();
export async function ensureFamilySchema(db:any){let p=initialized.get(db);if(!p){p=(async()=>{for(const sql of schema)await db.prepare(sql).run()})();initialized.set(db,p);p.catch(()=>initialized.delete(db))}await p}
const hash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const name=(v:any)=>{if(typeof v!=='string'||!v.trim()||v.length>60)throw Error('名称需为1—60个字符');return v.trim()};
const display=(u:FamilyUser)=>String(u.displayName??'家庭成员').slice(0,100);
async function active(db:any,userId:string):Promise<FamilyScope|null>{const r=await db.prepare(`SELECT h.*,m.role FROM households h JOIN household_members m ON m.household_id=h.id WHERE m.user_id=? AND m.active=1`).bind(userId).first();return r?{householdId:r.id,bookId:r.book_id,ownerSubject:r.owner_subject,userId,name:r.name,revision:r.revision,canWrite:r.role==='owner'&&r.owner_subject===userId}:null}
export async function familyContext(db:any,user:FamilyUser,config:FamilyConfig={}):Promise<FamilyScope|null>{
 await ensureFamilySchema(db);let c=await active(db,user.userId);if(c)return c;
 const trusted=config.ownerSubject?config.ownerSubject===user.userId:Boolean(config.bootstrapOwnerEmail&&user.email&&config.bootstrapOwnerEmail.trim().toLowerCase()===user.email.trim().toLowerCase());
 if(trusted){await db.batch([
  db.prepare(`INSERT OR IGNORE INTO households VALUES('legacy-personal','我的家庭',?,'personal',0,?)`).bind(user.userId,Date.now()),
  db.prepare(`INSERT OR IGNORE INTO household_members SELECT id,?,?,'owner',1,? FROM households WHERE id='legacy-personal' AND owner_subject=? AND NOT EXISTS(SELECT 1 FROM household_members WHERE user_id=? AND active=1)`).bind(user.userId,display(user),Date.now(),user.userId,user.userId)
 ,db.prepare("UPDATE accounts SET metadata=json_set(metadata,'$.ownerSubject',?,'$.ownerLabel',?) WHERE dataset_id=(SELECT active_dataset FROM books WHERE id='personal') AND category<>'system' AND json_extract(metadata,'$.ownerSubject') IS NULL AND EXISTS(SELECT 1 FROM households WHERE id='legacy-personal' AND owner_subject=?)").bind(user.userId,display(user),user.userId)
 ]);c=await active(db,user.userId)}return c;
}
export function familyWriteGuard(db:any,scope:FamilyScope,revision?:number){
 const id=crypto.randomUUID();return {id,statement:db.prepare(`INSERT INTO household_guards SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM households h JOIN household_members m ON m.household_id=h.id WHERE h.id=? AND h.book_id=? AND h.owner_subject=? AND m.user_id=? AND m.active=1 AND m.role='owner'${revision===undefined?'':' AND h.revision=?'}) THEN 1 ELSE 0 END`).bind(id,scope.householdId,scope.bookId,scope.userId,scope.userId,...(revision===undefined?[]:[revision]))};
}
async function commit(db:any,statements:any[]){try{await db.batch(statements)}catch{throw Error('权限、成员或家庭状态已变化，请刷新后重试')}}
export async function familyView(db:any,user:FamilyUser,config:FamilyConfig={}){
 const c=await familyContext(db,user,config);if(!c)return {family:null,members:[],invites:[],userId:user.userId};
 const members=await db.prepare('SELECT user_id AS userId,display_name AS displayName,role,joined_at AS joinedAt FROM household_members WHERE household_id=? AND active=1 ORDER BY joined_at,user_id').bind(c.householdId).all();
 const invites=c.canWrite?(await db.prepare('SELECT id,expires_at AS expiresAt,status,created_at AS createdAt FROM household_invites WHERE household_id=? ORDER BY created_at DESC LIMIT 40').bind(c.householdId).all()).results:[];
 return {family:{id:c.householdId,name:c.name,revision:c.revision,canManage:c.canWrite,role:c.canWrite?'owner':'viewer'},members:members.results,invites,userId:user.userId};
}
export async function familyCommand(db:any,user:FamilyUser,p:any,config:FamilyConfig={}){
 await ensureFamilySchema(db);const c=await familyContext(db,user,config),now=Date.now();
 if(p.action==='create'){
  if(config.restrictCreation)throw Error('此站点请通过家庭邀请加入');
  if(c)throw Error('已经加入家庭，请先退出当前家庭');const id=crypto.randomUUID(),bookId='family:'+id;
  await commit(db,[db.prepare('INSERT INTO households VALUES(?,?,?,?,0,?)').bind(id,name(p.name),user.userId,bookId,now),db.prepare("INSERT INTO household_members VALUES(?,?,?,'owner',1,?)").bind(id,user.userId,display(user),now)]);return {householdId:id};
 }
 if(p.action==='accept'){
  if(typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token))throw Error('邀请链接无效');const tokenHash=await hash(p.token),i=await db.prepare('SELECT * FROM household_invites WHERE token_hash=?').bind(tokenHash).first();
  if(i?.status==='accepted'&&i.accepted_by===user.userId&&c&&c.householdId===i.household_id)return {householdId:c.householdId};
  if(c)throw Error('已在一个家庭中，请先退出再接受其他邀请');if(!i||i.status!=='pending'||i.expires_at<=now)throw Error('邀请已过期、已撤销或已使用');
  const guardId=crypto.randomUUID();await commit(db,[
   db.prepare(`INSERT INTO household_guards SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM household_invites WHERE id=? AND token_hash=? AND status='pending' AND expires_at>?) AND NOT EXISTS(SELECT 1 FROM household_members WHERE user_id=? AND active=1) THEN 1 ELSE 0 END`).bind(guardId,i.id,tokenHash,now,user.userId),
   db.prepare("INSERT INTO household_members VALUES(?,?,?,'viewer',1,?) ON CONFLICT(household_id,user_id) DO UPDATE SET display_name=excluded.display_name,role='viewer',active=1,joined_at=MAX(household_members.joined_at+1,excluded.joined_at)").bind(i.household_id,user.userId,display(user),now),
   db.prepare("UPDATE household_invites SET status='accepted',accepted_by=? WHERE id=? AND status='pending'").bind(user.userId,i.id),
   db.prepare('UPDATE households SET revision=revision+1 WHERE id=?').bind(i.household_id),db.prepare('DELETE FROM household_guards WHERE id=?').bind(guardId)
  ]);return {householdId:i.household_id};
 }
 if(!c)throw Error('尚未加入家庭');
 if(p.action==='leave'){
  if(c.canWrite)throw Error('管理员须先转移管理权限才能退出');await commit(db,[db.prepare("UPDATE household_members SET active=0 WHERE household_id=? AND user_id=? AND role='viewer'").bind(c.householdId,user.userId),db.prepare('UPDATE households SET revision=revision+1 WHERE id=?').bind(c.householdId)]);return {left:true};
 }
 if(!c.canWrite)throw Error('仅家庭管理员可以维护家庭和邀请');if(!Number.isInteger(p.revision)||p.revision!==c.revision)throw Error('家庭状态已变化，请刷新');
 const guard=familyWriteGuard(db,c,p.revision),statements=[guard.statement];let result:any={ok:true};
 if(p.action==='rename')statements.push(db.prepare('UPDATE households SET name=? WHERE id=?').bind(name(p.name),c.householdId));
 else if(p.action==='invite'){
  const count=await db.prepare("SELECT COUNT(*) AS n FROM household_invites WHERE household_id=? AND status='pending' AND expires_at>?").bind(c.householdId,now).first();if(count.n>=20)throw Error('有效邀请最多20个，请先撤销旧邀请');
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID(),expiresAt=now+7*86400000;
  statements.push(db.prepare("INSERT INTO household_invites VALUES(?,?,?,?,'pending',NULL,?)").bind(id,c.householdId,await hash(token),expiresAt,now));result={id,token,expiresAt};
 }else if(p.action==='revoke')statements.push(db.prepare("UPDATE household_invites SET status='revoked' WHERE id=? AND household_id=? AND status='pending'").bind(String(p.inviteId),c.householdId));
 else if(p.action==='remove'||p.action==='transfer'){
  if(typeof p.userId!=='string'||p.userId===user.userId)throw Error('请选择其他家庭成员');const target=await db.prepare('SELECT 1 FROM household_members WHERE household_id=? AND user_id=? AND active=1').bind(c.householdId,p.userId).first();if(!target)throw Error('成员不存在');
  if(p.action==='remove')statements.push(db.prepare('UPDATE household_members SET active=0 WHERE household_id=? AND user_id=?').bind(c.householdId,p.userId));
  else statements.push(db.prepare("UPDATE household_members SET role='viewer' WHERE household_id=? AND user_id=?").bind(c.householdId,user.userId),db.prepare("UPDATE household_members SET role='owner' WHERE household_id=? AND user_id=? AND active=1").bind(c.householdId,p.userId),db.prepare('UPDATE households SET owner_subject=? WHERE id=?').bind(p.userId,c.householdId));
 }else throw Error('家庭操作无效');
 statements.push(db.prepare('UPDATE households SET revision=revision+1 WHERE id=?').bind(c.householdId),db.prepare('DELETE FROM household_guards WHERE id=?').bind(guard.id));await commit(db,statements);return result;
}
export async function previewFamilyInvite(db:any,token:any){
 await ensureFamilySchema(db);if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('邀请链接无效');
 const i=await db.prepare("SELECT h.name,i.expires_at AS expiresAt FROM household_invites i JOIN households h ON h.id=i.household_id WHERE i.token_hash=? AND i.status='pending' AND i.expires_at>?").bind(await hash(token),Date.now()).first();if(!i)throw Error('邀请已过期、已撤销或已使用');return {name:i.name,expiresAt:i.expiresAt};
}

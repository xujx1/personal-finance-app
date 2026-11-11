import {familyWriteGuard,type FamilyScope} from './family-service.ts';
export function scopeDb(db:any,scope:FamilyScope){return {prepare:(sql:string)=>db.prepare(sql),batch:(s:any[])=>db.batch(s),ledgerScope:scope};}
export function ledgerBookId(db:any):string{return db.ledgerScope?.bookId??'personal'}
export async function assertLedgerAccess(db:any,write=false){
 const c:FamilyScope|undefined=db.ledgerScope;if(!c)return;
 const r=await db.prepare(`SELECT h.owner_subject,m.role FROM households h JOIN household_members m ON m.household_id=h.id WHERE h.id=? AND h.book_id=? AND m.user_id=? AND m.active=1`).bind(c.householdId,c.bookId,c.userId).first();
 if(!r)throw Error('家庭成员权限已失效，请重新加载');if(write&&(r.role!=='owner'||r.owner_subject!==c.userId))throw Error('当前家庭成员只读，无修改权限');
}
export function ledgerWriteGuard(db:any,approvalOnly=false,revision?:number){
 const c=db.ledgerScope;if(!c)return null;if(!approvalOnly)return familyWriteGuard(db,c,revision);
 const id=crypto.randomUUID();return {id,statement:db.prepare(`INSERT INTO household_guards SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM households h JOIN household_members m ON m.household_id=h.id WHERE h.id=? AND h.book_id=? AND h.revision=? AND m.user_id=? AND m.active=1) THEN 1 ELSE 0 END`).bind(id,c.householdId,c.bookId,revision??c.revision,c.userId)};
}

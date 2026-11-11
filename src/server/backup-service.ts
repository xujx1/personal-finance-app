import {ensureBook} from './finance-store.ts';
const columns:any={accounts:['dataset_id','id','name','kind','category','currency','archived','metadata'],transactions:['dataset_id','id','kind','status','total_minor','original_id','business_date','metadata'],entries:['dataset_id','transaction_id','account_id','currency','amount_minor'],commands:['book_id','dataset_id','idempotency_key','request_hash','expected_revision','expected_fence','now_ms','result_json'],documents:['dataset_id','id','kind','payload'],audit_events:['dataset_id','id','created_at','actor_ref','action','payload']};
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
const from64=(s:string)=>{if(typeof s!=='string'||s.length>15000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('备份编码无效');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
async function key(password:string,salt:Uint8Array){if(typeof password!=='string'||password.length<12||password.length>300)throw Error('备份密码需12–300个字符');const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function exportBackup(db:any,password:string){
 await ensureBook(db);const tables=Object.entries(columns).map(([t,c]:any)=>`'${t}',json((SELECT COALESCE(json_group_array(json_object(${c.map((x:string)=>`'${x}',${x}`).join(',')})),'[]') FROM ${t} WHERE ${t}.dataset_id=b.active_dataset))`).join(',');
 // One SQLite statement observes one consistent read snapshot; runtime_cache and credentials are excluded.
 const row=await db.prepare(`SELECT json_object('format',1,'revision',b.revision,'createdAt',datetime('now'),'tables',json_object(${tables})) AS payload FROM books b WHERE id='personal'`).first();
 if(row.payload.length>10000000)throw Error('备份超过10MB，请使用部署文档中的数据库级备份流程');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('PFC-BACKUP-1')},await key(password,salt),enc.encode(row.payload));return {format:'PFC-ENCRYPTED-1',kdf:'PBKDF2-SHA256-210000',salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};
}
export async function restoreBackup(db:any,backup:any,password:string,command:any){
 if(!backup||backup.format!=='PFC-ENCRYPTED-1'||backup.kdf!=='PBKDF2-SHA256-210000'||typeof command.key!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(command.key))throw Error('备份或恢复标识无效');
 const book=await ensureBook(db),fingerprint=await digest(JSON.stringify(backup));
 const cached=await db.prepare("SELECT * FROM commands WHERE book_id='personal' AND dataset_id=? AND idempotency_key=?").bind(book.active_dataset,command.key).first();if(cached){if(cached.request_hash!==fingerprint)throw Error('恢复请求标识冲突');return JSON.parse(cached.result_json)}
 if(command.revision!==book.revision)throw Error('CONFLICT:账本已变化，请重新核对后恢复');
 let payload:any;try{const iv=from64(backup.iv),salt=from64(backup.salt);if(iv.length!==12||salt.length!==16)throw Error();const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode('PFC-BACKUP-1')},await key(password,salt),from64(backup.ciphertext));if(plain.byteLength>10000000)throw Error();payload=JSON.parse(dec.decode(plain))}catch{throw Error('备份密码错误或文件已损坏')}
 if(payload.format!==1||!payload.tables)throw Error('备份版本无效');for(const t of Object.keys(columns))if(!Array.isArray(payload.tables[t])||payload.tables[t].length>12000)throw Error('备份表无效或超出单次恢复上限');
 const {tables}=payload;if(tables.transactions.length>2000)throw Error('单次最多恢复2000笔，较大账本使用数据库级恢复');
 const dataset='restore-'+crypto.randomUUID(),now=Date.now(),result={ok:true,dataset,restoredAt:new Date().toISOString()};
 const statements=[db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)').bind('personal',book.active_dataset,'restore-guard-'+crypto.randomUUID(),fingerprint,book.revision,book.fence,now,'{}')];
 const insert=(t:string,row:any)=>{const c=columns[t],v=c.map((x:string)=>x==='dataset_id'?dataset:row[x]);if(v.some((x:any)=>x===undefined))throw Error('备份缺少必需字段');statements.push(db.prepare(`INSERT INTO ${t}(${c.join(',')}) VALUES(${c.map(()=>'?').join(',')})`).bind(...v))};
 for(const r of tables.accounts)insert('accounts',r);
 for(const r of tables.transactions){if(r.status!=='POSTED')throw Error('备份包含未过账交易');insert('transactions',{...r,status:'DRAFT'})}
 for(const r of tables.entries)insert('entries',r);
 for(const r of tables.transactions)statements.push(db.prepare("UPDATE transactions SET status='POSTED' WHERE dataset_id=? AND id=?").bind(dataset,r.id));
 for(const t of ['documents','audit_events'])for(const r of tables[t])insert(t,r);
 statements.push(db.prepare("UPDATE books SET active_dataset=?,revision=revision+1,fence=fence+1,maintenance_until=0 WHERE id='personal'").bind(dataset));
 for(const r of tables.commands)if(r.idempotency_key!==command.key)insert('commands',{...r,book_id:'personal',expected_revision:book.revision+1,expected_fence:book.fence+1,now_ms:now});
 insert('commands',{book_id:'personal',idempotency_key:command.key,request_hash:fingerprint,expected_revision:book.revision+1,expected_fence:book.fence+1,now_ms:now,result_json:JSON.stringify(result)});
 try{await db.batch(statements)}catch{const receipt=await db.prepare("SELECT result_json FROM commands WHERE book_id='personal' AND dataset_id=? AND idempotency_key=?").bind(dataset,command.key).first();if(receipt)return JSON.parse(receipt.result_json);throw Error('恢复未完成；原活动账本保持不变，请刷新后核对')}
 return result;
}

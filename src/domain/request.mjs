const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const commandHash=async(action,body)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical({action,body})))))).map(x=>x.toString(16).padStart(2,'0')).join('');
export class CommandTracker {
 constructor(storage){this.storage=storage;this.pending=null;try{this.pending=JSON.parse(storage?.getItem('finance-pending-command')??'null')}catch{}}
 async matches(action,body){return Boolean(this.pending&&this.pending.hash===await commandHash(action,body));}
 async prepare(action,body,revision){const hash=await commandHash(action,body);if(this.pending&&this.pending.hash!==hash)throw Error('上一笔保存结果尚未确认，请先重试原操作或刷新核实。');if(!this.pending){this.pending={key:crypto.randomUUID(),hash,action};this.storage?.setItem('finance-pending-command',JSON.stringify(this.pending));}return{key:this.pending.key,action,body,revision};}
 complete(){this.pending=null;this.storage?.removeItem('finance-pending-command');}
}

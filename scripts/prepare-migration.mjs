import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const source=readFileSync('db/ledger.sql','utf8');
const sql=source.replace(/;\n(?=CREATE |PRAGMA )/g,';\n--> statement-breakpoint\n');
const target='drizzle/0000_personal_ledger.sql';
if(existsSync(target)&&readFileSync(target,'utf8')!==sql)throw Error('Existing migration is immutable. Add a new numbered migration for schema changes.');
mkdirSync('drizzle/meta',{recursive:true});
writeFileSync(target,sql);
const journal='drizzle/meta/_journal.json';
const current=existsSync(journal)?JSON.parse(readFileSync(journal,'utf8')):{version:'7',dialect:'sqlite',entries:[]};
if(!current.entries.some(e=>e.tag==='0000_personal_ledger')){if(current.entries.length)throw Error('Unexpected migration journal; inspect before adding initial migration.');current.entries.push({idx:0,version:'6',when:Date.parse('2026-11-11T00:00:00Z'),tag:'0000_personal_ledger',breakpoints:true});writeFileSync(journal,JSON.stringify(current,null,2)+'\n');}
console.log('Initial ledger migration ready; existing migrations preserved.');

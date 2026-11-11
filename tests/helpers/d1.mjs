import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function openTestDatabase(filename=':memory:') {
 const sqlite=new DatabaseSync(filename);
 try{sqlite.exec('PRAGMA foreign_keys=ON');if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='books'").get())sqlite.exec(readFileSync(new URL('../../db/ledger.sql',import.meta.url),'utf8'));}catch(e){sqlite.close();throw e;}
 const db={prepare(sql){let args=[];const s={bind(...v){args=v;return s;},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return{results:sqlite.prepare(sql).all(...args)};},async run(){return sqlite.prepare(sql).run(...args);}};return s;},async batch(stmts){sqlite.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {db,sqlite};
}

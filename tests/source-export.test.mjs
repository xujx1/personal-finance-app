import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const script=path.resolve('scripts/export-source.py');
function fixture(t){const temp=mkdtempSync(path.join(tmpdir(),'source-export-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));const root=path.join(temp,'repo');mkdirSync(root);const put=(name,value='fake-private-content')=>{const target=path.join(root,name);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,value);};return {temp,root,put};}
function exportZip(root,output){const run=spawnSync('python3',[script,'--root',root,'--output',output],{encoding:'utf8'});assert.equal(run.status,0,run.stderr||run.stdout);}
function inspect(file){const run=spawnSync('python3',['-c',String.raw`import hashlib,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
 names=archive.namelist()
 manifest=json.loads(archive.read('SOURCE-MANIFEST.json'))
 valid=all(entry['sha256']==hashlib.sha256(archive.read(entry['path'])).hexdigest() and entry['size']==len(archive.read(entry['path'])) for entry in manifest['files'])
 print(json.dumps({'names':names,'manifest':manifest,'valid':valid,'env':archive.read('.env.example').decode() if '.env.example' in names else None,'hosting':json.loads(archive.read('.openai/hosting.json')) if '.openai/hosting.json' in names else None,'envExamples':{name:archive.read(name).decode() for name in names if name.lower().split('/')[-1]=='.env.example'}}))`,file],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);return JSON.parse(run.stdout);}

test('source export includes allowlisted source and schema while excluding secrets runtime data keys archives and symlinks',t=>{
 const {temp,root,put}=fixture(t);
 const included=['worker/index.ts','vendor/shadcn.css','vendor/LICENSE.md','examples/d1/db/schema.ts','cloudflare-env.d.ts','hooks/use-mobile.ts','app/page.tsx','components/Card.tsx','db/ledger.sql','drizzle/0000.sql','lib/util.ts','local/start.mjs','local/server.mjs','src/domain/calc.mjs','scripts/build.mjs','tests/calc.test.mjs','docs/README.md','public/logo.svg','package.json','package-lock.json','tsconfig.json','vite.config.ts','README.md','LICENSE'];
 for(const name of included)put(name,name==='package.json'?'{}':'source fixture');
 const blocked=['.env','.env.local','.env.production','HANDOFF-MANIFEST.json','unknown-private.txt','tsconfig.tsbuildinfo','node_modules/fake/index.js','.git/config','.sites-runtime/live.sqlite','.wrangler/state/db.sqlite','work/data.json','outputs/financial.csv','dist/index.js','.next/cache/data.json','.vinext/server.js','.idea/workspace.xml','.agents/private.md','.codex/session.json','src/.env','src/account.sqlite3','db/ledger.db','db/backup.sql','db/ledger-backup-2026.sql','src/credentials.txt','db/account.sqlite-wal','docs/private-key.pem','docs/archive.zip','docs/backup.bak','src/trace.log','src/backups/data.json','src/BACKUPS/data.json','src/Secrets/data.json','src/id_rsa','public/local.key','src/secrets/data.json'];
 for(const name of blocked)put(name);
 const outside=path.join(temp,'outside-secret.txt');writeFileSync(outside,'fake-outside-secret');symlinkSync(outside,path.join(root,'src/linked.ts'));symlinkSync(path.join(temp),path.join(root,'components/linked-directory'));
 const output=path.join(temp,'source.zip');exportZip(root,output);const zip=inspect(output);
 for(const name of blocked)assert.equal(zip.names.includes(name),false,name);
 for(const name of included)assert.equal(zip.names.includes(name),true,name);
 assert.equal(zip.names.includes('src/linked.ts'),false);assert.equal(zip.names.some(name=>name.includes('linked-directory')),false);
 assert.ok(zip.names.includes('db/ledger.sql'));assert.ok(zip.names.includes('src/domain/calc.mjs'));assert.ok(zip.names.includes('vite.config.ts'));
 assert.equal(zip.valid,true);
 assert.deepEqual(zip.manifest.files.map(entry=>entry.path).sort(),zip.names.filter(name=>name!=='SOURCE-MANIFEST.json').sort());
});

test('source export removes every env example value and restricts hosting metadata to safe resource fields',t=>{
 const {temp,root,put}=fixture(t);
 put('package.json','{}');put('docs/.ENV.EXAMPLE','TOKEN=uppercase-fake-secret\n');put('.env.example','# fake-secret-in-comment\nNEW_API_KEY=sk-fake-secret\nexport OWNER_SUBJECT_ID="private-owner"\nPORT=5173\nTOKEN="multiline\nprivate-value"\n');
 put('.openai/hosting.json',JSON.stringify({project_id:'project-fixture',token:'fake-host-token',credentials:{secret:'fake-secret'},static:{directory:'dist/client',token:'fake-static-token'},d1:[{binding:'DB',database_name:'fixture-db',database_id:'fixture-id',api_key:'fake-db-key'}],r2:[{binding:'FILES',bucket_name:'fixture-bucket',secret_access_key:'fake-storage-secret'}],capabilities:['d1','r2'],plugins:[{id:'plugin-fixture',token:'fake-plugin-token'}],connectors:[{name:'connector-fixture',client_secret:'fake-connector-secret'}]}));
 const output=path.join(temp,'source.zip');exportZip(root,output);const zip=inspect(output);
 assert.match(zip.env,/NEW_API_KEY=\n/);assert.match(zip.env,/OWNER_SUBJECT_ID=\n/);assert.match(zip.env,/PORT=\n/);
 for(const value of ['sk-fake-secret','private-owner','private-value','fake-secret-in-comment','5173'])assert.equal(zip.env.includes(value),false,value);
 assert.equal(JSON.stringify(zip.envExamples).includes('uppercase-fake-secret'),false);
 assert.equal(zip.hosting.project_id,'project-fixture');assert.equal(zip.hosting.static.directory,'dist/client');assert.equal(zip.hosting.d1[0].binding,'DB');assert.equal(zip.hosting.r2[0].bucket_name,'fixture-bucket');
 assert.deepEqual(Object.keys(zip.hosting).sort(),['capabilities','connectors','d1','plugins','project_id','r2','static']);
 assert.equal(JSON.stringify(zip.hosting).includes('fake-'),false);
 assert.equal(zip.valid,true);
});

test('source archives are deterministic and an output inside root never includes itself or stale manifests',t=>{
 const {temp,root,put}=fixture(t);put('package.json','{}');put('src/main.ts','export const value=1;');put('docs/HANDOFF-MANIFEST.json','stale');put('src/SOURCE-MANIFEST.json','must replace');
 const output=path.join(root,'outputs','source.zip');exportZip(root,output);const first=readFileSync(output);exportZip(root,output);const second=readFileSync(output);
 assert.equal(createHash('sha256').update(first).digest('hex'),createHash('sha256').update(second).digest('hex'));
 const outside=path.join(temp,'second.zip');exportZip(root,outside);assert.deepEqual(second,readFileSync(outside));
 const zip=inspect(output);assert.equal(zip.names.some(name=>name.endsWith('.zip')||name.endsWith('HANDOFF-MANIFEST.json')||name==='src/SOURCE-MANIFEST.json'),false);assert.equal(zip.valid,true);
});


test('exported archive retains the documented local startup command and its relative server module',t=>{
 const {temp,root,put}=fixture(t);
 put('package.json',JSON.stringify({type:'module',scripts:{'dev:local':'node local/start.mjs'}}));
 put('local/start.mjs',"import {ready} from './server.mjs'; console.log(ready);\n");
 put('local/server.mjs',"export const ready='packaged local startup ready';\n");
 put('local/.env.local','TOKEN=fake-secret');put('local/state.sqlite','fake-financial-data');
 const archive=path.join(temp,'source.zip'),extracted=path.join(temp,'extracted');
 exportZip(root,archive);
 const unzip=spawnSync('python3',['-c','import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',archive,extracted],{encoding:'utf8'});
 assert.equal(unzip.status,0,unzip.stderr);
 const run=spawnSync('npm',['run','dev:local','--silent'],{cwd:extracted,encoding:'utf8',timeout:5000});
 assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'packaged local startup ready');
 const zip=inspect(archive);assert.equal(zip.names.includes('local/.env.local'),false);assert.equal(zip.names.includes('local/state.sqlite'),false);
});

test('source export preserves actual Sites string and null bindings needed for typecheck',t=>{const {temp,root,put}=fixture(t);put('package.json','{}');put('.openai/hosting.json',JSON.stringify({project_id:'fixture',d1:'DB',r2:null,capabilities:['mcp'],secret:'blocked'}));const file=path.join(temp,'source.zip');exportZip(root,file);const zip=inspect(file);assert.equal(zip.hosting.d1,'DB');assert.equal(zip.hosting.r2,null);assert.equal('secret' in zip.hosting,false);});

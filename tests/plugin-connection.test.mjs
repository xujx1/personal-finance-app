import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {financePluginFiles,financeMarketplace} from '../src/domain/plugin-package.mjs';
import {openTestDatabase} from './helpers/d1.mjs';
import {familyContext,familyCommand} from '../src/server/family-service.ts';
import {scopeDb} from '../src/server/ledger-scope.ts';
import {snapshot} from '../src/server/finance-store.ts';
import {createMcpHandler} from '../src/server/mcp-http.ts';

test('plugin bundles seven workflows, setup and a required registered app, without hooks or credentials',()=>{
 const files=financePluginFiles({appId:'asdk_app_fixture'}),manifest=JSON.parse(files['plugin.json']),app=JSON.parse(files['.app.json']);
 assert.equal(Object.keys(files).filter(p=>p.endsWith('/SKILL.md')).length,8);assert.equal(app.apps['family-finance'].required,true);assert.equal(app.apps['family-finance'].id,'asdk_app_fixture');assert.equal(manifest.extensions['com.openai'].apps,'./.app.json');assert.ok(files[manifest.extensions['com.openai'].onboardingSkill.slice(2)]);assert.equal(files['mcp.json'],undefined);
 assert.match(files['skills/family-finance-connection/SKILL.md'],/get_connection_status/);assert.match(files['skills/family-finance-consumption/SKILL.md'],/get_skill_bundle/);assert.doesNotMatch(JSON.stringify(files),/clientSecret|Authorization|bearer_token|\.codex\/skills/);
 assert.equal(financeMarketplace().plugins[0].policy.authentication,'ON_INSTALL');
});
test('package cannot silently become skills only, accept wrong IDs, credentials or ambiguous endpoints',()=>{
 for(const config of [{},{appId:'link_bad'},{appId:'plugin_asdk_app_fixture'},{appId:'appgprj_fixture'},{appId:'asdk_app_fixture',token:'secret'},{appId:'asdk_app_fixture',mcpUrl:'https://fixture.example/mcp'},{mcpUrl:'http://fixture.example/mcp'},{mcpUrl:'https://user:pass@fixture.example/mcp'},{mcpUrl:'https://fixture.example/mcp?token=secret'},{mcpUrl:'https://localhost/mcp'}])assert.throws(()=>financePluginFiles(config));
 const mcp=JSON.parse(financePluginFiles({mcpUrl:'https://fixture.example/mcp',oauthResource:'https://fixture.example/mcp'})['mcp.json']);assert.equal(mcp.mcpServers['family-finance'].type,'streamable-http');assert.equal(mcp.mcpServers['family-finance'].extensions['com.openai'].auth.type,'oauth');
});
test('CLI produces a self-contained marketplace and refuses to overwrite an old connection',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'finance-plugin-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const run=(...args)=>spawnSync(process.execPath,['scripts/package-finance-plugin.mjs','--output',dir,...args],{encoding:'utf8'});
 assert.notEqual(run().status,0);assert.deepEqual(fs.readdirSync(dir),[]);const good=run('--app-id','asdk_app_fixture');assert.equal(good.status,0,good.stderr);assert.deepEqual(JSON.parse(good.stdout),{output:dir,packagePrepared:true,installed:false,oauthVerified:false,mobileVerified:false,files:10});assert.ok(fs.existsSync(path.join(dir,'.agents/plugins/marketplace.json')));assert.notEqual(run('--app-id','asdk_app_other').status,0);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'plugins/family-finance/.app.json'))).apps['family-finance'].id,'asdk_app_fixture');
});
test('connection MCP verifies scoped account, workflow and permissions without financial data or writes',async t=>{
 const x=openTestDatabase();t.after(()=>x.sqlite.close());const owner={userId:'connection-owner',email:'connection@example.test',displayName:'模拟发起人'},member={userId:'connection-member',displayName:'模拟家人'},config={bootstrapOwnerEmail:owner.email},scope=await familyContext(x.db,owner,config);
 const rpc=async(user,scope,args={})=>{const h=createMcpHandler({getIdentity:async()=>({id:user.userId,canWrite:scope.canWrite}),getDb:()=>scopeDb(x.db,scope)});return (await(await h(new Request('https://fixture.example/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_connection_status',arguments:args}})}))).json()).result;};
 const db=scopeDb(x.db,scope),before=await snapshot(db),r=await rpc(owner,scope);assert.ok(!r.isError,JSON.stringify(r));const s=r.structuredContent;assert.equal(s.status,'ready');assert.equal(s.account.name,owner.displayName);assert.equal(s.family.id,scope.householdId);assert.equal(s.permissions.canSubmitDraft,true);assert.equal(s.workflows.count,7);assert.equal(s.clientInstallation,'not_observable');assert.doesNotMatch(JSON.stringify(s),/balance|cashCny|accounts|transactions|token|secret/);assert.deepEqual(await snapshot(db),before);
 assert.equal((await rpc(owner,scope,{user_id:'foreign'})).isError,true);
 const invite=await familyCommand(x.db,owner,{action:'invite',revision:scope.revision},config);await familyCommand(x.db,member,{action:'accept',token:invite.token},config);const memberScope=await familyContext(x.db,member,config),m=await rpc(member,memberScope);assert.equal(m.structuredContent.permissions.canSubmitDraft,false);assert.equal(m.structuredContent.account.id,member.userId);
 x.sqlite.prepare('UPDATE household_members SET active=0 WHERE user_id=?').run(member.userId);assert.equal((await rpc(member,memberScope)).isError,true);
});

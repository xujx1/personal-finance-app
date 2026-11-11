import test from 'node:test';import assert from 'node:assert/strict';import {createChatGPTService} from '../src/server/chatgpt-service.mjs';import {base64url,seal,unseal} from '../src/server/chatgpt-protocol.mjs';import {openTestDatabase} from './helpers/d1.mjs';
const tokenKey=base64url(new Uint8Array(32).fill(7));
test('OAuth starts official PKCE flow with encrypted one-time pending state',async()=>{const {db,sqlite}=openTestDatabase();const s=createChatGPTService({db,config:{tokenKey,redirectUri:'http://127.0.0.1:5173/auth/callback'}});const r=await s.start('owner');const u=new URL(r.url);assert.equal(u.origin,'https://auth.openai.com');assert.equal(u.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(u.searchParams.get('code_challenge_method'),'S256');const pending=await db.prepare('SELECT payload FROM runtime_cache WHERE id=?').bind('chatgpt-pending:'+u.searchParams.get('state')).first();assert.ok(pending);assert.equal(pending.payload.includes('verifier'),false);await assert.rejects(s.callback('owner',new URL('http://127.0.0.1:5173/auth/callback?state='+u.searchParams.get('state')+'&code=x&client_id=oaiapp_test'),'wrong'));await assert.rejects(createChatGPTService({db,config:{tokenKey,redirectUri:'https://arbitrary.example/auth/callback'}}).start('owner'));sqlite.close()});
test('model catalog and Responses use OAuth without exposing tokens',async()=>{const {db,sqlite}=openTestDatabase();const credentials={clientId:'oaiapp_test',subject:'subject',access_token:'simulated-oauth-secret',refresh_token:'simulated-refresh',expiresAt:Date.now()+3600000,models:[],model:null,scopes:['resource.invoke','chatgpt.tokens.use.direct']};await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('chatgpt:owner',JSON.stringify(await seal(tokenKey,credentials,'chatgpt:owner'))).run();let sent;const s=createChatGPTService({db,config:{tokenKey,redirectUri:'http://127.0.0.1:5173/auth/callback'},fetcher:async(url,opts)=>{sent=opts;if(url.endsWith('/models'))return Response.json({models:[{slug:'simulated-model',display_name:'模拟模型',visibility:'list'}]});return new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:'模拟回复'})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{status:'completed'}})+'\n\n',{headers:{'content-type':'text/event-stream'}})}});const models=await s.models('owner');assert.equal(models[0].slug,'simulated-model');await s.selectModel('owner','simulated-model');const r=await s.infer('owner','模拟说明','模拟问题');assert.equal(r.text,'模拟回复');const request=JSON.parse(sent.body);assert.equal(request.store,false);assert.equal(request.stream,true);assert.equal('max_output_tokens' in request,false);const status=await s.status('owner');assert.equal(status.inferenceVerified,true);assert.equal(JSON.stringify(status).includes('simulated-oauth-secret'),false);await s.disconnect('owner');assert.equal((await s.status('owner')).connected,false);sqlite.close()});


test('OAuth agent executes only declared read tools and streams final output',async()=>{const {db,sqlite}=openTestDatabase();await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('chatgpt:owner',JSON.stringify(await seal(tokenKey,{access_token:'simulated',refresh_token:'simulated',expiresAt:Date.now()+3600000,models:[{slug:'simulated'}],model:'simulated'},'chatgpt:owner'))).run();let count=0,executed=0;const deltas=[];const s=createChatGPTService({db,config:{tokenKey},fetcher:async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.tools[0].type,'namespace');let response;if(count++===0)response={status:'completed',output:[{type:'function_call',name:'get_assets',namespace:'finance',call_id:'test-call',arguments:'{}'}]};else{assert.ok(body.input.some(x=>x.type==='function_call_output'));response={status:'completed',output:[]}}return new Response((count===2?'data: '+JSON.stringify({type:'response.output_text.delta',delta:'模拟分析'})+'\n\n':'')+'data: '+JSON.stringify({type:'response.completed',response})+'\n\n',{headers:{'content-type':'text/event-stream'}})}});const result=await s.infer('owner','模拟指令','模拟问题',{financeTools:{get_assets:async()=>{executed++;return {count:1}}},onDelta:d=>deltas.push(d)});assert.equal(executed,1);assert.equal(result.text,'模拟分析');assert.deepEqual(deltas,['模拟分析']);sqlite.close()});

test('aborted OAuth inference forwards cancellation and never marks an ignored provider response complete',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());
 await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('chatgpt:owner',JSON.stringify(await seal(tokenKey,{access_token:'simulated',refresh_token:'simulated',expiresAt:Date.now()+3600000,models:[{slug:'simulated'}],model:'simulated'},'chatgpt:owner'))).run();
 const controller=new AbortController(),deltas=[];let forwarded;
 const service=createChatGPTService({db,config:{tokenKey},fetcher:async(_url,options)=>{forwarded=options.signal;controller.abort();return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'不应完成'}]}]}})+'\n\n',{headers:{'content-type':'text/event-stream'}})}});
 await assert.rejects(service.infer('owner','模拟说明','模拟问题',{signal:controller.signal,onDelta:delta=>deltas.push(delta)}),{name:'AbortError'});
 assert.equal(forwarded.aborted,true);assert.deepEqual(deltas,[]);assert.equal((await service.status('owner')).inferenceVerified,false);
});

test('OAuth abort during a read tool prevents subsequent tool execution and completed inference',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());
 await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('chatgpt:owner',JSON.stringify(await seal(tokenKey,{access_token:'simulated',refresh_token:'simulated',expiresAt:Date.now()+3600000,models:[{slug:'simulated'}],model:'simulated'},'chatgpt:owner'))).run();
 const controller=new AbortController();let secondReads=0;
 const service=createChatGPTService({db,config:{tokenKey},fetcher:async()=>new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:['get_assets','get_liabilities'].map((name,index)=>({type:'function_call',name,namespace:'finance',call_id:'call-'+index,arguments:'{}'}))}})+'\n\n',{headers:{'content-type':'text/event-stream'}})});
 await assert.rejects(service.infer('owner','模拟说明','模拟问题',{signal:controller.signal,financeTools:{get_assets:async()=>{controller.abort();return {}},get_liabilities:async()=>{secondReads++;return {}}}}),{name:'AbortError'});
 assert.equal(secondReads,0);assert.equal((await service.status('owner')).inferenceVerified,false);
});


test('caller cancellation after refresh body parsing preserves rotated credentials before rejecting inference',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());
 const original={clientId:'oaiapp_test',subject:'simulated-subject',access_token:'simulated-old-access',refresh_token:'simulated-old-refresh',expiresAt:Date.now()-1,models:[{slug:'simulated'}],model:'simulated'};
 await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('chatgpt:owner',JSON.stringify(await seal(tokenKey,original,'chatgpt:owner'))).run();
 const controller=new AbortController(),deltas=[];let tokenSignal,responses=0,reads=0;
 const service=createChatGPTService({db,config:{tokenKey},fetcher:async(url,options)=>{
  if(url.endsWith('/oauth/token')){tokenSignal=options.signal;return {ok:true,json:async()=>{controller.abort();return {access_token:'simulated-rotated-access',refresh_token:'simulated-rotated-refresh',expires_in:3600}}};}
  responses++;throw Error('Responses must not run after caller abort');
 }});
 await assert.rejects(service.infer('owner','模拟说明','模拟问题',{signal:controller.signal,onDelta:delta=>deltas.push(delta),financeTools:{get_assets:async()=>{reads++;return {}}}}),{name:'AbortError'});
 const row=await db.prepare('SELECT payload FROM runtime_cache WHERE id=?').bind('chatgpt:owner').first();
 const saved=await unseal(tokenKey,JSON.parse(row.payload),'chatgpt:owner');
 assert.equal(saved.refresh_token,'simulated-rotated-refresh');assert.equal(saved.access_token,'simulated-rotated-access');assert.equal(saved.model,'simulated');
 assert.equal(tokenSignal.aborted,false);assert.equal(responses,0);assert.equal(reads,0);assert.deepEqual(deltas,[]);
 assert.equal(await db.prepare('SELECT payload FROM runtime_cache WHERE id=?').bind('chatgpt-refresh:owner').first(),null);
});

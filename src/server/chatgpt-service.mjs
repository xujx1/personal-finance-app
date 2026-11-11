import {createPkce,base64url,seal,unseal,verifyIdToken,readResponseStream} from './chatgpt-protocol.mjs';
const scopes='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',resource='https://api.openai.com/v1';
export function createChatGPTService({db,config,fetcher=fetch}){
 const read=async id=>{const r=await db.prepare('SELECT payload FROM runtime_cache WHERE id=?').bind(id).first();return r?{raw:r.payload,value:JSON.parse(r.payload)}:null};
 const save=async(id,value)=>db.prepare('INSERT INTO runtime_cache VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
 const encrypted=async owner=>{const id='chatgpt:'+owner,r=await read(id);if(!r)return null;return {id,raw:r.raw,value:await unseal(config.tokenKey,r.value,id)}};
 const cas=async(c,value)=>{const row=await db.prepare('UPDATE runtime_cache SET payload=? WHERE id=? AND payload=? RETURNING id').bind(JSON.stringify(await seal(config.tokenKey,value,c.id)),c.id,c.raw).first();if(!row)throw Error('连接状态已变化，请刷新后重试')};
 const request=async(url,opts={})=>{opts.signal?.throwIfAborted();const r=await fetcher(url,{...opts,redirect:'manual',signal:opts.signal?AbortSignal.any([opts.signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});opts.signal?.throwIfAborted();if(!r.ok)throw Error('ChatGPT服务请求失败，请检查授权、额度和网络');return r};
 const token=async (params,signal)=>(await request('https://auth.openai.com/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,resource}),signal})).json();
 const credentials=async (owner,signal)=>{
  signal?.throwIfAborted();let c=await encrypted(owner);signal?.throwIfAborted();if(!c)throw Error('请先连接ChatGPT');if(c.value.expiresAt>Date.now()+60000)return c;
  if(c.value.earliestRefreshAt&&Date.now()<c.value.earliestRefreshAt)throw Error('尚未到可刷新时间，请稍后重试');
  const id='chatgpt-refresh:'+owner,lease=crypto.randomUUID();const lock=await db.prepare("INSERT INTO runtime_cache VALUES(?,json_object('until',?,'lease',?)) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE json_extract(runtime_cache.payload,'$.until')<? RETURNING id").bind(id,Date.now()+90000,lease,Date.now()).first();if(!lock)throw Error('ChatGPT凭据正在刷新，请稍后重试');
  try{
   c=await encrypted(owner);signal?.throwIfAborted();if(!c)throw Error('连接已断开');if(c.value.expiresAt>Date.now()+60000)return c;
   // Rotation must persist the replacement credentials even if the caller stops inference.
   // The refresh has its own deadline; caller cancellation is checked by infer afterwards.
   const refreshSignal=AbortSignal.timeout(60000);
   const p=await token({grant_type:'refresh_token',client_id:c.value.clientId,refresh_token:c.value.refresh_token},refreshSignal);
   if(!p.access_token||!Number.isFinite(p.expires_in)||!p.refresh_token)throw Error('刷新返回缺少轮换凭据，请重新授权');
   if(p.id_token){const jwks=await(await request('https://auth.openai.com/.well-known/jwks.json',{signal:refreshSignal})).json();await verifyIdToken(p.id_token,jwks,{clientId:c.value.clientId,subject:c.value.subject})}
   refreshSignal.throwIfAborted();
   await cas(c,{...c.value,...p,expiresAt:Date.now()+p.expires_in*1000,earliestRefreshAt:p.earliest_refresh_at?Date.parse(p.earliest_refresh_at):null});
   return await encrypted(owner);
  }finally{await db.prepare("DELETE FROM runtime_cache WHERE id=? AND json_extract(payload,'$.lease')=?").bind(id,lease).run()}
 };
 const api={
  async status(owner){if(!config.tokenKey)return {configured:false,connected:false,reason:'请配置CHATGPT_TOKEN_KEY和回调地址'};const c=await encrypted(owner);return {configured:Boolean(config.redirectUri),connected:Boolean(c),model:c?.value.model??null,models:c?.value.models??[],inferenceVerified:c?.value.inferenceVerified===true,expiresAt:c?.value.expiresAt??null}},
  async start(owner){
   if(!config.tokenKey||!config.redirectUri)throw Error('请配置CHATGPT_TOKEN_KEY和CHATGPT_REDIRECT_URI');const redirect=new URL(config.redirectUri);
   if(!config.clientId&&(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||redirect.pathname!=='/auth/callback'))throw Error('动态注册仅支持127.0.0.1的HTTP /auth/callback；托管站需已注册的官方客户端');if(config.clientId&&redirect.protocol!=='https:'&&redirect.hostname!=='127.0.0.1')throw Error('已注册客户端回调须HTTPS或本机127.0.0.1');
   const c=await encrypted(owner),state=base64url(crypto.getRandomValues(new Uint8Array(32))),nonce=base64url(crypto.getRandomValues(new Uint8Array(32))),cookie=base64url(crypto.getRandomValues(new Uint8Array(32))),pkce=await createPkce();
   await db.prepare('INSERT OR IGNORE INTO runtime_cache VALUES(?,?)').bind('chatgpt-host',JSON.stringify({id:'urn:uuid:'+crypto.randomUUID()})).run();const host=(await read('chatgpt-host')).value.id,client=c?.value.clientId??config.clientId??'dynamic_agent_client';
   await save('chatgpt-pending:'+state,await seal(config.tokenKey,{owner,cookie,nonce,verifier:pkce.verifier,redirectUri:redirect.href,client,subject:c?.value.subject??null,expires:Date.now()+600000},'pending:'+state));
   const url=new URL('https://auth.openai.com/api/accounts/authorize');for(const [k,v] of Object.entries({client_id:client,ext_agent_host_id:host,response_type:'code',redirect_uri:redirect.href,scope:scopes,resource,state,nonce,code_challenge:pkce.challenge,code_challenge_method:'S256',...(client==='dynamic_agent_client'?{agent_name_hint:'Personal Finance Center'}:{}),...(c?.value.id_token?{id_token_hint:c.value.id_token}:{})}))url.searchParams.set(k,v);return {url:url.href,cookie};
  },
  async callback(owner,url,cookie){
   const state=url.searchParams.get('state');if(!state||!/^[A-Za-z0-9_-]{20,100}$/.test(state))throw Error('授权状态无效');const id='chatgpt-pending:'+state,r=await read(id);if(!r)throw Error('授权已使用或过期');const p=await unseal(config.tokenKey,r.value,'pending:'+state);
   if(p.owner!==owner||p.cookie!==cookie||p.expires<Date.now()||url.origin+url.pathname!==new URL(p.redirectUri).origin+new URL(p.redirectUri).pathname)throw Error('授权与当前浏览器或回调不匹配');
   if(!await db.prepare('DELETE FROM runtime_cache WHERE id=? AND payload=? RETURNING id').bind(id,r.raw).first())throw Error('授权已经使用');if(url.searchParams.has('error'))throw Error('ChatGPT授权未完成');
   const client=url.searchParams.get('client_id')??p.client;if(client==='dynamic_agent_client'||p.client!=='dynamic_agent_client'&&client!==p.client||client.length>200)throw Error('授权客户端不匹配');const code=url.searchParams.get('code');if(!code||code.length>3000)throw Error('授权码无效');
   const tokens=await token({grant_type:'authorization_code',client_id:client,code,code_verifier:p.verifier,redirect_uri:p.redirectUri,...(config.clientSecret?{client_secret:config.clientSecret}:{})});
   const granted=String(tokens.scope??'').split(' ');if(!tokens.access_token||!tokens.refresh_token||!Number.isFinite(tokens.expires_in)||!['resource.invoke','chatgpt.tokens.use.direct'].every(s=>granted.includes(s)))throw Error('未取得ChatGPT推理授权');
   const jwks=await(await request('https://auth.openai.com/.well-known/jwks.json')).json(),claims=await verifyIdToken(tokens.id_token,jwks,{clientId:client,nonce:p.nonce,subject:p.subject});
   await save('chatgpt:'+owner,await seal(config.tokenKey,{...tokens,clientId:client,subject:claims.sub,scopes:granted,expiresAt:Date.now()+tokens.expires_in*1000,models:[],model:null,inferenceVerified:false},'chatgpt:'+owner));return {connected:true};
  },
  async models(owner){const c=await credentials(owner),response=await(await request(resource+'/models',{headers:{Authorization:'Bearer '+c.value.access_token}})).json();if(!Array.isArray(response.models))throw Error('模型目录格式无效');const models=response.models.filter(x=>x.visibility==='list'&&typeof x.slug==='string').slice(0,40).map(x=>({slug:x.slug.slice(0,100),display_name:String(x.display_name??x.slug).slice(0,100)}));await cas(c,{...c.value,models,model:models.some(m=>m.slug===c.value.model)?c.value.model:null});return models},
  async selectModel(owner,model){const c=await encrypted(owner);if(!c?.value.models.some(x=>x.slug===model))throw Error('请选择授权目录中的模型');await cas(c,{...c.value,model})},
  async infer(owner,instructions,input,{web=false,image=null,financeTools=null,onDelta=null,onTool=null,signal=null}={}){
   signal?.throwIfAborted();const c=await credentials(owner,signal);signal?.throwIfAborted();if(!c.value.model)throw Error('请先读取目录并选择ChatGPT模型');
   const history=[{role:'user',content:image?[{type:'input_text',text:input},{type:'input_image',image_url:image}]:input}],tools=[];
   if(financeTools)tools.push({type:'namespace',name:'finance',description:'当前已授权账本的只读查询；不批准预算、不改资产或扣款',tools:Object.keys(financeTools).map(name=>({type:'function',name,description:({get_assets:'核对已持有资产和原始币种',get_liabilities:'核对贷款本金与月供',get_budgets:'读取已有预算和未付占用',get_holdings:'读取本人登记的股票基金数量与成本',get_market_quotes:'只读已有行情快照，保留来源和原报价日期',get_savings_goals:'读取本人定义的资产金额和期限目标',get_recent_consumption:'读取已确认消费和出行记录，排除候选和退款',get_cashflow_context:'读取经确认的现金流规划依据'})[name]??'只读查询',parameters:{type:'object',properties:{},required:[],additionalProperties:false},strict:true}))});if(web)tools.push({type:'web_search'});
   let calls=0;const citations=[];
   for(let round=0;round<4;round++){
    signal?.throwIfAborted();const streamSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000);const response=await request(resource+'/responses',{method:'POST',headers:{Authorization:'Bearer '+c.value.access_token,'Content-Type':'application/json'},signal:streamSignal,body:JSON.stringify({model:c.value.model,instructions,input:history,store:false,stream:true,...(tools.length?{tools,include:['reasoning.encrypted_content']}:{})})});
    streamSignal.throwIfAborted();const readable=response.body?new Response(response.body.pipeThrough(new TransformStream(),{signal:streamSignal}),{status:response.status,headers:response.headers}):response;const r=await readResponseStream(readable,{onDelta:delta=>{streamSignal.throwIfAborted();onDelta?.(delta)}});streamSignal.throwIfAborted();citations.push(...r.citations);
    if(!r.toolCalls.length){signal?.throwIfAborted();await cas(c,{...c.value,inferenceVerified:true,lastInferenceAt:Date.now()});signal?.throwIfAborted();return {...r,citations,model:c.value.model}}
    history.push(...r.output);
    for(const call of r.toolCalls){signal?.throwIfAborted();const name=String(call.name??'').replace(/^finance[.:]/,'');if(!financeTools||!Object.hasOwn(financeTools,name)||call.namespace&&call.namespace!=='finance'||++calls>8||typeof call.call_id!=='string')throw Error('模型请求了未授权工具或超过查询次数');const args=JSON.parse(call.arguments??'{}');if(!args||Array.isArray(args)||Object.keys(args).length)throw Error('财务查询工具不接受外部账本标识或参数');onTool?.({name,status:'running'});const value=await financeTools[name]();signal?.throwIfAborted();onTool?.({name,status:'completed'});history.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(value)});}
   }throw Error('工具查询超过4轮，请缩小问题范围');
  },
  async disconnect(owner){await db.prepare('DELETE FROM runtime_cache WHERE id=?').bind('chatgpt:'+owner).run();const pending=await db.prepare("SELECT id,payload FROM runtime_cache WHERE id LIKE 'chatgpt-pending:%'").all();for(const r of pending.results){try{const p=await unseal(config.tokenKey,JSON.parse(r.payload),'pending:'+r.id.slice('chatgpt-pending:'.length));if(p.owner===owner)await db.prepare('DELETE FROM runtime_cache WHERE id=?').bind(r.id).run()}catch{}}return {connected:false}}
 };return api;
}

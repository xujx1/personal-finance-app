import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvestmentHandlers} from '../src/server/investment-http.ts';
import {openTestDatabase} from './helpers/d1.mjs';
import {snapshot} from '../src/server/finance-store.ts';
const url='http://127.0.0.1/api/investment';
const config={baseUrl:'https://gateway.example/v1',key:'simulated-key',model:'simulated-model',searchKey:'simulated-search'};
const answer={title:'模拟投资研究',summary:'保持充足现金',content:'模拟持仓与现金流分析，非实际投资建议。',budget:'9999.00',sources:['https://example.com/market'],missing_inputs:[]};
const body={key:'investment-test',question:'模拟是否调整持仓',provider:'compatible',searchQuery:'模拟证券公告'};
const request=(input=body,options={})=>new Request(url,{method:'POST',body:JSON.stringify(input),...options});
function setup(t, overrides={}){
  const {db,sqlite}=openTestDatabase(); t.after(()=>sqlite.close());
  const calls=[];
  const fetcher=async(target,options)=>{calls.push({target,options});return target==='https://api.tavily.com/search'?Response.json({results:[{title:'模拟市场资料',url:'https://example.com/market',content:'模拟片段'}]}):Response.json({choices:[{message:{content:JSON.stringify(answer)}}]});};
  return {db,calls,api:createInvestmentHandlers({getUser:async()=>({userId:'owner'}),getOwner:()=> 'owner',getDb:()=>db,getConfig:()=>config,fetcher,...overrides})};
}

test('investment rejects anonymous and read-only requests before reading financial data',async()=>{
  const deps={getOwner:()=> 'owner',getDb:()=>{throw Error('must not read data')},getConfig:()=>config};
  assert.equal((await createInvestmentHandlers({...deps,getUser:async()=>null}).POST(request())).status,401);
  assert.equal((await createInvestmentHandlers({...deps,getUser:async()=>({userId:'viewer'})}).POST(request())).status,403);
});

test('investment validates provider and explains missing model or search configuration without outbound calls',async t=>{
  const {api,calls}=setup(t,{getConfig:()=>({})});
  assert.equal((await api.POST(request({...body,provider:'unknown'}))).status,422);
  const missing=await api.POST(request()); assert.equal(missing.status,503);
  assert.match((await missing.json()).error,/模型/);
  const search=setup(t,{getConfig:()=>({...config,searchKey:''})});
  const response=await search.api.POST(request()); assert.equal(response.status,503);
  assert.match((await response.json()).error,/检索|搜索/);
  assert.equal(calls.length,0); assert.equal(search.calls.length,0);
});

test('investment executes read tools, forwards trusted facts and saves only an idempotent wealth proposal',async t=>{
  const {api,db,calls}=setup(t);
  const first=await api.POST(request()); assert.equal(first.status,200);
  const value=await first.json(); assert.equal(value.proposal.kind,'wealth'); assert.equal(value.proposal.budget,null);
  const modelFacts=JSON.parse(JSON.parse(calls[1].options.body).messages[1].content);
  for(const name of ['get_assets','get_liabilities','get_budgets','get_holdings','get_savings_goals','get_market_quotes','get_cashflow_context']) assert.ok(modelFacts.readonly_financial_tools[name],name);
  const retried=await api.POST(request()); assert.equal((await retried.json()).id,value.id);
  assert.equal(calls.length,2);
  assert.equal((await api.POST(request({...body,question:'不同问题'}))).status,409);
  const state=await snapshot(db);
  assert.equal(state.documents.filter(x=>x.kind==='research_proposal').length,1);
  assert.equal(state.documents.filter(x=>x.kind==='plan').length,0);
  assert.equal(state.accounts.filter(x=>x.kind==='ASSET').length,0);
  assert.equal(state.transactions.length,0);
});

test('SSE reports completed read stages and one honest whole-result delta before validated final value',async t=>{
  const {api}=setup(t);
  const response=await api.POST(request(body,{headers:{Accept:'text/event-stream'}}));
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const events=(await response.text()).split('\n\n').filter(Boolean).map(line=>JSON.parse(line.slice(6)));
  for(const name of ['get_assets','get_liabilities','get_budgets','get_holdings','get_savings_goals','get_market_quotes','get_cashflow_context']) assert.ok(events.some(e=>e.type==='tool'&&e.name===name&&e.status==='completed'),name);
  const deltas=events.filter(e=>e.type==='delta'); assert.equal(deltas.length,1);
  assert.equal(deltas[0].text,answer.content); assert.equal(deltas[0].mode,'complete_result');
  assert.equal(events.at(-1).type,'result'); assert.equal(events.at(-1).value.proposal.kind,'wealth');
});

test('aborting investment propagates to provider and cannot publish or save a completed proposal',async t=>{
  const controller=new AbortController(); let searchStarted; const started=new Promise(resolve=>searchStarted=resolve);
  const {db,api}=setup(t,{fetcher:async(_url,options)=>{searchStarted();return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}});
  const response=await api.POST(request(body,{headers:{Accept:'text/event-stream'},signal:controller.signal}));
  await started; controller.abort();
  const stream=await response.text(); assert.equal(stream.includes('"type":"result"'),false);
  assert.equal((await snapshot(db)).documents.filter(d=>d.kind==='research_proposal').length,0);
});

test('investment deadline applies even when it expires before provider work begins',{timeout:1000},async t=>{
  let providerSignal;
  const {api,db}=setup(t,{timeoutMs:10,fetcher:async(_url,options)=>{providerSignal=options.signal;return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}});
  const response=await api.POST(request(body,{headers:{Accept:'text/event-stream'}}));
  const keepEventLoop=setInterval(()=>{},50);
  try {const text=await response.text();assert.equal(text.includes('"type":"result"'),false);assert.match(text,/error/);assert.match(text,/超时/);if(providerSignal){assert.equal(providerSignal.aborted,true);assert.equal(providerSignal.reason.name,'TimeoutError');}} finally {clearInterval(keepEventLoop);}
  assert.equal((await snapshot(db)).documents.filter(d=>d.kind==='research_proposal').length,0);
});

test('malformed provider output produces SSE error without a delta or final result',async t=>{
  const {api,db}=setup(t,{fetcher:async(target)=>target==='https://api.tavily.com/search'?Response.json({results:[]}):Response.json({choices:[{message:{content:'not JSON'}}]})});
  const text=await(await api.POST(request(body,{headers:{Accept:'text/event-stream'}}))).text();
  assert.match(text,/"type":"error"/);assert.equal(text.includes('"type":"delta"'),false);assert.equal(text.includes('"type":"result"'),false);
  assert.equal((await snapshot(db)).documents.length,0);
});

test('OAuth investment requires an authorized model and keeps successful analysis a wealth-only proposal',async t=>{
 let inferred=0;
 const unconfigured=setup(t,{chatgpt:{status:async()=>({connected:false,model:null}),infer:async()=>{inferred++;}}});
 assert.equal((await unconfigured.api.POST(request({...body,provider:'chatgpt'}))).status,503);
 assert.equal(inferred,0);
 const ready=setup(t,{getConfig:()=>({}),chatgpt:{status:async()=>({connected:true,model:'simulated-oauth'}),infer:async(_owner,_instructions,input,options)=>{
  inferred++;assert.ok(options.signal instanceof AbortSignal);if(options.web)assert.deepEqual(JSON.parse(input),{search_keywords:'模拟证券公告'});else assert.ok(JSON.parse(input).readonly_financial_tools.get_holdings);
  return {text:JSON.stringify(answer),model:'simulated-oauth',citations:[{title:'模拟市场资料',url:'https://example.com/market'}]};
 }}});
 const response=await ready.api.POST(request({...body,provider:'chatgpt'}));assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.proposal.kind,'wealth');assert.equal(value.proposal.budget,null);
 assert.equal(value.proposal.model,'simulated-oauth');assert.equal(inferred,2);
 assert.equal((await snapshot(ready.db)).transactions.length,0);
});

test('compatible investment gateway streams only readable content and still validates final wealth proposal',async t=>{
 const encoded=JSON.stringify(answer),parts=[encoded.slice(0,70),encoded.slice(70)];
 const {api}=setup(t,{fetcher:async(target)=>target==='https://api.tavily.com/search'?Response.json({results:[{title:'模拟来源',url:'https://example.com/market',content:'仅夹具'}]}):new Response(parts.map(content=>'data: '+JSON.stringify({choices:[{delta:{content},finish_reason:null}]})+'\n\n').join('')+'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})});
 const response=await api.POST(request(body,{headers:{Accept:'text/event-stream'}}));
 const events=(await response.text()).split('\n\n').filter(Boolean).map(line=>JSON.parse(line.slice(6)));
 const deltas=events.filter(e=>e.type==='delta');assert.ok(deltas.length>0);assert.equal(deltas.map(e=>e.text).join(''),answer.content);assert.ok(deltas.every(e=>e.mode==='stream'));assert.equal(events.at(-1).type,'result');
});
test('investment refreshes configured holdings before reading latest available quote facts',async t=>{
 const {executeCommand}=await import('../src/server/finance-store.ts');const parts=Array(40).fill('');parts[1]='SIM';parts[2]='BABA';parts[3]='102.72';parts[30]='20261110160000';let quoteCalls=0,modelFacts;
 const {api,db}=setup(t,{fetcher:async(target,options)=>{if(String(target).startsWith('https://qt.gtimg.cn/')){quoteCalls++;return new Response('v_usBABA="'+parts.join('~')+'";')}if(target==='https://api.tavily.com/search')return Response.json({results:[{title:'模拟来源',url:'https://example.com/market',content:'仅模拟'}]});modelFacts=JSON.parse(JSON.parse(options.body).messages[1].content);return Response.json({choices:[{message:{content:JSON.stringify(answer)}}]});}});
 await executeCommand(db,{key:'quote-fixture',revision:0,action:'account.save',body:{name:'模拟证券',category:'stock',currency:'USD',amount:'100.00',code:'BABA',market:'US'}},'test-fixture');
 await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('quote:stock:BABA',JSON.stringify({symbol:'BABA',price:'1.00',source:'old fixture',asOf:'2020-01-01',fetchedAt:0})).run();
 const response=await api.POST(request());assert.equal(response.status,200);assert.equal(quoteCalls,1);assert.equal(modelFacts.readonly_financial_tools.get_market_quotes.quotes[0].price,'102.72');
});
test('investment persists an authoritative exact scenario and never promotes a contradictory model headline',async t=>{const {executeCommand}=await import('../src/server/finance-store.ts');const {api,db,calls}=setup(t);for(const [code,quantity,price]of [['BABA','500','101.67'],['TCOM','350','43.43'],['NVDA','4','176.03'],['VOO','10','698.80']]){await executeCommand(db,{key:'scenario-'+code,revision:(await snapshot(db)).book.revision,action:'account.save',body:{name:'模拟'+code,category:'stock',currency:'USD',amount:'100',code,market:'US',quantity}},'test-fixture');await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('quote:stock:'+code,JSON.stringify({symbol:code,price,currency:'USD',market:'US',source:'模拟行情',asOf:'20261111210000',fetchedAt:Date.now()})).run()}const before=await snapshot(db);const response=await api.POST(request({...body,question:'查英伟达最新消息，评估卖出100股BABA加100股TCOM换入100股NVDA'}));assert.equal(response.status,200);const value=await response.json();assert.equal(value.proposal.calculation.grossFundingGap,'3093.00');assert.equal(value.proposal.calculation.portfolio.afterValue,'76820.62');assert.match(value.proposal.summary,/3093\.00/);assert.doesNotMatch(value.proposal.summary,/保持充足现金/);assert.equal(value.proposal.modelSummary,answer.summary);const persisted=(await snapshot(db)).documents.find(d=>d.id===value.id).payload;assert.equal(persisted.calculation.grossFundingGap,'3093.00');assert.equal(persisted.calculation.feesKnown,false);const modelFacts=JSON.parse(JSON.parse(calls[1].options.body).messages[1].content);assert.equal(modelFacts.authoritative_investment_calculation.grossFundingGap,'3093.00');assert.deepEqual((await snapshot(db)).accounts,before.accounts);assert.equal((await snapshot(db)).transactions.length,before.transactions.length);});

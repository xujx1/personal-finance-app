import test from 'node:test';import assert from 'node:assert/strict';
import {createMarketHandlers} from '../src/server/market-http.ts';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {openTestDatabase} from './helpers/d1.mjs';
import {safeQuotedBalance,parseTencent} from '../src/domain/market.mjs';
const quote=(code='BABA',price='102.72',time='2026-11-11 10:47:40',prefix='us')=>{const p=Array(40).fill('');p[1]='SIM';p[2]=code;p[3]=price;p[30]=time;return 'v_'+prefix+code+'="'+p.join('~')+'";';};
async function setup(t,body,fetcher){const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const a=await executeCommand(db,{key:'market-fixture',revision:0,action:'account.save',body:{name:'模拟持仓',category:'stock',currency:'USD',amount:'100.00',quantity:'2',code:'BABA',market:'US',...body}},'test');const api=createMarketHandlers({getUser:async()=>({userId:'test'}),getDb:()=>db,fetcher});return {api,db,id:a.id};}
const request=()=>new Request('http://localhost/api/market');
test('market requires login before touching private financial data',async()=>{const api=createMarketHandlers({getUser:async()=>null,getDb:()=>{throw Error('unexpected db read');}});assert.equal((await api.GET(request())).status,401);});
test('quote requests preserve publication timestamp and cache without changing the ledger',async t=>{let calls=0;const {api,db,id}=await setup(t,{},async url=>{assert.equal(url,'https://qt.gtimg.cn/q=usBABA');calls++;return new Response(quote());});const before=await snapshot(db);const first=await(await api.GET(request())).json();assert.equal(first.quotes[id].market,'US');assert.equal(first.quotes[id].asOf,'2026-11-11 10:47:40');assert.equal(first.quotes[id].status,'ok');assert.equal(first.ledgerUnchanged,true);const second=await(await api.GET(request())).json();assert.equal(second.quotes[id].status,'cached');assert.equal(calls,1);assert.deepEqual(await snapshot(db),before);});
test('unsupported markets or currency never request the US ticker endpoint',async t=>{for(const body of [{market:'HK'},{market:'CN',currency:'CNY',code:'600519'},{market:null},{market:'US',currency:'CNY'}]){const {api,id}=await setup(t,body,async()=>{throw Error('must not request unsupported symbol');});const result=await(await api.GET(request())).json();assert.equal(result.quotes[id].status,'unavailable');assert.match(result.quotes[id].message,/市场|币种|代码/);}});
test('explicit CN exchange codes produce a CNY quote without relabeling USD prices',async t=>{const {api,id}=await setup(t,{market:'CN',currency:'CNY',code:'SH600519'},async url=>{assert.equal(url,'https://qt.gtimg.cn/q=sh600519');return new Response(quote('600519','1402.30','20261111161439','sh'));});const result=await(await api.GET(request())).json();assert.equal(result.quotes[id].currency,'CNY');assert.equal(result.quotes[id].market,'CN');assert.equal(result.quotes[id].price,'1402.30');});
test('provider HTML pretending to be HTTP success does not replace published fund data',async t=>{const {api,db,id}=await setup(t,{category:'fund',currency:'CNY',market:'CN',code:'008163'},async()=>new Response('<html>页面未找到</html>'));await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('quote:fund:008163',JSON.stringify({symbol:'008163',price:'1.2345',currency:'CNY',market:'CN',source:'历史公开净值',asOf:'2026-11-10',fetchedAt:0,kind:'published_nav'})).run();const result=await(await api.GET(request())).json();assert.equal(result.quotes[id].status,'stale');assert.equal(result.quotes[id].price,'1.2345');assert.equal(result.quotes[id].asOf,'2026-11-10');});
test('unknown stock market and incompatible cache cannot supply current valuation',()=>{const a={category:'stock',currency:'USD',balance:10000,metadata:{quantity:'2'}};assert.equal(safeQuotedBalance(a,{market:'US',currency:'USD',price:'10'}),10000);assert.equal(safeQuotedBalance({...a,metadata:{quantity:'0',market:'US'}},null),0);});
test('Tencent rejects missing source time and a response from another symbol',()=>{assert.throws(()=>parseTencent(quote('BABA','102.72',''),'BABA'),/时间/);assert.throws(()=>parseTencent(quote('NVDA'),'BABA'),/代码/);});
test('fund NAV falls back to data-only Eastmoney history when estimate endpoint returns HTML',async t=>{
 const {api,id}=await setup(t,{category:'fund',currency:'CNY',market:'CN',code:'008163'},async url=>url.includes('fundgz')?new Response('<html>页面未找到</html>'):new Response('var fS_code="008163"; var Data_netWorthTrend=[{"x":1794240000000,"y":1.0901},{"x":1794326400000,"y":1.0791}]; var dangerous=(function(){throw "must never execute"})();'));
 const result=await(await api.GET(request())).json();assert.equal(result.quotes[id].status,'ok');assert.equal(result.quotes[id].price,'1.0791');assert.equal(result.quotes[id].asOf,'2026-11-11');assert.equal(result.quotes[id].kind,'published_nav');assert.equal(result.quotes[id].estimate,null);
});
test('Tencent cannot relabel an explicitly foreign provider currency as the account currency',()=>{
 const p=Array(40).fill('');p[2]='BABA.N';p[3]='10';p[30]='2026-11-11 10:47:40';p[35]='HKD';
 assert.throws(()=>parseTencent('v_usBABA="'+p.join('~')+'";','BABA','US'),/币种/);
});
test('daily cache uses Shanghai calendar day and retains original source timestamp',async t=>{
 let calls=0,now=Date.parse('2026-11-12T00:00:00Z');const {api,db,id}=await setup(t,{},async()=>{calls++;return new Response(quote());});
 const handler=createMarketHandlers({getUser:async()=>({userId:'test'}),getDb:()=>db,now:()=>now,fetcher:async()=>{calls++;return new Response(quote());}});
 const first=await(await handler.GET(request())).json();assert.equal(first.quotes[id].status,'ok');
 now+=10*60*60*1000;const cached=await(await handler.GET(request())).json();assert.equal(cached.quotes[id].status,'cached');assert.equal(cached.quotes[id].asOf,first.quotes[id].asOf);assert.equal(calls,1);
 now=Date.parse('2026-11-12T16:01:00Z');await handler.GET(request());assert.equal(calls,2,'Shanghai new day refreshes even within 24 hours');
});
test('provider failures are attempted once each day and do not erase stale data',async t=>{
 let calls=0,now=Date.parse('2026-11-12T02:00:00Z');const {db,id}=await setup(t,{},null);
 const handler=createMarketHandlers({getUser:async()=>({userId:'test'}),getDb:()=>db,now:()=>now,fetcher:async()=>{calls++;throw Error('offline');}});
 await db.prepare('INSERT INTO runtime_cache VALUES(?,?)').bind('quote:stock:BABA',JSON.stringify({symbol:'BABA',currency:'USD',market:'US',price:'99',source:'Tencent',asOf:'2026-11-11 10:00:00',fetchedAt:now-86400000})).run();
 const a=await(await handler.GET(request())).json();await handler.GET(request());assert.equal(calls,1);assert.equal(a.quotes[id].status,'stale');assert.equal(a.quotes[id].price,'99');
 now+=86400000;await handler.GET(request());assert.equal(calls,2);
});

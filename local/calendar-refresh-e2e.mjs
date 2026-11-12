import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareVendor} from './prepare-vendor.mjs';

// Real HTTP handlers, family guards and SQLite; ChatGPT output is an explicit
// structured fixture. No model, search, production book or payment is contacted.
const root=fileURLToPath(new URL('../',import.meta.url));
const modules=path.resolve(process.env.LOCAL_TEST_MODULES??process.argv[2]??path.join(root,'work/calendar-qa/node_modules'));
const {chromium}=createRequire(path.join(modules,'../package.json'))(path.join(modules,'playwright'));
const out=path.join(root,'work/calendar-refresh/e2e');fs.mkdirSync(out,{recursive:true});
const env={...process.env,LOCAL_TEST_MODULES:path.join(root,'node_modules'),LOCAL_FAMILY_QA:'1',LOCAL_API_PORT:'5764',LOCAL_UI_PORT:'5763',LOCAL_QA_DATABASE:`qa-calendar-refresh-${Date.now()}.sqlite`};
for(const k of Object.keys(env))if(k.startsWith('NEW_API_')||k==='TAVILY_API_KEY')delete env[k];
await prepareVendor(env.LOCAL_TEST_MODULES);
const children=['local/server.mjs','local/vite-server.mjs'].map((script,i)=>{const log=fs.openSync(path.join(out,i?'ui.log':'api.log'),'w');return spawn(process.execPath,[script],{cwd:root,env,stdio:['ignore',log,log]})});
const url='http://127.0.0.1:5763',api='http://127.0.0.1:5764';
const owner='local-simulated-owner',member='local-simulated-member',results=[],pageErrors=[],unexpected=[],requests=[];
let browser,page;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(){for(let i=0;i<100;i++){try{if((await fetch(url)).ok&&(await fetch(api+'/api/finance')).ok)return}catch{}await sleep(200)}throw Error('isolated preview did not start')}
async function json(route,{user=owner,body,headers={},allowError=false}={}){const r=await fetch(api+route,{method:body?'POST':'GET',headers:{'x-local-qa-user':user,...headers,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!allowError)assert.ok(r.ok,JSON.stringify(value));return {status:r.status,value}}
const state=async()=> (await json('/api/finance')).value;
async function call(name,args={},user=owner){const {value}=await json('/mcp',{user,body:{jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}}});assert.ok(!value.result?.isError,JSON.stringify(value));return value.result.structuredContent}
async function stage(kind,payload){return call('submit_finance_draft',{kind,payload,request_id:crypto.randomUUID(),expected_revision:(await state()).book.revision})}
async function command(action,body,user=owner,key=crypto.randomUUID()){return (await json('/api/finance',{user,body:{key,revision:(await state()).book.revision,action,body}})).value}
async function nav(name,p=page){
 if(['家庭管理','目标设置','工作流集成'].includes(name)){await p.getByRole('button',{name:'账户菜单',exact:true}).click();await p.getByRole('region',{name:'当前账户',exact:true}).getByRole('button',{name,exact:true}).click();return}
 const toggle=p.getByRole('button',{name:'切换菜单'});if(await toggle.isVisible())await toggle.click();await p.getByRole('navigation').getByRole('button',{name,exact:true}).click();await p.locator('.sidebar').evaluate(node=>Promise.all(node.getAnimations().map(a=>a.finished.catch(()=>{}))))
}
const card=id=>page.locator(`[data-draft-id="${id}"]`);
async function open(id){await card(id).locator(':scope > details > summary').click()}
async function adopt(id,kind,{coverage='uncovered'}={}){const c=card(id);await open(id);if(kind==='cashflow')await c.getByLabel('当前余额覆盖情况').selectOption(coverage);if(['cashflow','asset'].includes(kind))await c.getByRole('checkbox',{name:/我已确认/}).check();await c.getByRole('checkbox',{name:kind==='budget'||['cashflow','asset'].includes(kind)?/我已逐项核对外部分析/:/我已核对.*并确认保存/}).check();await c.getByRole('button',{name:kind==='budget'?'采用并提交家庭审批':kind==='asset'?'采用并登记已有资产':kind==='cashflow'?'采用并记录实际流水':kind==='recurring'?'采用并保存待核实规则':'核对并保存'+(kind==='investment'?'投资研究':'月度总结'),exact:true}).click();await c.waitFor({state:'detached'});return (await state()).documents.find(d=>d.id===id).payload.destinationId}
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}
const dialog=()=>page.getByRole('dialog');
async function seed(name){const p={name,category:'国内旅行',date:'2026-11-14',end:'2026-11-15',budget:'100.00',ownerMemberId:'family',analysis:'独立模拟，非生产',expenseDraft:{kind:'travel',items:[{id:'cost',name:'模拟费用',quantity:'1',unitPrice:'100.00',sourceType:'scenario_estimate'}],itinerary:[]}},d=await stage('budget',p);return (await command('mcp.draft.accept',{draftId:d.id,confirmed:true,reviewedPayload:p})).id}
async function selectCalendar(name){await nav('生活日历');await page.getByRole('button',{name:/2026-11-14，/}).click();await page.getByRole('button',{name:'取消计划：'+name,exact:true}).waitFor()}
async function cancel(name){await page.getByRole('button',{name:'取消计划：'+name,exact:true}).click();await dialog().getByLabel('确认同时取消日历计划与预算，保留实际账目').check();await dialog().getByRole('button',{name:'确认取消计划与预算'}).click();}
try{
 await waitServer();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(12000);page.on('pageerror',e=>pageErrors.push(e.message));
 const name='模拟晚返回的刷新';await seed(name);await page.goto(url,{waitUntil:'networkidle'});await selectCalendar(name);
 await check('较早刷新晚返回时不能恢复已经取消的日历计划',async()=>{
  let release,started;const gate=new Promise(r=>{release=r}),captured=new Promise(r=>{started=r});let held=false;
  await page.route('**/api/finance',async route=>{if(!held&&route.request().method()==='GET'){held=true;const response=await route.fetch();started();await gate;await route.fulfill({response}).catch(()=>{});}else await route.continue()});
  await page.getByRole('button',{name:'刷新',exact:true}).click();await captured;await cancel(name);await dialog().waitFor({state:'detached'});await page.getByRole('button',{name:'2026-11-14，0项安排',exact:true}).waitFor();release();await page.waitForTimeout(700);assert.equal(await page.getByRole('button',{name:'取消计划：'+name,exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'2026-11-14，0项安排',exact:true}).count(),1);await page.waitForTimeout(4000);await page.getByRole('status',{name:'计划取消结果'}).getByText(/日历与预算已更新/).waitFor();await page.unroute('**/api/finance');
 });
 await check('取消已确认但刷新延迟时立即移除安排，保留所选日期周视图和筛选并显示同步中',async()=>{
  const name='模拟慢刷新',id=await seed(name);await page.reload({waitUntil:'networkidle'});await selectCalendar(name);await page.getByRole('button',{name:'本周',exact:true}).click();await page.getByLabel('日历安排类型').selectOption('travel');let release,started;const gate=new Promise(r=>{release=r}),captured=new Promise(r=>{started=r});let held=false;await page.route('**/api/finance',async route=>{if(!held&&route.request().method()==='GET'){held=true;const response=await route.fetch();started();await gate;await route.fulfill({response}).catch(()=>{});}else await route.continue()});
  const before=await state();await cancel(name);await captured;await dialog().waitFor({state:'detached'});await page.getByRole('button',{name:'2026-11-14，0项安排',exact:true}).waitFor();const result=page.getByRole('status',{name:'计划取消结果'});await result.getByText('正在同步日历与预算…',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'本周',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByLabel('日历安排类型').inputValue(),'travel');assert.equal(await page.getByRole('button',{name:'2026-11-14，0项安排',exact:true}).getAttribute('aria-pressed'),'true');release();await result.getByText(/日历与预算已更新/).waitFor();await page.unroute('**/api/finance');const after=await state();assert.equal(after.documents.find(d=>d.id===id).payload.status,'CANCELLED');assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.transactions,before.transactions);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'cancel-result-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 });
 await check('刷新失败保留已取消状态和明确结果，重试只读刷新而不重复取消',async()=>{
  const name='模拟刷新失败';await seed(name);await page.reload({waitUntil:'networkidle'});await selectCalendar(name);let failed=false,cancelPosts=0;await page.route('**/api/finance',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='plan.cancel')cancelPosts++;if(!failed&&route.request().method()==='GET'){failed=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'模拟读取失败'})})}else await route.continue()});
  await cancel(name);await dialog().waitFor({state:'detached'});const result=page.getByRole('status',{name:'计划取消结果'});await result.getByText(/取消已保存，但日历重新加载未完成/).waitFor();assert.equal(await page.getByRole('button',{name:'取消计划：'+name,exact:true}).count(),0);await result.getByRole('button',{name:'重新加载日历'}).click();await result.getByText(/日历与预算已更新/).waitFor();assert.equal(cancelPosts,1);await page.unroute('**/api/finance');await page.screenshot({path:path.join(out,'cancel-refresh-retried.png'),fullPage:true});
 });
 await check('新请求读到旧计划快照也不能恢复已取消安排，清楚提示需重新加载',async()=>{
  const name='模拟旧快照';await seed(name);await page.reload({waitUntil:'networkidle'});await selectCalendar(name);const stale=await state();let served=false;await page.route('**/api/finance',async route=>{if(!served&&route.request().method()==='GET'){served=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...stale,book:{...stale.book,revision:stale.book.revision+1}})})}else await route.continue()});await cancel(name);await dialog().waitFor({state:'detached'});const result=page.getByRole('status',{name:'计划取消结果'});await result.getByRole('button',{name:'重新加载日历'}).waitFor();assert.equal(await page.getByRole('button',{name:'取消计划：'+name,exact:true}).count(),0);await result.getByRole('button',{name:'重新加载日历'}).click();await result.getByText(/日历与预算已更新/).waitFor();await page.unroute('**/api/finance');
 });
 await check('开启显示已取消后状态即时变为已取消，提示与预算同步且不能再次取消',async()=>{
  const name='模拟显示取消记录';await seed(name);await page.reload({waitUntil:'networkidle'});await selectCalendar(name);await page.getByLabel('显示已取消').check();await cancel(name);await dialog().waitFor({state:'detached'});await page.getByRole('status',{name:'计划取消结果'}).getByText(/日历与预算已更新/).waitFor();const event=page.locator('.life-calendar-event').filter({has:page.getByRole('heading',{name,exact:true})});await event.getByText('已取消',{exact:true}).waitFor();assert.equal(await event.getByRole('button',{name:'取消计划：'+name}).count(),0);await nav('预算与大型支出');const card=page.locator('.plan-card').filter({has:page.getByRole('heading',{name,exact:true})});await card.getByText('已取消',{exact:true}).waitFor();
 });
 await check('取消响应丢失但原回执已提交时仍更新日历与成功提示，且只有一次取消写入',async()=>{
  const name='模拟取消响应丢失';await seed(name);await page.reload({waitUntil:'networkidle'});await selectCalendar(name);let interrupted=false,posts=0;await page.route('**/api/finance',async route=>{if(!interrupted&&route.request().method()==='POST'&&route.request().postDataJSON().action==='plan.cancel'){interrupted=true;posts++;await route.fetch();await route.abort('failed')}else await route.continue()});await cancel(name);await dialog().waitFor({state:'detached'});await page.getByRole('status',{name:'计划取消结果'}).getByText(/日历与预算已更新/).waitFor();assert.equal(posts,1);assert.equal(await page.getByRole('button',{name:'取消计划：'+name}).count(),0);await page.unroute('**/api/finance');
 });
 await check('取消被服务器拒绝不假报成功，不从日历移除原计划',async()=>{
  const name='模拟取消拒绝';const id=await seed(name);await page.reload({waitUntil:'networkidle'});await selectCalendar(name);await page.route('**/api/finance',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='plan.cancel')await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'模拟版本变化'})});else await route.continue()});await cancel(name);await page.getByRole('status').filter({hasText:/模拟版本变化/}).waitFor();assert.equal(await page.getByRole('status',{name:'计划取消结果'}).count(),0);assert.notEqual((await state()).documents.find(d=>d.id===id).payload.status,'CANCELLED');await page.unroute('**/api/finance');await page.keyboard.press('Escape');await dialog().waitFor({state:'detached'});
 });
 await check('取消后刷新遇到登录失效清空旧家庭展示，恢复连接只读加载最终状态',async()=>{
  const name='模拟登录失效';const id=await seed(name);await page.reload({waitUntil:'networkidle'});await selectCalendar(name);let denied=false;await page.route('**/api/finance',async route=>{if(!denied&&route.request().method()==='GET'){denied=true;await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'模拟登录失效，请重新连接'})})}else await route.continue()});await cancel(name);await page.getByRole('heading',{name:'暂时无法读取账本',exact:true}).waitFor();assert.equal(await page.getByRole('status',{name:'计划取消结果'}).count(),0);assert.equal(await page.locator('.life-calendar').count(),0);assert.equal((await state()).documents.find(d=>d.id===id).payload.status,'CANCELLED');await page.getByRole('button',{name:'重新连接',exact:true}).click();await page.getByRole('heading',{name:'生活日历',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'取消计划：'+name,exact:true}).count(),0);await page.unroute('**/api/finance');
 });
 assert.deepEqual(pageErrors,[]);
}catch(e){results.push({name:'执行中断',status:'FAIL',error:e.stack});console.error(e);if(page){fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{})}process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({date:new Date().toISOString(),scope:'日历取消真实HTTP/SQLite/Chrome故障模拟；无生产取消',productionWrites:false,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,pageErrors,results},null,2));await browser?.close();for(const child of children)child.kill('SIGTERM')}

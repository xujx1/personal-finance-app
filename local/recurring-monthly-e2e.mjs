import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
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
const out=path.join(root,'work/recurring-monthly/e2e');fs.mkdirSync(out,{recursive:true});
const env={...process.env,LOCAL_TEST_MODULES:path.join(root,'node_modules'),LOCAL_FAMILY_QA:'1',LOCAL_API_PORT:'5634',LOCAL_UI_PORT:'5633',LOCAL_QA_DATABASE:`qa-recurring-monthly-${Date.now()}.sqlite`};
for(const k of Object.keys(env))if(k.startsWith('NEW_API_')||k==='TAVILY_API_KEY')delete env[k];
await prepareVendor(env.LOCAL_TEST_MODULES);
const children=['local/server.mjs','local/vite-server.mjs'].map((script,i)=>{const log=fs.openSync(path.join(out,i?'ui.log':'api.log'),'w');return spawn(process.execPath,[script],{cwd:root,env,stdio:['ignore',log,log]})});
const url='http://127.0.0.1:5633',api='http://127.0.0.1:5634';
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
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),month=today.slice(0,7),day=Number(today.slice(8)),next=new Date(today+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1,1);const future=next.toISOString().slice(0,10);
const review=async()=> (await json('/api/reviews?month='+month)).value;
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}
async function ready(){await page.locator('.monthly-cover').waitFor()}
let bank,loan,archive;
try{
 await waitServer();browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>pageErrors.push(e.message));await context.route('**/*',r=>{const u=new URL(r.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)){unexpected.push(u.origin);return r.abort()}return r.continue()});
 for(const [name,category,amount]of [['模拟银行','cash','1000'],['模拟贷款','loan','500']]){const payload={name,category,currency:'CNY',amount,ownerMemberId:'user:'+owner,asOf:new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10),owned:true},d=await stage('asset',payload),r=await command('mcp.draft.accept',{draftId:d.id,confirmed:true,actualConfirmed:true,reviewedPayload:payload});if(category==='cash')bank=r.id;else loan=r.id}
 for(const [name,type,amount]of [['工资','income','200'],['固定费用','expense','30'],['贷款','loan','110']])await command('recurring.save',{name,type,amount,day,start:month+'-01',accountId:bank,cashMemberId:'user:'+owner,...(type==='loan'?{loanId:loan}:{}),confirmed:true});
 await command('recurring.save',{name:'下月才开始工资',type:'income',amount:'999',day:1,start:future,accountId:bank,cashMemberId:'user:'+owner,confirmed:true});
 await command('savings.goal.save',{schemaVersion:2,name:'模拟目标',bucketTargets:{stock:'1000000',deposits:'1000000',broadIndex:'1000000',preciousMetals:'1000000'},monthlyTarget:'15000'});
 await check('新增规则不改现金，总览与月报一致展示周期收入、流出和预计积累',async()=>{
  const before=await state();await page.goto(url,{waitUntil:'networkidle'});const projection=page.getByLabel('月目标周期预计',{exact:true});await projection.waitFor();assert.match(await projection.innerText(),/200\.00/);assert.match(await projection.innerText(),/140\.00/);assert.match(await projection.innerText(),/60\.00/);assert.match(await projection.innerText(),/1条规则首期不在本月/);
  await nav('月度报告');await ready();const r=page.getByRole('region',{name:'周期收支与月度积累'});assert.match(await r.innerText(),/200\.00/);assert.match(await r.innerText(),/140\.00/);const doc=(await review()).document;assert.equal(doc.monthlyAccumulation.change,0);assert.equal(doc.monthlyAccumulation.projectedChange,6000);assert.equal(doc.monthlyAccumulation.recurring.pendingCount,3);assert.deepEqual((await state()).accounts,before.accounts);assert.deepEqual((await state()).transactions,before.transactions);await r.getByText('查看本月周期事项（3项）',{exact:true}).click();await page.screenshot({path:path.join(out,'period-plan-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'保存本月报告',exact:true}).click();await page.getByRole('button',{name:'保存本月报告',exact:true}).isDisabled();for(let i=0;i<50;i++){archive=(await state()).documents.find(d=>d.kind==='monthly_report_archive');if(archive)break;await sleep(100)}assert.ok(archive);
 });
 await check('待核实不计实际；确认工资实际金额后页面刷新，剩余支出只扣一次',async()=>{
  await command('recurring.run',{through:today});assert.equal((await review()).document.monthlyAccumulation.change,0);const due=(await state()).documents.find(d=>d.kind==='recurring_occurrence'&&d.payload.type==='income');await command('recurring.confirm',{id:due.id,confirmed:true,amount:'210',date:today});await page.reload({waitUntil:'networkidle'});await nav('月度报告');await ready();const monthly=(await review()).document.monthlyAccumulation;assert.equal(monthly.change,21000);assert.equal(monthly.projectedChange,7000);assert.equal(monthly.recurring.pendingCount,2);const r=page.getByRole('region',{name:'周期收支与月度积累'});assert.match(await r.innerText(),/210\.00/);assert.match(await r.innerText(),/70\.00/);await r.getByRole('button',{name:'核对周期收支 →'}).click();await page.getByRole('heading',{name:'周期收支',exact:true}).waitFor();
 });
 await check('还贷含本金全额降低非房产积累，非工资收入同步两处，旧月报快照不变',async()=>{
  for(const type of ['expense','loan']){const d=(await state()).documents.find(d=>d.kind==='recurring_occurrence'&&d.payload.type===type);await command('recurring.confirm',{id:d.id,confirmed:true,date:today,...(type==='loan'?{principal:'97.25'}:{})})}
  let m=(await review()).document.monthlyAccumulation;assert.equal(m.change,7000);assert.equal(m.projectedChange,7000);assert.equal(m.recurring.pendingCount,0);await command('transaction.record',{type:'income',accountId:bank,cashMemberId:'user:'+owner,amount:'12.34',date:today,note:'模拟非工资收入',confirmed:true});await page.reload({waitUntil:'networkidle'});const p=page.getByLabel('月目标周期预计',{exact:true});await p.waitFor();assert.match(await p.innerText(),/82\.34/);await nav('月度报告');await ready();assert.match(await page.getByRole('region',{name:'周期收支与月度积累'}).innerText(),/82\.34/);m=(await review()).document.monthlyAccumulation;assert.equal(m.change,8234);assert.equal(m.projectedChange,8234);assert.equal((await state()).accounts.find(a=>a.id===bank).balance,108234);assert.equal((await state()).accounts.find(a=>a.id===loan).balance,40275);const saved=(await json('/api/reviews?month='+month+'&archive='+archive.id)).value.document;assert.equal(saved.monthlyAccumulation.change,0);assert.equal(saved.monthlyAccumulation.projectedChange,6000);
 });
 await check('手机月报与总览无横向溢出，家庭外拒绝读取周期与报告',async()=>{
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'period-report-mobile.png'),fullPage:true});await nav('财务总览');await page.getByLabel('月目标周期预计',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal((await json('/api/reviews?month='+month,{user:'local-simulated-outsider',allowError:true})).status,403);assert.deepEqual(pageErrors,[]);assert.deepEqual(unexpected,[]);
 });
}catch(e){results.push({name:'执行中断',status:'FAIL',error:e.stack});console.error(e);if(page){fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{})}process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({date:new Date().toISOString(),productionWrites:false,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,pageErrors,unexpected,results},null,2));await browser?.close();for(const child of children)child.kill('SIGTERM')}

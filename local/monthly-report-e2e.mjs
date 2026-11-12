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
const out=path.join(root,'work/monthly-report/e2e');fs.mkdirSync(out,{recursive:true});
const env={...process.env,LOCAL_TEST_MODULES:path.join(root,'node_modules'),LOCAL_FAMILY_QA:'1',LOCAL_API_PORT:'5864',LOCAL_UI_PORT:'5863',LOCAL_QA_DATABASE:`qa-monthly-report-${Date.now()}.sqlite`};
for(const k of Object.keys(env))if(k.startsWith('NEW_API_')||k==='TAVILY_API_KEY')delete env[k];
await prepareVendor(env.LOCAL_TEST_MODULES);
const children=['local/server.mjs','local/vite-server.mjs'].map((script,i)=>{const log=fs.openSync(path.join(out,i?'ui.log':'api.log'),'w');return spawn(process.execPath,[script],{cwd:root,env,stdio:['ignore',log,log]})});
const url='http://127.0.0.1:5863',api='http://127.0.0.1:5864';
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
const month='2026-10',dialog=()=>page.getByRole('dialog');
const financialState=s=>({accounts:s.accounts,transactions:s.transactions,documents:s.documents.filter(d=>d.kind!=='monthly_report_archive')});
const review=async(archive,user=owner)=> (await json('/api/reviews?month='+month+(archive?'&archive='+encodeURIComponent(archive):''),{user})).value;
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}
async function poll(fn,message){for(let i=0;i<80;i++){const value=await fn();if(value)return value;await sleep(100)}throw Error(message)}
async function chooseVersion(id){
 const selected=page.getByLabel('报告版本',{exact:true});
 if(await selected.inputValue()===id){await page.locator('.monthly-cover').waitFor();return}
 const loaded=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/api/reviews'&&u.searchParams.get('month')===month&&(u.searchParams.get('archive')??'')===(id==='live'?'':id)&&r.ok()});
 await selected.selectOption(id);await loaded;
}
async function saveReport(){
 const before=(await state()).documents.filter(d=>d.kind==='monthly_report_archive').length;
 await page.getByRole('button',{name:'保存本月报告',exact:true}).click();
 return poll(async()=>{const s=await state(),rows=s.documents.filter(d=>d.kind==='monthly_report_archive');return rows.length>before?rows.sort((a,b)=>b.payload.version-a.payload.version)[0]:null},'report archive was not saved');
}
let bank,firstArchive,firstDocument;
try{
 await waitServer();browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)){unexpected.push(u.origin);return route.abort()}return route.continue()});
 page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>pageErrors.push(e.message));page.on('request',r=>requests.push({path:new URL(r.url()).pathname,method:r.method(),action:r.method()==='POST'&&r.url().endsWith('/api/finance')?r.postDataJSON()?.action:undefined}));
 const payload={name:'模拟月报银行',category:'cash',currency:'CNY',amount:'1000.00',ownerMemberId:'user:'+owner,asOf:'2026-09-01',owned:true},draft=await stage('asset',payload);bank=(await command('mcp.draft.accept',{draftId:draft.id,confirmed:true,actualConfirmed:true,reviewedPayload:payload})).id;
 await command('transaction.record',{type:'expense',accountId:bank,cashMemberId:'user:'+owner,amount:'20.00',date:'2026-10-10',note:'模拟月报餐费',confirmed:true});
 await check('家庭管理、目标设置与工作流集成统一置于账户菜单，侧栏保留日常页面',async()=>{
  await page.goto(url,{waitUntil:'networkidle'});for(const name of ['家庭管理','目标设置','工作流集成'])assert.equal(await page.getByRole('navigation').getByRole('button',{name,exact:true}).count(),0);
  await page.getByRole('button',{name:'账户菜单',exact:true}).click();const menu=page.getByRole('region',{name:'当前账户',exact:true});assert.deepEqual(await menu.getByRole('button').allTextContents(),['家庭管理›','目标设置›','工作流集成›']);assert.equal(await menu.getByRole('link',{name:'退出登录'}).getAttribute('href'),'/signout-with-chatgpt?return_to=%2F');await page.keyboard.press('Escape');
  await nav('目标设置');await page.getByRole('heading',{name:'目标设置',exact:true}).waitFor();await nav('家庭管理');await page.getByRole('heading',{name:'家庭管理',exact:true}).waitFor();await nav('工作流集成');await page.getByRole('heading',{name:'工作流集成',exact:true}).waitFor();await page.getByLabel('Codex安装命令').waitFor();assert.equal(await page.getByRole('region',{name:'ChatGPT处理入口'}).count(),0);assert.equal(await page.getByLabel('Skill工作流正文').count(),0);assert.equal(await page.getByRole('link',{name:/下载Skill|备份/}).count(),0);
 });
 await check('月报实时文档包含完整分录，保存版本只新增报告快照而不改变财务',async()=>{
  await nav('月度报告');await page.getByLabel('月份',{exact:true}).fill(month);await page.getByLabel('报告版本',{exact:true}).waitFor();await poll(async()=>!(await page.getByRole('button',{name:'保存本月报告',exact:true}).isDisabled()),'report did not become ready');assert.equal(await page.getByRole('button',{name:'交给ChatGPT ↗'}).count(),0);
  const before=await state(),live=await review();firstDocument=live.document;assert.equal(firstDocument.month,month);assert.ok(firstDocument.flows.some(row=>JSON.stringify(row).includes('模拟月报餐费')));assert.equal(firstDocument.ledger.currencies.find(row=>row.currency==='CNY').journalExpenseMinor,2000);assert.equal(firstDocument.nextMonth.available,false);
  firstArchive=await saveReport();assert.equal(firstArchive.payload.version,1);assert.deepEqual(financialState(await state()),financialState(before));const archived=await review(firstArchive.id);assert.equal(archived.archived,true);assert.deepEqual(archived.document,firstDocument);await chooseVersion(firstArchive.id);await page.screenshot({path:path.join(out,'saved-report-desktop.png'),fullPage:true});
 });
 await check('财务变化更新实时版，已存版本保持原文，重新保存生成第二版',async()=>{
  await command('transaction.record',{type:'expense',accountId:bank,cashMemberId:'user:'+owner,amount:'7.00',date:'2026-10-11',note:'模拟保存后新增餐费',confirmed:true});await page.reload({waitUntil:'networkidle'});await nav('月度报告');await page.getByLabel('月份',{exact:true}).fill(month);await poll(async()=>!(await page.getByRole('button',{name:'保存本月报告',exact:true}).isDisabled()),'changed live report did not become ready');
  const live=await review();assert.notEqual(live.document.fingerprint,firstDocument.fingerprint);assert.equal(live.document.ledger.currencies.find(row=>row.currency==='CNY').journalExpenseMinor,2700);assert.deepEqual((await review(firstArchive.id)).document,firstDocument);
  await chooseVersion(firstArchive.id);assert.equal(await page.getByRole('button',{name:'保存本月报告',exact:true}).isDisabled(),true);assert.equal(await page.getByText('模拟保存后新增餐费',{exact:true}).count(),0);await chooseVersion('live');await page.getByText('模拟保存后新增餐费',{exact:true}).waitFor();const before=await state(),second=await saveReport();assert.equal(second.payload.version,2);assert.notEqual(second.id,firstArchive.id);assert.deepEqual(financialState(await state()),financialState(before));assert.deepEqual((await review(firstArchive.id)).document,firstDocument);
  const count=(await review()).archives.length;const repeated=await command('monthly.report.save',{month,expectedFingerprint:second.payload.fingerprint});assert.equal(repeated.id,second.id);assert.equal((await review()).archives.length,count);await page.screenshot({path:path.join(out,'report-versions-desktop.png'),fullPage:true});
 });
 await check('旧内容指纹拒绝保存，家庭成员可读不可写，外人无法读取版本',async()=>{
  const before=await state(),rejected=await json('/api/finance',{allowError:true,body:{key:crypto.randomUUID(),revision:before.book.revision,action:'monthly.report.save',body:{month,expectedFingerprint:firstDocument.fingerprint}}});assert.equal(rejected.status,409);assert.deepEqual(await state(),before);
  const family=(await json('/api/family')).value,invite=(await json('/api/family',{body:{action:'invite',revision:family.family.revision}})).value;await json('/api/family',{user:member,body:{action:'accept',token:invite.token}});assert.deepEqual((await review(firstArchive.id,member)).document,firstDocument);
  const memberContext=await browser.newContext({extraHTTPHeaders:{'x-local-qa-user':member}}),memberPage=await memberContext.newPage();await memberPage.goto(url,{waitUntil:'networkidle'});await nav('月度报告',memberPage);await memberPage.getByLabel('月份',{exact:true}).fill(month);await memberPage.getByLabel('报告版本',{exact:true}).waitFor();assert.equal(await memberPage.getByRole('button',{name:'保存本月报告',exact:true}).isDisabled(),true);await memberContext.close();
  const protectedState=await state();assert.equal((await json('/api/reviews?month='+month+'&archive='+firstArchive.id,{user:'local-simulated-outsider',allowError:true})).status,403);assert.equal((await json('/api/finance',{user:member,allowError:true,body:{key:crypto.randomUUID(),revision:protectedState.book.revision,action:'monthly.report.save',body:{month,expectedFingerprint:(await review()).document.fingerprint}}})).status,403);assert.deepEqual(await state(),protectedState);
 });
 await check('周期页面按需读取历史，新增规则通过弹窗完成并保持现金不变',async()=>{
  await page.reload({waitUntil:'networkidle'});const readsBefore=requests.filter(r=>r.path==='/api/recurring').length;await nav('周期收支');await page.getByRole('button',{name:'新增规则',exact:true}).waitFor();assert.equal(await dialog().count(),0);assert.equal(await page.getByLabel('规则名称',{exact:true}).count(),0);assert.equal(requests.filter(r=>r.path==='/api/recurring').length,readsBefore);
  await page.getByRole('button',{name:'历史候选',exact:true}).click();await dialog().getByRole('heading',{name:'从完整流水归并周期候选'}).waitFor();await dialog().getByRole('heading',{name:'本次无可导入候选'}).waitFor();assert.equal(requests.filter(r=>r.path==='/api/recurring').length,readsBefore+1);await page.keyboard.press('Escape');await dialog().waitFor({state:'detached'});
  await page.getByRole('button',{name:'新增规则',exact:true}).click();await dialog().getByLabel('规则名称',{exact:true}).fill('模拟弹窗固定收入');await dialog().getByLabel('每期金额 CNY',{exact:true}).fill('123.45');await dialog().getByLabel('每月日期（1–31，短月取月末）',{exact:true}).fill('15');await dialog().getByLabel('生效日期（历史日期需核对余额快照）',{exact:true}).fill('2026-12-01');await dialog().getByLabel('收付款成员',{exact:true}).selectOption('user:'+owner);await dialog().getByLabel('人民币现金账户',{exact:true}).selectOption(bank);assert.equal(await dialog().getByRole('checkbox',{name:/到期自动更新本站账本/}).isChecked(),false);await dialog().getByRole('checkbox',{name:'我已确认金额、日期和账户，未从单笔流水猜测固定收入'}).check();const before=await state();assert.deepEqual(await dialog().locator('form').evaluate(form=>Array.from(form.elements).filter(input=>input.willValidate&&!input.checkValidity()).map(input=>({name:input.name,value:input.value,message:input.validationMessage}))),[]);await dialog().getByRole('button',{name:'保存确认的规则',exact:true}).click();await dialog().waitFor({state:'detached'});await page.getByText('模拟弹窗固定收入',{exact:true}).waitFor();const after=await state();assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.transactions,before.transactions);assert.equal(after.documents.find(d=>d.kind==='recurring_rule').payload.autoPost,false);
 });
 await check('手机月报、账户菜单与周期弹窗无横向溢出，无脚本或外部请求',async()=>{
  await page.setViewportSize({width:390,height:844});await nav('月度报告');await page.getByLabel('月份',{exact:true}).fill(month);await page.getByLabel('报告版本',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'monthly-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'账户菜单',exact:true}).click();await page.getByRole('region',{name:'当前账户',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'account-menu-mobile.png'),fullPage:true});await page.keyboard.press('Escape');await nav('周期收支');await page.getByRole('button',{name:'新增规则',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'recurring-dialog-mobile.png'),fullPage:true});await page.keyboard.press('Escape');await dialog().waitFor({state:'detached'});assert.deepEqual(pageErrors,[]);assert.deepEqual(unexpected,[]);assert.equal(requests.some(r=>/^\/api\/(advisor|investment|images|research|chatgpt)$/.test(r.path)),false);
 });
 fs.writeFileSync(path.join(out,'final-state.json'),JSON.stringify(await state(),null,2));
}catch(e){results.push({name:'执行中断',status:'FAIL',error:e.stack});console.error(e);if(page){fs.writeFileSync(path.join(out,'requests.json'),JSON.stringify(requests,null,2));fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{})}process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({date:new Date().toISOString(),scope:'月报实时与不可变版本、账户导航、周期弹窗真实HTTP/SQLite/Chrome；独立模拟家庭',productionWrites:false,database:env.LOCAL_QA_DATABASE,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,pageErrors,unexpected,results},null,2));await browser?.close();for(const child of children)child.kill('SIGTERM')}

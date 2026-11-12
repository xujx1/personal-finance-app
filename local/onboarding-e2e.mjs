import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareVendor} from './prepare-vendor.mjs';

// Real HTTP, SQLite and Chrome. Structured ChatGPT output below is explicitly
// simulated; no model/provider, real household or production endpoint is used.
const root=fileURLToPath(new URL('../',import.meta.url));
const modules=path.resolve(process.env.LOCAL_TEST_MODULES??process.argv[2]??path.join(root,'work/calendar-qa/node_modules'));
const {chromium}=createRequire(path.join(modules,'../package.json'))(path.join(modules,'playwright'));
const out=path.join(root,'work/onboarding/e2e');fs.mkdirSync(out,{recursive:true});
const env={...process.env,LOCAL_TEST_MODULES:path.join(root,'node_modules'),LOCAL_FAMILY_QA:'1',LOCAL_API_PORT:'5964',LOCAL_UI_PORT:'5963',LOCAL_QA_DATABASE:`qa-onboarding-${Date.now()}.sqlite`};
for(const key of Object.keys(env))if(key.startsWith('NEW_API_')||key==='TAVILY_API_KEY')delete env[key];
await prepareVendor(env.LOCAL_TEST_MODULES);
const children=['local/server.mjs','local/vite-server.mjs'].map((script,i)=>{const log=fs.openSync(path.join(out,i?'ui.log':'api.log'),'w');return spawn(process.execPath,[script],{cwd:root,env,stdio:['ignore',log,log]})});
const url='http://127.0.0.1:5963',api='http://127.0.0.1:5964';
const owner='local-simulated-owner',viewer='local-simulated-member',outsider='local-simulated-outsider';
const results=[],pageErrors=[],unexpected=[],chatgptLaunches=[],screenshots=[];
let browser,page;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const beforeSnapshot=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const future=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const setup=(section,data)=>({section,data,analysis:'隔离验收的模拟ChatGPT结构化输出；用户明确提供资料，等待本人核对，不代表实际模型访谈。'});
async function waitServer(){for(let i=0;i<120;i++){try{if((await fetch(url)).ok&&(await fetch(api+'/api/finance')).ok)return}catch{}await sleep(200)}throw Error('isolated onboarding preview did not start')}
async function json(route,{user=owner,body,allowError=false}={}){const response=await fetch(api+route,{method:body?'POST':'GET',headers:{'x-local-qa-user':user,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!allowError)assert.ok(response.ok,JSON.stringify(value));return {status:response.status,value}}
const state=async()=> (await json('/api/finance')).value;
async function rpc(name,args={},user=owner){return json('/mcp',{user,body:{jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}},allowError:true})}
async function call(name,args={},user=owner){const r=await rpc(name,args,user);assert.equal(r.status,200,JSON.stringify(r));assert.ok(!r.value.result?.isError,JSON.stringify(r.value));return r.value.result.structuredContent}
async function stage(kind,payload){return call('submit_finance_draft',{kind,payload,request_id:crypto.randomUUID(),expected_revision:(await state()).book.revision})}
async function command(action,body,{user=owner,allowError=false}={}){return json('/api/finance',{user,allowError,body:{key:crypto.randomUUID(),revision:(await state()).book.revision,action,body}})}
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}
async function nav(name,p=page){
 if(['家庭管理','目标设置','工作流集成'].includes(name)){await p.getByRole('button',{name:'账户菜单',exact:true}).click();await p.getByRole('region',{name:'当前账户',exact:true}).getByRole('button',{name,exact:true}).click();return}
 const toggle=p.getByRole('button',{name:'切换菜单'});if(await toggle.isVisible())await toggle.click();await p.getByRole('navigation').getByRole('button',{name,exact:true}).click();await p.locator('.sidebar').evaluate(node=>Promise.all(node.getAnimations().map(a=>a.finished.catch(()=>{}))));
}
const card=(id,p=page)=>p.locator(`[data-draft-id="${id}"]`);
async function open(id,p=page){await nav('研究记录',p);await p.getByRole('button',{name:/^待处理（/}).click();await p.getByLabel('草稿类型',{exact:true}).selectOption('all');await p.getByLabel('搜索同步草稿',{exact:true}).fill(id);const c=card(id,p);await c.locator(':scope > details > summary').click();return c}
async function reload(name){await page.reload({waitUntil:'networkidle'});if(name)await nav(name)}
async function accepted(id){await card(id).waitFor({state:'detached'});return (await state()).documents.find(d=>d.id===id).payload.destinationId}
async function adoptSetup(id){const c=await open(id);await c.getByRole('checkbox',{name:'我已核对家庭建档资料',exact:true}).check();await c.getByRole('button',{name:'核对并保存建档资料',exact:true}).click();return accepted(id)}
async function adoptActual(id,kind,{coverage='uncovered'}={}){const c=await open(id);if(kind==='cashflow'){await c.getByLabel('当前余额覆盖情况').selectOption(coverage)}await c.getByRole('checkbox',{name:/我已确认/}).check();await c.getByRole('checkbox',{name:/我已逐项核对外部分析/}).check();await c.getByRole('button',{name:kind==='asset'?'采用并登记已有资产':'采用并记录实际流水',exact:true}).click();return accepted(id)}
async function screenshot(name){const filename=path.join(out,name+'.png');await page.screenshot({path:filename,fullPage:true});screenshots.push(filename)}
const asset=(name,category,amount,ownerMemberId,extra={})=>({name,category,currency:'CNY',amount,ownerMemberId,asOf:today,owned:true,analysis:'隔离模拟：用户已持有的同日余额，不是新买入，也不是收入。',...extra});
const recurring=(accountId,cashMemberId,extra={})=>setup('recurring',{name:'模拟明确固定工资',type:'income',accountId,cashMemberId,amount:'20000.00',day:10,start:future,end:null,...extra});
try{
 await waitServer();browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();if(u.hostname==='chatgpt.com'){chatgptLaunches.push(u.href);return route.abort()}unexpected.push(u.origin);return route.abort()});
 page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>pageErrors.push(e.message));
 await check('空家庭显示六步建档入口，基础类别存在但未替用户设置400万元目标',async()=>{
  await page.goto(url,{waitUntil:'networkidle'});const start=page.getByRole('region',{name:'家庭财务建档',exact:true});await start.waitFor();assert.equal(await start.locator('.household-steps > div').count(),6);await start.getByRole('button',{name:/开始家庭财务建档/}).waitFor();
  const s=await state(),c=await call('get_financial_context');assert.equal(s.accounts.filter(a=>a.category!=='system').length,0);assert.equal(s.documents.filter(d=>d.kind==='savings_goal').length,0);assert.equal(c.onboarding.empty,true);assert.equal(c.onboarding.goalConfigured,false);assert.equal(c.onboarding.steps.find(s=>s.key==='asset_types').status,'ready');assert.ok(c.assetTypes.length>=14);assert.equal((await call('get_skill_bundle')).skills.length,6);await screenshot('01-empty-desktop');
 });
 await check('建档按钮准备家庭私有onboarding任务，再打开ChatGPT入口',async()=>{
  await page.getByRole('region',{name:'家庭财务建档',exact:true}).getByRole('button',{name:/开始家庭财务建档/}).click();const start=page.getByRole('region',{name:'家庭财务建档',exact:true});await start.getByRole('button',{name:'交给ChatGPT ↗',exact:true}).waitFor();
  const popupPromise=page.waitForEvent('popup');await start.getByRole('button',{name:'交给ChatGPT ↗',exact:true}).click();const popup=await popupPromise;await page.getByRole('status').filter({hasText:'任务已保存在家庭内'}).waitFor();for(let i=0;i<30&&!chatgptLaunches.length;i++)await sleep(100);assert.ok(chatgptLaunches.includes('https://chatgpt.com/'));await popup.close();
  const s=await state(),request=s.documents.find(d=>d.kind==='research_request'&&d.payload.kind==='onboarding');assert.ok(request);assert.match(request.payload.question,/每次只问当前关键缺项/);assert.equal((await call('get_financial_context')).onboarding.steps.length,6);await screenshot('02-workflow-task');
 });
 await check('已有资产专用任务保持单一入口，普通工作流导航恢复家庭建档入口',async()=>{
  await nav('资产与贷款');await page.getByRole('button',{name:'通过ChatGPT登记',exact:true}).click();assert.equal(await page.getByRole('region',{name:'家庭财务建档',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'交给ChatGPT ↗',exact:true}).count(),1);
  await nav('工作流集成');await page.getByRole('region',{name:'家庭财务建档',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'交给ChatGPT ↗',exact:true}).count(),1);
 });
 let spouse,kid,bank,zero,fund,loan,firstRule;
 await check('成员草稿只在研究记录核对；改称呼后重新确认且不授予访问权',async()=>{
  const before=await state(),d=await stage('setup',setup('members',{members:[{name:'模拟配偶'},{name:'模拟孩子'}]}));assert.equal((await state()).financeMembers.some(m=>m.name==='模拟配偶'),false);
  for(const name of ['财务总览','家庭管理','目标设置','工作流集成']){await reload(name);assert.equal(await card(d.id).count(),0)}await reload('研究记录');await card(d.id).waitFor();
  const c=await open(d.id),box=c.getByRole('checkbox',{name:'我已核对家庭建档资料',exact:true});await box.check();await c.getByLabel('成员称呼 2',{exact:true}).fill('模拟宝宝');assert.equal(await box.isChecked(),false);await box.check();await c.getByRole('button',{name:'核对并保存建档资料',exact:true}).click();await accepted(d.id);
  const s=await state();spouse=s.financeMembers.find(m=>m.name==='模拟配偶').id;kid=s.financeMembers.find(m=>m.name==='模拟宝宝').id;assert.ok(spouse.startsWith('person:'));assert.equal(s.financeMembers.find(m=>m.id===kid).userId,null);assert.deepEqual(s.householdMembers,before.householdMembers);assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.transactions,before.transactions);
 });
 await check('新增教育基金类别沿用十四个基础类别，不自动创建账户或资金流水',async()=>{
  const before=await state(),d=await stage('setup',setup('asset_types',{additions:[{id:'onboarding_education',name:'模拟教育基金',baseCategory:'fund',goalBucket:null}]}));await reload('工作流集成');await adoptSetup(d.id);const s=await state(),catalogue=s.documents.find(d=>d.kind==='asset_type_catalog');assert.equal(catalogue.payload.types.length,16);assert.ok(catalogue.payload.types.some(t=>t.id==='onboarding_education'&&t.enabled));assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.transactions,before.transactions);
 });
 await check('已有本人现金仅建立OPENING分录，不记新收入且草稿提交本身不改账',async()=>{
  const d=await stage('asset',asset('模拟本人工行余额','cash','1000.00','user:'+owner));assert.equal((await state()).accounts.filter(a=>a.category==='cash').length,0);await reload('资产与贷款');bank=await adoptActual(d.id,'asset');const s=await state();assert.equal(s.accounts.find(a=>a.id===bank).balance,100000);assert.equal(s.accounts.find(a=>a.id===bank).metadata.ownerMemberId,'user:'+owner);assert.equal(s.transactions.length,1);assert.equal(s.transactions[0].kind,'OPENING');
 });
 await check('只有一笔银行开账也能核对明确20000元未来工资，规则默认不自动入账且不补历史工资',async()=>{
  const before=await state();assert.equal(before.transactions.length,1);assert.equal((await call('get_recurring_candidates')).candidates.length,0);const d=await stage('setup',recurring(bank,'user:'+owner));await reload('工作流集成');firstRule=await adoptSetup(d.id);const s=await state(),rule=s.documents.find(d=>d.id===firstRule).payload;assert.equal(rule.amount,2000000);assert.equal(rule.autoPost,false);assert.equal(rule.principal,null);assert.equal(rule.start,future);assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.transactions,before.transactions);assert.equal(s.transactions.some(t=>t.kind==='INCOME'),false);
 });
 await check('配偶零余额现金、宝宝基金和配偶贷款按真实成员ID登记，不扣已有现金',async()=>{
  for(const [name,category,amount,memberId,extra] of [['模拟配偶零余额银行','cash','0.00',spouse,{}],['模拟宝宝教育基金','fund','500.00',kid,{assetTypeId:'onboarding_education'}],['模拟配偶贷款','loan','100000.00',spouse,{}]]){
   const before=await state(),d=await stage('asset',asset(name,category,amount,memberId,extra));await reload('资产与贷款');const id=await adoptActual(d.id,'asset'),s=await state(),a=s.accounts.find(a=>a.id===id);assert.equal(a.metadata.ownerMemberId,memberId);assert.equal(s.accounts.find(a=>a.id===bank).balance,100000);if(category==='cash'){zero=id;assert.equal(a.balance,0);assert.equal(s.transactions.length,before.transactions.length)}else if(category==='fund'){fund=id;assert.equal(a.balance,50000)}else{loan=id;assert.equal(a.balance,10000000)}
  }
  const s=await state();assert.equal(s.transactions.every(t=>t.kind==='OPENING'),true);assert.equal(s.transactions.length,3);
 });
 await check('目标1000000元保存为100万元，采用时可修改并重确认，不沿用示例400万元',async()=>{
  const before=await state(),p=setup('goals',{name:'模拟家庭积累目标',targets:[{scope:'group:deposits',target:'900000.00'}],monthlyTarget:'3000.00',deadline:'2030-12-31'}),d=await stage('setup',p);await reload('目标设置');const c=await open(d.id),box=c.getByRole('checkbox',{name:'我已核对家庭建档资料',exact:true});await box.check();await c.getByLabel('目标金额 CNY 1',{exact:true}).fill('1000000.00');assert.equal(await box.isChecked(),false);await box.check();await c.getByRole('button',{name:'核对并保存建档资料',exact:true}).click();const id=await accepted(d.id),s=await state(),goal=s.documents.find(d=>d.id===id).payload;assert.equal(goal.targets[0].target,100000000);assert.equal(goal.targets[0].scope,'group:deposits');assert.equal(goal.monthlyTarget,300000);assert.equal(s.documents.filter(d=>d.kind==='savings_goal').length,1);assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.transactions,before.transactions);assert.equal((await call('get_financial_context')).onboarding.goalConfigured,true);await screenshot('03-goal-desktop');
 });
 await check('固定规则成员及账户修改重置核对，提交采用实际表单成员与账户',async()=>{
  const before=await state(),d=await stage('setup',recurring(bank,'user:'+owner,{name:'模拟明确固定支出',type:'expense',amount:'1200.00'}));await reload('工作流集成');const c=await open(d.id),box=c.getByRole('checkbox',{name:'我已核对家庭建档资料',exact:true});await box.check();await c.getByLabel('规则类型',{exact:true}).selectOption('loan');assert.equal(await box.isChecked(),false);await c.getByLabel(/^贷款账户/).selectOption(loan);await box.check();await c.getByLabel('规则类型',{exact:true}).selectOption('expense');assert.equal(await box.isChecked(),false);await box.check();await c.getByLabel('收付款成员',{exact:true}).selectOption(spouse);assert.equal(await box.isChecked(),false);assert.equal(await c.getByLabel('人民币现金账户',{exact:true}).inputValue(),'');assert.equal(await c.getByLabel('人民币现金账户',{exact:true}).locator(`option[value="${bank}"]`).count(),0);await box.check();await c.getByLabel('人民币现金账户',{exact:true}).selectOption(zero);assert.equal(await box.isChecked(),false);await box.check();await c.getByRole('button',{name:'核对并保存建档资料',exact:true}).click();const id=await accepted(d.id),s=await state(),rule=s.documents.find(d=>d.id===id).payload;assert.equal(rule.accountId,zero);assert.equal(rule.cashMemberId,spouse);assert.equal(rule.autoPost,false);assert.equal(rule.type,'expense');assert.equal(rule.loanId,null);assert.equal(rule.assetId,null);assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.transactions,before.transactions);
 });
 await check('已含快照的123.45元历史支出必须匹配核实日期，保存后不再次扣现金',async()=>{
  const p={type:'expense',accountId:bank,cashMemberId:'user:'+owner,amount:'123.45',date:beforeSnapshot,note:'模拟已含银行余额的历史消费',balanceIncluded:false,analysis:'隔离模拟用户确认：这笔历史消费已经包含在当前银行余额内。'},d=await stage('cashflow',p);
  const wrong=await command('mcp.draft.accept',{draftId:d.id,confirmed:true,actualConfirmed:true,reviewedPayload:{...p,balanceIncluded:true,snapshotDate:beforeSnapshot}},{allowError:true});assert.equal(wrong.status,422);assert.match(wrong.value.error,/历史覆盖日期须匹配/);assert.equal((await state()).accounts.find(a=>a.id===bank).balance,100000);assert.equal((await state()).documents.find(x=>x.id===d.id).payload.status,'PENDING');
  await reload('现金流水');const id=await adoptActual(d.id,'cashflow',{coverage:'included'}),s=await state(),tx=s.transactions.find(t=>t.id===id);assert.equal(s.accounts.find(a=>a.id===bank).balance,100000);assert.equal(tx.kind,'EXPENSE');assert.equal(tx.total_minor??tx.totalMinor,12345);assert.equal(tx.metadata.balanceIncluded,true);assert.equal(tx.metadata.snapshotDate,today);assert.equal(s.transactions.some(t=>t.kind==='INCOME'),false);await screenshot('04-history-desktop');
 });
 await check('配置依据变更后旧建档草稿拒绝采用，并保留待核对状态',async()=>{
  const p=setup('members',{members:[{name:'模拟待核对成员'}]}),d=await stage('setup',p);await command('member.save',{name:'模拟后来新增成员'});await reload('家庭管理');const c=await open(d.id);await c.getByRole('checkbox',{name:'我已核对家庭建档资料',exact:true}).check();await c.getByRole('button',{name:'核对并保存建档资料',exact:true}).click();await page.getByText(/建档配置依据已变化/).first().waitFor();const s=await state();assert.equal(s.documents.find(x=>x.id===d.id).payload.status,'PENDING');assert.equal(s.financeMembers.some(m=>m.name==='模拟待核对成员'),false);
 });
 await check('跨成员、外部账户和额外自动入账字段不能通过ChatGPT草稿提交',async()=>{
  const invalid=[recurring(bank,spouse),recurring('foreign-account','user:'+owner),recurring(bank,'user:foreign'),recurring(bank,'user:'+owner,{autoPost:true}),setup('members',{members:[{name:'试图关联外人',linkedUserId:outsider}]})];const before=await state();for(const payload of invalid){const r=await rpc('submit_finance_draft',{kind:'setup',payload,request_id:crypto.randomUUID(),expected_revision:(await state()).book.revision});assert.equal(r.value.result.isError,true,JSON.stringify(r))}const s=await state();assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.transactions,before.transactions);assert.equal(s.documents.length,before.documents.length);
 });
 await check('只读家人只能查看不能提交或采用，外人和未登录者无法读取或操作家庭草稿',async()=>{
  const family=(await json('/api/family')).value,invite=(await json('/api/family',{body:{action:'invite',revision:family.family.revision}})).value;await json('/api/family',{user:viewer,body:{action:'accept',token:invite.token}});
  const p=setup('members',{members:[{name:'模拟只读待核对'}]}),d=await stage('setup',p),before=await state(),readContext=await browser.newContext({extraHTTPHeaders:{'x-local-qa-user':viewer}}),readPage=await readContext.newPage();await readPage.goto(url,{waitUntil:'networkidle'});await nav('工作流集成',readPage);const c=await open(d.id,readPage);assert.equal(await c.getByRole('checkbox',{name:'我已核对家庭建档资料',exact:true}).isDisabled(),true);assert.equal(await c.getByRole('button',{name:'核对并保存建档资料',exact:true}).isDisabled(),true);assert.equal((await rpc('submit_finance_draft',{kind:'setup',payload:p,request_id:crypto.randomUUID(),expected_revision:before.book.revision},viewer)).value.result.isError,true);assert.equal((await command('mcp.draft.accept',{draftId:d.id,confirmed:true,reviewedPayload:p},{user:viewer,allowError:true})).status,403);await readContext.close();
  for(const user of [outsider,'not-a-user']){const status=user===outsider?403:401;assert.equal((await json('/api/finance',{user,allowError:true})).status,status);assert.equal((await rpc('get_financial_context',{},user)).status,status);assert.equal((await rpc('submit_finance_draft',{kind:'setup',payload:p,request_id:crypto.randomUUID(),expected_revision:before.book.revision},user)).status,status);assert.equal((await command('mcp.draft.accept',{draftId:d.id,confirmed:true,reviewedPayload:p},{user,allowError:true})).status,status)}
  const s=await state();assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.transactions,before.transactions);assert.equal(s.documents.find(x=>x.id===d.id).payload.status,'PENDING');
 });
 await check('手机六步建档及草稿核对无横向溢出，页面无异常且没有实际外部调用',async()=>{
  await reload('工作流集成');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot('05-workflow-mobile');const pending=(await state()).documents.find(d=>d.kind==='financial_draft'&&d.payload.kind==='setup'&&d.payload.status==='PENDING'&&d.payload.payload.data.members?.[0].name==='模拟只读待核对');const c=await open(pending.id);await c.getByRole('form',{name:'家庭建档草稿核对'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot('06-review-mobile');assert.deepEqual(pageErrors,[]);assert.deepEqual(unexpected,[]);assert.equal(chatgptLaunches.length,1);const s=await state();assert.equal(s.accounts.find(a=>a.id===bank).balance,100000);assert.equal(s.accounts.find(a=>a.id===zero).balance,0);assert.equal(s.accounts.find(a=>a.id===fund).metadata.ownerMemberId,kid);assert.equal(s.accounts.find(a=>a.id===loan).metadata.ownerMemberId,spouse);assert.equal(s.transactions.filter(t=>t.kind==='OPENING').length,3);assert.equal(s.transactions.filter(t=>t.kind==='EXPENSE').length,1);assert.equal(s.transactions.filter(t=>t.kind==='INCOME').length,0);
 });
 fs.writeFileSync(path.join(out,'final-state.json'),JSON.stringify(await state(),null,2));
}catch(error){results.push({name:'执行中断',status:'FAIL',error:error.stack});console.error(error);if(page){fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{})}process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({date:new Date().toISOString(),scope:'隔离真实HTTP/SQLite/Chrome；ChatGPT结构化输出是透明模拟，不是实际模型访谈或客户端授权验证',productionWrites:false,database:env.LOCAL_QA_DATABASE,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,pageErrors,unexpected,chatgptLaunches,screenshots,results},null,2));await browser?.close();for(const child of children)child.kill('SIGTERM')}

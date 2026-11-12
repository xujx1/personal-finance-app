import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const modules=process.argv[2];if(!modules)throw Error('Provide installed Playwright modules directory');
const {chromium}=createRequire(path.resolve(modules,'../package.json'))(path.resolve(modules,'playwright'));
const url=process.env.MCP_QA_URL??'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('MCP review fixtures must run against a local preview');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(12000);
const errors=[],commands=[],results=[],unexpectedAI=[];
page.on('pageerror',e=>errors.push(e.message));
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const members=[{id:'family',name:'家庭共用',selectable:true,active:true},{id:'user:owner',name:'模拟本人',selectable:true,active:true},{id:'user:member',name:'模拟家人',selectable:true,active:true}];
const draft=(id,kind,payload)=>({id,kind:'financial_draft',payload:{kind,payload,status:'PENDING',source:'ChatGPT/MCP，外部分析待本人核对',createdAt:'2026-11-12T01:00:00Z'}});
const state={book:{revision:1},viewer:{subject:'owner',canWrite:true},household:{name:'隔离模拟家庭'},householdMembers:[{userId:'owner',displayName:'模拟本人',active:true,role:'owner'},{userId:'member',displayName:'模拟家人',active:true,role:'member'}],financeMembers:members,accounts:[{id:'cash-owner',name:'本人模拟现金',category:'cash',kind:'ASSET',currency:'CNY',balance:1000000,metadata:{ownerMemberId:'user:owner',asOf:'2026-11-01'}},{id:'cash-member',name:'家人模拟现金',category:'cash',kind:'ASSET',currency:'CNY',balance:2000000,metadata:{ownerMemberId:'user:member',asOf:'2026-11-01'}}],transactions:[],documents:[draft('budget','budget',{name:'外部模拟旅行',category:'国内旅行',date:'2027-01-09',end:'2027-01-09',budget:'246.90',ownerMemberId:'user:member',note:'模拟预算',analysis:'外部模拟分析，价格仅为情景估算。',expenseDraft:{kind:'travel',items:[{id:'hotel',name:'模拟住宿',quantity:'2',unitPrice:'123.45',category:'住宿',selected:true,itineraryId:'day-one',sourceType:'scenario_estimate'}],itinerary:[{id:'day-one',date:'2027-01-09',time:'下午',title:'模拟入住',notes:'请核实价格'}],comparisons:[]}}),draft('flow','cashflow',{type:'income',accountId:'cash-member',cashMemberId:'user:member',amount:'1234.56',date,note:'外部模拟实际收入',analysis:'模拟已到账，待核对账户。',balanceIncluded:false}),draft('asset','asset',{name:'外部模拟已有美股',category:'stock',currency:'USD',amount:'88.90',ownerMemberId:'user:member',asOf:date,owned:true,market:'US',code:'TEST',quantity:'1',price:'88.90',cost:'80.00',analysis:'模拟已有资产，非购买指令。'}),draft('reject','asset',{name:'外部模拟应拒绝资产',category:'other',currency:'CNY',amount:'1.00',ownerMemberId:'user:owner',asOf:date,owned:true})],audit:[],planSummaries:[],monthlyLedgerTotals:{complete:true,rows:[]}};
// All finance traffic is served from this isolated fixture. It never reaches a real book.
await page.route('**/api/**',async route=>{
 const req=route.request(),u=new URL(req.url());let response={};
 if(req.method()==='POST'&&u.pathname!=='/api/finance')unexpectedAI.push(u.pathname);
 if(u.pathname==='/api/finance'){
  if(req.method()==='POST'){
   const command=req.postDataJSON();commands.push(command);assert.ok(['mcp.draft.accept','mcp.draft.reject'].includes(command.action));
   const body=command.body,d=state.documents.find(d=>d.id===body.draftId);assert.ok(d);state.book.revision++;
   if(command.action==='mcp.draft.reject'){Object.assign(d.payload,{status:'REJECTED',rejectionReason:body.reason});}
   else {Object.assign(d.payload,{status:'ACCEPTED',reviewedPayload:body.reviewedPayload,destinationKind:d.payload.kind==='budget'?'plan':d.payload.kind==='asset'?'account':'transaction'});if(d.payload.kind==='budget')state.documents.push({id:'pending-plan',kind:'plan',payload:{...body.reviewedPayload,budget:30000,status:'PLANNED',version:1,reserved:0,budgetStatus:'PENDING_APPROVAL',familyApproval:{version:1,required:['owner','member'],approvals:[{userId:'owner'}],status:'PENDING_APPROVAL'}}});}
   response={ok:true};
  }else response=u.searchParams.has('command_key')?{status:'not_found'}:state;
 }else if(u.pathname==='/api/advisor')response={configured:false,missing:[],chatgpt:{connected:false}};
 else if(u.pathname==='/api/market')response={quotes:{}};
 else if(u.pathname==='/api/fx')response={rate:'7.10',status:'cached'};
 else if(u.pathname==='/api/images')response={configured:false};
 await route.fulfill({json:response});
});
const nav=async name=>{const toggle=page.getByRole('button',{name:'切换菜单'});if(await toggle.isVisible())await toggle.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();await page.locator('.sidebar').evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))))};
const card=id=>page.locator(`[data-draft-id="${id}"]`);
const open=async id=>{await card(id).locator(':scope > details > summary').click()};
const review=locator=>locator.getByRole('checkbox',{name:/我已逐项核对外部分析/});
const actual=locator=>locator.getByRole('checkbox',{name:/我已确认/});
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await check('MCP提交只显示待核对草稿，原金额与成员保持不变',async()=>{
  await nav('现金流水');await open('flow');assert.equal(await card('flow').getByLabel('外部流水实际金额 CNY').inputValue(),'1234.56');assert.equal(await card('flow').getByLabel('外部流水收付款成员').inputValue(),'user:member');assert.equal(await card('flow').getByLabel('外部流水实际现金账户').inputValue(),'cash-member');assert.equal(commands.length,0);assert.deepEqual(state.accounts.map(a=>a.balance),[1000000,2000000]);
 });
 await check('已含余额不能采用，人工核对后保留元单位及成员账户',async()=>{
  const flow=card('flow');await flow.getByLabel('当前余额覆盖情况').selectOption('included');await actual(flow).check();await review(flow).check();assert.equal(await flow.getByRole('button',{name:'采用并记录实际流水'}).isDisabled(),true);await flow.getByLabel('当前余额覆盖情况').selectOption('uncovered');assert.equal(await actual(flow).isChecked(),false);assert.equal(await review(flow).isChecked(),false);await flow.getByLabel('外部流水收付款成员').selectOption('user:owner');await flow.getByLabel('外部流水实际现金账户').selectOption('cash-owner');await actual(flow).check();await review(flow).check();await flow.getByRole('button',{name:'采用并记录实际流水'}).click();await flow.waitFor({state:'detached'});assert.equal(commands.at(-1).body.reviewedPayload.amount,'1234.56');assert.equal(commands.at(-1).body.reviewedPayload.cashMemberId,'user:owner');assert.equal(commands.at(-1).body.reviewedPayload.accountId,'cash-owner');assert.equal(commands.at(-1).body.reviewedPayload.balanceIncluded,false);assert.equal(commands.at(-1).body.actualConfirmed,true);
 });
 await check('预算编辑重算并重置人工确认，采用仅发起家庭审批',async()=>{
  await nav('预算与大型支出');await open('budget');const budget=card('budget');await review(budget).check();await budget.getByLabel('外部费用单价 1').fill('150.00');assert.equal(await review(budget).isChecked(),false);await budget.getByText('300.00 CNY',{exact:true}).waitFor();await budget.getByLabel('外部预算归属成员').selectOption('family');await budget.getByLabel('外部行程安排 1').fill('模拟入住与晚餐');await page.setViewportSize({width:390,height:844});await page.locator('.sidebar').evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));fs.mkdirSync('work/finance-v16',{recursive:true});await page.screenshot({path:'work/finance-v16/ui-mobile-review.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await review(budget).check();await budget.getByRole('button',{name:'采用并提交家庭审批'}).click();await budget.waitFor({state:'detached'});const body=commands.at(-1).body;assert.equal(body.reviewedPayload.budget,'300.00');assert.equal(body.reviewedPayload.ownerMemberId,'family');assert.equal(body.reviewedPayload.expenseDraft.itinerary[0].title,'模拟入住与晚餐');assert.equal(body.reviewedPayload.expenseDraft.reviewed,true);assert.equal(body.actualConfirmed,undefined);await page.getByRole('region',{name:'家庭预算审批'}).getByRole('heading',{name:'家庭审批',exact:true}).waitFor();assert.equal(state.documents.find(d=>d.id==='pending-plan').payload.budgetStatus,'PENDING_APPROVAL');assert.deepEqual(state.accounts.map(a=>a.balance),[1000000,2000000]);
 });
 await check('只读家人只能查看外部草稿',async()=>{
  state.viewer={subject:'member',canWrite:false};await page.reload({waitUntil:'networkidle'});await nav('资产与贷款');await open('asset');const asset=card('asset');assert.equal(await asset.getByLabel('外部资产当前余额或市值（原币）').isDisabled(),true);assert.equal(await actual(asset).isDisabled(),true);assert.equal(await asset.getByRole('button',{name:'采用并登记已有资产'}).isDisabled(),true);
 });
 await check('已有资产须本人确认持有，保留USD原币与正确成员',async()=>{
  state.viewer={subject:'owner',canWrite:true};await page.reload({waitUntil:'networkidle'});await nav('资产与贷款');await open('asset');const asset=card('asset');assert.equal(await asset.getByLabel('外部资产原币').inputValue(),'USD');assert.equal(await asset.getByLabel('外部资产当前余额或市值（原币）').inputValue(),'88.90');await review(asset).check();assert.equal(await asset.getByRole('button',{name:'采用并登记已有资产'}).isDisabled(),true);await actual(asset).check();await asset.getByRole('button',{name:'采用并登记已有资产'}).click();await asset.waitFor({state:'detached'});const body=commands.at(-1).body;assert.equal(body.reviewedPayload.amount,'88.90');assert.equal(body.reviewedPayload.currency,'USD');assert.equal(body.reviewedPayload.ownerMemberId,'user:member');assert.equal(body.reviewedPayload.owned,true);assert.equal(body.actualConfirmed,true);
 });
 await check('拒绝保留处理历史，手机核对不横向溢出',async()=>{
  await open('reject');const rejected=card('reject');await rejected.getByRole('button',{name:'拒绝此草稿',exact:true}).click();await rejected.getByLabel('外部草稿拒绝原因').fill('模拟核对：可能重复登记');await rejected.getByRole('button',{name:'确认拒绝并保留历史'}).click();await rejected.waitFor({state:'detached'});await page.getByRole('button',{name:/处理历史/}).click();await page.getByText('拒绝原因：模拟核对：可能重复登记',{exact:true}).waitFor();assert.equal(state.documents.find(d=>d.id==='reject').payload.status,'REJECTED');await page.setViewportSize({width:390,height:844});await nav('预算与大型支出');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 });
 assert.deepEqual(unexpectedAI,[],'MCP review must not request any additional AI analysis');assert.deepEqual(errors,[]);
 fs.mkdirSync('work/finance-v16',{recursive:true});await page.screenshot({path:'work/finance-v16/ui-mobile.png',fullPage:true});console.log(JSON.stringify({passed:results.length,simulated:true,productionWrites:false,extraAIRequests:unexpectedAI.length,pageErrors:errors}));
}catch(e){console.error(e);console.error((await page.locator('body').innerText()).slice(-6000));fs.mkdirSync('work/finance-v16',{recursive:true});await page.screenshot({path:'work/finance-v16/ui-failure.png',fullPage:true});process.exitCode=1}finally{await browser.close()}

import assert from 'node:assert/strict';import {createRequire} from 'node:module';import path from 'node:path';
const mods=path.resolve(process.argv[2]??'work/calendar-qa/node_modules');const {chromium}=createRequire(path.join(mods,'../package.json'))(path.join(mods,'playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(7000);const errors=[],calls=[],results=[];page.on('pageerror',e=>errors.push(e.message));
const fixture={book:{revision:1},viewer:{canWrite:true},accounts:[],transactions:[],planSummaries:[],documents:[]};
const draft={kind:'travel',reviewed:false,items:[{id:'hotel',name:'模拟酒店',category:'住宿',quantity:'2',unitPrice:'100.00',selected:true,sourceType:'scenario_estimate',merchant:'模拟黄山国际大酒店',alternatives:[{merchant:'模拟黄山维笙酒店',unitPrice:'90.00',sourceType:'scenario_estimate'}]},{id:'train',name:'模拟车票',category:'火车票',quantity:'2',unitPrice:'50.00',selected:true,sourceType:'scenario_estimate'}],itinerary:[{date:'2026-12-01',time:'19:00',title:'模拟接站',notes:'未出票'},{date:'2026-12-02',time:'12:00',title:'模拟午餐'}],comparisons:[{title:'模拟同款票务',merchant:'模拟商家',version:'同线路',price:'50.00',shipping:'0',url:'https://example.com/train',checkedAt:'2026-11-11T00:00:00Z',comparability:'unverified'}]};
await page.route('**/api/**',async route=>{const req=route.request(),endpoint=new URL(req.url()).pathname;
 if(req.method()==='GET')return route.fulfill({json:endpoint==='/api/finance'?fixture:endpoint==='/api/advisor'?{configured:true,model:'SIMULATED-UI-FIXTURE'}:{}});
 const input=req.postDataJSON();calls.push({endpoint,input});
 if(endpoint==='/api/research'){fixture.book.revision++;return route.fulfill({json:{id:'research-fixture',proposal:{title:'模拟旅行',source:'simulated-e2e',sources:[{title:'模拟研究来源',url:'https://example.com/train',checkedAt:'2026-11-11T00:00:00Z',verification:'retrieved'}],missing:['模拟仍需核实余票'],content:'仅为浏览器夹具，不是真实AI结果',expenseDraft:draft}}})}
 if(endpoint==='/api/advisor'){
  assert.equal(input.expenseDraft.reviewed,true);const n=input.expenseDraft.items.filter(x=>x.selected!==false).reduce((a,x)=>a+Math.round(Number(x.quantity)*Number(x.unitPrice)*100),0);
  const id='advice-fixture-'+calls.length;fixture.book.revision++;
  const advice={intent:'expense',source:'model',model:'SIMULATED-UI-FIXTURE',status:'READY',verdict:'可考虑',summary:'模拟清单复核结果，不是真实财务建议',inputs:{question:input.question,date:input.date,budgetMinor:n},expenseDraft:{...input.expenseDraft,totalMinor:n},expenseEnd:input.tripEnd,metrics:{cash:1000000,otherPlans:0,proposedRemaining:n,freeAfter:1000000-n},missing_inputs:[],risk_reasons:[],options:[],budget_items:[],assumptions:[],data_revision:fixture.book.revision,approvalRevision:fixture.book.revision,createdAt:new Date().toISOString(),expiresAt:Date.now()+60000,facts_snapshot_id:'simulated-snapshot'};
  fixture.documents.push({id,kind:'advice',payload:advice});return route.fulfill({json:{id,advice}});
 }
 if(endpoint==='/api/finance'&&input.action==='advice.accept'){
  const a=fixture.documents.find(d=>d.id===input.body.adviceId).payload;a.status='ACCEPTED';fixture.book.revision++;
  fixture.documents.push({id:'accepted-fixture-plan',kind:'plan',payload:{name:input.body.name,category:input.body.category,date:a.inputs.date,end:a.expenseEnd,status:'PLANNED',budgetStatus:'APPROVED',version:1,budget:a.inputs.budgetMinor,expenseDraft:a.expenseDraft,itinerary:a.expenseDraft.itinerary,items:a.expenseDraft.items,reserved:0}});
  return route.fulfill({json:{ok:true,id:'accepted-fixture-plan'}});
 }
 throw Error('Unexpected fixture write: '+endpoint);
});
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
try{
 await page.goto(process.env.CALENDAR_QA_URL??'http://127.0.0.1:5183/',{waitUntil:'networkidle'});
 await page.getByRole('navigation').getByRole('button',{name:'AI消费助手',exact:true}).click();
 await check('自动识别旅行并先生成待核对清单',async()=>{
  await page.getByLabel('花钱想法',{exact:true}).fill('模拟安徽两天亲子游，2026年12月1日至2日，3位成人和1位宝宝');
  await page.getByText(/已识别：旅行/).waitFor();
  
  await page.getByRole('button',{name:'✦ 生成行程与消费清单',exact:true}).click();
  await page.getByRole('region',{name:'当前清单费用',exact:true}).waitFor();assert.equal(calls.filter(x=>x.endpoint==='/api/advisor').length,0);assert.equal(await page.getByRole('button',{name:'✦ AI复核清单',exact:true}).isDisabled(),true);
 });
 await check('右侧紧凑小票可选择商家且详情初始折叠',async()=>{const receipt=page.getByRole('region',{name:'当前清单费用',exact:true});assert.equal(await page.getByRole('heading',{name:'核对消费清单',exact:true}).count(),0);assert.equal(await receipt.locator('details[open]').count(),0);await page.getByLabel('候选商家 1',{exact:true}).selectOption('0');assert.equal(await page.getByLabel('商家名称 1',{exact:true}).inputValue(),'模拟黄山维笙酒店');await page.getByText('¥280.00',{exact:true}).waitFor()});
 await check('研究依据展示来源日期和缺失资料',async()=>{await page.getByText('查看本次研究依据',{exact:true}).click();await page.getByRole('link',{name:'模拟研究来源',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'模拟研究来源',exact:true}).getAttribute('href'),'https://example.com/train');await page.getByText(/查询时间：2026-11-11/).waitFor();await page.getByText('模拟仍需核实余票',{exact:true}).waitFor();await page.getByText('查看本次研究依据',{exact:true}).click()});
 await check('数量单价重算、行程编辑和真实引用区分',async()=>{
  await page.getByLabel('项目单价 1',{exact:true}).fill('120.00');await page.getByText('¥340.00',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('本次总预算 CNY（可空）',{exact:true}).inputValue(),'340.00');
  await page.getByText('查看与调整行程 · 2项',{exact:true}).click();await page.getByLabel('行程安排 1',{exact:true}).fill('模拟接站修改');await page.getByText('查看商品比价参考',{exact:true}).click();await page.getByText(/模拟同款票务/).waitFor();
  await page.getByRole('button',{name:'核对并AI复核',exact:true}).click();await page.locator('.advisor-result').getByText('模拟清单复核结果，不是真实财务建议',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'确认并发起家庭审批',exact:true}).isDisabled(),false);
 });
 await check('再编辑使旧建议失效，必须重新核对复核',async()=>{
  await page.getByLabel('项目数量 1',{exact:true}).fill('1');assert.equal(await page.getByRole('button',{name:'✦ AI复核清单',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'确认并发起家庭审批',exact:true}).count(),0);
  await page.getByRole('button',{name:'核对并AI复核',exact:true}).click();await page.locator('.advisor-result').getByText('模拟清单复核结果，不是真实财务建议',{exact:true}).waitFor();
  assert.equal(calls.filter(x=>x.endpoint==='/api/advisor').length,2);
 });
 await check('采纳预算保存清单，行程进入日历',async()=>{
  await page.getByRole('button',{name:'确认并发起家庭审批',exact:true}).click();await page.getByText(/已提交家庭预算审批|家庭审批通过 · 已纳入正式预算/).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:'生活日历',exact:true}).click();await page.getByLabel('跳转月份',{exact:true}).fill('2026-12');
  await page.getByRole('button',{name:'2026-12-01，1项安排',exact:true}).click();await page.getByText('模拟接站修改',{exact:true}).waitFor();
  assert.equal(calls.filter(x=>x.endpoint==='/api/finance').length,1);
 });
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:results.length,pageErrors:errors,fixtureOnly:true}));
}finally{await browser.close()}

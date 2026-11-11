import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const modules=process.argv[2];
if(!modules)throw Error('Provide installed Playwright module directory');
const {chromium}=createRequire(path.resolve(modules,'../package.json'))(path.resolve(modules,'playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],results=[],requests=[];
page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
const now=new Date().toISOString();
const advice=(intent,question)=>({intent,status:'READY',source:'rules',verdict:'信息不足',summary:'模拟规则预览，不是实际AI回复',inputs:{question,budgetMinor:1000,asset:{name:'模拟资产',currency:'CNY',amountMinor:1000,source:'模拟资料'}},metrics:{cash:0,otherPlans:0,proposedRemaining:1000,freeAfter:0,loanMonthly:0,monthlySurplus:null},missing_inputs:['模拟资料不足'],risk_reasons:[],options:[],budget_items:[],assumptions:['仅测试'],createdAt:now,approvalRevision:1,data_revision:0,facts_snapshot_id:'simulated-snapshot',expiresAt:Date.now()+3600000});
const fixture={book:{revision:1},viewer:{subject:'simulated-test-owner',canWrite:true},accounts:[],transactions:[],planSummaries:[],documents:[{id:'history-expense',kind:'advice',payload:advice('expense','模拟消费历史')},{id:'history-asset',kind:'advice',payload:advice('asset','模拟资产历史')}]};
// Browser-owned API fixtures keep this UI test away from the user's ledger and real model.
await page.route('**/api/finance*',route=>{assert.equal(route.request().method(),'GET','UI preview must not post into the real ledger');return route.fulfill({json:fixture})});
await page.route('**/api/fx',route=>route.fulfill({json:{rate:null,status:'unavailable',message:'模拟测试未提供汇率'}}));
await page.route('**/api/advisor',route=>{
 if(route.request().method()==='GET')return route.fulfill({json:{configured:true,model:'SIMULATED-UI-TEST',financialContext:{values:{},sources:{}}}});
 const body=route.request().postDataJSON();requests.push(body);return route.fulfill({json:{id:'test-'+requests.length,advice:advice(body.intent,body.question)}});
});
const nav=()=>page.getByRole('navigation');
const check=async(name,fn)=>{await fn();results.push({name,status:'passed'});console.log('PASS '+name)};
try{
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await check('独立投资助手位于资产与贷款上方',async()=>{const names=await nav().getByRole('button').allTextContents();assert.ok(names.includes('AI投资助手'));assert.ok(names.indexOf('AI投资助手')<names.indexOf('资产与贷款'))});
 await check('图片和周期管理有独立入口',async()=>{assert.equal(await nav().getByRole('button',{name:'图片录入',exact:true}).count(),1);assert.equal(await nav().getByRole('button',{name:'周期与预测',exact:true}).count(),1)});
 await check('总览移除资产列表且流水不再手动记一笔',async()=>{assert.equal(await page.getByRole('heading',{name:'我的资产',exact:true}).count(),0);await nav().getByRole('button',{name:'现金流水',exact:true}).click();assert.equal(await page.getByRole('button',{name:'记一笔',exact:true}).count(),0);await page.locator('main').getByRole('button',{name:'AI消费助手',exact:true}).waitFor()});
 await check('消费页没有资产登记入口且只显示消费历史',async()=>{await nav().getByRole('button',{name:'AI消费助手',exact:true}).click();await page.getByRole('heading',{name:'AI消费助手',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'登记已有资产',exact:true}).count(),0);assert.equal(await page.getByLabel('资产名称',{exact:true}).count(),0);await page.getByRole('button',{name:/^模拟消费历史/}).waitFor();assert.equal(await page.getByRole('button',{name:/^模拟资产历史/}).count(),0)});
 await check('资产入口跳投资助手且隔离消费预算与历史',async()=>{await nav().getByRole('button',{name:'资产与贷款',exact:true}).click();await page.getByRole('button',{name:'AI登记资产',exact:true}).click();await page.getByRole('heading',{name:'AI投资助手',exact:true}).waitFor();await page.getByLabel('资产名称',{exact:true}).waitFor();assert.equal(await page.getByLabel('本次总预算 CNY（可空）',{exact:true}).count(),0);assert.equal(await page.getByLabel('花钱想法',{exact:true}).count(),0);await page.getByRole('button',{name:/^模拟资产历史/}).waitFor();assert.equal(await page.getByRole('button',{name:/^模拟消费历史/}).count(),0)});
 await check('投资助手新建仍保留资产登记语义',async()=>{await page.getByRole('button',{name:'新的登记',exact:true}).click();await page.getByLabel('资产名称',{exact:true}).waitFor();await page.getByLabel('登记说明',{exact:true}).fill('模拟登记已有现金');await page.getByLabel('资产名称',{exact:true}).fill('模拟已有现金');await page.getByLabel('已核实余额／估值（原币）').fill('10.00');await page.getByLabel('余额／估值来源').fill('模拟本人核对，非真实资产');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'只做资金测算',exact:true}).click();await page.getByText('规则测算 · 非AI回复',{exact:true}).waitFor();assert.equal(requests.at(-1).intent,'asset');assert.equal(await page.getByRole('button',{name:'确认登记到资产库',exact:true}).isDisabled(),true)});
 await check('返回消费助手不携带资产表单且只发送消费意图',async()=>{await nav().getByRole('button',{name:'AI消费助手',exact:true}).click();await page.getByLabel('花钱想法',{exact:true}).fill('模拟旅行想法');await page.getByLabel('本次总预算 CNY（可空）',{exact:true}).fill('10.00');await page.getByRole('button',{name:'只做资金测算',exact:true}).click();await page.getByText('规则测算 · 非AI回复',{exact:true}).waitFor();assert.equal(requests.at(-1).intent,'expense');assert.equal('asset' in requests.at(-1),false);assert.equal(await page.getByRole('button',{name:'确认并发起家庭审批',exact:true}).isDisabled(),true)});
 await check('财务参数自动读取且设置不展示操作记录',async()=>{assert.equal(await page.getByRole('heading',{name:'自动读取的财务依据',exact:true}).count(),0);assert.equal(await page.getByLabel('固定月收入 CNY（可空）',{exact:true}).count(),0);await nav().getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('heading',{name:'家庭规划参数',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'操作记录',exact:true}).count(),0)});
 await check('手机端可进入投资助手且页面无水平溢出',async()=>{await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'切换菜单',exact:true}).click();await nav().getByRole('button',{name:'AI投资助手',exact:true}).click();await page.getByLabel('资产名称',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))});
 assert.deepEqual(errors,[]);
}catch(e){results.push({name:'failure',status:'failed',message:e.message});console.error(e);process.exitCode=1}finally{
 fs.mkdirSync('.sites-runtime/e2e',{recursive:true});fs.writeFileSync('.sites-runtime/e2e/assistant-split-results.json',JSON.stringify({results,errors,realModelUsed:false,apiFixtures:true},null,2));await browser.close();console.log(JSON.stringify({passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length,pageErrors:errors.length}));
}

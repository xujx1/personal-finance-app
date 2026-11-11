import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const modules=path.resolve(process.argv[2]??'work/calendar-qa/node_modules');
const {chromium}=createRequire(path.join(modules,'../package.json'))(path.join(modules,'playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
page.setDefaultTimeout(7000);
const errors=[],writes=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const plan=(id,name,category,date,end=date,extra={})=>({id,kind:'plan',payload:{name,category,date,end,status:'PLANNED',budget:50000,reserved:0,budgetStatus:'APPROVED',version:1,...extra}});
const fixture={book:{revision:1},viewer:{canWrite:true},accounts:[],transactions:[],planSummaries:[],documents:[
 plan('trip','模拟周末亲子游','国内旅行','2026-11-14','2026-11-15',{itinerary:[{date:'2026-11-14',time:'19:00',title:'模拟接站',notes:'候选车次，待核实'},{date:'2026-11-15',time:'13:00',title:'模拟午睡'}]}),
 plan('meal','模拟海鲜晚餐','餐饮','2026-11-14'),plan('lunch','模拟午餐','餐饮','2026-11-14'),
 plan('cancel','模拟已取消聚餐','餐饮','2026-11-14',undefined,{status:'CANCELLED'}),
 plan('undated','模拟待排期旅行','国内旅行',null),plan('cross','模拟跨月旅行','国际旅行','2026-11-30','2026-12-02'),
 plan('shopping','模拟购物','大件采购','2026-11-14')
]};
await page.route('**/api/**',route=>{
 const req=route.request();if(req.method()!=='GET'){writes.push(req.url());return route.abort()}
 const pathname=new URL(req.url()).pathname;
 const value=pathname==='/api/finance'?fixture:pathname==='/api/fx'?{rate:null,status:'unavailable'}:pathname==='/api/market'?{quotes:{}}:pathname==='/api/advisor'?{configured:false}:{};
 return route.fulfill({json:value});
});
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
const calendar=()=>page.getByRole('region',{name:'旅行与餐饮日历',exact:true});
const agenda=()=>page.getByRole('region',{name:'当天安排',exact:true});
try{
 await page.goto(process.env.CALENDAR_QA_URL??'http://127.0.0.1:5183/',{waitUntil:'networkidle'});
 await check('生活日历入口和月视图',async()=>{
  await page.getByRole('navigation').getByRole('button',{name:'生活日历',exact:true}).click();
  await page.getByRole('heading',{name:'生活日历',exact:true}).waitFor();
  await page.getByLabel('跳转月份',{exact:true}).fill('2026-11');
  assert.equal(await calendar().getByRole('button',{name:/^2026-\d\d-\d\d，/}).count(),42);
 });
 await check('周末多计划、逐日行程及不重复预算',async()=>{
  await page.getByRole('button',{name:'2026-11-14，3项安排',exact:true}).click();
  assert.equal(await agenda().getByRole('article').count(),3);
  await agenda().getByText('模拟接站',{exact:true}).waitFor();
  assert.equal(await agenda().getByText('模拟午睡',{exact:true}).count(),0);
  await agenda().getByText('暂未提供具体餐次或菜单。',{exact:true}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'2026-11-14，3项安排',exact:true}).evaluate(el=>el.classList.contains('weekend')),true);
  assert.equal(await agenda().getByText(/整项预算（非当日开销）/).count(),3);
 });
 await check('分类筛选与取消状态',async()=>{
  await page.getByLabel('日历安排类型',{exact:true}).selectOption('dining');
  assert.equal(await agenda().getByRole('article').count(),2);
  await page.getByRole('checkbox',{name:'显示已取消',exact:true}).check();
  assert.equal(await agenda().getByRole('article').count(),3);
  await agenda().getByRole('heading',{name:'模拟已取消聚餐',exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'显示已取消',exact:true}).uncheck();
  await page.getByLabel('日历安排类型',{exact:true}).selectOption('all');
 });
 await check('周视图跨周导航与今天',async()=>{
  await page.getByRole('button',{name:'本周',exact:true}).click();
  assert.equal(await calendar().getByRole('button',{name:/^2026-\d\d-\d\d，/}).count(),7);
  await page.getByRole('button',{name:'下一周',exact:true}).click();
  await calendar().getByRole('heading',{name:'2026-11-16 — 2026-11-22',exact:true}).waitFor();
  await page.getByRole('button',{name:'上一周',exact:true}).click();
  await page.getByRole('button',{name:'今天',exact:true}).click();
  assert.equal(await calendar().locator('[aria-current="date"]').count(),1);
 });
 await check('跨月旅行和无日明细提示',async()=>{
  await page.getByRole('button',{name:'整月',exact:true}).click();
  await page.getByLabel('跳转月份',{exact:true}).fill('2026-11');
  await page.getByRole('button',{name:'2026-12-01，1项安排',exact:true}).click();
  await calendar().getByRole('heading',{name:'2026年12月',exact:true}).waitFor();
  await agenda().getByRole('heading',{name:'模拟跨月旅行',exact:true}).waitFor();
  await agenda().getByText('暂未提供当天行程，当前仅展示出行日期范围。',{exact:true}).waitFor();
 });
 await check('打开原计划详情和返回',async()=>{
  await agenda().getByRole('button',{name:'查看计划详情 →',exact:true}).click();
  await page.getByRole('heading',{name:'模拟跨月旅行',exact:true}).waitFor();
  await page.getByRole('button',{name:'← 返回预算清单',exact:true}).click();
  await page.getByRole('heading',{name:'预算与大型支出',exact:true}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:'生活日历',exact:true}).click();
  await calendar().getByRole('button',{name:'模拟待排期旅行 · 查看计划',exact:true}).waitFor();
 });
 await check('月份边界保持可用并禁用越界导航',async()=>{
  await page.getByLabel('跳转月份',{exact:true}).fill('9998-12');
  assert.equal(await page.getByRole('button',{name:'下个月',exact:true}).isDisabled(),true);
  await page.getByLabel('跳转月份',{exact:true}).fill('9999-12');
  await calendar().getByRole('heading',{name:'9998年12月',exact:true}).waitFor();
  assert.equal(await calendar().getByRole('button',{name:/^9999-01-/,disabled:false}).count(),0);
 });
 await page.getByLabel('跳转月份',{exact:true}).fill('2026-11');
 await page.getByRole('button',{name:'2026-11-14，3项安排',exact:true}).click();
 fs.mkdirSync('work/calendar-qa',{recursive:true});
 await page.screenshot({path:'work/calendar-qa/desktop.png',fullPage:true});
 await check('手机月周切换、当天清单与无横向溢出',async()=>{
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.getByRole('button',{name:'本周',exact:true}).click();
  assert.equal(await agenda().getByRole('article').count(),3);
  await page.getByRole('button',{name:'整月',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'work/calendar-qa/mobile.png',fullPage:true});
 });
 await check('AI规划沿用选中日期，查看日历不写账',async()=>{
  await page.getByRole('button',{name:'AI规划这一天',exact:true}).click();
  await page.getByRole('heading',{name:'AI消费助手',exact:true}).waitFor();
  const dateInput=page.locator('main input[type="date"]').first();
  assert.equal(await dateInput.inputValue(),'2026-11-14');
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 });
 console.log(JSON.stringify({passed:results.length,pageErrors:errors,writes},null,2));
}finally{await browser.close()}

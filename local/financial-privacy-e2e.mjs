import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {openTestDatabase} from '../tests/helpers/d1.mjs';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'work/financial-privacy/e2e');fs.mkdirSync(out,{recursive:true});
const {chromium}=createRequire(path.join(root,'work/calendar-qa/package.json'))('playwright');
const database=`qa-financial-privacy-${Date.now()}.sqlite`,env={...process.env,LOCAL_TEST_MODULES:path.join(root,'node_modules'),LOCAL_QA_DATABASE:database,LOCAL_UI_PORT:'5663',LOCAL_API_PORT:'5664',LOCAL_QA_OFFLINE_FX:'1'};
const x=openTestDatabase(path.join(root,'.sites-runtime/local-qa',database));
const send=async(action,body)=>executeCommand(x.db,{key:crypto.randomUUID(),revision:(await snapshot(x.db)).book.revision,action,body},'local-simulated-owner');
const bank=await send('account.save',{name:'隐私验证银行',category:'cash',currency:'CNY',amount:'12345.67',note:'余额12345.67元，2026-11-12核对',asOf:'2026-11-12'});
const fund=await send('account.save',{name:'隐私验证基金',category:'fund',currency:'CNY',amount:'24846.49',quantity:'37',price:'671.53',cost:'123.45',asOf:'2026-11-12',note:'持仓37份，成本123.45元'});
await send('savings.goal.save',{schemaVersion:4,name:'隐私资产目标',targets:[{id:'safety',name:'银行储备',assetTypeIds:['cash'],target:'100000'}],monthlyTarget:'1500.01'});
const plan=await send('plan.save',{name:'隐私验证旅行',category:'国内旅行',date:'2026-11-14',end:'2026-11-14',budget:'390',approve:true,note:'原预算410元，当前以结构化预算为准'});
const state=await snapshot(x.db),dataset=state.book.active_dataset,planDoc=state.documents.find(d=>d.id===plan.id),source='privacy-source-draft';
x.sqlite.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(dataset,source,'financial_draft',JSON.stringify({kind:'budget',status:'ACCEPTED',payload:{name:'隐私验证旅行',budget:'410',date:'2026-11-14',end:'2026-11-14'},reviewedPayload:{name:'隐私验证旅行',budget:'390',date:'2026-11-14',end:'2026-11-14'},destinationId:plan.id,destinationKind:'plan'}));
x.sqlite.prepare('UPDATE documents SET payload=? WHERE id=?').run(JSON.stringify({...planDoc.payload,mcpDraftId:source,externalAnalysis:true,familyApproval:{version:1,status:'APPROVED',required:['local-simulated-owner'],approvals:[{userId:'local-simulated-owner'}]}}),plan.id);
x.sqlite.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(dataset,'privacy-investment','investment_review',JSON.stringify({title:'隐私验证研究',summary:'保持长期视角',content:'# 研究结论\n**预算**：300元。持仓37份，成本123.45元。\n日期2026-11-12，保留原始来源。',acceptedAt:'2026-11-12T00:00:00Z',sources:[]}));
x.sqlite.close();
const children=['local/server.mjs','local/vite-server.mjs'].map((script,i)=>spawn(process.execPath,[script],{cwd:root,env,stdio:['ignore',fs.openSync(path.join(out,i?'ui.log':'api.log'),'w'),fs.openSync(path.join(out,i?'ui.err':'api.err'),'w')]}));
const url='http://127.0.0.1:5663',checks=[],errors=[];let browser,page;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<100;i++){try{if((await fetch(url)).ok&&(await fetch('http://127.0.0.1:5664/api/finance')).ok)return}catch{}await sleep(150)}throw Error('preview unavailable')}
async function nav(name){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}
try{
 await wait();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/market',route=>route.fulfill({json:{quotes:{[fund.id]:{price:'701.23',currency:'CNY',source:'隐私样本报价来源',asOf:'2026-11-12',kind:'published_nav'}}}}));await page.goto(url,{waitUntil:'networkidle'});
 await check('默认隐藏目标值和进度无aria金额，名称与日期可读',async()=>{await page.getByRole('heading',{name:'向资产目标，再进一步'}).waitFor();const goal=page.getByRole('region',{name:'资产目标总览'});assert.doesNotMatch(await goal.innerText(),/100,000|12345|1,500.01|12.3%/);assert.match(await goal.getByRole('img').first().getAttribute('aria-label'),/已隐藏/);await page.getByRole('button',{name:'显示金额',exact:true}).click();assert.match(await goal.innerText(),/100,000.00/);await page.getByRole('button',{name:'隐藏金额',exact:true}).click()});
 await check('资产备注和报价隐藏数值，来源日期及持仓入口保留',async()=>{await nav('资产与贷款');const row=page.getByRole('row').filter({hasText:'隐私验证基金'});await row.locator('summary').click();assert.doesNotMatch(await row.innerText(),/123.45|671.53|701.23|37份|数量 37/);assert.match(await row.innerText(),/2026-11-12/);await row.getByRole('button',{name:'持仓成本：隐私验证基金',exact:true}).click();const d=page.getByRole('dialog');assert.doesNotMatch(await d.innerText(),/123.45|671.53|701.23|\b37\b/);await d.getByText('行情来源与缓存详情',{exact:true}).click();assert.match(await d.innerText(),/隐私样本报价来源/);await d.getByRole('button',{name:'关闭',exact:true}).click()});
 await check('预算详情和审批隐藏金额，中文状态和历史备注指引可读',async()=>{await nav('预算与大型支出');assert.doesNotMatch(await page.locator('.plan-card').innerText(),/410元/);await page.getByRole('button',{name:'详情',exact:true}).click();const main=page.locator('main');assert.match(await main.innerText(),/计划中/);assert.doesNotMatch(await main.innerText(),/PLANNED|¥390.00|¥410.00/);await main.getByLabel('历史分析与当前事实').waitFor();await main.getByText('当前已隐藏展示金额；编辑与核对输入框仍显示原值，请留意周围环境。',{exact:true}).waitFor()});
 await check('研究标题和操作不再整卡模糊，正文金融数值隐藏',async()=>{await nav('研究记录');await page.getByRole('button',{name:/展开研究与历史方案/}).click();await page.getByRole('heading',{name:'隐私验证研究',exact:true}).waitFor();const record=page.locator('.review-record').filter({hasText:'隐私验证研究'});for(const summary of await record.locator('summary').all()){if(!(await summary.locator('..').getAttribute('open')))await summary.click();}assert.equal(await record.evaluate(el=>getComputedStyle(el).filter),'none');assert.doesNotMatch(await record.innerText(),/300元|37份|123.45元/);assert.match(await record.innerText(),/2026-11-12/)});
 await page.screenshot({path:path.join(out,'hidden-research.png'),fullPage:true});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,pageErrors:errors},null,2));console.log(JSON.stringify({checks:checks.length,pageErrors:errors.length,out}));
}finally{await browser?.close();for(const child of children)child.kill('SIGTERM');}

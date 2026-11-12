import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openTestDatabase} from '../tests/helpers/d1.mjs';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {createFxHandlers} from '../src/server/fx-http.ts';
import {createMarketHandlers} from '../src/server/market-http.ts';
import {prepareVendor} from './prepare-vendor.mjs';
import baseConfig from './vite.config.mjs';

// Actual finance/FX/market handlers, ephemeral SQLite fixtures, local Chrome only.
// External quotes are explicitly unavailable; no provider or production data is used.
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'work/acceptance-layout-e2e');fs.mkdirSync(out,{recursive:true});
const uiPort=5783,apiPort=5784,url=`http://127.0.0.1:${uiPort}`;
for(const port of [uiPort,apiPort])await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error(`Test port ${port} is occupied; no server was stopped.`)));s.listen(port,'127.0.0.1',()=>s.close(resolve));});
const modules=path.resolve(process.env.LOCAL_TEST_MODULES??path.join(root,'node_modules')),browserModules=path.resolve(process.env.PLAYWRIGHT_MODULES??path.join(root,'work/calendar-qa/node_modules'));
const {chromium}=createRequire(path.join(browserModules,'../package.json'))(path.join(browserModules,'playwright'));
const fixture=openTestDatabase(),empty=openTestDatabase(),owner='layout-test-owner';
const seed=async(action,body)=>executeCommand(fixture.db,{key:crypto.randomUUID(),revision:(await snapshot(fixture.db)).book.revision,action,body},owner);
const note='隔离长备注：工资每月23000元、奖金尚未到账，请保留现金缓冲，核对本人银行余额与家庭共用资金；这是布局测试用说明，不能当作真实收入。'.repeat(2);
const bank=(await seed('account.save',{name:'隔离现金账户-完整银行与账户名称用于检查长名称换行边界',category:'cash',currency:'CNY',amount:'100000.00',note,bank:'隔离银行长名称用于验证存款资料不会挤入金额列',startDate:'2026-10-01',annualRate:'1.25',date:'2026-11-01'})).id;
await seed('account.save',{name:'隔离股票账户 LONG-SYMBOL-ACCOUNT-NAME-1234567890',category:'stock',currency:'CNY',amount:'12345.67',note:'隔离股票长期持有备注及账面估值依据，收益尚未实现；仅用于布局回归。'.repeat(3),status:'redeeming',quantity:'1234.5678',price:'10.00',cost:'9.20',asOf:'2026-11-01',date:'2026-11-01'});
await seed('account.save',{name:'隔离定期存款',category:'term_deposit',currency:'CNY',amount:'20000.00',bank:'隔离银行',startDate:'2026-10-01',maturityDate:'2027-10-01',annualRate:'1.50',date:'2026-11-01'});
await seed('transaction.add',{type:'expense',accountId:bank,amount:'12.34',date:'2026-11-01',note:'隔离现金消费说明用于检查流水表格布局和筛选',consumptionType:'shopping'});
await seed('plan.save',{name:'隔离待执行计划用于验证默认状态徽标',date:'2026-11-12',budget:'100.00',approve:true});
await snapshot(empty.db);
const before=await snapshot(fixture.db);const offline=async()=>{throw Error('Explicit isolated offline quote fixture')};
const api=http.createServer(async(req,res)=>{try{let body='';for await(const chunk of req)body+=chunk;
 const request=new Request(`http://127.0.0.1:${uiPort}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}:{})}),db=req.headers['x-layout-empty']==='1'?empty.db:fixture.db;
 const deps={getUser:async()=>({userId:owner}),getOwner:()=>owner,getDb:()=>db,fetcher:offline};
 const route=new URL(request.url).pathname,handler=route==='/api/finance'?createFinanceHandlers(deps):route==='/api/market'?createMarketHandlers(deps):route==='/api/fx'?createFxHandlers(deps):null;
 const response=handler?(req.method==='GET'?await handler.GET(request):await handler.POST(request)):Response.json({error:'隔离接口未启用'},{status:404});
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error);res.writeHead(500);res.end(JSON.stringify({error:'隔离测试服务异常'}));}});
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script>');
fs.writeFileSync(path.join(out,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import FinanceApp from '../../components/FinanceApp';import '../../app/globals.css';createRoot(document.getElementById('root')).render(<FinanceApp displayName=\"隔离布局测试\"/>);");
let vite,browser,page;const results=[],pageErrors=[],measurements=[],screenshots=[];
async function settle(){await page.locator('.sidebar').evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{}))))}
async function nav(name){const toggle=page.getByRole('button',{name:'切换菜单'});if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();await settle();}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}catch(error){results.push({name,status:'FAIL',error:error.message});console.error('FAIL '+name+': '+error.message.split('\n')[0]);}}
async function shot(name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true});screenshots.push(file)}
async function pageFits(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page horizontal overflow');}
async function noteMetrics(selector){return page.locator(selector).evaluateAll(nodes=>{
 const parse=value=>{const a=value.match(/[\d.]+/g)?.map(Number)??[0,0,0];return [...a.slice(0,3),a.length===4?a[3]:1]};
 const over=(fg,bg)=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3]));
 const luminance=rgb=>rgb.map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
 return nodes.flatMap(node=>{const texts=[node,...node.querySelectorAll('span,small')];return texts.filter(n=>n.textContent.trim()&&n.getClientRects().length).map(n=>{
  const s=getComputedStyle(n);let bg=[255,255,255];const parents=[];for(let p=n;p;p=p.parentElement)parents.unshift(p);for(const p of parents)bg=over(parse(getComputedStyle(p).backgroundColor),bg);
  const fg=over(parse(s.color),bg),a=luminance(fg),b=luminance(bg),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  return {selector:n.className||n.tagName,text:n.textContent.slice(0,35),fontSize:parseFloat(s.fontSize),contrast:Number(contrast.toFixed(2)),color:s.color,background:bg};
 });});
 });}
try{
 await prepareVendor(modules);const {createServer}=await import(pathToFileURL(path.join(modules,'vite/dist/node/index.js')).href);await new Promise(r=>api.listen(apiPort,'127.0.0.1',r));
 vite=await createServer({...baseConfig,root:out,server:{...baseConfig.server,port:uiPort,hmr:false,proxy:{'/api':{target:`http://127.0.0.1:${apiPort}`}}},configFile:false});await vite.listen();browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>pageErrors.push(error.message));
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'每一笔资产，都心中有数',exact:true}).waitFor();await page.getByRole('button',{name:'显示金额',exact:true}).click();
  await check(`${width}: explanatory notes are at least 12px with 4.5 contrast`,async()=>{
   const metrics=await noteMetrics('.subtitle,.help-text,.metric-note,.metric-label,.badge');measurements.push({width,page:'dashboard',metrics});const failures=metrics.filter(n=>n.fontSize<12||n.contrast<4.5);assert.deepEqual(failures,[]);const emphasis=await page.locator('.metric.emphasis .metric-label').evaluate(n=>getComputedStyle(n).color);assert.ok(emphasis.match(/[0-9.]+/g).slice(0,3).every(v=>Number(v)>180),'emphasis label should retain light text');
  });
  await nav('资产与贷款');const table=page.getByRole('table',{name:'资产与贷款账户'});await table.waitFor();
  await check(`${width}: long cash/stock notes stay within their cells; amount and action labels keep nowrap`,async()=>{
   await pageFits();const issues=await table.evaluate(table=>{
    const issues=[];for(const td of table.querySelectorAll('tbody td')){const cell=td.getBoundingClientRect();for(const text of td.querySelectorAll('.asset-name,.asset-name>div,.asset-name small,.asset-detail,.asset-row-actions,.badge,.money')){const box=text.getBoundingClientRect();if(box.left<cell.left-1||box.right>cell.right+1)issues.push({text:text.textContent.slice(0,35),cell:[cell.left,cell.right],box:[box.left,box.right]});}}
    for(const amount of table.querySelectorAll('.num>.money'))if(getComputedStyle(amount).whiteSpace!=='nowrap')issues.push({amount:amount.textContent,whiteSpace:getComputedStyle(amount).whiteSpace});
    for(const button of table.querySelectorAll('.asset-row-actions .btn'))if(getComputedStyle(button).whiteSpace!=='nowrap')issues.push({button:button.textContent,whiteSpace:getComputedStyle(button).whiteSpace});return issues;
   });assert.deepEqual(issues,[]);if(width===390){assert.equal(await table.locator('tbody tr').first().evaluate(n=>getComputedStyle(n).display),'grid');assert.equal(await table.locator('thead').evaluate(n=>getComputedStyle(n).display),'none');}
  });
  await check(`${width}: asset helper text and nested estimate notes meet size and contrast`,async()=>{
   const metrics=await noteMetrics('.asset-name small,.asset-detail,.asset-category-helper,.asset-history-toggle,.record-filters .field,.asset-accounts-table .badge');measurements.push({width,page:'assets',metrics});assert.deepEqual(metrics.filter(n=>n.fontSize<12||n.contrast<4.5),[]);
  });await shot(`assets-${width}`);
  if(width<=900)await check(`${width}: menu opens, closes with scrim and navigation restores uncovered main content`,async()=>{
   const toggle=page.getByRole('button',{name:'切换菜单'});assert.equal(await toggle.isVisible(),true);assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();await settle();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.ok((await page.locator('.sidebar').boundingBox()).x>=-1);
   await page.getByRole('button',{name:'收起菜单'}).click({position:{x:width-10,y:120}});await settle();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.getByRole('button',{name:'收起菜单'}).count(),0);await nav('现金流水');const box=await page.locator('.sidebar').boundingBox();assert.ok(box.x+box.width<=1);assert.equal(await toggle.getAttribute('aria-expanded'),'false');await pageFits();
  });
  await nav('现金流水');
  await check(`${width}: nonmatching filters explain no match and clear restores existing ledger rows`,async()=>{
   const count=await page.getByRole('table',{name:'现金流水'}).locator('tbody tr').count();assert.ok(count>0);await page.getByLabel('流水开始日期',{exact:true}).fill('2099-01-01');await page.getByText('没有符合当前筛选条件的流水。',{exact:true}).waitFor();assert.equal(await page.getByRole('table',{name:'现金流水'}).locator('tbody tr').count(),0);await page.getByRole('button',{name:'清空流水筛选'}).click();assert.equal(await page.getByLabel('流水开始日期',{exact:true}).inputValue(),'');assert.equal(await page.getByRole('table',{name:'现金流水'}).locator('tbody tr').count(),count);
  });
  if(width<=900)await check(`${width}: wide cashflow table has a readable horizontal-scroll hint`,async()=>{const wrap=page.getByRole('table',{name:'现金流水'}).locator('..');assert.match(await wrap.evaluate(n=>getComputedStyle(n,'::before').content),/表格可左右滑动/);assert.ok(await wrap.evaluate(n=>parseFloat(getComputedStyle(n,'::before').fontSize)>=12));await pageFits();});
  await check(`${width}: actual cashflow confirmation remains separate from save action`,async()=>{
   await page.getByRole('button',{name:'记实际收支',exact:true}).click();const dialog=page.getByRole('dialog'),consent=dialog.getByRole('checkbox',{name:/我已核对这笔收入/});await consent.waitFor();const label=consent.locator('..'),button=dialog.getByRole('button',{name:'确认保存',exact:true});const a=await label.boundingBox(),b=await button.boundingBox();assert.ok(b.y>=a.y+a.height,'consent and button overlap');const metrics=await noteMetrics('.modal-panel .help-text,.modal-panel .modal-note,.modal-panel .field');measurements.push({width,page:'confirmation',metrics});assert.deepEqual(metrics.filter(n=>n.fontSize<12||n.contrast<4.5),[]);assert.ok(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'dialog horizontal overflow');await shot(`confirmation-${width}`);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  });
  if(await page.getByRole('dialog').count())await page.keyboard.press('Escape');
 }
 await check('genuinely empty ledger offers first-record explanation without filter-reset action',async()=>{
  const c=await browser.newContext({extraHTTPHeaders:{'x-layout-empty':'1'},viewport:{width:390,height:844}}),p=await c.newPage();await p.goto(url,{waitUntil:'domcontentloaded'});await p.getByRole('heading',{name:'每一笔资产，都心中有数',exact:true}).waitFor();await p.getByRole('button',{name:'切换菜单'}).click();await p.getByRole('navigation').getByRole('button',{name:'现金流水',exact:true}).click();await p.getByText('暂无流水，记录实际收入或支出后会显示在这里。',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'清空流水筛选'}).count(),0);assert.equal(await p.getByRole('table',{name:'现金流水'}).locator('tbody tr').count(),0);await c.close();
 });
 await check('layout inspection does not change financial data or emit browser errors',async()=>{const after=await snapshot(fixture.db);assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.transactions,before.transactions);assert.deepEqual(after.documents,before.documents);assert.deepEqual(pageErrors,[]);});
}catch(error){results.push({name:'执行中断',status:'FAIL',error:error.stack});console.error(error.message);if(page)await shot('failure').catch(()=>{});}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({productionWrites:false,inMemoryDatabases:true,results,measurements,pageErrors,screenshots},null,2));await browser?.close();await vite?.close();await new Promise(r=>api.listening?api.close(r):r());fixture.sqlite.close();empty.sqlite.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1;console.log(`${results.filter(r=>r.status==='PASS').length} passed, ${results.filter(r=>r.status==='FAIL').length} failed`);}

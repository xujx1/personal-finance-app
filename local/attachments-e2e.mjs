import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {openTestDatabase} from '../tests/helpers/d1.mjs';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {createAttachmentHandlers} from '../src/server/attachment-http.ts';
import {prepareVendor} from './prepare-vendor.mjs';
import baseConfig from './vite.config.mjs';

// Only loopback HTTP, an in-memory ledger, and a new test-only encryption key.
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'work/attachments-e2e');
fs.mkdirSync(out,{recursive:true});
const uiPort=5773,apiPort=5774,url=`http://127.0.0.1:${uiPort}`;
for(const port of [uiPort,apiPort])await new Promise((resolve,reject)=>{const check=net.createServer();check.once('error',()=>reject(Error(`Test port ${port} is already in use; no server was stopped.`)));check.listen(port,'127.0.0.1',()=>check.close(resolve));});
const modules=path.resolve(process.env.LOCAL_TEST_MODULES??path.join(root,'node_modules'));
const browserModules=path.resolve(process.env.PLAYWRIGHT_MODULES??path.join(root,'work/calendar-qa/node_modules'));
const {chromium}=createRequire(path.join(browserModules,'../package.json'))(path.join(browserModules,'playwright'));
const {db,sqlite}=openTestDatabase();
const plan=await executeCommand(db,{key:'attachment-fixture-plan',revision:0,action:'plan.save',body:{name:'隔离票据测试计划',date:'2026-11-12',budget:'100.00',approve:true}},'owner');
const secret=randomBytes(32).toString('base64');
let failNext=false,delayNext=false,posts=[],commands=[];
const api=http.createServer(async(req,res)=>{try{
 let body='';for await(const chunk of req)body+=chunk;
 const request=new Request(`http://127.0.0.1:${uiPort}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}:{})});
 const subject=req.headers['x-test-viewer']==='1'?'viewer':'owner';
 const deps={getUser:async()=>({userId:subject}),getOwner:()=> 'owner',getDb:()=>db,getKey:()=>secret};
 const route=new URL(request.url).pathname;
 if(route==='/api/attachments'&&req.method==='POST'){posts.push(JSON.parse(body));if(delayNext){delayNext=false;await new Promise(r=>setTimeout(r,550));}}
 if(route==='/api/finance'&&req.method==='POST')commands.push(JSON.parse(body));
 const handlers=route==='/api/attachments'?createAttachmentHandlers(deps):createFinanceHandlers(deps);
 let response=req.method==='POST'?await handlers.POST(request):await handlers.GET(request);
 // Simulate a lost success response after the real handler has committed.
 if(route==='/api/attachments'&&req.method==='POST'&&failNext){failNext=false;response=Response.json({error:'连接中断，请核对附件后重试'},{status:503});}
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error);res.writeHead(500);res.end(JSON.stringify({error:'隔离测试服务异常'}));}});
const fixtureHtml='<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script>';
fs.writeFileSync(path.join(out,'index.html'),fixtureHtml);
fs.writeFileSync(path.join(out,'entry.tsx'),`import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import Attachments from '../../components/Attachments';import '../../app/globals.css';function Fixture(){const [state,setState]=useState(null);async function refresh(){const r=await fetch('/api/finance');if(!r.ok)throw Error('列表刷新失败');setState(await r.json())}useEffect(()=>{refresh()},[]);async function save(action,body){const r=await fetch('/api/finance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,body,revision:state.book.revision,key:crypto.randomUUID()})});if(!r.ok)throw Error((await r.json()).error);const value=await r.json();await refresh();return value}return <main style={{maxWidth:800,margin:'24px auto',padding:16}}>{state&&<Attachments planId=${JSON.stringify(plan.id)} state={state} onRefresh={refresh} onSave={save}/>}</main>}createRoot(document.getElementById('root')).render(<Fixture/>);`);
let vite,browser,page;const results=[],errors=[];
const pdf={name:'模拟票据.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 isolated receipt')};
const png={name:'模拟图片.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')};
const section=p=>p.getByRole('region',{name:'票据与附件'}),file=p=>p.getByLabel('选择票据附件',{exact:true}),confirm=p=>p.getByRole('checkbox',{name:'确认将此附件私密保存到该计划'}),save=p=>p.getByRole('button',{name:'保存附件',exact:true});
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name)}
try{
 await prepareVendor(modules);const {createServer}=await import(pathToFileURL(path.join(modules,'vite/dist/node/index.js')).href);
 await new Promise(r=>api.listen(apiPort,'127.0.0.1',r));
 vite=await createServer({...baseConfig,root:out,server:{...baseConfig.server,port:uiPort,proxy:{'/api':{target:`http://127.0.0.1:${apiPort}`}}},configFile:false});await vite.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'networkidle'});
 await check('selection renders local image preview and clear removes selection without saving',async()=>{
  await file(page).setInputFiles(png);const image=page.getByRole('img',{name:'待保存附件预览'});await image.waitFor();assert.match(await image.getAttribute('src'),/^blob:/);assert.ok(await image.evaluate(n=>n.complete&&n.naturalWidth>0));await confirm(page).check();await page.getByRole('button',{name:'清除所选文件'}).click();assert.equal(await file(page).inputValue(),'');assert.equal(await confirm(page).isChecked(),false);assert.equal(await image.count(),0);assert.equal(posts.length,0);
 });
 await check('MIME and oversize errors appear before submit and choosing another file resets error and confirmation',async()=>{
  await file(page).setInputFiles({name:'模拟文本.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});await page.getByRole('alert').filter({hasText:/PDF|格式/}).waitFor();assert.equal(await save(page).isDisabled(),true);
  await file(page).setInputFiles({...pdf,buffer:Buffer.alloc(524289,32)});await page.getByRole('alert').filter({hasText:/512/}).waitFor();assert.equal(await save(page).isDisabled(),true);await file(page).setInputFiles(pdf);assert.equal(await page.getByRole('alert').count(),0);assert.equal(await confirm(page).isChecked(),false);assert.equal(posts.length,0);assert.match(await section(page).innerText(),/模拟票据.pdf.*KB/s);
 });
 await check('successful save resets native filename and consent, announces result and refreshes saved list',async()=>{
  await confirm(page).check();await save(page).click();await page.getByRole('status').filter({hasText:/已保存/}).waitFor();assert.equal(await file(page).inputValue(),'');assert.equal(await confirm(page).isChecked(),false);assert.equal(await save(page).isDisabled(),true);await section(page).getByRole('link',{name:pdf.name,exact:true}).waitFor();assert.equal((await snapshot(db)).documents.filter(d=>d.kind==='attachment').length,1);
 });
 await check('lost response retains file, requires renewed consent and reuses original key once; busy blocks edits and duplicate submit',async()=>{
  await file(page).setInputFiles({...pdf,name:'模拟重试.pdf'});await confirm(page).check();failNext=true;delayNext=true;const start=posts.length;await save(page).click();await page.getByRole('button',{name:/保存中/}).waitFor();assert.equal(await file(page).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'清除所选文件'}).isDisabled(),true);assert.equal(await confirm(page).isDisabled(),true);
  await page.getByRole('alert').filter({hasText:/重试/}).waitFor();assert.match(await file(page).inputValue(),/模拟重试.pdf$/);assert.equal(await confirm(page).isChecked(),false);assert.equal(await save(page).isDisabled(),true);assert.equal(posts.length,start+1);await confirm(page).check();await save(page).click();await page.getByRole('status').filter({hasText:/已保存/}).waitFor();assert.equal(posts.length,start+2);assert.equal(posts[start].key,posts[start+1].key);assert.equal((await snapshot(db)).documents.filter(d=>d.kind==='attachment').length,2);
 });
 await check('switching file after failure clears error, consent and old request key',async()=>{
  await file(page).setInputFiles({...pdf,name:'模拟旧选择.pdf'});await confirm(page).check();failNext=true;await save(page).click();await page.getByRole('alert').waitFor();const old=posts.at(-1).key;
  await file(page).setInputFiles({...pdf,name:'模拟新选择.pdf'});assert.equal(await page.getByRole('alert').count(),0);assert.equal(await confirm(page).isChecked(),false);await confirm(page).check();await save(page).click();await page.getByRole('status').filter({hasText:/已保存/}).waitFor();assert.notEqual(posts.at(-1).key,old);
 });
 await check('archive affects only saved item and leaves current unsaved selection intact',async()=>{
  await file(page).setInputFiles(png);const row=section(page).locator('.attachment-saved-item').filter({has:page.getByRole('link',{name:pdf.name,exact:true})});await row.getByRole('button',{name:'归档附件'}).click();await row.waitFor({state:'hidden'});assert.equal(commands.at(-1).action,'attachment.archive');assert.match(await file(page).inputValue(),/模拟图片.png$/);assert.equal((await snapshot(db)).documents.find(d=>d.kind==='attachment'&&d.payload.name===pdf.name).payload.archived,true);
 });
 await check('mobile consent and action occupy separate rows with no overflow; keyboard clear works',async()=>{
  const label=confirm(page).locator('..'),button=page.getByRole('button',{name:'清除所选文件'});const a=await label.boundingBox(),b=await save(page).boundingBox();assert.ok(b.y>=a.y+a.height);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await button.focus();await page.keyboard.press('Enter');assert.equal(await file(page).inputValue(),'');await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 });
 await check('read-only visitor can download but cannot select, upload or archive',async()=>{
  const c=await browser.newContext({extraHTTPHeaders:{'x-test-viewer':'1'},viewport:{width:390,height:844}}),p=await c.newPage();await p.goto(url,{waitUntil:'networkidle'});await section(p).waitFor();assert.equal(await file(p).isDisabled(),true);assert.equal(await save(p).isDisabled(),true);for(const b of await section(p).getByRole('button',{name:'归档附件'}).all())assert.equal(await b.isDisabled(),true);assert.ok(await section(p).getByRole('link').count()>0);assert.match(await section(p).innerText(),/只读/);await c.close();
 });
 assert.deepEqual(errors,[]);
}catch(error){console.error(error);results.push({name:'执行中断',status:'FAIL',error:error.stack});if(page){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText().catch(()=>''));}process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({productionWrites:false,inMemoryDatabase:true,testOnlyEphemeralKey:true,results,errors},null,2));await browser?.close();await vite?.close();await new Promise(r=>api.listening?api.close(r):r());sqlite.close();}

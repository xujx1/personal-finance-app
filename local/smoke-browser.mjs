import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const modules=process.argv[2];
if(!modules)throw Error('Provide a directory containing an already installed playwright package');
const {chromium}=createRequire(path.resolve(modules,'../package.json'))(path.resolve(modules,'playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 fs.mkdirSync('.sites-runtime/e2e',{recursive:true});await page.screenshot({path:'.sites-runtime/e2e/desktop.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.sites-runtime/e2e/mobile.png',fullPage:true,animations:'disabled'});
 console.log(JSON.stringify({title:await page.title(),text:(await page.locator('body').innerText()).slice(0,4000),errors},null,2));
 if(errors.length)process.exitCode=1;
}finally{await browser.close();}

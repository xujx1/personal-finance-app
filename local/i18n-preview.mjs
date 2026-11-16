// Offline preview of the real React product with synthetic in-memory fixtures.
// Every request is intercepted locally. Writes and external requests are rejected.
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {i18nFixture} from './i18n-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),fixture=await i18nFixture();
fixture.report={...fixture.report,aiReview:{title:'Synthetic monthly review',summary:'Offline sample only. Original ledger amounts and transaction currencies are retained.',sections:[],nextActions:['Review original receipts before recording real payments.'],limitations:['Synthetic data; no model inference, live quotation or production write.'],stale:false}};
const source=`import React from 'react';import {createRoot} from 'react-dom/client';import FinanceApp from './components/FinanceApp';import {I18nProvider} from './components/I18n';import './app/globals.css';
const fixture=${JSON.stringify(fixture)};
window.__i18nWrites=[];
window.fetch=async(input,options={})=>{const url=new URL(String(input),'https://offline.invalid');if(options.method&&options.method!=='GET'){window.__i18nWrites.push({url:url.pathname,body:options.body});return Response.json({error:'当前分享访问为只读'},{status:403})}const data=url.pathname==='/api/finance'?fixture.state:url.pathname==='/api/market'?{quotes:{}}:url.pathname==='/api/fx'?{rate:7.1,date:fixture.day,status:'cached',source:'Synthetic fixture'}:url.pathname==='/api/family'?fixture.family:url.pathname==='/api/reviews'?{document:fixture.report}:url.pathname==='/api/recurring'?{complete:true,candidates:[],message:'完整历史中暂无足够多月的周期候选'}:null;return Response.json(data??{error:'记录不存在'},{status:data?200:404})};
createRoot(document.getElementById('root')).render(<I18nProvider><div style={{padding:'8px 16px',background:'#fff1cf',textAlign:'center'}}>OFFLINE I18N PREVIEW · Synthetic data · Writes disabled</div><FinanceApp displayName="模拟成员"/></I18nProvider>);`;
const result=await build({stdin:{contents:source,resolveDir:root,loader:'tsx'},bundle:true,format:'iife',platform:'browser',write:false,outfile:'preview.js',minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'';
const out=path.join(root,'work/i18n/preview.html');await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline i18n preview</title><style>${css}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></html>`);console.log(out);

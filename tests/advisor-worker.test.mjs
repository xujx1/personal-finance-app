import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';

test('advisor SSE accepts the framework-tracked Request proxy in the production Worker runtime and sends a structured error when no DB is bound',async()=>{
 const output=await build({stdin:{contents:"import {createAdvisorHandlers} from './src/server/advisor-http.ts';const h=createAdvisorHandlers({getUser:async()=>({userId:'worker-fixture'}),getDb:()=>undefined,getOwner:()=>undefined,getConfig:()=>({})});export default {fetch(req){return h.POST(new Proxy(req,{get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}}))}}",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022'});
 const mf=new Miniflare({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});
 try{const r=await mf.dispatchFetch('https://worker.example/api/advisor',{method:'POST',headers:{Accept:'text/event-stream','Content-Type':'application/json'},body:JSON.stringify({key:'worker-scenario',question:'安徽亲子游',mode:'rules',date:'2026-11-14'})});const text=await r.text();assert.equal(r.status,200,text);assert.match(r.headers.get('content-type'),/text\/event-stream/);assert.match(text,/"type":"error"/);assert.match(text,/数据库/);}finally{await mf.dispose()}
});

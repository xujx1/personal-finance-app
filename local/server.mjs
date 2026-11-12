import {retiredAIResponse} from '../src/server/retired-ai.ts';
import {createSkillHandlers} from '../src/server/skill-http.ts';
import {createReviewHandlers} from '../src/server/review-http.ts';
import {createLocalFamilyApi} from './family-api.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openTestDatabase} from '../tests/helpers/d1.mjs';
import {createRecurringHandlers} from '../src/server/recurring-http.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {createAttachmentHandlers} from '../src/server/attachment-http.ts';
import {createBackupHandlers} from '../src/server/backup-http.ts';
import {createFxHandlers} from '../src/server/fx-http.ts';
import {createMarketHandlers} from '../src/server/market-http.ts';
import {createJobsHandlers} from '../src/server/jobs-http.ts';
import {runScheduledJobs} from '../src/server/jobs.ts';
import {createMcpHandler} from '../src/server/mcp-http.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'.sites-runtime','local-qa');fs.mkdirSync(directory,{recursive:true});
const uiPort=Number(process.env.LOCAL_UI_PORT??5173),apiPort=Number(process.env.LOCAL_API_PORT??5174);
if(!Number.isInteger(uiPort)||!Number.isInteger(apiPort)||uiPort<1024||apiPort<1024||uiPort>65535||apiPort>65535)throw Error('本地端口无效');
try{process.loadEnvFile(path.join(root,'.env.local'))}catch(e){if(e.code!=='ENOENT')throw Error('无法读取本地环境配置');}
const existing=fs.readdirSync(directory).filter(n=>/^simulated-\d+\.sqlite$/.test(n)&&fs.lstatSync(path.join(directory,n)).isFile()).sort((a,b)=>fs.statSync(path.join(directory,b)).mtimeMs-fs.statSync(path.join(directory,a)).mtimeMs);
const requested=process.env.LOCAL_QA_DATABASE;if(requested&&!/^qa-[A-Za-z0-9_-]+\.sqlite$/.test(requested))throw Error('测试数据库名称必须为qa-开头的安全文件名');
const {db,sqlite}=openTestDatabase(path.join(directory,requested??existing[0]??`simulated-${Date.now()}.sqlite`));
const familyApi=process.env.LOCAL_FAMILY_QA==='1'?createLocalFamilyApi(db):null;
const recurring=createRecurringHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db});
const api=createFinanceHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db,getOwner:()=> 'local-simulated-owner'});
const attachments=createAttachmentHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db,getKey:()=>process.env.ATTACHMENT_KEY});
const backup=createBackupHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db});
const fx=createFxHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db,...(process.env.LOCAL_QA_OFFLINE_FX==='1'?{fetcher:async()=>{throw Error('Explicit offline QA fixture')}}:{})});
const market=createMarketHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db});
const jobDeps={getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db,getQuotes:async()=>((await(await market.GET(new Request('http://127.0.0.1/api/market'))).json()).quotes??{})};
const jobs=createJobsHandlers(jobDeps);
const retired={GET:retiredAIResponse,POST:retiredAIResponse,CALLBACK:retiredAIResponse},advisor=retired,images=retired,research=retired,investment=retired,chatgpt=retired;
const skills=createSkillHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db}),reviews=createReviewHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db});
const mcp=createMcpHandler({getIdentity:async()=>({id:'local-simulated-owner',canWrite:true}),getDb:()=>db});
const server=http.createServer(async(req,res)=>{try{
 const host=req.headers.host;if(![`127.0.0.1:${uiPort}`,`127.0.0.1:${apiPort}`,`localhost:${uiPort}`,`localhost:${apiPort}`].includes(host)){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,`http://${host}`);let response;
 if(!familyApi&&url.pathname==='/api/fx')response=await fx.GET();
 else if(['/api/skills','/api/reviews','/api/recurring','/api/family','/api/initialization','/api/finance','/api/advisor','/api/attachments','/api/images','/api/backup','/api/chatgpt','/api/investment','/api/research','/api/market','/api/jobs','/mcp','/auth/callback'].includes(url.pathname)){
  const abort=new AbortController();req.once('aborted',()=>abort.abort());res.once('close',()=>{if(!res.writableEnded)abort.abort()});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>(url.pathname==='/api/images'?3100000:url.pathname==='/api/backup'?15000000:url.pathname==='/api/attachments'?730000:url.pathname==='/api/finance'?80000:20000)){res.writeHead(413);res.end();return;}}
  const request=new Request(url,{method:req.method,headers:req.headers,signal:abort.signal,...(['GET','HEAD'].includes(req.method)?{}:{body})});
  const handlers={'/api/skills':skills,'/api/reviews':reviews,'/api/recurring':recurring,'/api/finance':api,'/api/attachments':attachments,'/api/advisor':advisor,'/api/images':images,'/api/backup':backup,'/api/chatgpt':chatgpt,'/api/research':research,'/api/investment':investment,'/api/market':market,'/api/jobs':jobs};const handler=handlers[url.pathname];
  response=familyApi?await familyApi(request):url.pathname==='/auth/callback'?await chatgpt.CALLBACK(request):url.pathname==='/mcp'?await mcp(request):req.method==='GET'?handler.GET?await handler.GET(request):new Response(null,{status:405}):req.method==='POST'?handler.POST?await handler.POST(request):new Response(null,{status:405}):new Response(null,{status:405});
 }else response=new Response(null,{status:404});
 res.writeHead(response.status,Object.fromEntries(response.headers));if(response.headers.get('content-type')?.includes('text/event-stream')&&response.body){res.flushHeaders();for await(const chunk of response.body){if(res.destroyed)break;res.write(Buffer.from(chunk))}res.end()}else res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'本地测试服务错误'}));console.error(e);}});
server.listen(apiPort,'127.0.0.1',()=>console.log('Local simulated API ready: http://127.0.0.1:'+apiPort));
let jobBusy=false;const timer=setInterval(async()=>{if(familyApi||jobBusy)return;jobBusy=true;try{const s=await api.GET(new Request('http://127.0.0.1/api/finance')),v=await s.json();if(v.documents?.some(d=>d.kind==='recurring_rule'||d.kind==='reminder'))await runScheduledJobs(db,jobDeps)}catch{console.error('Local scheduled check incomplete; no automatic request replay')}finally{jobBusy=false}},300000);timer.unref();
const close=()=>server.close(()=>{sqlite.close();process.exit(0)});process.on('SIGINT',close);process.on('SIGTERM',close);

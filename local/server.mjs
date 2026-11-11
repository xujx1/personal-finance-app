import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openTestDatabase} from '../tests/helpers/d1.mjs';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {createAdvisorHandlers} from '../src/server/advisor-http.ts';
import {createAttachmentHandlers} from '../src/server/attachment-http.ts';
import {createBackupHandlers} from '../src/server/backup-http.ts';
import {createMarketHandlers} from '../src/server/market-http.ts';
import {createChatGPTHandlers} from '../src/server/chatgpt-http.ts';
import {createChatGPTService} from '../src/server/chatgpt-service.mjs';
import {createResearchHandlers} from '../src/server/research-http.ts';
import {createJobsHandlers} from '../src/server/jobs-http.ts';
import {runScheduledJobs} from '../src/server/jobs.ts';
import {createImageHandlers} from '../src/server/image-http.ts';
import {createMcpHandler} from '../src/server/mcp-http.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'.sites-runtime','local-qa');fs.mkdirSync(directory,{recursive:true});
const uiPort=Number(process.env.LOCAL_UI_PORT??5173),apiPort=Number(process.env.LOCAL_API_PORT??5174);
if(!Number.isInteger(uiPort)||!Number.isInteger(apiPort)||uiPort<1024||apiPort<1024||uiPort>65535||apiPort>65535)throw Error('本地端口无效');
try{process.loadEnvFile(path.join(root,'.env.local'))}catch(e){if(e.code!=='ENOENT')throw Error('无法读取本地环境配置');}
const existing=fs.readdirSync(directory).filter(n=>/^simulated-\d+\.sqlite$/.test(n)&&fs.lstatSync(path.join(directory,n)).isFile()).sort((a,b)=>fs.statSync(path.join(directory,b)).mtimeMs-fs.statSync(path.join(directory,a)).mtimeMs);
const requested=process.env.LOCAL_QA_DATABASE;if(requested&&!/^qa-[A-Za-z0-9_-]+\.sqlite$/.test(requested))throw Error('测试数据库名称必须为qa-开头的安全文件名');
const {db,sqlite}=openTestDatabase(path.join(directory,requested??existing[0]??`simulated-${Date.now()}.sqlite`));
const api=createFinanceHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db,getOwner:()=> 'local-simulated-owner'});
const chatgptService=createChatGPTService({db,config:{tokenKey:process.env.CHATGPT_TOKEN_KEY,redirectUri:process.env.CHATGPT_REDIRECT_URI,clientId:process.env.CHATGPT_CLIENT_ID,clientSecret:process.env.CHATGPT_CLIENT_SECRET}});
const chatgpt=createChatGPTHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',service:chatgptService});
const attachments=createAttachmentHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db,getKey:()=>process.env.ATTACHMENT_KEY});
const backup=createBackupHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db});
const market=createMarketHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db});
const research=createResearchHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db,chatgpt:chatgptService,getConfig:()=>({baseUrl:process.env.NEW_API_BASE_URL,key:process.env.NEW_API_KEY,model:process.env.NEW_API_MODEL,searchKey:process.env.TAVILY_API_KEY})});
const jobDeps={getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db,getQuotes:async()=>((await(await market.GET(new Request('http://127.0.0.1/api/market'))).json()).quotes??{})};
const jobs=createJobsHandlers(jobDeps);
const advisor=createAdvisorHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getDb:()=>db,getOwner:()=> 'local-simulated-owner',chatgpt:chatgptService,getConfig:()=>({baseUrl:process.env.NEW_API_BASE_URL,model:process.env.NEW_API_MODEL,key:process.env.NEW_API_KEY})});
const images=createImageHandlers({getUser:async()=>({userId:'local-simulated-owner'}),getOwner:()=> 'local-simulated-owner',getDb:()=>db,getConfig:()=>({baseUrl:process.env.NEW_API_BASE_URL,key:process.env.NEW_API_KEY,model:process.env.NEW_API_VISION_MODEL})});
const mcp=createMcpHandler({getIdentity:async()=>({id:'local-simulated-owner',canWrite:true}),getDb:()=>db});
const server=http.createServer(async(req,res)=>{try{
 const host=req.headers.host;if(![`127.0.0.1:${uiPort}`,`127.0.0.1:${apiPort}`,`localhost:${uiPort}`,`localhost:${apiPort}`].includes(host)){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,`http://${host}`);let response;
 if(url.pathname==='/api/fx')response=Response.json({rate:null,status:'unavailable',source:'ECB日度参考价',message:'本地离线测试未取得汇率，外币资产暂不计入合计'});
 else if(['/api/finance','/api/advisor','/api/attachments','/api/images','/api/backup','/api/chatgpt','/api/research','/api/market','/api/jobs','/mcp','/auth/callback'].includes(url.pathname)){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>(url.pathname==='/api/images'?3100000:url.pathname==='/api/backup'?15000000:url.pathname==='/api/attachments'?730000:20000)){res.writeHead(413);res.end();return;}}
  const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body})});
  const handlers={'/api/finance':api,'/api/attachments':attachments,'/api/advisor':advisor,'/api/images':images,'/api/backup':backup,'/api/chatgpt':chatgpt,'/api/research':research,'/api/market':market,'/api/jobs':jobs};const handler=handlers[url.pathname];
  response=url.pathname==='/auth/callback'?await chatgpt.CALLBACK(request):url.pathname==='/mcp'?await mcp(request):req.method==='GET'?handler.GET?await handler.GET(request):new Response(null,{status:405}):req.method==='POST'?handler.POST?await handler.POST(request):new Response(null,{status:405}):new Response(null,{status:405});
 }else response=new Response(null,{status:404});
 res.writeHead(response.status,Object.fromEntries(response.headers));if(response.headers.get('content-type')?.includes('text/event-stream')&&response.body){res.flushHeaders();for await(const chunk of response.body){if(res.destroyed)break;res.write(Buffer.from(chunk))}res.end()}else res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'本地测试服务错误'}));console.error(e);}});
server.listen(apiPort,'127.0.0.1',()=>console.log('Local simulated API ready: http://127.0.0.1:'+apiPort));
let jobBusy=false;const timer=setInterval(async()=>{if(jobBusy)return;jobBusy=true;try{const s=await api.GET(new Request('http://127.0.0.1/api/finance')),v=await s.json();if(v.documents?.some(d=>d.kind==='recurring_rule'||d.kind==='reminder'))await runScheduledJobs(db,jobDeps)}catch{console.error('Local scheduled check incomplete; no automatic request replay')}finally{jobBusy=false}},300000);timer.unref();
const close=()=>server.close(()=>{sqlite.close();process.exit(0)});process.on('SIGINT',close);process.on('SIGTERM',close);

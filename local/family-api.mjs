// Explicitly simulated identities for isolated local tests only. Production uses Sites headers.
import {withFamilyRequest,createFamilyHandlers} from '../src/server/family-route.ts';
import {createRecurringHandlers} from '../src/server/recurring-http.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {createInitializationHandlers} from '../src/server/initialization-http.ts';
import {createMarketHandlers} from '../src/server/market-http.ts';
import {createFxHandlers} from '../src/server/fx-http.ts';
import {retiredAIResponse} from '../src/server/retired-ai.ts';
import {createSkillHandlers} from '../src/server/skill-http.ts';
import {createReviewHandlers} from '../src/server/review-http.ts';
import {createMcpHandler} from '../src/server/mcp-http.ts';
export function createLocalFamilyApi(db){return async req=>{
 const subject=req.headers.get('x-local-qa-user')??'local-simulated-owner',user=['local-simulated-owner','local-simulated-member','local-simulated-outsider'].includes(subject)?{userId:subject,displayName:subject==='local-simulated-owner'?'模拟管理员':subject==='local-simulated-member'?'模拟家人':'模拟外人',email:subject+'@example.test'}:null;
 const getUser=async()=>user,env={DB:db,FAMILY_BOOTSTRAP_OWNER_EMAIL:'local-simulated-owner@example.test'},path=new URL(req.url).pathname;
 if(path==='/api/family'){const h=createFamilyHandlers({getUser,env});return req.method==='POST'?h.POST(req):h.GET(req)}
 return withFamilyRequest(req,getUser,env,async d=>{
  if(['/api/advisor','/api/investment','/api/research','/api/images','/api/chatgpt','/auth/callback'].includes(path))return retiredAIResponse();
  if(path==='/api/skills')return createSkillHandlers(d).GET(req);
  if(path==='/api/reviews')return createReviewHandlers(d).GET(req);
  if(path==='/api/recurring'){const h=createRecurringHandlers(d);return req.method==='POST'?h.POST(req):h.GET();}
  if(path==='/api/finance'){const h=createFinanceHandlers(d);return req.method==='POST'?h.POST(req):h.GET(req)}
  if(path==='/api/initialization')return createInitializationHandlers(d).POST(req);
  if(path==='/api/market')return Response.json({quotes:{},simulated:true});
  if(path==='/api/fx')return createFxHandlers({...d,fetcher:async()=>{throw Error('Explicit offline fixture')}}).GET();
  if(path==='/mcp')return createMcpHandler({getDb:d.getDb,getIdentity:async()=>({id:user.userId,canWrite:d.scope.canWrite})})(req);
  return Response.json({error:'此家庭测试未配置模型或上传服务'},{status:503});
 });
};}

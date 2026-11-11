import {familyContext,familyView,familyCommand,previewFamilyInvite,type FamilyUser} from './family-service.ts';
import {scopeDb} from './ledger-scope.ts';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export const familyConfig=(env:any)=>({ownerSubject:env.OWNER_SUBJECT_ID,bootstrapOwnerEmail:env.FAMILY_BOOTSTRAP_OWNER_EMAIL,restrictCreation:true});
export async function withFamilyRequest(req:Request,getUser:()=>Promise<FamilyUser|null>,env:any,run:(deps:any)=>Promise<Response>|Response){
 const user=await getUser();if(!user)return json({error:'请先使用ChatGPT账号登录'},401);if(!env.DB)return json({error:'数据库尚未配置'},503);
 try{const scope=await familyContext(env.DB,user,familyConfig(env));if(!scope)return json({error:'请先接受家庭邀请',code:'FAMILY_REQUIRED'},403);
  const db=scopeDb(env.DB,scope);return await run({getUser:async()=>user,getDb:()=>db,getOwner:()=>scope.ownerSubject,user,scope});
 }catch{return json({error:'家庭权限或数据状态已变化，请重新加载'},403)}
}
export function createFamilyHandlers(deps:{getUser:()=>Promise<FamilyUser|null>;env:any}){return {
 async GET(_req:Request){const u=await deps.getUser();if(!u)return json({error:'请先使用ChatGPT账号登录'},401);if(!deps.env.DB)return json({error:'数据库尚未配置'},503);try{return json(await familyView(deps.env.DB,u,familyConfig(deps.env)))}catch{return json({error:'家庭资料暂时无法读取'},503)}},
 async POST(req:Request){const u=await deps.getUser();if(!u)return json({error:'请先使用ChatGPT账号登录'},401);if(!deps.env.DB)return json({error:'数据库尚未配置'},503);if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
  try{const raw=await req.text();if(raw.length>2000)return json({error:'请求过长'},413);const p=JSON.parse(raw);return json(p.action==='preview'?await previewFamilyInvite(deps.env.DB,p.token):await familyCommand(deps.env.DB,u,p,familyConfig(deps.env)))}catch(e:any){return json({error:String(e.message).slice(0,160)},409)}
 }
};}

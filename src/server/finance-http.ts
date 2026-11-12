import {ledgerBookId} from './ledger-scope.ts';
import {minor} from '../domain/finance.mjs';
import {buildFinanceMembers,accountMember} from '../domain/member-ownership.mjs';
import {snapshot,publicSnapshot,executeCommand,commandStatus} from './finance-store.ts';
type Dependencies={getUser:()=>Promise<{userId:string}|null>;getDb:()=>D1Database|undefined;getOwner:()=>string|undefined};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export function createFinanceHandlers(deps:Dependencies){
 return {
  async GET(req:Request){try{
   const user=await deps.getUser();if(!user)return json({error:'请先登录'},401);
   const db=deps.getDb();if(!db)return json({error:'数据库尚未绑定，请先完成D1部署'},503);
   const key=new URL(req.url).searchParams.get('command_key');if(key)return json(await commandStatus(db,key));
   const owner=deps.getOwner(),state=await snapshot(db);if(!state.household){state.householdMembers=[{userId:user.userId,displayName:'本人',active:true,role:'owner'}];state.financeMembers=buildFinanceMembers(state,state.householdMembers);for(const a of state.accounts){if(a.category==='system')continue;const m=accountMember(a,state);a.metadata={...a.metadata,ownerMemberId:m.id,ownerLabel:m.name};}}return json({...publicSnapshot(state),viewer:{subject:user.userId,canWrite:!owner||owner===user.userId}});
  }catch(e:any){return json({error:String(e.message).slice(0,250)},String(e.message).startsWith('CONFLICT:')?409:500);}},
  async POST(req:Request){try{
   const user=await deps.getUser();if(!user)return json({error:'请先登录'},401);
   const owner=deps.getOwner();
   if(req.headers.get('origin')&&new URL(req.headers.get('origin')!).origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
   const db=deps.getDb();if(!db)return json({error:'数据库尚未绑定'},503);
   const raw=await req.text();if(raw.length>80000)return json({error:'请求内容过长'},413);
   const input=JSON.parse(raw);if(raw.length>20000&&input.action!=='skills.save')return json({error:'请求内容过长'},413);const action=typeof input.action==='string'?input.action.trim():'';
   if(!['monthly.report.save','asset.types.save','skills.save','skills.restore','mcp.draft.accept','mcp.draft.reject','transaction.record','member.save','account.owner.set','account.save','account.archive','plan.save','plan.cancel','plan.approve','plan.schedule','plan.reserve','plan.pay','transaction.refund','loan.pay','advice.accept','research.request','financial.profile.save','preferences.save','cash.transfer','asset.trade','recurring.save','recurring.run','recurring.confirm','import.confirm','plan.details','plan.prepay','plan.consume','plan.prepay.refund','reminder.save','notification.read','savings.goal.save','attachment.archive'].includes(action))return json({error:'此操作不允许通过公开账本接口调用'},403);
   if(owner&&owner!==user.userId&&(action!=='plan.approve'||!(db as any).ledgerScope))return json({error:'当前分享访问为只读'},403);
   input.action=action;
   if(action==='account.save'&&input.body?.id){const state=await snapshot(db),a=state.accounts.find((a:any)=>a.id===input.body.id);if(a?.category==='cash'&&minor(String(input.body.amount))!==a.balance)return json({error:'银行现金变动请通过已确认预算、图片核对或真实到账记录；不能手改余额扣款'},403);}
   if(action==='account.save'||action==='plan.save'){
    const id=input.body?.id,kind=action==='account.save'?'accounts':'documents';
    const current:any=typeof id==='string'?await db.prepare('SELECT id FROM '+kind+" WHERE dataset_id=(SELECT active_dataset FROM books WHERE id=?) AND id=?"+(kind==='documents'?" AND kind='plan'":'')).bind(ledgerBookId(db),id).first():null;
    if(!current||action==='plan.save'&&input.body?.approve===true)return json({error:action==='account.save'?'新增已有资产请在ChatGPT完成整理并提交资产草稿，再回本站核对':'新增预算请在ChatGPT完成规划并提交预算草稿，家庭审批后生效'},403);
   }
   return json(await executeCommand(db,input,user.userId));
  }catch(e:any){const message=String(e.message);return json({error:message.slice(0,250)},message.startsWith('UNKNOWN:')?503:message.startsWith('CONFLICT:')?409:422);}}
 };
}

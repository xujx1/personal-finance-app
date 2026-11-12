import {snapshot} from './finance-store.ts';
import {getMonthlyContext} from './mcp-queries.ts';
import {assertLedgerAccess} from './ledger-scope.ts';
export function createReviewHandlers(deps:any){return {async GET(req:Request){const json=(p:any,status=200)=>Response.json(p,{status,headers:{'Cache-Control':'private, no-store'}});try{
 const user=await deps.getUser();if(!user)return json({error:'请先登录'},401);const db=deps.getDb();if(!db)return json({error:'数据库尚未绑定'},503);if(db.ledgerScope&&db.ledgerScope.userId!==user.userId)throw Error('家庭身份不匹配');const url=new URL(req.url);if([...url.searchParams.keys()].some(k=>k!=='month'))throw Error('月报参数无效');const result=await getMonthlyContext(db,await snapshot(db),url.searchParams.get('month')??'');await assertLedgerAccess(db);return json(result);
 }catch(e:any){return json({error:String(e.message).slice(0,200)},403)}}};}

import {snapshot} from './finance-store.ts';
import {getMonthlyContext} from './mcp-queries.ts';
import {buildMonthlyReportDocument} from './monthly-report-document.ts';
import {assertLedgerAccess} from './ledger-scope.ts';
export function createReviewHandlers(deps:any){return {async GET(req:Request){const json=(p:any,status=200)=>Response.json(p,{status,headers:{'Cache-Control':'private, no-store'}});try{
 const user=await deps.getUser();if(!user)return json({error:'请先登录'},401);const db=deps.getDb();if(!db)return json({error:'数据库尚未绑定'},503);if(db.ledgerScope&&db.ledgerScope.userId!==user.userId)throw Error('家庭身份不匹配');
 const url=new URL(req.url);if([...url.searchParams.keys()].some(k=>!['month','archive'].includes(k)))throw Error('月报参数无效');const month=url.searchParams.get('month')??'';if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('月份无效');
 const state=await snapshot(db),archives=state.documents.filter((d:any)=>d.kind==='monthly_report_archive'&&d.payload.month===month),index=archives.map((d:any)=>{const {document,...p}=d.payload;void document;return {id:d.id,...p}}).sort((a:any,b:any)=>b.version-a.version),id=url.searchParams.get('archive');
 if(id){const archive=archives.find((d:any)=>d.id===id);if(!archive)throw Error('报告不存在或无权访问');await assertLedgerAccess(db);return json({document:archive.payload.document,archive:index.find((a:any)=>a.id===id),archives:index,archived:true});}
 const result=await getMonthlyContext(db,state,month),document=await buildMonthlyReportDocument(db,state,month,result);await assertLedgerAccess(db);return json({...result,document,archives:index});
 }catch(e:any){return json({error:String(e.message).slice(0,200)},403)}}};}

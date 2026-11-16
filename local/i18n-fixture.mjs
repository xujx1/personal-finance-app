// Synthetic, in-memory data only. No production database, credentials or network.
import {openTestDatabase} from '../tests/helpers/d1.mjs';
import {executeCommand,snapshot,publicSnapshot} from '../src/server/finance-store.ts';
import {familyContext,familyView} from '../src/server/family-service.ts';
import {scopeDb} from '../src/server/ledger-scope.ts';
import {buildMonthlyReportDocument} from '../src/server/monthly-report-document.ts';
export async function i18nFixture(){
 const x=openTestDatabase(),user={userId:'i18n-fixture',displayName:'模拟成员'},scope=await familyContext(x.db,user,{ownerSubject:user.userId}),db=scopeDb(x.db,scope);
 try{
  const send=async(action,body)=>executeCommand(db,{key:crypto.randomUUID(),revision:(await snapshot(db)).book.revision,action,body},user.userId);
  const bank=await send('account.save',{name:'银行现金',category:'cash',currency:'CNY',amount:'20000.00',ownerMemberId:'user:'+user.userId});
  await send('account.save',{name:'模拟美元账户',category:'cash',currency:'USD',amount:'1234.56',ownerMemberId:'family'});
  await send('account.save',{name:'模拟基金',category:'fund',currency:'CNY',amount:'6000.00',ownerMemberId:'user:'+user.userId,quantity:'1000',price:'6',code:'000001',market:'CN'});
  await send('account.save',{name:'模拟住房贷款',category:'loan',currency:'CNY',amount:'100000.00',ownerMemberId:'family',monthly:'1200.00',rate:'3.1'});
  const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date()),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await send('transaction.record',{type:'expense',accountId:bank.id,cashMemberId:'user:'+user.userId,amount:'88.00',date:day,note:'模拟午餐，保留中文原文',confirmed:true});
  await send('savings.goal.save',{name:'模拟家庭目标',schemaVersion:4,targets:[{id:'savings',name:'我的中文储蓄目标',assetTypeIds:['cash','fund'],target:'100000.00'}],monthlyTarget:'2000.00'});
  let state=await snapshot(db);const ds=state.book.active_dataset;
  const add=(id,kind,payload)=>x.sqlite.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(ds,id,kind,JSON.stringify(payload));
  add('i18n-plan','plan',{id:'i18n-plan',name:'模拟家庭旅行',category:'国内旅行',date:day,end:day,budget:200000,reserved:0,status:'PLANNED',budgetStatus:'APPROVED',ownerMemberId:'family',version:1,note:'旅行备注保持原文'});
  add('i18n-rule','recurring_rule',{name:'模拟工资',type:'income',accountId:bank.id,cashMemberId:'user:'+user.userId,amount:1000000,day:28,start:month+'-01',autoPost:false});
  state=await snapshot(db);const report=await buildMonthlyReportDocument(db,state,month),family=await familyView(x.db,user);
  return {state:{...publicSnapshot(state),viewer:{canWrite:true,userId:user.userId,subject:user.userId}},report,family,day,month};
 }finally{x.sqlite.close()}
}

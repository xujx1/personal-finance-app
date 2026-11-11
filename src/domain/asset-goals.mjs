import {MAX_MINOR,minor} from './finance.mjs';
import {buildMonthlyReport} from './monthly-report.mjs';

export const ASSET_GOAL_BUCKETS=[
 {id:'stock',label:'股票',hint:'个股与已明确的股票资产',color:'#356d58'},
 {id:'deposits',label:'银行存款＋国债',hint:'活期、定期存款及明确的国债',color:'#8d9d65'},
 {id:'broadIndex',label:'宽基指数',hint:'纳斯达克等已明确的宽基指数',color:'#789caa'},
 {id:'preciousMetals',label:'黄金与贵金属',hint:'实物贵金属及对应基金',color:'#c9a65f'}
];
const ids=ASSET_GOAL_BUCKETS.map(x=>x.id),excluded=['property','prepayment','system'];
const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n)||Math.abs(n)>MAX_MINOR)throw Error('目标合计超出金额上限');return n;};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T00:00:00Z').valueOf())&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const amount=value=>{const n=minor(String(value));if(n<=0)throw Error('目标金额必须大于0');return n;};

// API amounts are decimal yuan strings; persisted goals use integer CNY minor units.
export function normalizeAssetGoalInput(body){
 if(body?.schemaVersion!==2)throw Error('目标版本无效');
 const targets=body.bucketTargets;
 if(!targets||Array.isArray(targets)||Object.keys(targets).length!==ids.length||ids.some(id=>!Object.hasOwn(targets,id)))throw Error('请完整填写四类资产目标');
 const bucketTargets=Object.fromEntries(ids.map(id=>[id,amount(targets[id])]));Object.values(bucketTargets).reduce(add,0);
 const monthlyTarget=body.monthlyTarget==null||body.monthlyTarget===''?null:amount(body.monthlyTarget);
 const deadline=body.deadline==null||body.deadline===''?null:body.deadline;
 if(deadline!==null&&!validDate(deadline))throw Error('目标日期无效');
 const name=String(body.name??'四类资产目标').trim();if(!name||name.length>100)throw Error('目标名称无效');
 return {schemaVersion:2,name,bucketTargets,monthlyTarget,deadline};
}

function readGoal(doc){
 const p=doc?.payload;if(p?.schemaVersion!==2)return null;
 try{
  if(!p.bucketTargets||Object.keys(p.bucketTargets).length!==ids.length||ids.some(id=>!Number.isSafeInteger(p.bucketTargets[id])||p.bucketTargets[id]<=0||p.bucketTargets[id]>MAX_MINOR))return null;
  const totalTarget=Object.values(p.bucketTargets).reduce(add,0);
  if(p.monthlyTarget!=null&&(!Number.isSafeInteger(p.monthlyTarget)||p.monthlyTarget<=0||p.monthlyTarget>MAX_MINOR))return null;
  if(p.deadline!=null&&!validDate(p.deadline))return null;
  return {...p,id:doc.id,totalTarget,monthlyTarget:p.monthlyTarget??null,deadline:p.deadline??null,isDefault:false};
 }catch{return null;}
}

export function assetGoalBucket(account){
 const category=account.category,metadata=account.metadata??{},name=String(account.name??'');
 if(excluded.includes(category)||account.kind!=='ASSET')return null;
 if(category==='cash'||category==='term_deposit'||category==='treasury')return 'deposits';
 // Individual mining shares remain stocks; only clearly named ETFs can use a special bucket.
 if(category==='stock'&&!/ETF|指数基金/i.test(name))return 'stock';
 if(/生物科技|生物医药|矿业|采矿|金矿|黄金股|贵金属股|gold miners|gold mining/i.test(name))return null;
 if(/黄金|白银|铂金|钯金|贵金属|\b(gold|silver|platinum|palladium)\b/i.test(name))return 'preciousMetals';
 if(/纳斯达克(?:100|一百)?|纳指|nasdaq[ -]?100|标普[ -]?500|s\s*&\s*p[ -]?500|沪深[ -]?300|中证(?:[ -]?(?:500|1000|2000)|全指)|上证[ -]?50|全市场指数|全球股票指数/i.test(name))return 'broadIndex';
 if(/(?:储蓄|记账式)?国债|\btreasury\b/i.test(name))return 'deposits';
 if(category==='stock')return 'stock';
 if(ids.includes(metadata.goalBucket))return metadata.goalBucket;
 return null;
}

function eligible(account){
 if(account.kind!=='ASSET'||excluded.includes(account.category)||account.archived||account.balance===0||['cleared','closed'].includes(account.metadata?.status))return false;
 const quantity=account.metadata?.quantity;
 if(['stock','fund'].includes(account.category)&&typeof quantity==='string'&&/^\d+(?:\.\d+)?$/.test(quantity)&&Number(quantity)===0)return false;
 return true;
}

function monthlyProgress(state,month,target){
 const basis='按本站完整已过账分录计算本月人民币非房产资产的业务新增积累；包括工资和其他实际收入，减去已记支出与实际还贷现金影响。开账、余额校正、内部资产转换不计为新增收入；不使用当前行情回填收益。外币业务单列，不虚构历史汇率。';
 const unavailable=reason=>({month,available:false,change:null,opening:null,closing:null,corrections:null,progress:null,reason,basis});
 const report=buildMonthlyReport(state,month);if(!report.available)return unavailable(report.reason);
 const rows=state.monthlyLedgerTotals.rows.filter(row=>row.month<=month&&row.accountKind==='ASSET'&&!excluded.includes(row.category));
 try{
  const cny=rows.filter(row=>row.currency==='CNY'),hasOpening=cny.some(row=>row.month<month);
  const opening=hasOpening?cny.filter(row=>row.month<month).reduce((n,row)=>add(n,row.deltaMinor),0):null;
  const closing=hasOpening?cny.reduce((n,row)=>add(n,row.deltaMinor),0):null;
  const current=cny.filter(row=>row.month===month),corrections=current.filter(row=>['OPENING','ADJUSTMENT'].includes(row.transactionKind)).reduce((n,row)=>add(n,row.deltaMinor),0);
  const change=current.filter(row=>!['OPENING','ADJUSTMENT'].includes(row.transactionKind)).reduce((n,row)=>add(n,row.deltaMinor),0);
  const foreignExcluded=rows.some(row=>row.month===month&&row.currency!=='CNY'&&!['OPENING','ADJUSTMENT'].includes(row.transactionKind)&&row.deltaMinor!==0);
  const reason=[target===null?'尚未设置月目标；填写后可查看完成率':'',!hasOpening?'期初历史未完整记录；当前完成率仅按本月人民币业务新增积累计算':'',foreignExcluded?'本月外币业务未折算，另见月度报告':''].filter(Boolean).join('。');
  return {month,available:true,opening,closing,corrections,change,foreignExcluded,progress:target===null?null:Math.min(100,Math.max(0,change/target*100)),reason,basis};
 }catch(error){return unavailable(error.message);}
}

export function currentGoalMonth(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 return parts.find(x=>x.type==='year').value+'-'+parts.find(x=>x.type==='month').value;
}

export function getAssetGoal(state){
 const documents=(state?.documents??[]).filter(doc=>doc.kind==='savings_goal');
 const stored=documents.map(readGoal).filter(Boolean).sort((a,b)=>String(b.updatedAt??'').localeCompare(String(a.updatedAt??'')));
 return stored[0]??{schemaVersion:2,id:null,name:'四类资产目标',bucketTargets:Object.fromEntries(ids.map(id=>[id,100000000])),totalTarget:400000000,monthlyTarget:null,deadline:null,isDefault:true};
}

export function buildAssetGoalOverview(state,valueCNY,month=currentGoalMonth()){
 const documents=(state?.documents??[]).filter(doc=>doc.kind==='savings_goal');
 const goal=getAssetGoal(state);
 const buckets=ASSET_GOAL_BUCKETS.map(bucket=>({...bucket,target:goal.bucketTargets[bucket.id],current:0,complete:true,accountNames:[]}));
 let current=0,unassigned=0,complete=true;const unassignedNames=[],unknownNames=[];
 for(const account of (state?.accounts??[]).filter(eligible)){
  const bucket=buckets.find(bucket=>bucket.id===assetGoalBucket(account));
  if(bucket)bucket.accountNames.push(account.name);else unassignedNames.push(account.name);
  const value=valueCNY(account);
  if(!Number.isSafeInteger(value)||value<0||value>MAX_MINOR){complete=false;unknownNames.push(account.name);if(bucket)bucket.complete=false;continue;}
  current=add(current,value);if(bucket)bucket.current=add(bucket.current,value);else unassigned=add(unassigned,value);
 }
 for(const bucket of buckets){bucket.progress=bucket.complete?Math.min(100,Math.max(0,bucket.current/bucket.target*100)):null;bucket.gap=bucket.complete?Math.max(0,bucket.target-bucket.current):null;}
 return {goal,buckets,current,unassigned,unassignedNames,unknownNames,complete,progress:complete?Math.min(100,current/goal.totalTarget*100):null,gap:complete?Math.max(0,goal.totalTarget-current):null,legacyGoals:documents.filter(doc=>doc.payload?.schemaVersion!==2),monthly:monthlyProgress(state,month,goal.monthlyTarget)};
}

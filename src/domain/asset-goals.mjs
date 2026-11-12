import {withRecurringProjection} from './recurring-monthly.mjs';
import {goalAssetAccounts} from './asset-view.mjs';
import {MAX_MINOR,minor} from './finance.mjs';
import {buildMonthlyReport} from './monthly-report.mjs';

import {ASSET_GOAL_GROUPS,getAssetTypes,accountAssetType,legacyGoalBucket,assetTypeGoalGroups,goalEligibleType} from './asset-types.mjs';
export const ASSET_GOAL_BUCKETS=ASSET_GOAL_GROUPS;
const ids=ASSET_GOAL_BUCKETS.map(x=>x.id),excluded=['property','prepayment','system'];
const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n)||Math.abs(n)>MAX_MINOR)throw Error('目标合计超出金额上限');return n;};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T00:00:00Z').valueOf())&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const amount=value=>{const n=minor(String(value));if(n<=0)throw Error('目标金额必须大于0');return n;};

// API amounts are decimal yuan strings; persisted goals use integer CNY minor units.
export function normalizeAssetGoalInput(body,state={}){
 if(body?.schemaVersion===4)return normalizeCombinationGoal(body,state);
 if(body?.schemaVersion===3)return normalizeSelectableGoal(body,state);
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

function readGoal(doc,state){
 if(doc?.payload?.schemaVersion===4){try{const p=doc.payload,n=normalizeCombinationGoal({...p,targets:p.targets.map(t=>({...t,target:minorToInput(t.target)})),monthlyTarget:p.monthlyTarget==null?null:minorToInput(p.monthlyTarget)},state);return {...p,...n,id:doc.id,totalTarget:n.targets.map(t=>t.target).reduce(add,0),bucketTargets:Object.fromEntries(n.targets.map(t=>['selection:'+t.id,t.target])),isDefault:false};}catch{return null;}}
 const p=doc?.payload;if(p?.schemaVersion===3){try{const n=normalizeSelectableGoal({...p,targets:p.targets.map(t=>({...t,target:minorToInput(t.target)})),monthlyTarget:p.monthlyTarget==null?null:minorToInput(p.monthlyTarget)},state);return {...p,...n,id:doc.id,totalTarget:n.targets.map(t=>t.target).reduce(add,0),bucketTargets:Object.fromEntries(n.targets.map(t=>[t.scope,t.target])),isDefault:false};}catch{return null;}}
 if(p?.schemaVersion!==2)return null;
 try{
  if(!p.bucketTargets||Object.keys(p.bucketTargets).length!==ids.length||ids.some(id=>!Number.isSafeInteger(p.bucketTargets[id])||p.bucketTargets[id]<=0||p.bucketTargets[id]>MAX_MINOR))return null;
  const totalTarget=Object.values(p.bucketTargets).reduce(add,0);
  if(p.monthlyTarget!=null&&(!Number.isSafeInteger(p.monthlyTarget)||p.monthlyTarget<=0||p.monthlyTarget>MAX_MINOR))return null;
  if(p.deadline!=null&&!validDate(p.deadline))return null;
  return {...p,id:doc.id,totalTarget,monthlyTarget:p.monthlyTarget??null,deadline:p.deadline??null,isDefault:false};
 }catch{return null;}
}

export function assetGoalBucket(account,state){
 if(account.metadata?.assetTypeId&&state)return accountAssetType(account,state)?.goalBucket??null;
 return legacyGoalBucket(account);
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
 const stored=documents.map(doc=>readGoal(doc,state)).filter(Boolean).sort((a,b)=>String(b.updatedAt??'').localeCompare(String(a.updatedAt??'')));
 return stored[0]??{schemaVersion:2,id:null,name:'四类资产目标',bucketTargets:Object.fromEntries(ids.map(id=>[id,100000000])),totalTarget:400000000,monthlyTarget:null,deadline:null,isDefault:true};
}

export function buildAssetGoalOverview(state,valueCNY,month=currentGoalMonth()){
 const documents=(state?.documents??[]).filter(doc=>doc.kind==='savings_goal');
 const goal=getAssetGoal(state);
 const buckets=goal.schemaVersion===4?goal.targets.map((row,i)=>({...row,scope:'selection:'+row.id,label:row.name,color:ASSET_GOAL_BUCKETS[i%ASSET_GOAL_BUCKETS.length].color,hint:row.assetTypeIds.map(id=>getAssetTypes(state).find(t=>t.id===id)?.name??id).join('、'),current:0,complete:true,accountNames:[]})):goal.schemaVersion===3?goal.targets.map(row=>({...goalScopeOptions(state).find(o=>o.scope===row.scope),id:row.scope,target:row.target,current:0,complete:true,accountNames:[]})):ASSET_GOAL_BUCKETS.map(bucket=>({...bucket,target:goal.bucketTargets[bucket.id],current:0,complete:true,accountNames:[]}));
 let current=0,unassigned=0,complete=true,unassignedComplete=true;const unassignedNames=[],unknownNames=[];
 for(const account of goalAssetAccounts(state,goal).filter(eligible)){
  const bucket=goal.schemaVersion===4?buckets.find(bucket=>bucket.assetTypeIds.includes(accountAssetType(account,state)?.id)):goal.schemaVersion===3?buckets.find(bucket=>goalScopeMatches(bucket.scope,account,state)):buckets.find(bucket=>bucket.id===assetGoalBucket(account,state));
  if(bucket)bucket.accountNames.push(account.name);else unassignedNames.push(account.name);
  const value=valueCNY(account);
  if(goal.schemaVersion>=3&&!bucket){if(Number.isSafeInteger(value)&&value>=0&&value<=MAX_MINOR)unassigned=add(unassigned,value);else unassignedComplete=false;continue;}
  if(!Number.isSafeInteger(value)||value<0||value>MAX_MINOR){complete=false;unknownNames.push(account.name);if(bucket)bucket.complete=false;continue;}
  current=add(current,value);if(bucket)bucket.current=add(bucket.current,value);else unassigned=add(unassigned,value);
 }
 for(const bucket of buckets){bucket.progress=bucket.complete?Math.min(100,Math.max(0,bucket.current/bucket.target*100)):null;bucket.gap=bucket.complete?Math.max(0,bucket.target-bucket.current):null;}
 return {goal,buckets,current,unassigned,unassignedComplete,unassignedNames,unknownNames,complete,progress:complete?Math.min(100,current/goal.totalTarget*100):null,gap:complete?Math.max(0,goal.totalTarget-current):null,legacyGoals:documents.filter(doc=>![2,3,4].includes(doc.payload?.schemaVersion)),monthly:withRecurringProjection(state,monthlyProgress(state,month,goal.monthlyTarget),goal.monthlyTarget)};
}

function normalizeCombinationGoal(body,state){
 if(!Array.isArray(body.targets)||!body.targets.length||body.targets.length>20)throw Error('请设置1至20项目标组合');
 const available=getAssetTypes(state).filter(goalEligibleType),used=new Set(),names=new Set(),targetIds=new Set();
 const targets=body.targets.map((row,index)=>{
  if(!row||Object.keys(row).some(k=>!['id','name','assetTypeIds','target'].includes(k)))throw Error('目标组合字段无效');
  const id=row.id??'target_'+(index+1),name=typeof row.name==='string'?row.name.trim():'';
  if(typeof id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(id)||targetIds.has(id))throw Error('目标组合标识无效或重复');targetIds.add(id);
  const nameKey=name.normalize('NFKC').toLocaleLowerCase();if(!name||name.length>100||/[\u0000-\u001f\u007f]/.test(name)||names.has(nameKey))throw Error('目标组合名称为空、重复或过长');names.add(nameKey);
  if(!Array.isArray(row.assetTypeIds)||!row.assetTypeIds.length||row.assetTypeIds.length>50)throw Error('每项目标至少勾选一个资产类型');
  for(const typeId of row.assetTypeIds){if(typeof typeId!=='string'||!available.some(t=>t.id===typeId))throw Error('目标资产类型不存在、已停用或不适用');if(used.has(typeId))throw Error('目标范围重复，同一资产类型只能计入一个目标');used.add(typeId);}
  return {id,name,assetTypeIds:[...row.assetTypeIds],target:amount(row.target)};
 });
 targets.map(t=>t.target).reduce(add,0);const monthlyTarget=body.monthlyTarget==null||body.monthlyTarget===''?null:amount(body.monthlyTarget),deadline=body.deadline==null||body.deadline===''?null:body.deadline;
 if(deadline!==null&&!validDate(deadline))throw Error('目标日期无效');const name=String(body.name??'资产目标').trim();if(!name||name.length>100)throw Error('目标名称无效');return {schemaVersion:4,name,targets,monthlyTarget,deadline};
}

/** Editor suggestions only: existing stored goals retain their original scope until explicitly saved. */
export function editableGoalCombinations(goal,state){
 if(goal.schemaVersion===4)return goal.targets.map(t=>({...t,assetTypeIds:[...t.assetTypeIds],target:minorToInput(t.target)}));
 const types=getAssetTypes(state).filter(goalEligibleType),rows=goal.schemaVersion===3?goal.targets:ASSET_GOAL_BUCKETS.map(g=>({scope:'group:'+g.id,target:goal.bucketTargets[g.id]}));
 return rows.map((row,index)=>{const option=goalScopeOptions(state).find(o=>o.scope===row.scope),group=row.scope.startsWith('group:')?row.scope.slice(6):null;const typeIds=group?types.filter(t=>t.goalBucket===group||(state.accounts??[]).some(a=>eligible(a)&&goalScopeMatches(row.scope,a,state)&&accountAssetType(a,state)?.id===t.id)).map(t=>t.id):[row.scope.slice(5)];return {id:'target_'+(index+1),name:option?.label.replace('（组合）','')??'目标 '+(index+1),assetTypeIds:typeIds,target:minorToInput(row.target)};});
}

const minorToInput=n=>{if(!Number.isSafeInteger(n)||n<=0||n>MAX_MINOR)throw Error('目标金额无效');return String(Math.floor(n/100))+'.'+String(n%100).padStart(2,'0');};
export function goalScopeOptions(state){return [...ASSET_GOAL_BUCKETS.map(g=>({...g,scope:'group:'+g.id,label:g.label+'（组合）'})),...getAssetTypes(state).filter(t=>t.enabled&&!excluded.includes(t.baseCategory)&&t.baseCategory!=='loan').map(t=>({scope:'type:'+t.id,id:t.id,label:t.name,color:ASSET_GOAL_BUCKETS.find(g=>g.id===t.goalBucket)?.color??'#8b9d96'}))];}
function goalScopeMatches(scope,account,state){if(scope.startsWith('type:'))return accountAssetType(account,state)?.id===scope.slice(5);return assetGoalBucket(account,state)===scope.slice(6);}
function normalizeSelectableGoal(body,state){
 const options=goalScopeOptions(state);if(!Array.isArray(body.targets)||!body.targets.length||body.targets.length>20)throw Error('请选择1至20项目标');
 const scopes=new Set(),types=getAssetTypes(state);const targets=body.targets.map(row=>{if(!row||Object.keys(row).some(k=>!['scope','target'].includes(k))||!options.some(o=>o.scope===row.scope)||scopes.has(row.scope))throw Error('目标类型无效或重复');scopes.add(row.scope);return {scope:row.scope,target:amount(row.target)};});
 for(const row of targets.filter(r=>r.scope.startsWith('type:'))){const type=types.find(t=>t.id===row.scope.slice(5));if(type&&assetTypeGoalGroups(type).some(group=>scopes.has('group:'+group)))throw Error('资产类型与组合目标重复，请选择其中一种');}
 for(const a of (state.accounts??[]).filter(eligible))if(targets.filter(r=>goalScopeMatches(r.scope,a,state)).length>1)throw Error('目标范围重复，不能重复计算同一资产');
 targets.map(t=>t.target).reduce(add,0);const monthlyTarget=body.monthlyTarget==null||body.monthlyTarget===''?null:amount(body.monthlyTarget),deadline=body.deadline==null||body.deadline===''?null:body.deadline;
 if(deadline!==null&&!validDate(deadline))throw Error('目标日期无效');const name=String(body.name??'资产目标').trim();if(!name||name.length>100)throw Error('目标名称无效');return {schemaVersion:3,name,targets,monthlyTarget,deadline};
}

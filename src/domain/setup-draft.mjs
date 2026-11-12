import {minor,decimal} from './finance.mjs';
import {normalizeMemberProfile,buildFinanceMembers,resolveFinanceMember,accountMember} from './member-ownership.mjs';
import {getAssetTypes,normalizeAssetTypes,BASE_ASSET_CATEGORIES} from './asset-types.mjs';
import {normalizeAssetGoalInput,getAssetGoal} from './asset-goals.mjs';

const key=name=>name.normalize('NFKC').toLocaleLowerCase();
const only=(p,keys,required=keys)=>{if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!keys.includes(k))||required.some(k=>!Object.hasOwn(p,k)))throw Error('建档配置包含无效或不允许的字段');};
const text=(v,max,multiline=false)=>{if(typeof v!=='string'||!v.trim()||v.length>max||(multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(v))throw Error('建档配置文字无效或过长');return v.trim();};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('建档日期无效');return v;};
const amount=v=>{if(typeof v!=='string')throw Error('金额须为人民币元十进制字符串');const n=minor(v);if(n<=0)throw Error('金额必须大于0');return decimal(n);};
const list=(v,max)=>{if(!Array.isArray(v)||!v.length||v.length>max)throw Error('建档配置数量无效');return v;};
const unique=(rows,field)=>{const seen=new Set();for(const row of rows){const id=key(row[field]);if(seen.has(id))throw Error('建档配置名称或标识重复');seen.add(id);}return rows;};
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

/** Finite external setup proposals: no login identities, journal fields, or auto-post controls. */
export function normalizeSetupDraft(p){
 only(p,['section','data','analysis']);const analysis=text(p.analysis,6000,true),d=p.data;let data;
 if(p.section==='members'){
  only(d,['members']);data={members:unique(list(d.members,20).map(m=>{only(m,['name']);return {name:normalizeMemberProfile({name:text(m.name,60)},{}).name};}),'name')};
 }else if(p.section==='asset_types'){
  only(d,['additions']);const additions=list(d.additions,10).map(t=>{only(t,['id','name','baseCategory','goalBucket']);const id=text(t.id,64),name=text(t.name,40);if(!/^[a-z][a-z0-9_-]{0,63}$/.test(id)||!Object.hasOwn(BASE_ASSET_CATEGORIES,t.baseCategory)||t.baseCategory==='prepayment'||!['stock','deposits','broadIndex','preciousMetals',null].includes(t.goalBucket)||['property','loan'].includes(t.baseCategory)&&t.goalBucket!==null)throw Error('资产类型标识、性质或目标组合无效');return {id,name,baseCategory:t.baseCategory,goalBucket:t.goalBucket};});unique(additions,'id');unique(additions,'name');data={additions};
 }else if(p.section==='goals'){
  only(d,['name','targets','monthlyTarget','deadline']);data={name:text(d.name,100),targets:list(d.targets,20).map(t=>{only(t,['scope','target']);return {scope:text(t.scope,80),target:amount(t.target)};}),monthlyTarget:d.monthlyTarget===null?null:amount(d.monthlyTarget),deadline:d.deadline===null?null:date(d.deadline)};
 }else if(p.section==='recurring'){
  only(d,['name','type','accountId','cashMemberId','amount','day','start','end','loanId','assetId'],['name','type','accountId','cashMemberId','amount','day','start','end']);if(!['income','expense','loan','investment'].includes(d.type)||!Number.isInteger(d.day)||d.day<1||d.day>31)throw Error('周期规则类型或每月日期无效');
  if(d.type==='loan'?!d.loanId||d.assetId!==undefined:d.type==='investment'?!d.assetId||d.loanId!==undefined:d.loanId!==undefined||d.assetId!==undefined)throw Error('周期规则贷款或投资账户字段无效');
  const start=date(d.start),end=d.end===null?null:date(d.end);if(end&&end<start)throw Error('结束日期不能早于开始日期');
  data={name:text(d.name,100),type:d.type,accountId:text(d.accountId,120),cashMemberId:text(d.cashMemberId,120),amount:amount(d.amount),day:d.day,start,end,...(d.type==='loan'?{loanId:text(d.loanId,120)}:{}),...(d.type==='investment'?{assetId:text(d.assetId,120)}:{})};
 }else throw Error('建档配置阶段无效');
 return {section:p.section,data,analysis};
}

export function validateSetupDraft(payload,state,{today=localDate()}={}){
 const p=normalizeSetupDraft(payload),d=p.data;
 if(p.section==='members'){
  const names=new Set((state.financeMembers??buildFinanceMembers(state)).map(m=>key(m.name)));for(const m of d.members)if(names.has(key(m.name)))throw Error('已有同名成员，请核对重复建档');
 }else if(p.section==='asset_types'){
  const types=normalizeAssetTypes([...getAssetTypes(state),...d.additions.map(t=>({...t,enabled:true}))],state),updated={...state,documents:(state.documents??[]).filter(x=>x.kind!=='asset_type_catalog').concat({id:'asset-types',kind:'asset_type_catalog',payload:{types}})};
  const goal=getAssetGoal(state);if(goal.schemaVersion===3)normalizeAssetGoalInput({...goal,targets:goal.targets.map(t=>({...t,target:decimal(t.target)})),monthlyTarget:goal.monthlyTarget==null?null:decimal(goal.monthlyTarget)},updated);
 }else if(p.section==='goals')normalizeAssetGoalInput({schemaVersion:3,...d},state);
 else{
  if(d.start<today)throw Error('新周期规则开始日期须为今天或将来，历史请单独核对');
  const account=id=>{const a=(state.accounts??[]).find(a=>a.id===id&&!a.archived);if(!a)throw Error('账户不存在或已归档');return a;};
  const bank=account(d.accountId);if(bank.kind!=='ASSET'||bank.category!=='cash'||bank.currency!=='CNY')throw Error('请选择人民币现金账户');
  const member=resolveFinanceMember(state,d.cashMemberId,{write:true});if(member.id!==accountMember(bank,state).id)throw Error('资金成员与现金账户归属不一致');d.cashMemberId=member.id;
  if(d.type==='loan'){const a=account(d.loanId);if(a.kind!=='LIABILITY'||a.category!=='loan'||a.currency!=='CNY')throw Error('请选择人民币贷款账户');}
  if(d.type==='investment'){const a=account(d.assetId);if(a.kind!=='ASSET'||!['fund','stock'].includes(a.category)||a.currency!=='CNY')throw Error('请选择人民币基金或股票账户');}
  if((state.documents??[]).some(x=>{const r=x.payload;return x.kind==='recurring_rule'&&r.type===d.type&&r.accountId===d.accountId&&resolveFinanceMember(state,r.cashMemberId??accountMember(bank,state).id).id===d.cashMemberId&&(r.loanId??null)===(d.loanId??null)&&(r.assetId??null)===(d.assetId??null)&&r.amount===minor(d.amount)&&r.day===d.day&&(!r.end||r.end>=d.start)&&(!d.end||d.end>=r.start);}))throw Error('已有相同周期规则，请核对重复设置');
 }
 return p;
}

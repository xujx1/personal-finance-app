import {normalizeFollowUps} from './investment-followups.mjs';
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('请填写有效的总结或研究文字');return v.trim()};
const only=(p,fields)=>{if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!fields.includes(k)))throw Error('草稿包含不允许的字段')};
const list=(v=[])=>{if(!Array.isArray(v)||v.length>12)throw Error('列表过长');return v.map(x=>text(x,500))};
export function normalizeWorkflowDraft(kind,p){
 if(kind==='investment'){
  only(p,['title','summary','content','sources','missing','ownerMemberId','followUps']);
  if(!Array.isArray(p.sources??[])||(p.sources??[]).length>15)throw Error('研究来源过多');
  const sources=(p.sources??[]).map(s=>{only(s,['title','url','checkedAt']);let u;try{u=new URL(s.url)}catch{throw Error('来源链接无效')}if(u.protocol!=='https:'||u.username||u.password)throw Error('来源链接须为无凭据HTTPS地址');return {title:text(s.title,200),url:u.href,checkedAt:s.checkedAt==null?null:text(s.checkedAt,60)};});
  return {title:text(p.title,100),summary:text(p.summary,2000),content:text(p.content,10000),sources,missing:list(p.missing),...(p.followUps!==undefined?{followUps:normalizeFollowUps(p.followUps)}:{}),ownerMemberId:text(p.ownerMemberId??'family',120)};
 }
 if(kind==='monthly_review'){
  only(p,['month','title','summary','sections','limitations','nextActions','basisFingerprint','ownerMemberId']);
  if(typeof p.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month))throw Error('月份无效');
  if(!/^[a-f0-9]{64}$/.test(p.basisFingerprint??''))throw Error('请先读取服务器月报依据指纹');
  if(!Array.isArray(p.sections)||p.sections.length<1||p.sections.length>8)throw Error('月总结需1至8个章节');
  return {month:p.month,title:text(p.title,100),summary:text(p.summary,2000),sections:p.sections.map(s=>{only(s,['heading','body']);return {heading:text(s.heading,100),body:text(s.body,1200)}}),limitations:list(p.limitations),nextActions:list(p.nextActions),basisFingerprint:p.basisFingerprint,ownerMemberId:text(p.ownerMemberId??'family',120)};
 }
 if(kind==='recurring'){
  only(p,['candidateId','name','analysis']);return {candidateId:text(p.candidateId,150),name:text(p.name,100),analysis:text(p.analysis,3000)};
 }
 throw Error('草稿类型无效');
}

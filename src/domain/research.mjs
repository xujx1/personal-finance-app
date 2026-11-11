import {minor} from './finance.mjs';
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('研究方案文字无效或过长');return v.trim()};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('方案日期无效');return v};
export function normalizeProposal(body){
 if(!['travel','shopping','dining','wealth'].includes(body.kind))throw Error('方案类型无效');
 const sources=body.sources??[];if(!Array.isArray(sources)||sources.length>20)throw Error('来源数量无效');
 const checked=sources.map(s=>{const url=new URL(s.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('来源必须为HTTPS网页');const at=s.checked_at==null?null:String(s.checked_at);if(at&&(at.length>40||Number.isNaN(Date.parse(at))))throw Error('来源时间无效');return {title:text(s.title,200),url:url.href,checkedAt:at,verification:'agent_provided'};});
 const start=body.date?date(body.date):null,end=body.end?date(body.end):start;if(start&&end<start)throw Error('结束日期早于开始日期');
 return {kind:body.kind,title:text(body.title,100),summary:text(body.summary,1500),content:text(body.content,12000),budget:body.budget==null||body.budget===''?null:minor(String(body.budget)),date:start,end,sources:checked};
}

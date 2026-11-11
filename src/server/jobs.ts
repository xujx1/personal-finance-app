import {snapshot,executeCommand} from './finance-store.ts';import {thresholdAlerts} from '../domain/planning.mjs';
export async function runScheduledJobs(db:any,deps:any,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date())){
 let s=await snapshot(db);const send=async(action:string,body:any,key:string)=>{s=await snapshot(db);return executeCommand(db,{key,revision:s.book.revision,action,body},'site-scheduler')};const notify=async(id:string,title:string,message:string)=>{s=await snapshot(db);if(!s.documents.some((d:any)=>d.id===id))await send('notification.record',{id,title,message,date:today},'note:'+id)};
 const active=s.documents.filter((d:any)=>d.kind==='recurring_rule'&&!d.payload.paused);if(active.length){const signature=active.map((d:any)=>d.id+':'+d.payload.version).join('|'),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)))).slice(0,8).join('');await send('recurring.run',{through:today},'scheduled:'+today+':'+hash)}
 s=await snapshot(db);for(const p of s.documents.filter((d:any)=>d.kind==='plan'&&d.payload.status!=='CANCELLED')){const n=Math.round((Date.parse(p.payload.date)-Date.parse(today))/86400000),after=Math.round((Date.parse(today)-Date.parse(p.payload.end))/86400000);if([7,3,1].includes(n))await notify('plan-check:'+p.id+':'+n,'出行 / 支出计划检查',p.payload.name+'：'+(n===7?'检查酒店、交通与路线':n===3?'复核天气、预算和未付订单':'准备宝宝用品与行李'));if([1,3].includes(after))await notify('plan-reconcile:'+p.id+':'+after,'计划结束后复核',p.payload.name+'：'+(after===1?'补录实际消费与退款':'核对预算与实际支出差异'))}
 const quotes=deps.getQuotes?await deps.getQuotes(today):{};
 s=await snapshot(db);for(const d of s.documents.filter((d:any)=>d.kind==='reminder'&&d.payload.enabled)){const r=d.payload;
  if(r.type==='date'&&r.date<=today){await notify('reminder:'+d.id,'到期提醒',r.name);continue}
  if(r.type==='price'){
   if(r.checkedDate&&Date.parse(today)-Date.parse(r.checkedDate)<7*86400000)continue;const q:any=Object.values(quotes).find((q:any)=>q.symbol===r.symbol&&q.price&&q.status==='ok');if(!q)continue;
   const date=String(q.asOf??'').replace(/^(\d{4})(\d{2})(\d{2}).*$/,'$1-$2-$3').slice(0,10),age=Date.parse(today)-Date.parse(date);if(!Number.isFinite(age)||age<0||age>7*86400000)continue;
   const next=thresholdAlerts({symbol:r.symbol,levels:r.levels,previous:r.previous??null,current:q.price,sent:r.sent??[]});await send('reminder.check',{id:d.id,previous:q.price,sent:next.sent,checkedDate:today},'price-check:'+d.id+':'+today);
   if(next.crossed.length)await notify('price:'+d.id+':'+next.crossed.join('-'),r.symbol+'触达提醒',r.symbol+'报价 '+q.price+' USD；本次向上触达 '+next.crossed.join(' / ')+' USD。来源 '+(q.source??'公共行情')+'；报价时间 '+q.asOf+'；可能延迟，请结合最新资料重新评估，本系统不执行交易。');
  }
 }return {ok:true,checkedAt:today};
}

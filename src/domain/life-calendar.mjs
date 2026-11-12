import {activityInWindow} from './executable-costs.mjs';
import {sortItineraryActivitiesByTime} from './trip-details.mjs';
const DAY=86400000;
export const MIN_CALENDAR_DATE='0001-01-01',MAX_CALENDAR_DATE='9998-12-31';
const supported=value=>typeof value==='string'&&value>=MIN_CALENDAR_DATE&&value<=MAX_CALENDAR_DATE;
/** @typedef {{date:string,time?:string,title:string,notes?:string,location?:string,phase?:string}} Activity */
/** @typedef {{planId:string,name:string,kind:string,date:string,end:string,status:string,budget:number|null,budgetStatus:string,activities:Activity[]}} CalendarEvent */
function parseDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const d=new Date(value+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;
}
const key=d=>d.toISOString().slice(0,10);
const add=(d,n)=>new Date(d.getTime()+n*DAY);
export const shanghaiToday=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);

export function shiftCalendarDate(anchor,view,direction){
 const d=parseDay(anchor);if(!d||!supported(anchor)||!['month','week'].includes(view)||![1,-1].includes(direction))throw Error('日历日期或视图无效');
 if(view==='week'){const next=key(add(d,direction*7));return supported(next)?next:anchor;}
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+direction);
 const last=new Date(d);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
 d.setUTCDate(Math.min(day,last.getUTCDate()));return supported(key(d))?key(d):anchor;
}

function planKind(p){
 if(p.consumptionType)return ['travel','dining'].includes(p.consumptionType)?p.consumptionType:null;
 if(['travel','dining'].includes(p.expenseDraft?.kind))return p.expenseDraft.kind;
 const category=String(p.category??'').toLowerCase();
 if(category==='travel'||/旅行|旅游|出游|行程/.test(category))return 'travel';
 if(category==='dining'||/餐饮|聚餐|饮食|用餐|菜单|食材/.test(category))return 'dining';
 if(['travel','dining'].includes(p.research?.kind))return p.research.kind;
 return null;
}

/** Read-only projection: a plan appears once per visible day; budget is never split or summed. */
export function buildLifeCalendar(plans,{anchor,view='month',kind='all',includeCancelled=false}){
 const selected=parseDay(anchor);if(!selected||!supported(anchor)||!['month','week'].includes(view))throw Error('日历日期或视图无效');
 const first=new Date(selected);if(view==='month')first.setUTCDate(1);
 const start=add(first,-((first.getUTCDay()+6)%7));
 const days=Array.from({length:view==='month'?42:7},(_,i)=>{const d=add(start,i);return {date:key(d),selectable:supported(key(d)),inMonth:d.getUTCMonth()===selected.getUTCMonth()&&d.getUTCFullYear()===selected.getUTCFullYear(),weekend:d.getUTCDay()===0||d.getUTCDay()===6,events:/** @type {CalendarEvent[]} */([])}});
 const unscheduled=[];
 for(const p of plans){
  if(p.budgetStatus==='PENDING_APPROVAL'||p.familyApproval?.status==='PENDING_APPROVAL')continue;
  const type=planKind(p);if(!type||(kind!=='all'&&type!==kind)||(!includeCancelled&&p.status==='CANCELLED'))continue;
  const begin=parseDay(p.date),end=parseDay(p.end==null||p.end===''?p.date:p.end);
  if(!begin||!end||end<begin){unscheduled.push(p);continue;}
  for(const day of days){
   const activities=sortItineraryActivitiesByTime((Array.isArray(p.itinerary)?p.itinerary:[]).filter(a=>a&&parseDay(a.date)&&a.date===day.date&&typeof a.title==='string'&&a.title.trim()));
   if((day.date<p.date||day.date>key(end))&&!activities.some(a=>['preparation','follow_up'].includes(a.phase)&&activityInWindow(a,p.date,key(end))))continue;
   day.events.push({planId:p.id,name:p.name,kind:type,date:p.date,end:key(end),status:p.status,budget:p.budget,budgetStatus:p.budgetStatus,activities});
  }
 }
 for(const day of days)day.events.sort((a,b)=>a.date.localeCompare(b.date)||String(a.planId).localeCompare(String(b.planId)));
 return {days,unscheduled};
}

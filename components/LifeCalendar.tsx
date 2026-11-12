"use client";

import {useState} from 'react';
import {buildLifeCalendar,shanghaiToday,shiftCalendarDate,MIN_CALENDAR_DATE,MAX_CALENDAR_DATE} from '../src/domain/life-calendar.mjs';
import {decimal} from '../src/domain/finance.mjs';

type Props={plans:any[];onPlan:(id:string)=>void;onNew:(date:string)=>void;onCancel?:(id:string)=>void;canWrite?:boolean;busy?:boolean};
const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
const statuses:Record<string,string>={PLANNED:'计划中',BOOKED:'已预订',IN_PROGRESS:'执行中',COMPLETED:'已完成',CANCELLED:'已取消',DRAFT:'草稿'};
const fullDate=(date:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'UTC',month:'long',day:'numeric',weekday:'long'}).format(new Date(date+'T00:00:00Z'));

export default function LifeCalendar({plans,onPlan,onNew,onCancel,canWrite=false,busy=false}:Props){
 const today=shanghaiToday();
 const [selected,setSelected]=useState(today),[anchor,setAnchor]=useState(today),[view,setView]=useState<'month'|'week'>('month');
 const [kind,setKind]=useState('all'),[includeCancelled,setIncludeCancelled]=useState(false);
 const {days,unscheduled}=buildLifeCalendar(plans,{anchor,view,kind,includeCancelled});
 const active=days.find(d=>d.date===selected);
 const previous=shiftCalendarDate(anchor,view,-1),next=shiftCalendarDate(anchor,view,1);
 function move(date:string){setAnchor(date);setSelected(date);}
 const period=view==='month'?`${anchor.slice(0,4)}年${Number(anchor.slice(5,7))}月`:`${days[0].date} — ${days[6].date}`;
 return <>
  <div className="page-title"><div><div className="eyebrow">MAKE ROOM FOR THE WEEKEND</div><h1>生活日历</h1><p className="subtitle">把出游和一日三餐，放进期待的日子里。</p></div><button className="btn primary" onClick={()=>onNew(selected)}>在ChatGPT规划这一天</button></div>
  <section className="card life-calendar" aria-label="旅行与餐饮日历">
   <div className="life-calendar-toolbar">
    <div className="life-calendar-period"><button className="icon-button" aria-label={view==='month'?'上个月':'上一周'} disabled={previous===anchor} onClick={()=>move(previous)}>‹</button><h2 aria-live="polite">{period}</h2><button className="icon-button" aria-label={view==='month'?'下个月':'下一周'} disabled={next===anchor} onClick={()=>move(next)}>›</button></div>
    <div className="actions"><button className="btn" onClick={()=>move(today)}>今天</button><div className="segment" aria-label="日历视图"><button aria-pressed={view==='month'} className={view==='month'?'active':''} onClick={()=>{setView('month');setAnchor(selected)}}>整月</button><button aria-pressed={view==='week'} className={view==='week'?'active':''} onClick={()=>{setView('week');setAnchor(selected)}}>本周</button></div></div>
   </div>
   <div className="life-calendar-filters">
    <label>安排类型 <select aria-label="日历安排类型" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">旅行与餐饮</option><option value="travel">只看旅行</option><option value="dining">只看餐饮</option></select></label>
    <label>跳转月份 <input aria-label="跳转月份" type="month" min={MIN_CALENDAR_DATE.slice(0,7)} max={MAX_CALENDAR_DATE.slice(0,7)} value={anchor.slice(0,7)} onChange={e=>{const date=e.target.value+'-01';if(/^\d{4}-\d{2}$/.test(e.target.value)&&date>=MIN_CALENDAR_DATE&&date<=MAX_CALENDAR_DATE)move(date)}}/></label>
    <label className="life-calendar-cancelled"><input type="checkbox" checked={includeCancelled} onChange={e=>setIncludeCancelled(e.target.checked)}/>显示已取消</label>
   </div>
   <div className="life-calendar-layout">
    <div className={'life-calendar-board '+(view==='week'?'week-view':'')}>
     <div className="life-calendar-weekdays">{weekdays.map((name,i)=><span key={name} className={i>4?'weekend':''}>{name}</span>)}</div>
     <div className="life-calendar-days">{days.map(day=><button key={day.date} disabled={!day.selectable} aria-label={`${day.date}，${day.events.length}项安排`} aria-pressed={selected===day.date} aria-current={day.date===today?'date':undefined} className={'life-calendar-day '+(day.weekend?'weekend ':'')+(!day.inMonth&&view==='month'?'outside ':'')+(selected===day.date?'selected ':'')+(day.date===today?'is-today':'')} onClick={()=>{setSelected(day.date);if(!day.inMonth&&view==='month')setAnchor(day.date)}}>
      <span className="life-calendar-day-number">{Number(day.date.slice(8))}{day.date===today&&<small>今天</small>}</span>
      <span className="life-calendar-day-events">{day.events.slice(0,2).map(event=><span key={event.planId} className={'life-calendar-chip '+event.kind+(event.status==='CANCELLED'?' cancelled':'')}>{event.name}</span>)}{day.events.length>2&&<span className="life-calendar-more">另有{day.events.length-2}项</span>}</span>
      {day.events.length>0&&<span className="life-calendar-mobile-count">{day.events.length}项</span>}
     </button>)}</div>
     <p className="life-calendar-legend"><span className="travel">● 旅行</span><span className="dining">● 餐饮</span><span>浅底色为周末 · 按北京时间日期</span></p>
    </div>
    <section className="life-calendar-agenda" aria-label="当天安排" aria-live="polite">
     <div className="life-calendar-agenda-title"><small>{selected}</small><h2>{fullDate(selected)}</h2><p>{active?.events.length??0}项安排</p></div>
     {!active?.events.length&&<div className="life-calendar-empty"><strong>这一天，还留着空白</strong><p>可以安排一次出游，或一顿想吃的饭。</p><button className="btn" onClick={()=>onNew(selected)}>去ChatGPT规划</button></div>}
     {active?.events.map(event=><article key={event.planId} className={'life-calendar-event '+event.kind}>
      <div className="life-calendar-event-meta"><span>{event.kind==='travel'?'旅行':'餐饮'}</span><span>{statuses[event.status]??'状态待核实'}</span></div>
      <h3>{event.name}</h3><p className="life-calendar-event-range">{event.date===event.end?event.date:`${event.date} — ${event.end}`}</p>
      {event.activities.length>0?<ul className="life-calendar-activities">{event.activities.map((activity,i)=><li key={i}><span>{activity.time||'时间待定'}</span><div><strong>{activity.title}</strong>{activity.notes&&<p>{activity.notes}</p>}</div></li>)}</ul>:<p className="life-calendar-no-details">{event.kind==='travel'?'暂未提供当天行程，当前仅展示出行日期范围。':'暂未提供具体餐次或菜单。'}</p>}
      <p className="life-calendar-budget">整项预算（非当日开销）：<span className="money">{event.budget==null?'待制定':'¥'+decimal(event.budget)}</span><small>{event.budgetStatus==='APPROVED'?'预算已确认':'预算待确认'}</small></p>
      <div className="actions"><button className="text-button" onClick={()=>onPlan(event.planId)}>查看计划详情 →</button>{onCancel&&!['CANCELLED','COMPLETED'].includes(event.status)&&<button className="btn" disabled={!canWrite||busy} aria-label={'取消计划：'+event.name} onClick={()=>onCancel(event.planId)}>取消计划</button>}</div>
     </article>)}
    </section>
   </div>
   {unscheduled.length>0&&<section className="life-calendar-unscheduled"><h3>待排期 · {unscheduled.length}项</h3><p>这些计划的日期尚未填写完整，未放入日历。</p>{unscheduled.map(p=><button className="btn" key={p.id} onClick={()=>onPlan(p.id)}>{p.name} · 查看计划</button>)}</section>}
   <p className="help-text">展示已保存的旅行与餐饮计划；未确认预算不代表已预订。日历仅整理日期，实际付款仍在原计划中核实。</p>
  </section>
 </>;
}

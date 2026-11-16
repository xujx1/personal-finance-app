"use client";

import ActivityImages from './ActivityImages';
import {useState} from 'react';
import {buildLifeCalendar,shanghaiToday,shiftCalendarDate,MIN_CALENDAR_DATE,MAX_CALENDAR_DATE} from '../src/domain/life-calendar.mjs';
import {decimal} from '../src/domain/finance.mjs';
import {useI18n} from './I18n';


type Props={onMemberships?:()=>void;onReview?:(id:string)=>void;plans:any[];onPlan:(id:string)=>void;onNew:(date:string)=>void;onCancel?:(id:string)=>void;canWrite?:boolean;busy?:boolean};
const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
const eventName=(event:any)=>event.kind==='travel'?'旅行':event.kind==='dining'?'餐饮':event.kind==='investment'?'投资复核':'消费计划';
const statuses:Record<string,string>={PLANNED:'计划中',BOOKED:'已预订',IN_PROGRESS:'执行中',COMPLETED:'已完成',CANCELLED:'已取消',DRAFT:'草稿'};
const fullDate=(date:string,locale='zh-CN')=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',month:'long',day:'numeric',weekday:'long'}).format(new Date(date+'T00:00:00Z'));

export default function LifeCalendar({onMemberships,onReview,plans,onPlan,onNew,onCancel,canWrite=false,busy=false}:Props){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember,displayMoney:uiDisplayMoney}=useI18n();

 const today=shanghaiToday();
 const [selected,setSelected]=useState(today),[anchor,setAnchor]=useState(today),[view,setView]=useState<'month'|'week'>('month');
 const [kind,setKind]=useState('all'),[includeCancelled,setIncludeCancelled]=useState(false);
 const {days,unscheduled}=buildLifeCalendar(plans,{anchor,view,kind,includeCancelled});
 const active=days.find(d=>d.date===selected);
 const previous=shiftCalendarDate(anchor,view,-1),next=shiftCalendarDate(anchor,view,1);
 function move(date:string){setAnchor(date);setSelected(date);}
 const period=view==='month'?new Intl.DateTimeFormat(uiLocale,{timeZone:'UTC',year:'numeric',month:'long'}).format(new Date(anchor.slice(0,7)+'-01T00:00:00Z')):`${days[0].date} — ${days[6].date}`;
 return <>
  <div className="page-title"><div><div className="eyebrow">MAKE ROOM FOR THE WEEKEND</div><h1>{tr("生活日历")}</h1><p className="subtitle">{tr("把出游和一日三餐，放进期待的日子里。")}</p></div><div className="actions">{onMemberships&&<button className="btn" onClick={onMemberships}>{tr("会员权益")}</button>}<button className="btn primary" onClick={()=>onNew(selected)}>{tr("在ChatGPT规划这一天")}</button></div></div>
  <section className="card life-calendar" aria-label={tr("旅行与餐饮日历")}>
   <div className="life-calendar-toolbar">
    <div className="life-calendar-period"><button className="icon-button" aria-label={view==='month'?tr("上个月"):tr("上一周")} disabled={previous===anchor} onClick={()=>move(previous)}>‹</button><h2 aria-live="polite">{period}</h2><button className="icon-button" aria-label={view==='month'?tr("下个月"):tr("下一周")} disabled={next===anchor} onClick={()=>move(next)}>›</button></div>
    <div className="actions"><button className="btn" onClick={()=>move(today)}>{tr("今天")}</button><div className="segment" aria-label={tr("日历视图")}><button aria-pressed={view==='month'} className={view==='month'?'active':''} onClick={()=>{setView('month');setAnchor(selected)}}>{tr("整月")}</button><button aria-pressed={view==='week'} className={view==='week'?'active':''} onClick={()=>{setView('week');setAnchor(selected)}}>{tr("本周")}</button></div></div>
   </div>
   <div className="life-calendar-filters">
    <label>{tr("安排类型")}{" "}<select aria-label={tr("日历安排类型")} value={kind} onChange={e=>setKind(e.target.value)}><option value="all">{tr("全部安排")}</option><option value="travel">{tr("只看旅行")}</option><option value="dining">{tr("只看餐饮")}</option><option value="plan">{tr("只看其他计划")}</option><option value="investment">{tr("只看投资复核")}</option></select></label>
    <label>{tr("跳转月份")}{" "}<input aria-label={tr("跳转月份")} type="month" min={MIN_CALENDAR_DATE.slice(0,7)} max={MAX_CALENDAR_DATE.slice(0,7)} value={anchor.slice(0,7)} onChange={e=>{const date=e.target.value+'-01';if(/^\d{4}-\d{2}$/.test(e.target.value)&&date>=MIN_CALENDAR_DATE&&date<=MAX_CALENDAR_DATE)move(date)}}/></label>
    <label className="life-calendar-cancelled"><input type="checkbox" checked={includeCancelled} onChange={e=>setIncludeCancelled(e.target.checked)}/>{tr("显示已取消")}</label>
   </div>
   <div className="life-calendar-layout">
    <div className={'life-calendar-board '+(view==='week'?'week-view':'')}>
     <div className="life-calendar-weekdays">{weekdays.map((name,i)=><span key={name} className={i>4?'weekend':''}>{tr(name)}</span>)}</div>
     <div className="life-calendar-days">{days.map(day=><button key={day.date} disabled={!day.selectable} aria-label={tr("{p0}，{p1}项安排", {p0: day.date, p1: day.events.length})} aria-pressed={selected===day.date} aria-current={day.date===today?'date':undefined} className={'life-calendar-day '+(day.weekend?'weekend ':'')+(!day.inMonth&&view==='month'?'outside ':'')+(selected===day.date?'selected ':'')+(day.date===today?'is-today':'')} onClick={()=>{setSelected(day.date);if(!day.inMonth&&view==='month')setAnchor(day.date)}}>
      <span className="life-calendar-day-number">{Number(day.date.slice(8))}{day.date===today&&<small>{tr("今天")}</small>}</span>
      <span className="life-calendar-day-events">{day.events.slice(0,2).map(event=><span key={event.planId} className={'life-calendar-chip '+event.kind+(event.status==='CANCELLED'?' cancelled':'')+(event.pendingApproval?' pending-approval':'')}>{event.pendingApproval?tr("待审批 · "):''}{event.name}</span>)}{day.events.length>2&&<span className="life-calendar-more">{tr("另有")}{day.events.length-2}{tr("项")}</span>}</span>
      {day.events.length>0&&<span className="life-calendar-mobile-count">{day.events.length}{tr("项")}</span>}
     </button>)}</div>
     <p className="life-calendar-legend"><span className="travel">{tr("● 旅行")}</span><span className="dining">{tr("● 餐饮")}</span><span className="plan">{tr("● 其他计划")}</span><span className="investment">{tr("● 投资复核")}</span><span>{tr("浅底色为周末 · 按北京时间日期")}</span></p>
    </div>
    <section className="life-calendar-agenda" aria-label={tr("当天安排")} aria-live="polite">
     <div className="life-calendar-agenda-title"><small>{selected}</small><h2>{fullDate(selected,uiLocale)}</h2><p>{active?.events.length??0}{tr("项安排")}</p></div>
     {!active?.events.length&&<div className="life-calendar-empty"><strong>{tr("这一天，还留着空白")}</strong><p>{tr("可以安排一次出游，或一顿想吃的饭。")}</p><button className="btn" onClick={()=>onNew(selected)}>{tr("去ChatGPT规划")}</button></div>}
     {active?.events.map(event=><article key={event.planId} className={'life-calendar-event '+event.kind+(event.pendingApproval?' pending-approval':'')}>
      <div className="life-calendar-event-meta"><span>{tr(eventName(event))}</span><span>{event.kind==='investment'?event.status==='COMPLETED'?tr("已复核"):event.status==='CANCELLED'?tr("已取消复核"):tr("待复核 · 未交易"):event.pendingApproval?tr("待家庭审批"):tr(statuses[event.status])??tr("状态待核实")}</span></div>
      <h3>{event.name}</h3>{event.pendingApproval&&<p className="approval-pending-note">{tr("候选安排，待全家确认，尚未纳入正式预算。")}</p>}<p className="life-calendar-event-range">{event.date===event.end?event.date:`${event.date} — ${event.end}`}</p>
      {event.activities.length>0?<ul className="life-calendar-activities">{event.activities.map((activity,i)=><li key={i}><span>{activity.time||tr("时间待定")}</span><div><strong>{activity.title}</strong>{activity.location&&<p>{tr("地点：")}{activity.location}</p>}{activity.notes&&<p>{activity.notes}</p>}<ActivityImages activity={activity}/></div></li>)}</ul>:<p className="life-calendar-no-details">{event.kind==='travel'?tr("暂未提供当天行程，当前仅展示出行日期范围。"):event.kind==='dining'?tr("暂未提供具体餐次或菜单。"):tr("具体事项请打开预算详情核对。")}</p>}
      {event.kind!=='investment'&&<p className="life-calendar-budget">{tr("整项预算（非当日开销）：")}<span className="money">{event.budget==null?tr("待制定"):uiDisplayMoney(event.budget)}</span><small>{event.pendingApproval?tr("待家庭审批"):event.budgetStatus==='APPROVED'?tr("预算已确认"):tr("预算待确认")}</small></p>}
      <div className="actions"><button className="text-button" onClick={()=>event.reviewId?onReview?.(event.reviewId):onPlan(event.planId)}>{event.kind==='investment'?tr("查看研究与复核安排 →"):event.pendingApproval?tr("查看并审批 →"):tr("查看计划详情 →")}</button>{onCancel&&event.kind!=='investment'&&!['CANCELLED','COMPLETED'].includes(event.status)&&<button className="btn" disabled={!canWrite||busy} aria-label={tr("取消计划：{p0}", {p0: event.name})} onClick={()=>onCancel(event.planId)}>{tr("取消计划")}</button>}</div>
     </article>)}
    </section>
   </div>
   {unscheduled.length>0&&<section className="life-calendar-unscheduled"><h3>{tr("待排期 ·")}{" "}{unscheduled.length}{tr("项")}</h3><p>{tr("这些计划的日期尚未填写完整，未放入日历。")}</p>{unscheduled.map(p=><button className="btn" key={p.id} onClick={()=>p.reviewId?onReview?.(p.reviewId):onPlan(p.id)}>{p.name} · {p.budgetStatus==='PENDING_APPROVAL'||p.familyApproval?.status==='PENDING_APPROVAL'?tr("待审批"):tr("查看计划")}</button>)}</section>}
   <p className="help-text">{tr("家庭审批通过的预算自动显示在日历。待审批事项请在预算计划处理；实际发生后打开计划记录消费，同步流水和账户。投资复核仅作日程，不执行交易。")}</p>
  </section>
 </>;
}

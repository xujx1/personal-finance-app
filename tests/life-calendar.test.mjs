import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLifeCalendar, shiftCalendarDate, shanghaiToday} from '../src/domain/life-calendar.mjs';

const trip={id:'trip',name:'周末亲子游',category:'国内旅行',date:'2026-11-14',end:'2026-11-15',status:'PLANNED',budget:50000,budgetStatus:'DRAFT'};

test('month starts Monday and retains adjacent-month weekends',()=>{
 const x=buildLifeCalendar([],{anchor:'2026-11-11',view:'month'});
 assert.equal(x.days.length,42);assert.equal(x.days[0].date,'2026-10-26');assert.equal(x.days.at(-1).date,'2026-12-06');
 assert.equal(x.days[5].weekend,true);assert.equal(x.days[6].weekend,true);assert.equal(x.days[7].weekend,false);
 assert.equal(x.days[0].inMonth,false);assert.equal(x.days[6].inMonth,true);
});
test('week and navigation cross years and leap days without timezone drift',()=>{
 const x=buildLifeCalendar([],{anchor:'2027-01-01',view:'week'});
 assert.deepEqual(x.days.map(d=>d.date),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.equal(shiftCalendarDate('2028-01-31','month',1),'2028-02-29');
 assert.equal(shiftCalendarDate('2026-12-31','week',1),'2027-01-07');
 assert.equal(shanghaiToday(new Date('2026-11-13T16:30:00Z')),'2026-11-14');
 assert.throws(()=>buildLifeCalendar([],{anchor:'2026-02-30',view:'month'}));
});
test('multi-day travel and dining coexist without creating daily spending or mutating plans',()=>{
 const plans=[trip,{id:'meal',name:'周日晚餐',category:'餐饮',date:'2026-11-15',end:'2026-11-15',status:'PLANNED'},
 {...trip,id:'long',date:'2020-01-01',end:'2030-01-01'}];const before=JSON.stringify(plans);
 const x=buildLifeCalendar(plans,{anchor:'2026-11-14',view:'week'});
 assert.deepEqual(x.days[5].events.map(e=>e.planId),['long','trip']);
 assert.deepEqual(x.days[6].events.map(e=>e.planId),['long','trip','meal']);
 assert.equal(x.days[6].events.find(e=>e.planId==='trip').budgetStatus,'DRAFT');
 assert.equal(JSON.stringify(plans),before);
});
test('filters honor category and cancelled state; bad dates stay unscheduled',()=>{
 const plans=[trip,{...trip,id:'cancel',status:'CANCELLED'},
 {id:'meal',name:'晚餐',category:'dining',date:'2026-11-14',status:'COMPLETED'},
 {...trip,id:'missing',date:null,end:null},{...trip,id:'bad',date:'2026-02-30'},
 {...trip,id:'reverse',end:'2026-11-13'},{...trip,id:'shopping',category:'大件采购'}];
 const x=buildLifeCalendar(plans,{anchor:'2026-11-14',view:'week',kind:'dining'});
 assert.deepEqual(x.days[5].events.map(e=>e.planId),['meal']);
 const all=buildLifeCalendar(plans,{anchor:'2026-11-14',view:'week',includeCancelled:true});
 assert.equal(all.days[5].events.some(e=>e.planId==='cancel'),true);
 assert.deepEqual(all.unscheduled.map(p=>p.id),['missing','bad','reverse']);
 assert.equal(all.days[5].events.some(e=>e.planId==='shopping'),false);
});
test('daily details only use explicitly dated itinerary; empty days are never invented',()=>{
 const plans=[{...trip,itinerary:[{date:'2026-11-14',time:'19:00',title:'接站',notes:'候选时刻，未出票'},
 {date:'2026-11-15',time:'12:00',title:'午餐'},{date:'2026-02-30',title:'坏日期'}]}];
 const x=buildLifeCalendar(plans,{anchor:'2026-11-14',view:'week'});
 assert.deepEqual(x.days[5].events[0].activities,[{date:'2026-11-14',time:'19:00',title:'接站',notes:'候选时刻，未出票'}]);
 assert.equal(x.days[6].events[0].activities[0].title,'午餐');
 assert.equal(x.days[4].events.length,0);
 assert.deepEqual(buildLifeCalendar([trip],{anchor:'2026-11-14',view:'week'}).days[5].events[0].activities,[]);
});
test('calendar year endpoints never produce invalid or duplicate dates',()=>{
 assert.throws(()=>buildLifeCalendar([],{anchor:'9999-12-01',view:'month'}));
 assert.equal(shiftCalendarDate('9998-12-31','month',1),'9998-12-31');
 assert.equal(shiftCalendarDate('0001-01-01','week',-1),'0001-01-01');
 const x=buildLifeCalendar([],{anchor:'0001-01-01',view:'month'});
 assert.equal(new Set(x.days.map(d=>d.date)).size,42);
});
test('day agenda orders valid times chronologically with stable ties and cleans only schema note artifacts without mutating saved plans',()=>{const plan={...trip,itinerary:[{id:'station',date:trip.date,time:'19:00',title:'妈妈乘车',notes:'车次待确认，expenses为空数组'},{id:'dinner',date:trip.date,time:'18:00',title:'晚餐',notes:'宝宝少盐，提前留座'},{id:'dinner-second',date:trip.date,time:'18:00',title:'同时间备忘',notes:'真实提醒保留'},{id:'nap',date:trip.date,time:'13:00–14:30',title:'宝宝午睡',notes:'带午睡毯；expenses为空数组'},{id:'unknown',date:trip.date,time:'晚间待定',title:'停车核实',notes:'expenses预算由本人核实'},{id:'bad',date:trip.date,time:'25:00',title:'未核实时间',notes:'请核对时间'}]};const before=JSON.stringify(plan);const day=buildLifeCalendar([plan],{anchor:trip.date,view:'week'}).days.find(day=>day.date===trip.date);assert.deepEqual(day.events[0].activities.map(activity=>activity.id),['nap','dinner','dinner-second','station','unknown','bad']);assert.equal(day.events[0].activities.find(activity=>activity.id==='station').notes,'车次待确认');assert.equal(day.events[0].activities.find(activity=>activity.id==='nap').notes,'带午睡毯');assert.equal(day.events[0].activities.find(activity=>activity.id==='dinner').notes,'宝宝少盐，提前留座');assert.equal(day.events[0].activities.find(activity=>activity.id==='unknown').notes,'expenses预算由本人核实');assert.equal(day.events[0].budget,trip.budget);assert.equal(JSON.stringify(plan),before);});

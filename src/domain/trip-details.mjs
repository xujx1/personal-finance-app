const iso=(y,m,d)=>{const s=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null};
export function inferTripDetails(question,today,fallbackDate=null){const q=String(question??''),base=new Date(today+'T00:00:00Z');let date=null,end=null;const explicit=[...q.matchAll(/(20\d{2})[年\/-](\d{1,2})[月\/-](\d{1,2})日?/g)];if(explicit.length){date=iso(...explicit[0].slice(1).map(Number));if(explicit.length>1)end=iso(...explicit[1].slice(1).map(Number));else{const rest=q.slice(explicit[0].index+explicit[0][0].length),m=/^\s*(?:至|到|—|~|～|-)\s*(?:(\d{1,2})月)?(\d{1,2})日/.exec(rest);if(m)end=iso(Number(explicit[0][1]),Number(m[1]??explicit[0][2]),Number(m[2]));}}
 if(!date&&/周六|星期六|周末/.test(q)&&Number.isFinite(base.getTime())){let delta=(6-base.getUTCDay()+7)%7;if(/下周六|下星期六|下周末/.test(q))delta+=base.getUTCDay()===0?0:7;if(!delta&&/下/.test(q))delta=7;base.setUTCDate(base.getUTCDate()+delta);date=base.toISOString().slice(0,10);}
 if(!date&&fallbackDate&&/^\d{4}-\d{2}-\d{2}$/.test(fallbackDate))date=fallbackDate;
 const number=s=>({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6}[s]??Number(s)),days=/(\d+|[一二两三四五六])\s*(?:天(?:游|行程|亲子游)?|日(?:游|行程))/.exec(q);if(!end&&date&&days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Math.max(0,number(days[1])-1));end=d.toISOString().slice(0,10);}
 const adults=/(\d+|[一二两三四五六])\s*(?:位|个|名)?\s*(?:成人|大人)/.exec(q),babies=/(\d+|[一二两三四五六])\s*(?:位|个|名)?\s*(?:宝宝|婴儿|孩子)/.exec(q);return {date,end,adults:adults?number(adults[1]):null,babies:babies?number(babies[1]):/无宝宝|不带宝宝|没有宝宝/.test(q)?0:null};}

/** Remove only the known generated schema instruction; real travel reminders remain untouched. */
export function cleanItineraryNotes(value){
 const original=String(value??'');
 const clean=original.replace(/(?:[，,；;]\s*)?(?:`expenses`|expenses)\s*(?:为|=|：|:)\s*(?:空数组|\[\s*\])(?=\s*(?:[，,。；;.!！?？]|$))/gi,'');
 return clean===original?original:clean.replace(/^\s*[，,；;]\s*/,'').trim();
}
const itineraryMinute=value=>{
 const match=/^([01]?\d|2[0-3])[:：]([0-5]\d)(?:\s*[-–—~～至到]\s*(?:[01]?\d|2[0-3])[:：][0-5]\d)?$/.exec(String(value??'').trim());
 return match?Number(match[1])*60+Number(match[2]):Number.POSITIVE_INFINITY;
};
export function sortItineraryActivitiesByTime(activities){return activities.map((activity,index)=>({activity,index})).sort((a,b)=>itineraryMinute(a.activity.time)-itineraryMinute(b.activity.time)||a.index-b.index).map(({activity})=>({...activity,...(typeof activity.notes==='string'?{notes:cleanItineraryNotes(activity.notes)}:{})}));}

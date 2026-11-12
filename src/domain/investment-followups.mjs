const text=(x,n)=>{if(typeof x!=='string'||!x.trim()||x.length>n)throw Error('复核事项文字无效');return x.trim()};
export function normalizeFollowUps(rows=[]){
 if(!Array.isArray(rows)||rows.length>12)throw Error('最多12项投资复核安排');const ids=new Set();return rows.map((row,i)=>{
  if(!row||typeof row!=='object'||Object.keys(row).some(k=>!['id','title','date','time','notes','condition','status'].includes(k)))throw Error('投资复核字段无效，不能指定交易执行');const id=text(row.id??'followup-'+i,100);if(ids.has(id))throw Error('复核事项ID重复');ids.add(id);
  const date=row.date||null;if(date!==null&&(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'0001-01-01'||date>'9998-12-31'||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('投资复核日期无效');
  const time=row.time??'';if(typeof time!=='string'||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('复核时间须为北京时间HH:mm');const status=row.status??'PLANNED';if(!['PLANNED','COMPLETED','CANCELLED'].includes(status))throw Error('复核状态无效');for(const k of ['notes','condition'])if(row[k]!=null&&(typeof row[k]!=='string'||row[k].length>1000))throw Error('复核说明过长');
  return {id,title:text(row.title,150),date,time,status,notes:row.notes??'',condition:row.condition??''};
 });
}
export function investmentCalendarEntries(documents=[]){return documents.filter(d=>d.kind==='investment_review').flatMap(d=>{let rows;try{rows=normalizeFollowUps(d.payload.followUps??[])}catch{return []}return rows.map(row=>({id:'investment:'+d.id+':'+row.id,sourceType:'investment_review',reviewId:d.id,name:row.title,consumptionType:'investment',date:row.date,end:row.date,status:row.status,budget:null,budgetStatus:'NOT_APPLICABLE',itinerary:row.date?[{id:row.id,date:row.date,time:row.time,title:row.title,notes:[row.condition?'复核条件：'+row.condition:'',row.notes,'仅复核安排，不代表已执行交易。'].filter(Boolean).join('\n')}]:[]}))})}

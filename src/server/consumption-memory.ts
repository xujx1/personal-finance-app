const todayLocal=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function getConsumptionMemory(db:D1Database,state:any,today=todayLocal()){
 const from=new Date(today+'T00:00:00Z');from.setUTCDate(from.getUTCDate()-90);const start=from.toISOString().slice(0,10);
 const query=`SELECT t.id,t.kind,t.business_date,t.total_minor,t.metadata,t.total_minor-COALESCE((SELECT SUM(r.total_minor) FROM transactions r WHERE r.dataset_id=t.dataset_id AND r.original_id=t.id AND r.kind='REFUND' AND r.status='POSTED'),0) AS net_minor FROM transactions t LEFT JOIN documents p ON p.dataset_id=t.dataset_id AND p.id=json_extract(t.metadata,'$.planId') AND p.kind='plan' WHERE t.dataset_id=? AND t.status='POSTED' AND t.kind IN('EXPENSE','PAYMENT') AND t.business_date<=? AND `;
 // Reserve independent bounded slots for durable product history; busy recent meals cannot evict it.
 const [recent,products]:any[]=await Promise.all([
  db.prepare(query+"t.business_date>=? ORDER BY t.business_date DESC,t.rowid DESC LIMIT 120").bind(state.book.active_dataset,today,start).all(),
  db.prepare(query+"(json_extract(p.payload,'$.expenseDraft.kind')='shopping' OR json_extract(p.payload,'$.category') IN('大件采购','购物','数码','游戏')) ORDER BY t.business_date DESC,t.rowid DESC LIMIT 120").bind(state.book.active_dataset,today).all()
 ]);
 const rows={results:[...new Map([...recent.results,...products.results].map((row:any)=>[row.id,row])).values()] as any[]};
 const paidPlans=new Set<string>(),refundedPlans=new Set<string>();
 const grouped=new Map<string,any>();
 for(const row of rows.results){const metadata=JSON.parse(row.metadata);if(metadata.planId){if(row.net_minor>0)paidPlans.add(metadata.planId);else refundedPlans.add(metadata.planId);}if(row.net_minor<=0)continue;const p=metadata.planId?state.documents.find((d:any)=>d.kind==='plan'&&d.id===metadata.planId):null;if(p?.payload.status==='CANCELLED')continue;const key=p?.id??row.id;if(!grouped.has(key))grouped.set(key,{id:key,title:p?.payload.name??metadata.note??'已记录支出',category:p?.payload.category??'日常支出',date:row.business_date,source:p?'同一计划的已确认付款合并，不等于多次消费':'已确认支出流水',completionStatus:p?.payload.status??null,paidProduct:Boolean(p&&(p.payload.expenseDraft?.kind==='shopping'||['大件采购','购物','数码','游戏'].includes(p.payload.category))),paymentIds:[]});grouped.get(key).paymentIds.push(row.id);}
 for(const d of state.documents.filter((d:any)=>d.kind==='plan'&&d.payload.status==='COMPLETED'&&d.payload.end>=start&&d.payload.end<=today)){if(refundedPlans.has(d.id)&&!paidPlans.has(d.id))continue;if(!grouped.has(d.id))grouped.set(d.id,{id:d.id,title:d.payload.name,category:d.payload.category,date:d.payload.end,source:'用户标记已完成；付款与商品持有状态需结合流水核实',completionStatus:'COMPLETED',paymentIds:[]});}
 // Legacy preference documents remain stored, but are not evidence of consumption or ownership.
 const preferences={};
 return {windowDays:90,start,end:today,records:[...grouped.values()].filter(r=>!r.paidProduct).slice(0,40).concat([...grouped.values()].filter(r=>r.paidProduct).slice(0,40)),preferences,instructions:['只参考已确认支出、实际付款和用户标记完成的计划；候选建议不等于消费，已取消计划不等于去过。','同一计划的多笔付款不是多次出游；全额退款的付款不能证明商品仍被持有。','优先提供变化，避免近期反复同一目的地、同一食材和重复游戏卡；有补货、送人或明确复购需求时可以例外。','采购难度反馈是偏好与历史反馈，不是今天的实时库存。历史不明确时先追问，不捏造已买/已吃/已去。']};
}

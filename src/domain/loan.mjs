export function normalizeLoanMetadata(input={}){
 const raw=input.annualRate!==undefined?input.annualRate:input.rate;let rate=null;
 if(raw!==undefined&&raw!==null&&raw!==''){const s=String(raw);if(!/^\d+(?:\.\d{1,6})?$/.test(s)||!Number.isFinite(Number(s))||Number(s)>100)throw Error('贷款年利率需为0至100之间的百分数');rate=String(Number(s))}
 const date=(v)=>{if(v==null||v==='')return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('贷款日期无效');return v};
 const startDate=date(input.startDate),maturityDate=date(input.maturityDate);if(startDate&&maturityDate&&maturityDate<=startDate)throw Error('贷款结束日期必须晚于开始日期');return {rate,annualRate:rate,startDate,maturityDate};
}

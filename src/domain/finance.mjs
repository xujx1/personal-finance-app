export const MAX_MINOR=9_000_000_000_000;
export function minor(value){
 if(typeof value!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(value))throw Error('金额必须是非负十进制数，最多两位小数');
 const [a,b='']=value.split('.');const n=BigInt(a)*100n+BigInt(b.padEnd(2,'0'));
 if(n>BigInt(MAX_MINOR))throw Error('金额超过系统上限');return Number(n);
}
export function decimal(n){if(!Number.isSafeInteger(n)||Math.abs(n)>MAX_MINOR)throw Error('无效金额');return (n<0?'-':'')+Math.floor(Math.abs(n)/100)+'.'+String(Math.abs(n)%100).padStart(2,'0');}
export function convert(n,rate){
 if(!Number.isSafeInteger(n)||!/^\d+(?:\.\d{1,12})?$/.test(rate))throw Error('无效汇率');
 const [a,b='']=rate.split('.'),den=10n**BigInt(b.length),num=BigInt(a+b);
 if(num<=0n)throw Error('汇率必须大于零');
 const v=BigInt(Math.abs(n))*num;const rounded=(v+den/2n)/den;const result=Number(rounded)*(n<0?-1:1);
 if(!Number.isSafeInteger(result)||Math.abs(result)>MAX_MINOR)throw Error('折算金额超出上限');return result;
}
export function balanceJournal(entries){
 if(entries.length<2)throw Error('至少需要两条分录');const sums={};
 for(const e of entries){if(!Number.isSafeInteger(e.amount)||e.amount===0||Math.abs(e.amount)>MAX_MINOR)throw Error('无效分录金额');sums[e.currency]=(sums[e.currency]??0)+e.amount;}
 if(Object.values(sums).some(v=>v!==0))throw Error('分录按币种不平衡');return true;
}
export function forecastPlans(plans,start,end){let outflow=0,unknown=0;for(const p of plans){if(['CANCELLED','COMPLETED','DRAFT'].includes(p.status)||p.date<start||p.date>end)continue;if(p.budget==null)unknown++;else outflow+=Math.max(0,p.budget-(p.paid??0));}return{outflow,unknown};}

import {minor,decimal} from './finance.mjs';
import {normalizeExpenseDraft} from './expense-plan.mjs';
import {normalizeDepositMetadata} from './deposit.mjs';
import {normalizeLoanMetadata} from './loan.mjs';
import {normalizeWorkflowDraft} from './workflow-draft.mjs';
const txt=(x,n=200)=>{if(typeof x!=='string'||!x.trim()||x.length>n)throw Error('草稿文字无效或过长');return x.trim()};
const date=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x))||new Date(x).toISOString().slice(0,10)!==x)throw Error('草稿日期无效');return x};
const amount=x=>{if(typeof x!=='string')throw Error('金额须使用十进制字符串，单位为元');const n=minor(x);if(!n)throw Error('金额必须大于0');return decimal(n)};
function only(p,keys){if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!keys.includes(k)))throw Error('草稿包含无效或不允许的字段');}
export function downgradeExternalExpenseDraft(draft){
 const downgrade=x=>({...x,...(x.sourceType==='retrieved_reference'?{sourceType:'scenario_estimate',checkedAt:null,priceEvidence:null}:{}),...(x.alternatives?{alternatives:x.alternatives.map(downgrade)}:{})});
 return {...draft,items:draft.items.map(downgrade),comparisons:draft.comparisons.map(x=>({...x,price:null,checkedAt:null,priceEvidence:null,comparability:'unverified'}))};
}
/** External MCP analysis is never an approval or proof of an actual transaction. */
export function normalizeFinanceDraft(kind,p){
 if(['investment','monthly_review','recurring'].includes(kind))return normalizeWorkflowDraft(kind,p);
 const common=['analysis','note'];
 if(kind==='budget'){
  only(p,[...common,'name','category','date','end','budget','ownerMemberId','expenseDraft','planId']);
  const start=date(p.date),end=date(p.end??p.date);if(end<start)throw Error('结束日期不能早于开始日期');
  if(!Array.isArray(p.expenseDraft?.items)||p.expenseDraft.items.some(x=>typeof x.unitPrice!=='string'||typeof x.quantity!=='string'||(x.alternatives??[]).some(a=>typeof a.unitPrice!=='string')))throw Error('清单价格和数量须使用十进制字符串');
  const expenseDraft=downgradeExternalExpenseDraft(normalizeExpenseDraft({...p.expenseDraft,reviewed:false},{requireReview:false}));
  if(expenseDraft.itinerary.some(x=>x.date<start||x.date>end))throw Error('行程日期必须在预算起止日期内');
  const total=amount(p.budget);if(minor(total)!==expenseDraft.totalMinor)throw Error('预算与消费清单合计不一致');
  return {name:txt(p.name,100),category:txt(p.category??'其他',30),date:start,end,budget:total,ownerMemberId:txt(p.ownerMemberId??'family',120),...(p.planId?{planId:txt(p.planId,120)}:{}),expenseDraft,note:String(p.note??'').slice(0,3000),analysis:txt(p.analysis,6000)};
 }
 if(kind==='cashflow'){
  only(p,[...common,'type','accountId','cashMemberId','amount','date','balanceIncluded','snapshotDate']);
  if(!['income','expense'].includes(p.type))throw Error('仅支持实际收入或支出，预计收支请保存预算');
  if(typeof p.balanceIncluded!=='boolean')throw Error('请明确核对这笔收支是否包含在银行余额中');
  if(p.balanceIncluded&&(!p.snapshotDate||date(p.date)>date(p.snapshotDate)))throw Error('已含余额的历史须提供覆盖该笔的余额核实日期');
  return {type:p.type,accountId:txt(p.accountId,120),cashMemberId:txt(p.cashMemberId,120),amount:amount(p.amount),date:date(p.date),balanceIncluded:p.balanceIncluded,...(p.balanceIncluded?{snapshotDate:date(p.snapshotDate)}:{}),note:txt(p.note,300),analysis:String(p.analysis??'').slice(0,6000)};
 }
 if(kind==='asset'){
  const fields=['name','category','currency','amount','ownerMemberId','asOf','owned','market','code','quantity','price','cost','bank','startDate','annualRate','maturityDate','rate','monthly','day'];
  only(p,[...common,...fields]);if(p.owned!==true)throw Error('只可登记已经实际持有的资产，未来投资想法请保存预算');
  if(!['cash','term_deposit','fund','stock','property','loan','other'].includes(p.category)||!['CNY','USD'].includes(p.currency))throw Error('资产类型或币种无效');
  if(p.market!=null&&!['US','CN','HK','OTHER'].includes(p.market))throw Error('市场无效');
  if(p.day!=null&&p.day!==''&&(!Number.isInteger(Number(p.day))||Number(p.day)<1||Number(p.day)>31))throw Error('每月扣款日期无效');
  const terms=['cash','term_deposit'].includes(p.category)?normalizeDepositMetadata(p,{required:p.category==='term_deposit'}):p.category==='loan'?normalizeLoanMetadata(p):{};
  const details=Object.fromEntries(['code','quantity','price','cost','monthly'].filter(k=>p[k]!=null).map(k=>[k,String(p[k]).slice(0,100)]));
  for(const k of ['quantity','price','cost'])if(details[k]&&!/^\d+(\.\d{1,6})?$/.test(details[k]))throw Error('资产数量或金额无效');
  if(details.monthly)minor(details.monthly);
  return {name:txt(p.name,100),category:p.category,currency:p.currency,amount:amount(p.amount),ownerMemberId:txt(p.ownerMemberId,120),asOf:date(p.asOf),owned:true,market:p.market??null,...details,...terms,...(p.day!=null?{day:p.day===''?null:Number(p.day)}:{}),note:String(p.note??'').slice(0,2000),analysis:String(p.analysis??'').slice(0,6000)};
 }
 throw Error('草稿类型无效');
}

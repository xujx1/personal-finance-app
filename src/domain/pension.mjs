import {minor,decimal,MAX_MINOR} from './finance.mjs';
export const PENSION_TYPE={id:'personal_pension',name:'个人养老金',baseCategory:'other',goalBucket:null,enabled:true,builtin:true};
export const isPensionAccount=a=>Boolean(a?.metadata?.pension||a?.metadata?.assetTypeId===PENSION_TYPE.id);
const text=(v,n=100)=>{if(typeof v!=='string'||!v.trim()||v.length>n||/[\u0000-\u001f\u007f]/.test(v))throw Error('养老金资料文字无效');return v.trim()};
const money=(v,positive=false)=>{if(typeof v!=='string')throw Error('养老金金额须为人民币元字符串');const n=minor(v);if(positive&&n<=0)throw Error('养老金金额必须大于0');return decimal(n)};
const only=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('养老金资料字段无效')};
export function normalizePension(p,amount){
 only(p,['annualLimit','withdrawalAge','cashBalance','contributions','holdings']);const annualLimit=money(p.annualLimit,true);if(minor(annualLimit)>1200000)throw Error('个人养老金年度额度不能超过12000元');
 if(!Number.isInteger(p.withdrawalAge)||p.withdrawalAge<18||p.withdrawalAge>100)throw Error('请核对个人计划领取年龄');
 const cashBalance=money(p.cashBalance),years=new Set();if(!Array.isArray(p.contributions)||p.contributions.length>100)throw Error('养老金年度缴费资料无效');
 const contributions=p.contributions.map(x=>{only(x,['year','amount']);if(!Number.isInteger(x.year)||x.year<2000||x.year>2100||years.has(x.year))throw Error('养老金缴费年份无效或重复');years.add(x.year);const amount=money(x.amount);if(minor(amount)>minor(annualLimit))throw Error('年度实缴金额超过设置额度');return {year:x.year,amount}});
 if(!Array.isArray(p.holdings)||p.holdings.length>50)throw Error('养老金持仓清单无效');const names=new Set();const holdings=p.holdings.map(x=>{only(x,['name','value','cost','yesterdayProfit']);const name=text(x.name),key=name.normalize('NFKC').toLocaleLowerCase();if(names.has(key))throw Error('养老金持仓名称重复');names.add(key);const value=money(x.value),cost=money(x.cost);let yesterdayProfit;if(x.yesterdayProfit!=null){if(typeof x.yesterdayProfit!=='string'||!/^[-+]?\d+(\.\d{1,2})?$/.test(x.yesterdayProfit))throw Error('昨日收益无效');const n=minor(x.yesterdayProfit.replace(/^[-+]/,''));yesterdayProfit=(x.yesterdayProfit.startsWith('-')?'-':'')+decimal(n);}return {name,value,cost,...(yesterdayProfit!==undefined?{yesterdayProfit}:{})}});
 const cost=holdings.reduce((n,x)=>n+minor(x.cost),minor(cashBalance));if(!Number.isSafeInteger(cost)||cost>MAX_MINOR)throw Error('养老金成本合计超出金额上限');
 const total=holdings.reduce((n,x)=>n+minor(x.value),minor(cashBalance));if(!Number.isSafeInteger(total)||total>MAX_MINOR||total!==minor(String(amount)))throw Error('养老金总额须等于资金余额与持仓价值之和');return {annualLimit,withdrawalAge:p.withdrawalAge,cashBalance,contributions,holdings};
}
export function pensionSummary(a,year=new Date().getFullYear()){
 const p=normalizePension(a.metadata.pension,decimal(a.balance)),cost=p.holdings.reduce((n,x)=>n+minor(x.cost),minor(p.cashBalance)),contributed=minor(p.contributions.find(x=>x.year===year)?.amount??'0');return {year,value:a.balance,cost,profit:a.balance-cost,contributed,remaining:Math.max(0,minor(p.annualLimit)-contributed),annualLimit:minor(p.annualLimit),withdrawalAge:p.withdrawalAge,restricted:true,withdrawable:0,holdings:p.holdings,cashBalance:minor(p.cashBalance)};
}

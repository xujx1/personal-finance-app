import {MAX_MINOR} from './finance.mjs';
const validDate=value=>{
 if(value==null||value==='')return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('存款日期无效');
 return value;
};
export function normalizeDepositMetadata(input={}, {required=false}={}){
 if(input.bank!=null&&typeof input.bank!=='string')throw Error('银行名称无效');
 const bank=(input.bank??'').trim();if(bank.length>100)throw Error('银行名称过长');
 const startDate=validDate(input.startDate),maturityDate=validDate(input.maturityDate),annualRate=String(input.annualRate??'').trim();
 if(annualRate&&(!/^\d+(\.\d{1,6})?$/.test(annualRate)||Number(annualRate)>100))throw Error('存款年利率必须为0到100之间的百分比');
 if(required&&(!bank||!startDate||!maturityDate||annualRate===''))throw Error('请填写定期存款银行、起存日、年利率和到期日');
 if(startDate&&maturityDate&&maturityDate<=startDate)throw Error('到期日必须晚于起存日');
 return {bank,startDate,annualRate,maturityDate};
}
export function estimatedDepositInterest(account){
 if(account?.category!=='term_deposit'||!Number.isSafeInteger(account.balance)||account.balance<0||account.balance>MAX_MINOR)return null;
 try{
  const terms=normalizeDepositMetadata(account.metadata,{required:true});
  const days=BigInt((Date.parse(terms.maturityDate)-Date.parse(terms.startDate))/86400000),[whole,fraction='']=terms.annualRate.split('.');
  const numerator=BigInt(account.balance)*BigInt(whole+fraction)*days,denominator=100n*365n*10n**BigInt(fraction.length);
  const rounded=(numerator+denominator/2n)/denominator;
  return rounded<=BigInt(MAX_MINOR)?Number(rounded):null;
 }catch{return null;}
}

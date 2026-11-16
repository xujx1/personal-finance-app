import {formatMinor,translate} from './i18n.mjs';
export const DISPLAY_CURRENCY_STORAGE_KEY='family-finance.display-currency';
export const normalizeCurrencyMode=value=>['auto','CNY','USD'].includes(value)?value:'auto';
export const effectiveDisplayCurrency=(locale,mode='auto')=>normalizeCurrencyMode(mode)==='auto'?(locale==='en-US'?'USD':'CNY'):mode;

function ratio(rate){
 const text=typeof rate==='number'&&Number.isFinite(rate)?String(rate):rate;
 if(typeof text!=='string'||!/^\d{1,12}(\.\d{1,12})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.'),scale=10n**BigInt(fraction.length),numerator=BigInt(whole+fraction);
 return numerator>0n?{numerator,scale}:null;
}
export function usableDisplayRate(quote){
 if(!quote||['unavailable','error'].includes(quote.status)||!ratio(quote.rate))return null;
 if(typeof quote.source!=='string'||!quote.source.trim()||typeof quote.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(quote.date))return null;
 const date=new Date(quote.date+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==quote.date)return null;
 return quote.rate;
}
export function displayRateIsStale(quote,now=Date.now()){
 return usableDisplayRate(quote)!==null&&(quote.status==='stale'||now-Date.parse(quote.date+'T00:00:00Z')>7*86400000);
}
/** rate = CNY per USD. Round half away from zero, exactly once, in minor units. */
export function convertDisplayMinor(amount,source,target,rate){
 if(!Number.isSafeInteger(amount)||!['CNY','USD'].includes(source)||!['CNY','USD'].includes(target))return null;
 if(source===target||amount===0)return amount;
 const r=ratio(rate);if(!r)return null;
 const absolute=BigInt(amount<0?-amount:amount),numerator=absolute*(source==='USD'?r.numerator:r.scale),denominator=source==='USD'?r.scale:r.numerator;
 const rounded=(numerator+denominator/2n)/denominator;if(rounded>BigInt(Number.MAX_SAFE_INTEGER))return null;
 return rounded===0n?0:(amount<0?-1:1)*Number(rounded);
}
export function displayMoney(amount,source,target,quote,locale){
 if(!Number.isSafeInteger(amount))return translate('未知',{},locale);
 const converted=convertDisplayMinor(amount,source,target,usableDisplayRate(quote));
 if(converted===null)return formatMinor(amount,source,locale)+' · '+translate('{p0}折算待汇率',{p0:target},locale);
 return (source!==target&&amount!==0?'≈ ':'')+formatMinor(converted,target,locale);
}
export function aggregateDisplayAmounts(rows,target,quote){
 let sum=0n,missing=0,known=0;for(const row of rows){const amount=convertDisplayMinor(row.amount,row.currency,target,usableDisplayRate(quote));if(amount===null){missing++;continue}known++;sum+=BigInt(amount)}
 return {amount:missing>0&&known===0?null:sum>BigInt(Number.MAX_SAFE_INTEGER)||sum<BigInt(-Number.MAX_SAFE_INTEGER)?null:Number(sum),missing};
}

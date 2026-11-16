"use client";
import {useI18n} from './I18n';
import {SensitiveValue} from './FinancialPrivacy';
import {convertDisplayMinor,usableDisplayRate} from '../src/domain/display-currency.mjs';

/** Read-only display. Never use converted amounts as form or command values. */
export default function DisplayAmount({value,currency='CNY',showOriginal=false}:{value:number|null;currency?:string;showOriginal?:boolean}){
 const {displayMoney,money,displayCurrency,fx,t}=useI18n();
 const converted=value===null?null:convertDisplayMinor(value,currency,displayCurrency,usableDisplayRate(fx));
 return <SensitiveValue className="money">{value===null?t('待核实'):displayMoney(value,currency)}{showOriginal&&value!==null&&currency!==displayCurrency&&converted!==null&&<small className="currency-original">{t('原币金额：{p0}',{p0:money(value,currency)})}</small>}</SensitiveValue>;
}

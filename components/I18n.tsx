"use client";

import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {DEFAULT_LOCALE,LOCALE_STORAGE_KEY,preferredLocale,normalizeLocale,translate,translateMessage,formatMinor,formatCalendarDate,assetTypeLabel,memberLabel,planCategoryLabel} from '../src/domain/i18n.mjs';
import {DISPLAY_CURRENCY_STORAGE_KEY,normalizeCurrencyMode,effectiveDisplayCurrency,displayMoney as convertMoney,usableDisplayRate,displayRateIsStale} from '../src/domain/display-currency.mjs';
import './I18n.css';

export type Locale = 'zh-CN' | 'en-US';
export type CurrencyMode = 'auto' | 'CNY' | 'USD';
type DisplaySettings={currencyMode:CurrencyMode;setCurrencyMode:(mode:CurrencyMode)=>void;fx:any;setFx:(value:any)=>void};
const defaultDisplay:DisplaySettings={currencyMode:'auto',setCurrencyMode:()=>{},fx:null,setFx:()=>{}};
type Variables = Record<string, string | number | bigint | null | undefined>;
const makeValue = (locale:Locale, setLocale:(locale:Locale)=>void,display:DisplaySettings=defaultDisplay) => ({
  locale, setLocale, ...display, displayCurrency:effectiveDisplayCurrency(locale,display.currencyMode),
  displayMoney:(amount:number,currency='CNY')=>convertMoney(amount,currency,effectiveDisplayCurrency(locale,display.currencyMode),display.fx,locale),
  t:(message:string,values:Variables={}):string=>translate(message,values,locale),
  message:(text:unknown)=>translateMessage(text,locale),
  money:(amount:number,currency='CNY')=>formatMinor(amount,currency,locale),
  date:(value:string,options:Intl.DateTimeFormatOptions={})=>formatCalendarDate(value,locale,options),
  assetType:(type:any)=>assetTypeLabel(type,locale),
  member:(value:any)=>memberLabel(value,locale),
  category:(value:string)=>planCategoryLabel(value,locale),
});
const I18nContext=createContext(makeValue(DEFAULT_LOCALE,()=>{}));

export function I18nProvider({children,initialLocale=DEFAULT_LOCALE,initialCurrencyMode='auto',initialFx=null}:{children:ReactNode;initialLocale?:Locale;initialCurrencyMode?:CurrencyMode;initialFx?:any}) {
  const [locale,updateLocale]=useState<Locale>(initialLocale);
  const [currencyMode,updateCurrencyMode]=useState<CurrencyMode>(initialCurrencyMode),[fx,setFx]=useState<any>(initialFx);
  useEffect(()=>{
    let currency:string|null=null;
    try{currency=window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY)}catch{}
    updateCurrencyMode(normalizeCurrencyMode(currency) as CurrencyMode);
    let stored:string|null=null;
    try{stored=window.localStorage.getItem(LOCALE_STORAGE_KEY)}catch{/* Storage may be disabled. */}
    updateLocale(preferredLocale(stored,[...(window.navigator.languages??[window.navigator.language])]) as Locale);
    const sync=(event:StorageEvent)=>{if(event.key===LOCALE_STORAGE_KEY||event.key===null)updateLocale(preferredLocale(event.newValue,[...(window.navigator.languages??[])]) as Locale);if(event.key===DISPLAY_CURRENCY_STORAGE_KEY||event.key===null)updateCurrencyMode(normalizeCurrencyMode(event.newValue) as CurrencyMode)};
    window.addEventListener('storage',sync);
    return()=>window.removeEventListener('storage',sync);
  },[]);
  useEffect(()=>{
    document.documentElement.lang=locale;
    document.title=translate('家庭财务中心',{},locale);
    document.querySelector('meta[name="description"]')?.setAttribute('content',translate('管理资产、现金流与每一项生活计划。',{},locale));
  },[locale]);
  const value=useMemo(()=>makeValue(locale,(next:Locale)=>{
    const valid=normalizeLocale(next) as Locale|null;if(!valid)return;
    updateLocale(valid);
    try{window.localStorage.setItem(LOCALE_STORAGE_KEY,valid)}catch{/* Language switching still works without persistence. */}
  },{currencyMode,fx,setFx,setCurrencyMode:(next:CurrencyMode)=>{const valid=normalizeCurrencyMode(next) as CurrencyMode;updateCurrencyMode(valid);try{window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY,valid)}catch{}}}),[locale,currencyMode,fx]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n=()=>useContext(I18nContext);

export function LanguageSwitch(){
  const {locale,setLocale,t}=useI18n();
  return <label className="language-switch"><span aria-hidden="true">文/A</span><select aria-label={t('界面语言')} value={locale} onChange={event=>setLocale(event.target.value as Locale)}><option value="zh-CN" lang="zh-CN">中文</option><option value="en-US" lang="en">English</option></select></label>;
}

export function CurrencySwitch(){
 const {currencyMode,setCurrencyMode,displayCurrency,t}=useI18n();
 return <label className="language-switch currency-switch"><select aria-label={t('展示币种')} value={currencyMode} onChange={event=>setCurrencyMode(event.target.value as CurrencyMode)}><option value="auto">{t('自动 · {p0}',{p0:displayCurrency})}</option><option value="USD">USD $</option><option value="CNY">CNY ¥</option></select></label>;
}
export function DisplayCurrencyNotice(){
 const {displayCurrency,fx,t,message}=useI18n(),rate=usableDisplayRate(fx);
 return <aside className="display-currency-note" aria-label={t('展示币种与汇率')}><p>{t('展示币种：{p0}；输入和原币流水保持原币。',{p0:displayCurrency})}</p>{rate?<p>{t('参考汇率：1 USD = {p0} CNY · {p1} · {p2}',{p0:String(rate),p1:fx.date,p2:message(fx.source)})}{displayRateIsStale(fx)?' · '+t('旧汇率，仅供参考'):''}</p>:<p>{t('暂无有效汇率，不能折算的金额保留原币并标记；不按零或1:1处理。')}</p>}<small>{t('折算仅改变展示，使用当前参考汇率，不重写账本、存档或历史汇率。')}</small></aside>;
}

export function UiText({text,values={}}:{text:string;values?:Variables}){const {t}=useI18n();return <>{t(text,values)}</>}

export function UiMessage({text,values}:{text:string;values:Record<string,ReactNode>}){
  const {t}=useI18n();
  return <>{t(text).split(/(\{[A-Za-z][A-Za-z0-9_]*\})/g).map((part,i)=>
    /^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(part)&&Object.hasOwn(values,part.slice(1,-1))
      ? <span key={i}>{values[part.slice(1,-1)]}</span> : part)}</>;
}

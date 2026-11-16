"use client";
import {CONSUMPTION_TYPES} from '../src/domain/consumption.mjs';
import './RecordViews.css';
import {useI18n} from './I18n';

export default function ConsumptionFilters({prefix,type,onType,from,onFrom,to,onTo,onClear,children}:{prefix:string;type:string;onType:(v:string)=>void;from:string;onFrom:(v:string)=>void;to:string;onTo:(v:string)=>void;onClear:()=>void;children?:React.ReactNode}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();
return <div className="financial-record-filters" aria-label={tr("{p0}筛选", {p0: tr(prefix)})}>{children}<label className="field">{tr("消费种类")}<select aria-label={tr("{p0}消费种类", {p0: tr(prefix)})} value={type} onChange={e=>onType(e.target.value)}><option value="all">{tr("全部种类")}</option>{CONSUMPTION_TYPES.map((t:any)=><option key={t.id} value={t.id}>{tr(t.label)}</option>)}</select></label><label className="field">{prefix==='预算'?tr("计划开始日期"):tr("开始日期")}<input aria-label={tr("{p0}开始日期", {p0: tr(prefix)})} type="date" value={from} onChange={e=>onFrom(e.target.value)}/></label><label className="field">{prefix==='预算'?tr("计划结束日期"):tr("结束日期")}<input aria-label={tr("{p0}结束日期", {p0: tr(prefix)})} type="date" value={to} onChange={e=>onTo(e.target.value)}/></label><button type="button" className="btn" onClick={onClear}>{tr("清空筛选")}</button>{from&&to&&from>to&&<p className="notice" role="status">{tr("开始日期不能晚于结束日期。")}</p>}</div>}

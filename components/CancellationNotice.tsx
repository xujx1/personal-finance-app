"use client";
import {useI18n} from './I18n';

export default function CancellationNotice({value,onRetry,onDismiss}:{value:any;onRetry:()=>void;onDismiss:()=>void}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 return <section className="notice neutral cancellation-result" role="status" aria-label={tr("计划取消结果")} aria-live="polite"><div><strong>{value.name}{" "}{tr("已取消")}</strong><p>{value.phase==='syncing'?tr("正在同步日历与预算…"):value.phase==='done'?tr("日历与预算已更新。已释放预留，已付款和历史流水保留。"):tr("取消已保存，但日历重新加载未完成。请重试刷新，无需再次取消。")}</p></div><div className="actions">{value.phase==='refresh-error'&&<button className="btn" onClick={onRetry}>{tr("重新加载日历")}</button>}<button className="text-button" onClick={onDismiss} aria-label={tr("关闭取消结果提示")}>{tr("关闭提示")}</button></div></section>;
}

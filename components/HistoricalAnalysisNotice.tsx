"use client";
import {SensitiveText} from './FinancialPrivacy';
import {historicalAnalysisFacts} from '../src/domain/research-records.mjs';
import {useI18n} from './I18n';

export default function HistoricalAnalysisNotice({original,reviewed,current,facts,compact=false}:{original?:any;reviewed?:any;current?:any;facts?:any;compact?:boolean}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const info=facts??historicalAnalysisFacts({original,reviewed,current});
 return <aside className="notice neutral historical-analysis-notice" aria-label={tr("历史分析与当前事实")}>
  <strong>{tr("结构化金额、日期与行程为核对依据")}</strong>
  <p className="sensitive-text"><SensitiveText>{info.reviewed?.amount!=null?tr("保存版本预算 ¥{p0}", {p0: info.reviewed.amount}):tr("保存时预算未记录")}{info.reviewed?.date?` · ${info.reviewed.date}${info.reviewed.end!==info.reviewed.date?tr(' 至 ')+info.reviewed.end:''}`:''}{info.current?.amount!=null?tr("；当前计划 ¥{p0}", {p0: info.current.amount}):''}</SensitiveText></p>
  {info.reviewChanged&&<p className="sensitive-text"><SensitiveText>{tr("原稿 → 本人核对：")}{info.original?.amount!=null?'¥'+info.original.amount:tr("金额未记录")} → {info.reviewed?.amount!=null?'¥'+info.reviewed.amount:tr("金额未记录")}{info.original?.date!==info.reviewed?.date?tr("；日期 {p0} → {p1}", {p0: info.original?.date || tr("未记录"), p1: info.reviewed?.date || tr("未记录")}):''}{tr("。费用、日期或行程已调整。")}</SensitiveText></p>}
  {info.currentChanged&&<p className="sensitive-text"><SensitiveText>{tr("保存版本 → 当前计划：")}{info.reviewed?.amount!=null?'¥'+info.reviewed.amount:tr("金额未记录")} → {info.current?.amount!=null?'¥'+info.current.amount:tr("金额未记录")}{tr("；当前计划另有调整，历史版本保持原样。")}</SensitiveText></p>}
  <p className="help-text">{info.reviewChanged||info.currentChanged?tr("原分析和行程备注需重新核对。"):tr("原分析和行程备注按当时资料保存。")}{!compact&&tr("原文中的金额、状态及“尚待采用”等描述属于历史表述；结构化修改未经模型重新评估。")}</p>
 </aside>;
}

"use client";
import {historicalAnalysisFacts} from '../src/domain/research-records.mjs';
export default function HistoricalAnalysisNotice({original,reviewed,current,facts,compact=false}:{original?:any;reviewed?:any;current?:any;facts?:any;compact?:boolean}){
 const info=facts??historicalAnalysisFacts({original,reviewed,current});
 return <aside className="notice neutral historical-analysis-notice" aria-label="历史分析与当前事实">
  <strong>结构化金额、日期与行程为核对依据</strong>
  <p className="sensitive-text">{info.reviewed?.amount!=null?`保存时本人核对预算 ¥${info.reviewed.amount}`:'保存时预算未记录'}{info.reviewed?.date?` · ${info.reviewed.date}${info.reviewed.end!==info.reviewed.date?' 至 '+info.reviewed.end:''}`:''}{info.current?.amount!=null?`；当前计划 ¥${info.current.amount}`:''}</p>
  {info.reviewChanged&&<p className="sensitive-text">原稿 → 本人核对：{info.original?.amount!=null?'¥'+info.original.amount:'金额未记录'} → {info.reviewed?.amount!=null?'¥'+info.reviewed.amount:'金额未记录'}{info.original?.date!==info.reviewed?.date?`；日期 ${info.original?.date||'未记录'} → ${info.reviewed?.date||'未记录'}`:''}。费用、日期或行程已调整。</p>}
  {info.currentChanged&&<p className="sensitive-text">保存版本 → 当前计划：{info.reviewed?.amount!=null?'¥'+info.reviewed.amount:'金额未记录'} → {info.current?.amount!=null?'¥'+info.current.amount:'金额未记录'}；当前计划另有调整，历史版本保持原样。</p>}
  <p className="help-text">{info.reviewChanged||info.currentChanged?'原分析和行程备注需重新核对。':'原分析和行程备注按当时资料保存。'}{!compact&&'原文中的金额、状态及“尚待采用”等描述属于历史表述；结构化修改未经模型重新评估。'}</p>
 </aside>;
}

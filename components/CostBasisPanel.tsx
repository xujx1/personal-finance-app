"use client";
import {SensitiveValue,SensitiveText} from './FinancialPrivacy';
import {normalizeExpenseDraft} from '../src/domain/expense-plan.mjs';
import {PRICE_BASES,priceOverview} from '../src/domain/executable-costs.mjs';
import {decimal} from '../src/domain/finance.mjs';
import './CostBasisPanel.css';
import {useI18n} from './I18n';

export default function CostBasisPanel({draft}:{draft:any}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember,displayMoney:uiDisplayMoney}=useI18n();

 let value:any;try{value=normalizeExpenseDraft(draft,{requireReview:false})}catch{return <p className="help-text">{tr("请先补齐费用数量、价格和来源分类，再核对价格构成。")}</p>}
 const v=priceOverview(value),fmt=(n:number)=><SensitiveValue className="money">{uiDisplayMoney(n)}</SensitiveValue>;
 return <section className="cost-basis-panel" aria-label={tr("价格构成与执行依据")}><div className="cost-basis-totals"><div><small>{tr("外部引用 / 用户参考")}</small><strong>{fmt(v.quoted)}</strong></div><div><small>{tr("按输入计算")}</small><strong>{fmt(v.calculated)}</strong></div><div><small>{tr("预算预留")}</small><strong>{fmt(v.allowance)}</strong></div></div><p>{tr("合计为当前预算，包含预留时不能称为真实报价。外部引用未由本站核验，日期、规格及库存仍须核对。")}{v.unknown>0&&<strong>{tr("另有")}{v.unknown}{tr("项价格未知，未计入金额。")}</strong>}</p><details><summary>{tr("查看可执行条件与缺失信息")}</summary>{value.items.map((x:any)=><article key={x.id}><strong>{x.name}</strong><span>{tr((PRICE_BASES as Record<string,string>)[x.pricing?.basis])??(x.sourceType==='external_reference'?tr("外部引用 · 本站未核验"):x.sourceType==='user_quote'?tr("用户参考价"):tr("预算估算"))}{x.selected===false?tr(" · 未计入"):''}</span>{x.pricing&&<><p>{x.pricing.serviceDate||tr("适用日期待核实")} · {x.pricing.specification||tr("具体规格待补充")}{x.pricing.unit?' · '+x.pricing.unit:''}</p>{x.pricing.conditions&&<p><SensitiveText>{x.pricing.conditions}</SensitiveText></p>}{x.pricing.formula&&<p>{tr("计算：")}<SensitiveText>{x.pricing.formula}</SensitiveText></p>}{x.pricing.inputs.length>0&&<p>{tr("输入：")}<SensitiveText>{x.pricing.inputs.join('；')}</SensitiveText></p>}{x.pricing.missing.length>0&&<p className="cost-missing">{tr("待核对：")}{x.pricing.missing.join('；')}</p>}</>}{x.sourceUrl&&<a href={x.sourceUrl} target="_blank" rel="noreferrer">{tr("价格来源")}</a>}{x.checkedAt&&<small>{" "}{tr("· 查询")}{" "}{x.checkedAt}</small>}{x.priceEvidence&&<blockquote><SensitiveText>{x.priceEvidence}</SensitiveText></blockquote>}</article>)}</details></section>;
}

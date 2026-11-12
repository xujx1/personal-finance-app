"use client";
import {normalizeExpenseDraft} from '../src/domain/expense-plan.mjs';
import {PRICE_BASES,priceOverview} from '../src/domain/executable-costs.mjs';
import {decimal} from '../src/domain/finance.mjs';
import './CostBasisPanel.css';
export default function CostBasisPanel({draft}:{draft:any}){
 let value:any;try{value=normalizeExpenseDraft(draft,{requireReview:false})}catch{return <p className="help-text">请先补齐费用数量、价格和来源分类，再核对价格构成。</p>}
 const v=priceOverview(value),fmt=(n:number)=><span className="money">¥{decimal(n)}</span>;
 return <section className="cost-basis-panel" aria-label="价格构成与执行依据"><div className="cost-basis-totals"><div><small>外部引用 / 用户参考</small><strong>{fmt(v.quoted)}</strong></div><div><small>按输入计算</small><strong>{fmt(v.calculated)}</strong></div><div><small>预算预留</small><strong>{fmt(v.allowance)}</strong></div></div><p>合计为当前预算，包含预留时不能称为真实报价。外部引用未由本站核验，日期、规格及库存仍须核对。{v.unknown>0&&<strong>另有{v.unknown}项价格未知，未计入金额。</strong>}</p><details><summary>查看可执行条件与缺失信息</summary>{value.items.map((x:any)=><article key={x.id}><strong>{x.name}</strong><span>{(PRICE_BASES as Record<string,string>)[x.pricing?.basis]??(x.sourceType==='external_reference'?'外部引用 · 本站未核验':x.sourceType==='user_quote'?'用户参考价':'预算估算')}{x.selected===false?' · 未计入':''}</span>{x.pricing&&<><p>{x.pricing.serviceDate||'适用日期待核实'} · {x.pricing.specification||'具体规格待补充'}{x.pricing.unit?' · '+x.pricing.unit:''}</p>{x.pricing.conditions&&<p>{x.pricing.conditions}</p>}{x.pricing.formula&&<p>计算：{x.pricing.formula}</p>}{x.pricing.inputs.length>0&&<p>输入：{x.pricing.inputs.join('；')}</p>}{x.pricing.missing.length>0&&<p className="cost-missing">待核对：{x.pricing.missing.join('；')}</p>}</>}{x.sourceUrl&&<a href={x.sourceUrl} target="_blank" rel="noreferrer">价格来源</a>}{x.checkedAt&&<small> · 查询 {x.checkedAt}</small>}{x.priceEvidence&&<blockquote>{x.priceEvidence}</blockquote>}</article>)}</details></section>;
}

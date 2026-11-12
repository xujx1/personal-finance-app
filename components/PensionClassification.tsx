"use client";
import {useState} from 'react';
import {getAssetTypes} from '../src/domain/asset-types.mjs';
import {PENSION_KIND_BASE} from '../src/domain/asset-view.mjs';
import {pensionKinds} from './PensionInvestment';
export default function PensionClassification({state,asset,holding,onSave,busy}:{state:any;asset:any;holding:any;onSave:any;busy:boolean}){
 const [kind,setKind]=useState(holding.productKind??'fund'),[type,setType]=useState(holding.classificationPending?'':holding.assetTypeId??''),[error,setError]=useState('');
 const types=getAssetTypes(state).filter((t:any)=>t.enabled&&t.id!=='personal_pension'&&t.baseCategory===(PENSION_KIND_BASE as Record<string,string>)[kind]);
 return <form aria-label="养老金持仓分类核对" onSubmit={async e=>{e.preventDefault();setError('');try{await onSave('pension.holding.classify',{assetId:asset.id,holdingId:holding.holdingId,kind,assetTypeId:type})}catch(e:any){setError(e.message)}}}><p className="help-text">{asset.name}持有 · {holding.name}。仅调整分类，金额、成本和现金保持。</p><div className="form-grid"><label className="field">产品种类<select aria-label="持仓产品种类" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);setType('')}}>{Object.entries(pensionKinds).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="field">资产分类<select aria-label="持仓资产分类" value={type} disabled={busy} required onChange={e=>setType(e.target.value)}><option value="">请选择已核对分类</option>{types.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div><p className="help-text">不确定细分类型时可选择通用基金或其他资产，后续再核对。</p>{error&&<p role="alert" className="notice">{error}</p>}<button className="btn primary section-space" disabled={busy||!type||!state.viewer?.canWrite}>保存持仓分类</button></form>;
}

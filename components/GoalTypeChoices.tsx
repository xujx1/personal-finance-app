"use client";
import {getAssetTypes,goalEligibleType} from '../src/domain/asset-types.mjs';
export default function GoalTypeChoices({state,targets,index,onChange,prefix='组合'}:{state:any;targets:any[];index:number;onChange:(ids:string[])=>void;prefix?:string}){
 const selected=targets[index].assetTypeIds??[],others=targets.flatMap((t:any,i:number)=>i===index?[]:t.assetTypeIds??[]),types=getAssetTypes(state).filter(goalEligibleType);
 return <details className="goal-type-picker" open={index===0}><summary>选择资产类型 · 已选 {selected.length} 类<span>{types.filter((t:any)=>selected.includes(t.id)).map((t:any)=>t.name).join('、')||'尚未选择'}</span></summary><div className="goal-type-choices" role="group" aria-label={prefix+' '+(index+1)+'的资产类型'}>{types.map((t:any)=><label key={t.id} className={others.includes(t.id)?'type-used':''}><input type="checkbox" aria-label={prefix+' '+(index+1)+'：'+t.name} checked={selected.includes(t.id)} disabled={others.includes(t.id)&&!selected.includes(t.id)} onChange={e=>onChange(e.target.checked?[...selected,t.id]:selected.filter((id:string)=>id!==t.id))}/><span>{t.name}{others.includes(t.id)&&<small>已用于其他目标</small>}</span></label>)}</div></details>;
}

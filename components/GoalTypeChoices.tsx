"use client";
import {getAssetTypes,goalEligibleType} from '../src/domain/asset-types.mjs';
import {useI18n} from './I18n';

export default function GoalTypeChoices({state,targets,index,onChange,prefix='组合'}:{state:any;targets:any[];index:number;onChange:(ids:string[])=>void;prefix?:string}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const selected=targets[index].assetTypeIds??[],others=targets.flatMap((t:any,i:number)=>i===index?[]:t.assetTypeIds??[]),types=getAssetTypes(state).filter(goalEligibleType);
 return <details className="goal-type-picker" open={index===0}><summary>{tr("选择资产类型 · 已选")}{" "}{selected.length}{" "}{tr("类")}<span>{types.filter((t:any)=>selected.includes(t.id)).map((t:any)=>uiAssetType(t)).join(uiLocale==='en-US'?', ':'、')||tr("尚未选择")}</span></summary><div className="goal-type-choices" role="group" aria-label={tr("{p0} {p1}的资产类型", {p0: tr(prefix), p1: (index+1)})}>{types.map((t:any)=><label key={t.id} className={others.includes(t.id)?'type-used':''}><input type="checkbox" aria-label={tr(prefix)+' '+(index+1)+'：'+uiAssetType(t)} checked={selected.includes(t.id)} disabled={others.includes(t.id)&&!selected.includes(t.id)} onChange={e=>onChange(e.target.checked?[...selected,t.id]:selected.filter((id:string)=>id!==t.id))}/><span>{uiAssetType(t)}{others.includes(t.id)&&<small>{tr("已用于其他目标")}</small>}</span></label>)}</div></details>;
}

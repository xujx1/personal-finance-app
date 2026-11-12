import {isPensionAccount,normalizePension} from './pension.mjs';
import {getAssetTypes} from './asset-types.mjs';
import {minor,decimal} from './finance.mjs';
export const PENSION_KIND_BASE={fund:'fund',bond:'other',insurance:'other',deposit:'term_deposit',other:'other'};
/** Disjoint display leaves only. These IDs are not ledger accounts or transaction targets. */
export function expandAssetAccounts(state,accounts=state?.accounts??[]){
 const types=getAssetTypes(state);
 return accounts.flatMap(a=>{
  if(!isPensionAccount(a)||a.projection)return [a];
  const p=normalizePension(a.metadata.pension,decimal(a.balance));
  const projection=(kind,holdingId=null)=>({kind,parentAccountId:a.id,parentAccountName:a.name,holdingId,restricted:true,withdrawalAge:p.withdrawalAge});
  const metadata={ownerMemberId:a.metadata.ownerMemberId,asOf:a.metadata.asOf,status:a.metadata.status};
  return [{...a,id:'pension:'+a.id+':cash',name:a.name+' · 资金余额',balance:minor(p.cashBalance),metadata:{...metadata,assetTypeId:'personal_pension'},projection:projection('pension_cash')},...p.holdings.map(h=>{
   const base=PENSION_KIND_BASE[h.kind],type=types.find(t=>t.id===h.assetTypeId&&t.id!=='personal_pension'&&t.baseCategory===base)??types.find(t=>t.id===(base??'other'));
   return {...a,id:'pension:'+a.id+':'+h.id,name:h.name,category:type?.baseCategory??'other',balance:minor(h.value),metadata:{...metadata,assetTypeId:type?.id??'other',...(h.code?{code:h.code}:{})},projection:{...projection('pension_holding',h.id),productKind:h.kind??null,costAmountMajor:h.cost,classificationPending:!h.assetTypeId}};
  })];
 });
}
/** An explicitly selected whole pension account takes precedence over its product exposures. */
export function goalAssetAccounts(state,goal){
 const whole=goal?.schemaVersion===4?goal.targets.some(t=>t.assetTypeIds.includes('personal_pension')):goal?.schemaVersion===3&&goal.targets.some(t=>t.scope==='type:personal_pension');
 return whole?state.accounts:expandAssetAccounts(state);
}

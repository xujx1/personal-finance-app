import {minor} from '../domain/finance.mjs';

// Used only after both generated drafts pass their schema and row validators.
// A totals repair can add an omitted expense, but cannot rewrite a chosen cost
// or move it to a different activity to make the arithmetic appear consistent.
function selectedCosts(answer){
 const draft=answer?.expenseDraft;
 if(!draft||!Array.isArray(draft.items))throw preservationError();
 const rows=[...draft.items.map(cost=>({cost,parent:null})),
  ...(draft.wholePlanExpenses??[]).map(cost=>({cost,parent:null})),
  ...(draft.itinerary??[]).flatMap(activity=>(activity.expenses??[]).map(cost=>({cost,parent:activity})))];
 const counts=new Map(),identities=new Map();
 for(const {cost,parent}of rows){
  if(cost.selected!==true)continue;
  const quantity=String(cost.quantity),parts=/^(\d+)(?:\.(\d{1,4}))?$/.exec(quantity);
  if(!parts)throw preservationError();
  const units=BigInt(parts[1])*10000n+BigInt((parts[2]??'').padEnd(4,'0'));
  const text=value=>String(value??'').trim();
  const identity=[text(cost.name),text(cost.category),text(cost.merchant),text(cost.version),units.toString(),minor(String(cost.unitPrice))];
  const identityKey=JSON.stringify(identity);
  const key=JSON.stringify([cost.scope,...identity,
   cost.scope==='activity'?[text(parent?.date),text(parent?.time),text(parent?.title)]:null]);
  counts.set(key,(counts.get(key)??0)+1);
  identities.set(identityKey,(identities.get(identityKey)??0)+1);
 }
 return {counts,identities};
}
function preservationError(){return Object.assign(Error('费用复核改变或重复了原已选项目，请重新生成；未保存草稿'),{validationField:'cost_preservation'});}
export function assertSelectedResearchCostsPreserved(before,after){
 const original=selectedCosts(before),repaired=selectedCosts(after);
 for(const [key,count]of original.counts)if(repaired.counts.get(key)!==count)throw preservationError();
 // Preserve multiplicity across parents too: copying a known ticket to a new
 // activity is not a newly discovered expense. Existing repeated meals remain.
 for(const [key,count]of original.identities)if(repaired.identities.get(key)!==count)throw preservationError();
 return true;
}

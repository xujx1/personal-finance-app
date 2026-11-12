import {positionValue} from '../../src/domain/market.mjs';import {decimal} from '../../src/domain/finance.mjs';
// Complete nonmonetary schema metadata in synthetic provider fixtures; never migrate cost containers or overwrite explicit totals/scopes.
export function completeGeneratedFixture(value){
 const answer=structuredClone(value),draft=answer.expenseDraft;
 if(!draft||!['travel','dining','shopping'].includes(draft.kind))return answer;
 const evidence={merchant:'',checkedAt:null,priceEvidence:null,sourceUrl:null,sourceType:'scenario_estimate'};
 const candidate=raw=>({name:'',version:'',note:'',...evidence,...raw});
 const cost=raw=>({...(draft.kind==='shopping'?{scope:'whole_plan'}:{}),version:'',category:'其他',quantity:'1',selected:true,...evidence,note:'',alternatives:[],...raw,alternatives:(raw.alternatives??[]).map(candidate)});
 draft.reviewed??=false;draft.items=(draft.items??[]).map(cost);draft.comparisons=(draft.comparisons??[]).map(raw=>({merchant:'',version:'',price:null,shipping:'未核实',priceEvidence:null,checkedAt:null,comparability:'unverified',note:'',...raw}));
 if(Array.isArray(draft.wholePlanExpenses))draft.wholePlanExpenses=draft.wholePlanExpenses.map(cost);
 draft.itinerary=(draft.itinerary??[]).map(activity=>({time:'',notes:'',...activity,expenses:(activity.expenses??[]).map(cost)}));
 if(answer.budget===undefined){const rows=[...draft.items,...(draft.wholePlanExpenses??[]),...draft.itinerary.flatMap(activity=>activity.expenses)];answer.budget=decimal(rows.filter(row=>row.selected!==false).reduce((sum,row)=>sum+positionValue(row.quantity,row.unitPrice),0))}
 return answer;
}

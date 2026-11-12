import {validateSetupDraft} from '../domain/setup-draft.mjs';
import {getAssetTypes,assetTypeCatalogue,normalizeAssetTypes} from '../domain/asset-types.mjs';
import {normalizeAssetGoalInput,getAssetGoal} from '../domain/asset-goals.mjs';
import {normalizeMemberProfile,buildFinanceMembers} from '../domain/member-ownership.mjs';
import {minor} from '../domain/finance.mjs';
import {evidenceHash} from './mcp-queries.ts';
type Member={id:string;name:string;userId:string|null;active:boolean;selectable:boolean};
type Account={id:string;name:string;kind:string;category:string;currency:string;archived?:boolean;balance:number;metadata?:{ownerMemberId?:string;assetTypeId?:string;goalBucket?:string;status?:string;quantity?:string}};
type State={book:{active_dataset:string};financeMembers?:Member[];householdRevision?:number;documents?:{id:string;kind:string;payload:unknown}[];accounts?:Account[]};
type SetupDraft=(
 | {section:'members';data:{members:{name:string}[]}}
 | {section:'asset_types';data:{additions:Addition[]}}
 | {section:'goals';data:{name:string;targets:({scope:string;target:string}|{name:string;assetTypeIds:string[];target:string})[];monthlyTarget:string|null;deadline:string|null}}
 | {section:'recurring';data:{name:string;type:'income'|'expense'|'loan'|'investment';accountId:string;cashMemberId:string;amount:string;day:number;start:string;end:string|null;loanId?:string;assetId?:string}}
)&{analysis:string};
type Context={state:State;writeDoc:(id:string,kind:string,payload:unknown)=>unknown};
type Addition={id:string;name:string;baseCategory:string;goalBucket:string|null};
const sorted=<T extends {id:string}>(rows:T[])=>rows.sort((a,b)=>a.id.localeCompare(b.id));
const members=(state:State)=>sorted((state.financeMembers??buildFinanceMembers(state)).map((m:Member)=>({id:m.id,name:m.name,userId:m.userId,active:m.active,selectable:m.selectable})));
const goals=(state:State)=>sorted((state.documents??[]).filter(d=>d.kind==='savings_goal').map(d=>({id:d.id,payload:d.payload})));
const accounts=(state:State,goalRelevant=false)=>sorted((state.accounts??[]).filter(a=>a.category!=='system').map(a=>({id:a.id,name:a.name,kind:a.kind,category:a.category,currency:a.currency,archived:!!a.archived,ownerMemberId:a.metadata?.ownerMemberId??null,...(goalRelevant?{balance:a.balance,assetTypeId:a.metadata?.assetTypeId??null,goalBucket:a.metadata?.goalBucket??null,status:a.metadata?.status??null,quantity:a.metadata?.quantity??null}:{})})));
/** Ignore draft/audit writes, but retain all configuration that may affect this section. */
export async function setupBasis(state:State,p:SetupDraft){
 let basis:Record<string,unknown>={section:p.section,dataset:state.book.active_dataset};
 if(p.section==='members')basis={...basis,members:members(state),householdRevision:state.householdRevision??null};
 else if(p.section==='asset_types'||p.section==='goals')basis={...basis,catalogue:assetTypeCatalogue(state),goals:goals(state),accounts:accounts(state,true)};
 else if(p.section==='recurring')basis={...basis,members:members(state),accounts:accounts(state),rules:sorted((state.documents??[]).filter(d=>d.kind==='recurring_rule').map(d=>({id:d.id,payload:d.payload})))};
 else throw Error('建档配置阶段无效');
 return evidenceHash(basis);
}
export const stageValidation=(state:State,p:SetupDraft)=>validateSetupDraft(p,state);

/** Write configuration only; never creates accounts or financial journals. */
export function adoptSetupDraft(c:Context,p:SetupDraft,draftId:string,now:string){
 const {state,writeDoc}=c;let id:string,destinationKind:string;
 stageValidation(state,p);
 if(p.section==='members'){
  const d=p.data,ids=d.members.map((m:{name:string})=>{const id='person:'+crypto.randomUUID(),profile=normalizeMemberProfile({name:m.name,linkedUserId:null},state);writeDoc(id,'financial_member',{...profile,id,mcpDraftId:draftId});return id;});
  id=ids[0];destinationKind='financial_member';
 }else if(p.section==='asset_types'){
  const d=p.data;id='asset-types';destinationKind='asset_type_catalog';const current=assetTypeCatalogue(state),types=normalizeAssetTypes([...getAssetTypes(state),...d.additions.map((t:Addition)=>({...t,enabled:true}))],state);
  writeDoc(id,destinationKind,{types,version:current.version+1,updatedAt:now,mcpDraftId:draftId});
 }else if(p.section==='goals'){
  const d=p.data,current=getAssetGoal(state);id=current.id??crypto.randomUUID();destinationKind='savings_goal';writeDoc(id,destinationKind,{...normalizeAssetGoalInput({schemaVersion:d.targets.some(t=>'assetTypeIds' in t)?4:3,...d},state),updatedAt:now,mcpDraftId:draftId});
 }else{
  const d=p.data;id=crypto.randomUUID();destinationKind='recurring_rule';writeDoc(id,destinationKind,{...d,loanId:d.loanId??null,assetId:d.assetId??null,amount:minor(d.amount),autoPost:false,paused:false,version:1,principal:null,confirmedAt:now,analysis:p.analysis,mcpDraftId:draftId,source:'本人明确提供的周期规则，未经历史推定，不等于实际已到账或扣款'});
 }
 return {id,destinationKind};
}

import {normalizeFinanceDraft} from '../domain/mcp-draft.mjs';
import {ownerFields,resolveFinanceMember,accountMember} from '../domain/member-ownership.mjs';
import {assetTypeForWrite,getAssetTypes} from '../domain/asset-types.mjs';
import {validatePensionProductTypes} from '../domain/pension.mjs';
import {stageValidation,setupBasis} from './setup-draft.ts';
import {getMonthlyContext,evidenceHash} from './mcp-queries.ts';
import {suggestRecurring} from './recurring-http.ts';
export async function validateStagedDraft(c:any,kind:string,input:any){
 const {state,account,doc,db}=c,payload:any=normalizeFinanceDraft(kind,input),meta:any={};
 if(kind==='setup'){Object.assign(payload,stageValidation(state,payload));meta.setupBasisFingerprint=await setupBasis(state,payload);}
 else if(kind==='cashflow'){const a=account(payload.accountId);if(a.kind!=='ASSET'||a.category!=='cash'||a.currency!=='CNY'||resolveFinanceMember(state,payload.cashMemberId,{write:true}).id!==accountMember(a,state).id)throw Error('现金账户或资金成员不一致');}
 else if(kind==='recurring'){meta.candidateEvidence=(await suggestRecurring(db)).candidates.find((x:any)=>x.id===payload.candidateId);if(!meta.candidateEvidence)throw Error('周期候选不存在或证据已变化，请重新读取');}
 else{ownerFields(state,payload.ownerMemberId);if(kind==='asset'){assetTypeForWrite(state,payload.assetTypeId,payload);if(payload.pension)validatePensionProductTypes(payload.pension,getAssetTypes(state));if(payload.pension&&payload.ownerMemberId==='family')throw Error('个人养老金须归属具体成员');}}
 if(kind==='monthly_review'&&(await getMonthlyContext(db,state,payload.month)).basisFingerprint!==payload.basisFingerprint)throw Error('月报依据已变化，请重新读取并总结');
 if(kind==='budget'&&payload.planId){const plan=doc(payload.planId);if(plan.kind!=='plan'||['COMPLETED','CANCELLED'].includes(plan.payload.status)||plan.payload.scheduleOnly)throw Error('原预算不存在、已结束或属于须单独核对本息的还款预约');if(input.ownerMemberId==null)payload.ownerMemberId=plan.payload.ownerMemberId;meta.targetVersion=plan.payload.version??0;meta.targetFingerprint=await evidenceHash(plan.payload);}
 return {payload,...meta};
}

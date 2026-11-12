import {clearReusedQuoteEvidence} from '../domain/stale-quote.mjs';
import {validateStagedDraft} from './mcp-draft-stage.ts';
import {isPensionAccount,validatePensionProductTypes} from '../domain/pension.mjs';
import {setupBasis,stageValidation,adoptSetupDraft} from './setup-draft.ts';
import {assetTypeForWrite,getAssetTypes} from '../domain/asset-types.mjs';
import {minor} from '../domain/finance.mjs';
import {normalizeFinanceDraft} from '../domain/mcp-draft.mjs';
import {ownerFields,resolveFinanceMember,accountMember} from '../domain/member-ownership.mjs';
import {beginFamilyApproval,applyFamilyApproval} from '../domain/family-approval.mjs';
import {getMonthlyContext,evidenceHash} from './mcp-queries.ts';
import {suggestRecurring} from './recurring-http.ts';
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const only=(body:any,keys:string[])=>{if(Object.keys(body).some(k=>!keys.includes(k)))throw Error('确认字段无效，不能指定审批人或审批状态')};
export async function extendMcpDraft(c:any){
 const {action,body,state,rows,db,ds,account,doc,writeDoc,journal,entry,system,result,stagedAccounts,actor}=c;
 if(action==='mcp.draft.submit'||action==='mcp.draft.update'){
  const updating=action==='mcp.draft.update';only(body,updating?['draftId','expectedDraftVersion','payload','changeNote']:['kind','payload']);
  const old=updating?doc(body.draftId):null;if(old&&(old.kind!=='financial_draft'||old.payload.status!=='PENDING'))throw Error('仅可修改待本人核对的财务草稿；已采用或拒绝的记录保持历史');
  const previousVersion=old?.payload.draftVersion??1;
  if(updating&&(!Number.isInteger(body.expectedDraftVersion)||body.expectedDraftVersion!==previousVersion))throw Error('CONFLICT:草稿版本已变化，请读取最新草稿再修改');
  if(body.changeNote!==undefined&&(typeof body.changeNote!=='string'||body.changeNote.length>1000))throw Error('修改说明无效或过长');
  const kind=old?.payload.kind??body.kind;
  if(old&&(kind==='budget'&&(old.payload.payload.planId??null)!==(body.payload?.planId??null)||kind==='setup'&&old.payload.payload.section!==body.payload?.section||kind==='recurring'&&old.payload.payload.candidateId!==body.payload?.candidateId))throw Error('不能在续改时更换原计划、建档阶段或周期候选；请为新目标另建草稿');
  const validated=await validateStagedDraft(c,kind,body.payload),id=old?.id??crypto.randomUUID(),now=new Date().toISOString(),draftVersion=old?previousVersion+1:1;
  if(old&&kind==='budget'){const cleaned=clearReusedQuoteEvidence(old.payload.payload.expenseDraft,validated.payload.expenseDraft);validated.payload.expenseDraft=cleaned.draft;if(cleaned.reset)result.warnings=[cleaned.reset+'项报价条件已更改，旧证据失效，已改为估算/预留，请重新核价'];}
  if(old)writeDoc(crypto.randomUUID(),'financial_draft_revision',{draftId:id,draftVersion:previousVersion,previousDraft:old.payload,changedAt:now,changedBy:actor,changeNote:body.changeNote??''});
  writeDoc(id,'financial_draft',{kind,...validated,draftVersion,status:'PENDING',source:'ChatGPT/MCP，外部分析待本人核对',submittedBy:old?.payload.submittedBy??actor,createdAt:old?.payload.createdAt??now,...(old?{updatedAt:now,updatedBy:actor,changeNote:body.changeNote??''}:{})});result.id=id;result.draftVersion=draftVersion;result.status='PENDING';return true;
 }
 if(action!=='mcp.draft.accept'&&action!=='mcp.draft.reject')return false;
 only(body,action==='mcp.draft.accept'?['draftId','confirmed','reviewedPayload','actualConfirmed']:['draftId','reason']);
 const d=doc(body.draftId);if(d.kind!=='financial_draft')throw Error('财务草稿不存在');
 if(action==='mcp.draft.reject'){
  if(d.payload.status==='ACCEPTED')throw Error('已采纳的草稿不可拒绝');
  if(body.reason!=null&&(typeof body.reason!=='string'||body.reason.length>1000))throw Error('拒绝理由无效');
  writeDoc(d.id,'financial_draft',{...d.payload,status:'REJECTED',rejectedAt:new Date().toISOString(),rejectedBy:actor,rejectionReason:body.reason??''});result.id=d.id;return true;
 }
 if(body.confirmed!==true)throw Error('请本人核对并确认草稿');
 if(d.payload.status==='ACCEPTED'){result.id=d.payload.destinationId;result.destinationKind=d.payload.destinationKind;return true;}
 if(d.payload.status!=='PENDING')throw Error('草稿已拒绝，不能再次采纳');
 const p:any=normalizeFinanceDraft(d.payload.kind,body.reviewedPayload),now=new Date().toISOString();let id:string,destinationKind:string;
 if(d.payload.kind==='setup'){
  if(p.section!==d.payload.payload.section)throw Error('不能在核对时更换建档配置阶段，请重新提交');
  if(await setupBasis(state,d.payload.payload)!==d.payload.setupBasisFingerprint)throw Error('建档配置依据已变化，请重新读取并提交草稿');
  Object.assign(p,stageValidation(state,p));({id,destinationKind}=adoptSetupDraft(c,p,d.id,now));
 }else if(d.payload.kind==='budget'){
  if((p.planId??null)!==(d.payload.payload.planId??null))throw Error('不能在核对时更换原预算，请重新提交草稿');
  const old=p.planId?doc(p.planId):null;if(old&&(old.kind!=='plan'||['COMPLETED','CANCELLED'].includes(old.payload.status)||old.payload.version!==d.payload.targetVersion||await evidenceHash(old.payload)!==d.payload.targetFingerprint))throw Error('原预算版本已变化，请重新提交草稿');
  id=old?.id??crypto.randomUUID();destinationKind='plan';const budget=minor(p.budget),expenseDraft={...p.expenseDraft,reviewed:true},version=Math.max(old?.payload.version??0,old?.payload.familyApproval?.version??0)+1;
  const paid=state.planSummaries.find((x:any)=>x.planId===id)?.paid??0;
  const plan={...old?.payload,...ownerFields(state,p.ownerMemberId),name:p.name,category:p.category,consumptionType:p.consumptionType,date:p.date,end:p.end,budget,status:old?.payload.status??'PLANNED',reserved:Math.min(old?.payload.reserved??0,Math.max(0,budget-paid)),version,note:p.note,analysis:p.analysis,expenseDraft,itinerary:expenseDraft.itinerary,items:expenseDraft.items.filter((x:any)=>x.selected),comparisons:expenseDraft.comparisons,mcpDraftId:d.id,externalAnalysis:true};
  writeDoc(id,'plan',applyFamilyApproval(plan,beginFamilyApproval(version,state.householdMembers,actor,undefined,state.householdRevision)));
 }else if(d.payload.kind==='investment'){
  id=crypto.randomUUID();destinationKind='investment_review';writeDoc(id,destinationKind,{...p,...ownerFields(state,p.ownerMemberId),mcpDraftId:d.id,acceptedAt:now,acceptedBy:actor,source:'ChatGPT外部研究，引用未由本站重新核验'});
 }else if(d.payload.kind==='monthly_review'){
  if(p.month!==d.payload.payload.month)throw Error('不能在核对时更换月报月份');
  const basis=await getMonthlyContext(db,state,p.month);if(basis.basisFingerprint!==p.basisFingerprint||p.basisFingerprint!==d.payload.payload.basisFingerprint)throw Error('月报依据已变化，请回到ChatGPT更新总结');
  id=crypto.randomUUID();destinationKind='monthly_review';writeDoc(id,destinationKind,{...p,...ownerFields(state,p.ownerMemberId),basis,mcpDraftId:d.id,acceptedAt:now,acceptedBy:actor,source:'ChatGPT月度总结，数字以服务器月报为准'});
 }else if(d.payload.kind==='recurring'){
  if(p.candidateId!==d.payload.payload.candidateId)throw Error('周期候选已更换，请重新提交草稿');
  const candidate=(await suggestRecurring(db)).candidates.find((x:any)=>x.id===p.candidateId);if(!candidate)throw Error('周期证据或现有规则已变化，请重新读取候选');if(await evidenceHash({...candidate,start:null})!==await evidenceHash({...d.payload.candidateEvidence,start:null}))throw Error('周期证据已变化，请重新读取并提交草稿');
  id=crypto.randomUUID();destinationKind='recurring_rule';writeDoc(id,destinationKind,{name:p.name,type:candidate.type,accountId:candidate.accountId,cashMemberId:candidate.cashMemberId,amount:candidate.amount,day:candidate.day,start:candidate.start,end:null,autoPost:false,paused:false,version:1,principal:null,confirmedAt:now,evidence:candidate.evidence,analysis:p.analysis,mcpDraftId:d.id});
 }else{
  if(body.actualConfirmed!==true)throw Error('请确认已经实际到账、支付或实际持有，不能将预计事项记为实际');
  if(d.payload.kind==='cashflow'){
   const a=account(p.accountId),n=minor(p.amount);if(a.kind!=='ASSET'||a.category!=='cash'||a.currency!=='CNY')throw Error('请选择人民币现金账户');
   if(resolveFinanceMember(state,p.cashMemberId,{write:true}).id!==accountMember(a,state).id)throw Error('资金成员与现金账户归属不一致');
   if(p.date>localDate())throw Error('不能提前记未来实际收支');if(!p.balanceIncluded&&a.metadata.asOf&&p.date<=a.metadata.asOf)throw Error('该日期已被银行余额快照覆盖，请核对历史已含余额');
   if(p.balanceIncluded&&(!a.metadata.asOf||p.snapshotDate!==a.metadata.asOf||p.date>p.snapshotDate||p.snapshotDate>localDate()))throw Error('历史覆盖日期须匹配此银行账户已登记的余额核实日期');
   const duplicates:any=await db.prepare("SELECT metadata FROM transactions WHERE dataset_id=? AND status='POSTED' AND business_date=? AND total_minor=? AND kind=?").bind(ds,p.date,n,p.type==='income'?'INCOME':'EXPENSE').all();if(duplicates.results.some((r:any)=>{const m=JSON.parse(r.metadata);return m.accountId===a.id&&m.note===p.note}))throw Error('已存在相同账户、日期、金额和说明的记录，请核对重复图片或草稿');
   const income=p.type==='income',basis=p.balanceIncluded?system('equity'):a;id=journal(income?'INCOME':'EXPENSE',n,[entry(basis,income?n:-n),entry(system(income?'income':'expense'),income?-n:n)],{businessDate:p.date,accountId:a.id,note:p.note,consumptionType:p.consumptionType,balanceIncluded:p.balanceIncluded,snapshotDate:p.snapshotDate??null,mcpDraftId:d.id,externalAnalysis:true});destinationKind='transaction';
  }else{
   if(p.asOf>localDate())throw Error('已有资产核对日期不能在未来');id=crypto.randomUUID();destinationKind='account';const kind=p.category==='loan'?'LIABILITY':'ASSET',n=minor(p.amount),signed=kind==='LIABILITY'?-n:n,owner=ownerFields(state,p.ownerMemberId);
   if(state.accounts.some((a:any)=>a.category===p.category&&a.currency===p.currency&&String(a.name).trim().toLocaleLowerCase()===p.name.toLocaleLowerCase()&&accountMember(a,state).id===owner.ownerMemberId))throw Error('同名同币种同归属资产已经登记，请在资产列表核对修改，避免重复新增');
   if(p.pension)validatePensionProductTypes(p.pension,getAssetTypes(state));
   if(p.pension&&(owner.ownerMemberId==='family'||state.accounts.some((a:any)=>isPensionAccount(a)&&accountMember(a,state).id===owner.ownerMemberId)))throw Error('个人养老金须归属具体成员且不能重复登记，请调整已有账户');
   const {name,category,currency}=p;const details=Object.fromEntries(Object.entries(p).filter(([key])=>!['amount','name','category','currency','ownerMemberId','owned'].includes(key)));const assetTypeId=assetTypeForWrite(state,p.assetTypeId,{category:p.category,name:p.name,metadata:p});const metadata={...details,...owner,...(p.assetTypeId?{assetTypeId}:{}),mcpDraftId:d.id,source:'本人确认ChatGPT分析的已有资产登记'};stagedAccounts.push({id,name,kind,category,currency,metadata});
   rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(ds,id,name,kind,category,currency,JSON.stringify(metadata)));
   if(n>0)journal('OPENING',n,[{account_id:id,currency,amount:signed},entry(system('equity',currency),-signed)],{businessDate:p.asOf,accountId:id,reason:'本人确认已有资产，不是新买入或银行交易',mcpDraftId:d.id});
  }
 }
 writeDoc(d.id,'financial_draft',{...d.payload,status:'ACCEPTED',reviewedPayload:p,acceptedAt:now,acceptedBy:actor,destinationId:id,destinationKind});result.id=id;result.destinationKind=destinationKind;return true;
}

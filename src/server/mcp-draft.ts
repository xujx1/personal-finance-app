import {minor} from '../domain/finance.mjs';
import {normalizeFinanceDraft} from '../domain/mcp-draft.mjs';
import {ownerFields,resolveFinanceMember,accountMember} from '../domain/member-ownership.mjs';
import {beginFamilyApproval,applyFamilyApproval} from '../domain/family-approval.mjs';
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const only=(body:any,keys:string[])=>{if(Object.keys(body).some(k=>!keys.includes(k)))throw Error('确认字段无效，不能指定审批人或审批状态')};
export function extendMcpDraft(c:any){
 const {action,body,state,rows,db,ds,account,doc,writeDoc,journal,entry,system,result,stagedAccounts,actor}=c;
 if(action==='mcp.draft.submit'){
  only(body,['kind','payload']);const payload=normalizeFinanceDraft(body.kind,body.payload),id=crypto.randomUUID();
  // Validate family ownership and account references before saving any external draft.
  if(body.kind==='cashflow'){const a=account(payload.accountId);if(a.kind!=='ASSET'||a.category!=='cash'||a.currency!=='CNY'||resolveFinanceMember(state,payload.cashMemberId,{write:true}).id!==accountMember(a,state).id)throw Error('现金账户或资金成员不一致');}
  else ownerFields(state,payload.ownerMemberId);
  writeDoc(id,'financial_draft',{kind:body.kind,payload,status:'PENDING',source:'ChatGPT/MCP，外部分析待本人核对',submittedBy:actor,createdAt:new Date().toISOString()});result.id=id;return true;
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
 const p:any=normalizeFinanceDraft(d.payload.kind,body.reviewedPayload),now=new Date().toISOString();let id,destinationKind;
 if(d.payload.kind==='budget'){
  id=crypto.randomUUID();destinationKind='plan';const budget=minor(p.budget),expenseDraft={...p.expenseDraft,reviewed:true};
  const plan={...ownerFields(state,p.ownerMemberId),name:p.name,category:p.category,date:p.date,end:p.end,budget,status:'PLANNED',reserved:0,version:1,note:p.note,analysis:p.analysis,expenseDraft,itinerary:expenseDraft.itinerary,items:expenseDraft.items.filter((x:any)=>x.selected),comparisons:expenseDraft.comparisons,mcpDraftId:d.id,externalAnalysis:true};
  writeDoc(id,'plan',applyFamilyApproval(plan,beginFamilyApproval(1,state.householdMembers,actor,undefined,state.householdRevision)));
 }else{
  if(body.actualConfirmed!==true)throw Error('请确认已经实际到账、支付或实际持有，不能将预计事项记为实际');
  if(d.payload.kind==='cashflow'){
   const a=account(p.accountId),n=minor(p.amount);if(a.kind!=='ASSET'||a.category!=='cash'||a.currency!=='CNY')throw Error('请选择人民币现金账户');
   if(resolveFinanceMember(state,p.cashMemberId,{write:true}).id!==accountMember(a,state).id)throw Error('资金成员与现金账户归属不一致');
   if(p.date>localDate())throw Error('不能提前记未来实际收支');if(a.metadata.asOf&&p.date<=a.metadata.asOf)throw Error('该日期已被银行余额快照覆盖，请通过历史图片核对');
   const income=p.type==='income';id=journal(income?'INCOME':'EXPENSE',n,[entry(a,income?n:-n),entry(system(income?'income':'expense'),income?-n:n)],{businessDate:p.date,accountId:a.id,note:p.note,mcpDraftId:d.id,externalAnalysis:true});destinationKind='transaction';
  }else{
   if(p.asOf>localDate())throw Error('已有资产核对日期不能在未来');id=crypto.randomUUID();destinationKind='account';const kind=p.category==='loan'?'LIABILITY':'ASSET',n=minor(p.amount),signed=kind==='LIABILITY'?-n:n,owner=ownerFields(state,p.ownerMemberId);
   if(state.accounts.some((a:any)=>a.category===p.category&&a.currency===p.currency&&String(a.name).trim().toLocaleLowerCase()===p.name.toLocaleLowerCase()&&accountMember(a,state).id===owner.ownerMemberId))throw Error('同名同币种同归属资产已经登记，请在资产列表核对修改，避免重复新增');
   const {name,category,currency}=p;const details=Object.fromEntries(Object.entries(p).filter(([key])=>!['amount','name','category','currency','ownerMemberId','owned'].includes(key)));const metadata={...details,...owner,mcpDraftId:d.id,source:'本人确认ChatGPT分析的已有资产登记'};stagedAccounts.push({id,name,kind,category,currency,metadata});
   rows.push(db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,0,?)').bind(ds,id,name,kind,category,currency,JSON.stringify(metadata)));
   journal('OPENING',n,[{account_id:id,currency,amount:signed},entry(system('equity',currency),-signed)],{businessDate:p.asOf,accountId:id,reason:'本人确认已有资产，不是新买入或银行交易',mcpDraftId:d.id});
  }
 }
 writeDoc(d.id,'financial_draft',{...d.payload,status:'ACCEPTED',reviewedPayload:p,acceptedAt:now,acceptedBy:actor,destinationId:id,destinationKind});result.id=id;result.destinationKind=destinationKind;return true;
}

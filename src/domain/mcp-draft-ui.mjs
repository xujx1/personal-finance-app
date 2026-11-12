import {decimal} from './finance.mjs';
import {normalizeExpenseDraft} from './expense-plan.mjs';

export function mcpDraftAcceptBody(state,document,payload,checks){
 if(state?.viewer?.canWrite!==true)throw Error('仅账本本人可核对外部草稿');
 if(document?.payload?.status!=='PENDING')throw Error('此草稿已处理，请刷新核对');
 if(!checks.reviewed)throw Error('请先逐项核对外部分析与金额');
 const kind=document.payload.kind;
 if(kind==='cashflow'&&((payload.planId??null)!==(document.payload.payload?.planId??null)||(payload.prepaymentId??null)!==(document.payload.payload?.prepaymentId??null)))throw Error('不能在核对时更换关联计划或原预付款');
 if(kind==='cashflow'&&typeof payload.balanceIncluded!=='boolean')throw Error('请明确核对该笔余额覆盖情况');
 if(kind==='cashflow'&&payload.balanceIncluded){const account=state.accounts.find(a=>a.id===payload.accountId);if(!account?.metadata?.asOf||payload.snapshotDate!==account.metadata.asOf||payload.date>payload.snapshotDate)throw Error('已含余额的历史须匹配账户核实日期');}
 if(kind==='asset'&&payload.owned!==true)throw Error('只能登记已经实际持有的资产');
 const actualNeeded=['cashflow','asset'].includes(kind);if(actualNeeded&&!checks.actual)throw Error('请确认实际发生或已经持有');
 let reviewedPayload={...payload};
 if(kind==='budget'){
  const expenseDraft=normalizeExpenseDraft({...payload.expenseDraft,reviewed:true});
  reviewedPayload={...payload,budget:decimal(expenseDraft.totalMinor),expenseDraft};
 }
 return {draftId:document.id,confirmed:true,reviewedPayload,...(actualNeeded?{actualConfirmed:true}:{})};
}

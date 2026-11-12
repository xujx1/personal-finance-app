export const DRAFT_KINDS=['setup','budget','cashflow','asset','investment','monthly_review','recurring'];
export function draftInbox(state,{kind='all',query='',status='PENDING',page=1}={}){
 const documents=(state?.documents??[]).filter(d=>d.kind==='financial_draft'&&DRAFT_KINDS.includes(d.payload?.kind));
 const pending=documents.filter(d=>d.payload.status==='PENDING'),processed=documents.filter(d=>['ACCEPTED','REJECTED'].includes(d.payload.status));
 const needle=query.trim().toLocaleLowerCase(),filtered=(status==='PROCESSED'?processed:pending).filter(d=>(kind==='all'||d.payload.kind===kind)&&(!needle||JSON.stringify([d.id,d.payload.payload,d.payload.reviewedPayload,d.payload.rejectionReason]).toLocaleLowerCase().includes(needle)));
 const pages=Math.max(1,Math.ceil(filtered.length/5)),current=Math.min(pages,Math.max(1,Math.trunc(page)||1));
 return {pendingCount:pending.length,processedCount:processed.length,total:filtered.length,pages,page:current,shown:filtered.slice((current-1)*5,current*5)};
}

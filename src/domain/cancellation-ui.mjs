// Called only after a successful cancel response or a verified committed receipt.
// This updates the display immediately; authoritative reload still follows.
export function applyConfirmedCancellation(state,body,receipt){
 if(!state||receipt?.id!==body.planId||receipt.dataset&&receipt.dataset!==state.book.dataset)return state;
 const document=state.documents.find(d=>d.kind==='plan'&&d.id===body.planId);if(!document)return state;
 const plan=receipt.cancelledPlan??{id:body.planId,status:'CANCELLED',reserved:0,version:body.version+1};
 if(plan.id!==body.planId||plan.status!=='CANCELLED'||plan.reserved!==0)throw Error('取消回执无效，请重新读取账本');
 if((document.payload.version??0)>plan.version)return state;
 const {id,...payload}=plan,revision=Number.isSafeInteger(receipt.revision)?receipt.revision:document.payload.status==='CANCELLED'?state.book.revision:state.book.revision+1;
 return {...state,book:{...state.book,revision:Math.max(state.book.revision,revision)},documents:state.documents.map(d=>d===document?{...d,payload:{...d.payload,...payload}}:d)};
}

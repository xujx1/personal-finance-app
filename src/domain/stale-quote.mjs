/** Quote evidence belongs to the quoted identity/price; changing those cannot reuse the old tuple. */
export function clearReusedQuoteEvidence(previous,next){
 let reset=0;const tuple=x=>JSON.stringify([x.sourceUrl??null,x.checkedAt??null,x.priceEvidence??null]);
 const invalid=(old,x)=>old&&['retrieved_reference','external_reference'].includes(old.sourceType)&&tuple(old)===tuple(x)&&(['name','merchant','version','unitPrice','quantity'].some(k=>(old[k]??'')!==(x[k]??''))||['specification','serviceDate','unit','conditions','inputs','formula'].some(k=>JSON.stringify(old.pricing?.[k]??null)!==JSON.stringify(x.pricing?.[k]??null)));
 const resetItem=x=>{reset++;return {...x,sourceType:'scenario_estimate',sourceUrl:null,checkedAt:null,priceEvidence:null,...(x.pricing?{pricing:{...x.pricing,basis:x.pricing.basis==='external_quote'?'allowance':x.pricing.basis,missing:[...new Set([...(x.pricing.missing??[]),'报价条件已更改，原引用失效，请重新核价'])].slice(0,12)}}:{})};};
 const items=next.items.map(x=>{const old=previous.items.find(o=>o.id===x.id);let item=invalid(old,x)?resetItem(x):x;const alternatives=(x.alternatives??[]).map((a,i)=>invalid(old?.alternatives?.[i],a)?resetItem(a):a);return {...item,alternatives};});
 const comparisons=next.comparisons.map(x=>{const old=previous.comparisons.find(o=>o.url===x.url);if(old&&tuple({...old,sourceUrl:old.url})===tuple({...x,sourceUrl:x.url})&&['title','merchant','version','price','shipping'].some(k=>(old[k]??'')!==(x[k]??''))){reset++;return {...x,checkedAt:null,priceEvidence:null,comparability:'unverified'};}return x;});
 return {draft:{...next,items,comparisons},reset};
}

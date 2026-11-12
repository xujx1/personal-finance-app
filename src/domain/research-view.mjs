export function normalizeResearchView(value={}){
 return {query:typeof value.query==='string'?value.query:'',kind:typeof value.kind==='string'?value.kind:'all',from:typeof value.from==='string'?value.from:'',to:typeof value.to==='string'?value.to:'',page:Number.isInteger(value.page)&&value.page>0?value.page:1,open:value.open===true,scrollY:Number.isFinite(value.scrollY)&&value.scrollY>=0?value.scrollY:0};
}
// Memory belongs to this tab's current session; no financial contents are persisted to disk.
let current=normalizeResearchView();
export const getResearchView=()=>({...current});
export function saveResearchView(value){current=normalizeResearchView({...current,...value});}

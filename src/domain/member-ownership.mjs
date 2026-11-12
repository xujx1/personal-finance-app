const FAMILY={id:'family',name:'家庭共用',kind:'family',userId:null,active:true,selectable:true,aliases:['family']};
const UNKNOWN={id:'unknown',name:'归属待确认',kind:'unknown',userId:null,active:false,selectable:false,aliases:['unknown']};
const string=value=>typeof value==='string'?value:'';
export function buildFinanceMembers(state,householdMembers=state?.householdMembers??[]){
 const profiles=(state?.documents??[]).filter(d=>d.kind==='financial_member'&&/^person:[A-Za-z0-9_-]{1,100}$/.test(d.id)&&typeof d.payload?.name==='string');
 const people=Array.isArray(householdMembers)?householdMembers:[],result=[{...FAMILY}],claimed=new Set();
 const profileMember=(d,user)=>({id:d.id,name:d.payload.name,kind:'person',userId:user?.userId??null,active:d.payload.archived!==true&&(!user||user.active!==0&&user.active!==false),selectable:d.payload.archived!==true&&(!user||user.active!==0&&user.active!==false),aliases:[d.id,...(user?['user:'+user.userId,user.userId]:[])]});
 for(const user of people){if(!user||typeof user.userId!=='string')continue;const profile=profiles.find(d=>d.payload.linkedUserId===user.userId);if(profile){result.push(profileMember(profile,user));claimed.add(profile.id);}else{const active=user.active!==0&&user.active!==false;result.push({id:'user:'+user.userId,name:string(user.displayName)||'家庭成员',kind:'user',userId:user.userId,active,selectable:active,aliases:['user:'+user.userId,user.userId]});}}
 for(const d of profiles)if(!claimed.has(d.id)){if(d.payload.linkedUserId){result.push({...profileMember(d,null),userId:d.payload.linkedUserId,active:false,selectable:false,aliases:[d.id,'user:'+d.payload.linkedUserId,d.payload.linkedUserId]});}else result.push(profileMember(d,null));}
 // Historical ownership remains visible even when a linked login has left or the old directory is incomplete.
 for(const account of state?.accounts??[]){const metadata=account.metadata??{},id=string(metadata.ownerMemberId)||(metadata.ownerSubject?'user:'+metadata.ownerSubject:'');if(!id||result.some(m=>m.id===id||m.aliases.includes(id)))continue;result.push({id,name:metadata.ownerLabel&&metadata.ownerLabel!=='本人'?String(metadata.ownerLabel):'历史成员（待核对）',kind:id.startsWith('user:')?'user':'person',userId:metadata.ownerSubject??null,active:false,selectable:false,aliases:[id,...(metadata.ownerSubject?[metadata.ownerSubject,'user:'+metadata.ownerSubject]:[])]});}
 return [...new Map(result.map(m=>[m.id,m])).values(),{...UNKNOWN}];
}
const directory=state=>Array.isArray(state?.financeMembers)?state.financeMembers:buildFinanceMembers(state);
export function resolveFinanceMember(state,id,{write=false}={}){const key=string(id),member=directory(state).find(m=>m.id===key||m.aliases?.includes(key));if(write&&(!member||!member.selectable||member.id==='unknown'))throw Error('请选择本家庭有效的归属成员');return member??{...UNKNOWN};}
export function defaultMemberId(state){const subject=state?.viewer?.subject??state?.household?.userId;const me=subject?resolveFinanceMember(state,'user:'+subject):null;return me?.selectable?me.id:'family';}
export function accountMember(account,state){const metadata=account?.metadata??{};return resolveFinanceMember(state,metadata.ownerMemberId??(metadata.ownerSubject?'user:'+metadata.ownerSubject:'unknown'));}
export function planMember(plan,state){const p=plan?.payload??plan??{};return resolveFinanceMember(state,p.ownerMemberId??(p.ownerSubject?'user:'+p.ownerSubject:'unknown'));}
export function ownerFields(state,id){const member=resolveFinanceMember(state,id,{write:true});return {ownerMemberId:member.id,ownerLabel:member.name,ownerSubject:member.userId??null};}
export function captureAccountOwners(state,entries=[],metadata={},overrides=[]){
 const accounts=new Map([...(state?.accounts??[]),...overrides].map(a=>[a.id,a])),rows=new Map();
 for(const entry of entries){const id=entry.account_id??entry.accountId,account=accounts.get(id);if(!account||account.category==='system'||!['ASSET','LIABILITY'].includes(account.kind))continue;const amount=entry.amount??entry.amount_minor??entry.amountMinor;if(!Number.isSafeInteger(amount))continue;rows.set(id,{account,amount:(rows.get(id)?.amount??0)+amount});}
 for(const id of [metadata.accountId,metadata.fromId,metadata.toId]){const account=accounts.get(id);if(account&&account.category!=='system'&&['ASSET','LIABILITY'].includes(account.kind)&&!rows.has(id))rows.set(id,{account,amount:0});}
 return [...rows.values()].map(({account,amount})=>{const member=accountMember(account,state);return {accountId:account.id,accountName:account.name,memberId:member.id,memberName:member.name,currency:account.currency,category:account.category,amountMinor:amount};});
}
export function transactionParties(transaction,state){let rows=Array.isArray(transaction?.metadata?.accountOwners)?transaction.metadata.accountOwners:[];
 if(!rows.length)rows=captureAccountOwners(state,transaction?.entries??[],transaction?.metadata??{});
 const valid=rows.filter(x=>x&&typeof x.accountId==='string'&&typeof x.memberId==='string').map(x=>({...x,memberId:resolveFinanceMember(state,x.memberId).id==='unknown'&&x.memberId!=='unknown'?x.memberId:resolveFinanceMember(state,x.memberId).id,memberName:string(x.memberName)||resolveFinanceMember(state,x.memberId).name}));
 const cash=valid.filter(x=>x.category==='cash'),movedCash=cash.filter(x=>x.amountMinor!==0);if(movedCash.length)return movedCash;
 const movedAssets=valid.filter(x=>x.category!=='cash'&&x.amountMinor!==0);return movedAssets.length?movedAssets:cash.length?cash:valid;
}
export function memberMatchesTransaction(transaction,memberId,state){if(!memberId||memberId==='all')return true;const selected=resolveFinanceMember(state,memberId).id;const parties=transactionParties(transaction,state);return selected==='unknown'&&!parties.length||parties.some(x=>x.memberId===selected||x.memberId===memberId);}
export function normalizeMemberProfile(body,state){const name=string(body.name).trim();if(!name||name.length>60||['家庭共用','归属待确认'].includes(name))throw Error('请填写有效的成员称呼（最多60字）');const linkedUserId=body.linkedUserId==null||body.linkedUserId===''?null:body.linkedUserId;if(linkedUserId!==null){if(typeof linkedUserId!=='string'||!(state?.householdMembers??[]).some(m=>m.userId===linkedUserId&&m.active!==0&&m.active!==false))throw Error('只能关联本家庭已加入的有效成员');if((state?.documents??[]).some(d=>d.kind==='financial_member'&&d.id!==body.id&&d.payload.linkedUserId===linkedUserId))throw Error('该家庭成员已经关联其他记账档案，请勿重复关联');}return {name,linkedUserId};}

export function activeMemberFilterOptions(state){
 const members=directory(state).filter(m=>m.id!=='unknown'&&m.active!==false&&m.selectable!==false);
 return members.some(m=>m.id==='family')?members:[{...FAMILY},...members];
}

import {normalizeMembership} from '../domain/memberships.mjs';
import {ownerFields,resolveFinanceMember} from '../domain/member-ownership.mjs';
const key=(v:string)=>v.normalize('NFKC').toLocaleLowerCase();
export function extendMemberships(c:any){
 if(c.action!=='membership.save')return false;
 const {body,state,doc,writeDoc,result,actor}=c;const {id,...input}=body,p=normalizeMembership(input),owner=ownerFields(state,p.ownerMemberId);let old:any;
 if(id!==undefined){if(typeof id!=='string'||!id||id.length>150)throw Error('会员记录编号无效');old=doc(id);if(old.kind!=='membership')throw Error('会员记录类型不符');}
 const cards=state.documents.filter((d:any)=>d.kind==='membership');if(!id&&cards.length>=100)throw Error('会员权益最多100项，请调整已有记录');
 if(cards.some((d:any)=>d.id!==id&&resolveFinanceMember(state,d.payload.ownerMemberId).id===owner.ownerMemberId&&key(d.payload.name)===key(p.name)&&key(d.payload.brand)===key(p.brand)))throw Error('已有同成员、同品牌、同名会员权益，请编辑原记录，避免重复');
 const nextId=id??crypto.randomUUID(),now=new Date().toISOString();writeDoc(nextId,'membership',{...p,...owner,createdAt:old?.payload.createdAt??now,createdBy:old?.payload.createdBy??actor,updatedAt:now,updatedBy:actor});result.id=nextId;return true;
}

// Approval identities come exclusively from the authenticated household directory.
export function requiredApprovers(members){return [...new Set((members??[]).filter(m=>m.active===true||m.active===1).map(m=>m.userId).filter(id=>typeof id==='string'&&id))].sort()}
const membershipFingerprint=members=>JSON.stringify((members??[]).filter(m=>m.active===true||m.active===1).map(m=>[m.userId,m.joinedAt??0]).sort(([a],[b])=>a.localeCompare(b)));
/** @param {string|null} actor */
export function beginFamilyApproval(version,members,actor=null,now=new Date().toISOString(),membershipRevision=0){
 const required=requiredApprovers(members);if(!required.length)throw Error('没有有效家庭审批成员');if(actor&&!required.includes(actor))throw Error('审批人不是有效家庭成员');
 const approvals=actor?[{userId:actor,at:now}]:[];return {version,membershipRevision,membershipFingerprint:membershipFingerprint(members),required,approvals,status:required.every(id=>approvals.some(a=>a.userId===id))?'APPROVED':'PENDING_APPROVAL'};
}
export function currentFamilyApproval(approval,members,membershipRevision=0){
 if(!approval)return null;const required=requiredApprovers(members);if(membershipFingerprint(members)!==(approval.membershipFingerprint??JSON.stringify(approval.required.map(id=>[id,0])))||JSON.stringify(required)!==JSON.stringify(approval.required))return beginFamilyApproval((approval.version??0)+Math.max(1,membershipRevision-(approval.membershipRevision??0)),members,null,undefined,membershipRevision);
 const approvals=(approval.approvals??[]).filter((a,i,all)=>required.includes(a.userId)&&all.findIndex(x=>x.userId===a.userId)===i),rejections=(approval.rejections??[]).filter(a=>required.includes(a.userId));return {...approval,required,approvals,...(rejections.length?{rejections}:{}),status:rejections.length?'REJECTED':required.length&&required.every(id=>approvals.some(a=>a.userId===id))?'APPROVED':'PENDING_APPROVAL'};
}
export function approveFamilyPlan(plan,members,actor,version,now=new Date().toISOString(),membershipRevision=0){
 const approval=currentFamilyApproval(plan.familyApproval,members,membershipRevision);if(!approval)throw Error('计划尚未发起家庭审批');if(version!==approval.version)throw Error('CONFLICT:审批版本或家庭成员已变化，请刷新');if(!approval.required.includes(actor))throw Error('审批人不是有效家庭成员');
 if(approval.status==='REJECTED')throw Error('计划已被拒绝，请修改后重新发起审批');
 const approvals=approval.approvals.some(a=>a.userId===actor)?approval.approvals:[...approval.approvals,{userId:actor,at:now}];const status=approval.required.every(id=>approvals.some(a=>a.userId===id))?'APPROVED':'PENDING_APPROVAL';return {...plan,familyApproval:{...approval,approvals,status},budgetStatus:status,approvedAt:status==='APPROVED'?now:null};
}
export function rejectFamilyPlan(plan,members,actor,version,reason,now=new Date().toISOString(),membershipRevision=0){
 const approval=currentFamilyApproval(plan.familyApproval,members,membershipRevision);
 if(!approval||version!==approval.version)throw Error('CONFLICT:审批版本或家庭成员已变化，请刷新');
 if(!approval.required.includes(actor))throw Error('审批人不是有效家庭成员');
 if(approval.status!=='PENDING_APPROVAL')throw Error('本轮审批已结束，请修改后重新发起审批');
 if(typeof reason!=='string'||!reason.trim()||reason.length>1000)throw Error('请填写拒绝原因（最多1000字）');
 return {...plan,familyApproval:{...approval,approvals:approval.approvals.filter(a=>a.userId!==actor),rejections:[{userId:actor,at:now,reason:reason.trim()}],status:'REJECTED'},budgetStatus:'REJECTED',approvedAt:null};
}
export function applyFamilyApproval(plan,approval){return {...plan,familyApproval:approval,budgetStatus:approval.status,approvedAt:approval.status==='APPROVED'?new Date().toISOString():null}}

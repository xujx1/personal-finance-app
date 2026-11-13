import {currentSkillVersion,normalizeSkillCatalogue} from '../domain/skill-catalog.mjs';
import {SKILL_ENTRIES} from '../domain/skill-cli.mjs';
export function connectionStatus(state:any,identity:{id:string;canWrite:boolean}){
 const scope=state.household,bound=Boolean(scope&&scope.userId===identity.id),current=currentSkillVersion(state);
 const skills=normalizeSkillCatalogue(current.skills),ids=new Set(skills.map((s:any)=>s.id)),workflowsReady=SKILL_ENTRIES.every(([id])=>ids.has(id));
 const member=state.householdMembers.find((m:any)=>m.userId===identity.id&&m.active);
 return {status:bound&&member?(workflowsReady?'ready':'workflow_unavailable'):'family_required',checkedAt:new Date().toISOString(),account:{id:identity.id,name:member?.displayName??'当前账号'},family:bound?{id:scope.householdId,name:scope.name}:null,permissions:{canRead:bound&&Boolean(member),canSubmitDraft:bound&&Boolean(member)&&identity.canWrite&&scope.canWrite,approval:'family_members_on_website',bankOrSecurityTransactions:false},workflows:{ready:workflowsReady,count:skills.length,version:current.version},data_revision:state.book.revision,household_revision:state.householdRevision,clientInstallation:'not_observable',note:'此结果仅证明发起本次MCP请求的会话可访问该家庭，不证明其他会话或设备已安装、已授权。'};
}

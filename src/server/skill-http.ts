import {currentSkillVersion,normalizeSkillCatalogue,DEFAULT_SKILLS} from '../domain/skill-catalog.mjs';
import {INSTALLER_SOURCE} from '../domain/skill-installer-source.mjs';
import {zipStored} from '../domain/zip.mjs';
import {snapshot} from './finance-store.ts';
import {assertLedgerAccess} from './ledger-scope.ts';
const encode=new TextEncoder();
const sha=async(data:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(data)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function buildSkillPackage(state:any,version?:number){
 const current=currentSkillVersion(state),selected=version===undefined?current:version===0?{version:0,skills:DEFAULT_SKILLS,note:'内置备份',createdAt:null}:state.documents.find((d:any)=>d.kind==='skill_version'&&d.payload.version===version)?.payload;
 if(!selected)throw Error('工作流版本不存在');const skills=normalizeSkillCatalogue(selected.skills),semanticVersion='1.0.'+selected.version;
 const files:Record<string,string>={'plugin.json':JSON.stringify({$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:'family-finance-workflows',version:semanticVersion,description:'家庭财务中心：消费、投资、图片、月度复盘及周期收支工作流。需连接已有家庭财务中心MCP。'},null,2)+'\n'};
 for(const skill of skills)files['skills/'+skill.id+'/SKILL.md']='---\nname: '+skill.id+'\ndescription: '+JSON.stringify(skill.description)+'\nmetadata:\n  bundle_version: "'+semanticVersion+'"\n---\n\n'+skill.body+'\n';
 const manifest={version:semanticVersion,files:await Promise.all(Object.entries(files).map(async([path,content])=>({path,size:encode.encode(content).length,sha256:await sha(content)})))};
 return {version:selected.version,semanticVersion,skills,note:selected.note,createdAt:selected.createdAt,manifest,manifestSha256:await sha(JSON.stringify(manifest)),files,installation:'在站点工作流页下载并解压备份包，在解压目录运行 python3 install.py。安装器只安装五个Skill，覆盖前备份，不改MCP凭据；使用已连接家庭财务中心插件。新会话加载；网站更新后须重新下载安装。'};
}
export function createSkillHandlers(deps:any){return {async GET(req:Request){try{
 const user=await deps.getUser();if(!user)return json({error:'请先登录'},401);const db=deps.getDb();if(!db)return json({error:'数据库尚未绑定'},503);if(db.ledgerScope&&db.ledgerScope.userId!==user.userId)throw Error('家庭身份不匹配');
 const url=new URL(req.url);if([...url.searchParams.keys()].some(k=>!['download','version'].includes(k)))throw Error('参数无效');const raw=url.searchParams.get('version');if(raw!==null&&!/^(0|[1-9]\d{0,5})$/.test(raw))throw Error('版本无效');
 const state=await snapshot(db),bundle=await buildSkillPackage(state,raw===null?undefined:Number(raw));await assertLedgerAccess(db);
 if(url.searchParams.get('download')==='1'){
  const files={...bundle.files,'SKILLS-MANIFEST.json':JSON.stringify(bundle.manifest,null,2)+'\n','install.py':INSTALLER_SOURCE,'README.md':'# 家庭财务工作流备份 '+bundle.semanticVersion+'\n\n'+bundle.installation+'\n\n安装前可阅读 skills/ 中全部说明。站点编辑仅改变下一次下载，不会自动更新本机或ChatGPT插件。MCP认证由现有站点插件完成，不填写模型Key。\n'};
  const bytes=zipStored(files);return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="family-finance-skills-'+bundle.semanticVersion+'.zip"','Cache-Control':'private, no-store'}});
 }
 return json({...bundle,currentVersion:currentSkillVersion(state).version,history:[{version:0,note:'内置备份',createdAt:null},...state.documents.filter((d:any)=>d.kind==='skill_version').map((d:any)=>({version:d.payload.version,note:d.payload.note,createdAt:d.payload.createdAt,restoredFrom:d.payload.restoredFrom}))].sort((a,b)=>b.version-a.version).slice(0,50)});
 }catch(e:any){return json({error:String(e.message).slice(0,200)},403)}}};}

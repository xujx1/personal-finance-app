#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';

const ids=['consumption','investment','images','monthly','recurring'].map(s=>'family-finance-'+s);
const digest=b=>createHash('sha256').update(b).digest('hex');
const info=p=>fs.lstatSync(p,{throwIfNoEntry:false});
function safe(p,kind){const s=info(p);if(s&&(s.isSymbolicLink()||(kind==='dir'?!s.isDirectory():!s.isFile())))throw Error('不安全的安装路径：'+p);return s;}
function install(args){
 let target=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills'),dry=false;
 while(args.length){const a=args.shift();if(a==='--target'){if(!args[0]||args[0].startsWith('--'))throw Error('--target 需要目录');target=args.shift();}else if(a==='--dry-run')dry=true;else throw Error('未知参数：'+a);}
 target=path.resolve(target);safe(target,'dir');
 const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const manifest=JSON.parse(fs.readFileSync(path.join(pkg,'manifest.json'),'utf8'));
 if(manifest.format!==1||manifest.files?.length!==5)throw Error('安装清单无效');
 const seen=new Set(),entries=[];
 for(const f of manifest.files){
  if(!ids.includes(f.id)||seen.has(f.id)||f.path!=='skills/'+f.id+'/SKILL.md')throw Error('安装清单包含未知或重复路径');seen.add(f.id);
  safe(path.join(pkg,'skills'),'dir');safe(path.join(pkg,'skills',f.id),'dir');const source=path.join(pkg,f.path);safe(source,'file');
  const bytes=fs.readFileSync(source);if(bytes.length!==f.size||digest(bytes)!==f.sha256)throw Error('SHA256 校验失败：'+f.id);
  const dir=path.join(target,f.id),file=path.join(dir,'SKILL.md');safe(dir,'dir');const existing=safe(file,'file'),previous=existing?fs.readFileSync(file):null;
  entries.push({id:f.id,dir,file,bytes,previous,changed:!previous||!previous.equals(bytes)});
 }
 const backupRoot=path.join(target,'.family-finance-backups');safe(backupRoot,'dir');
 const changed=entries.filter(e=>e.changed);
 if(dry){console.log('预检通过；将更新 '+changed.length+' 个入口：'+target);return;}
 if(!changed.length){console.log('五个工作流入口已是当前版本：'+target);return;}
 fs.mkdirSync(target,{recursive:true});
 const backup=path.join(backupRoot,new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
 for(const e of changed.filter(e=>e.previous)){const d=path.join(backup,e.id);fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'SKILL.md'),e.previous,{flag:'wx',mode:0o600});}
 const applied=[];
 try{for(const e of changed){fs.mkdirSync(e.dir,{recursive:true});const temporary=path.join(e.dir,'.SKILL-'+randomUUID());try{fs.writeFileSync(temporary,e.bytes,{flag:'wx',mode:0o600});fs.renameSync(temporary,e.file);applied.push(e);}finally{fs.rmSync(temporary,{force:true});}}}
 catch(error){for(const e of applied.reverse()){if(e.previous)fs.writeFileSync(e.file,e.previous);else fs.rmSync(e.file,{force:true});}throw error;}
 console.log('已安装 '+changed.length+' 个家庭财务入口：'+target);
 if(changed.some(e=>e.previous))console.log('原版本备份：'+backup);
 console.log('请重新打开 Codex 会话，并使用已连接的“家庭财务中心”MCP。工作流正文在使用时从站点读取最新版。');
}
try{const [command,...args]=process.argv.slice(2);if(!command||['--help','-h','help'].includes(command))console.log('用法：family-finance-skills install [--target 目录] [--dry-run]\n安装五个通用工作流入口，不含家庭资料，不修改 MCP 认证。');else if(command==='install')install(args);else throw Error('未知命令：'+command);}catch(error){console.error('安装未完成：'+error.message);process.exitCode=1;}

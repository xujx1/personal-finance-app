import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {SKILL_CLI_VERSION,SKILL_ENTRIES,bootstrapSkill} from '../src/domain/skill-cli.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--output'))throw Error('用法：node scripts/package-skill-cli.mjs [--output 目录]');
const output=path.resolve(args[1]??path.join(root,'public/downloads'));fs.mkdirSync(output,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'finance-skill-pack-'));
try{
 fs.mkdirSync(path.join(temp,'bin'));fs.copyFileSync(path.join(root,'scripts/finance-skills-cli/cli.mjs'),path.join(temp,'bin/cli.mjs'));fs.chmodSync(path.join(temp,'bin/cli.mjs'),0o755);
 const files=[];for(const entry of SKILL_ENTRIES){const content=Buffer.from(bootstrapSkill(entry)),name='skills/'+entry[0]+'/SKILL.md';fs.mkdirSync(path.dirname(path.join(temp,name)),{recursive:true});fs.writeFileSync(path.join(temp,name),content);files.push({id:entry[0],path:name,size:content.length,sha256:createHash('sha256').update(content).digest('hex')});}
 fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify({format:1,version:SKILL_CLI_VERSION,files},null,2));
 fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({name:'family-finance-skills',version:SKILL_CLI_VERSION,private:true,type:'module',description:'Public bootstrap entries for the authenticated family finance MCP',bin:{'family-finance-skills':'bin/cli.mjs'},engines:{node:'>=20'},files:['bin','skills','manifest.json']},null,2));
 const result=spawnSync('npm',['pack','--json','--ignore-scripts','--pack-destination',output],{cwd:temp,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);const pack=JSON.parse(result.stdout)[0];console.log(JSON.stringify({file:path.join(output,pack.filename),sha256:createHash('sha256').update(fs.readFileSync(path.join(output,pack.filename))).digest('hex'),size:pack.size}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}

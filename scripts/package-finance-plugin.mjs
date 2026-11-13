import fs from 'node:fs';
import path from 'node:path';
import {financePluginFiles,financeMarketplace} from '../src/domain/plugin-package.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--app-id','--mcp-url','--oauth-resource','--output'].includes(args[i])||!args[i+1]||Object.hasOwn(options,args[i]))throw Error('需要 --output 目录及 --app-id 实际应用ID 或 --mcp-url 已确认地址');options[args[i]]=args[i+1];}
if(!options['--output'])throw Error('必须提供 --output；不修改用户安装目录');
const files=financePluginFiles({...options['--app-id']?{appId:options['--app-id']}:{},...options['--mcp-url']?{mcpUrl:options['--mcp-url']}:{},...options['--oauth-resource']?{oauthResource:options['--oauth-resource']}:{}});
const out=path.resolve(options['--output']);if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('输出目录必须为空，以免残留旧MCP映射');
fs.mkdirSync(out,{recursive:true});
for(const [name,body] of Object.entries(files)){const p=path.join(out,'plugins/family-finance',name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);}
const marketplace=path.join(out,'.agents/plugins/marketplace.json');fs.mkdirSync(path.dirname(marketplace),{recursive:true});fs.writeFileSync(marketplace,JSON.stringify(financeMarketplace(),null,2)+'\n');
console.log(JSON.stringify({output:out,packagePrepared:true,installed:false,oauthVerified:false,mobileVerified:false,files:Object.keys(files).length}));

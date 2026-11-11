import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareVendor} from './prepare-vendor.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),i=args.indexOf('--modules');
const modules=path.resolve(i>=0?args[i+1]:path.join(root,'node_modules'));
const vite=path.join(modules,'vite','bin','vite.js');
if(!fs.existsSync(vite))throw Error('未找到已安装的Vite，请用--modules指定本机第三方依赖目录');
await prepareVendor(modules);
const env={...process.env,LOCAL_TEST_MODULES:modules};
const children=[spawn(process.execPath,[path.join(root,'local/server.mjs')],{cwd:root,env,stdio:'inherit'}),spawn(process.execPath,[path.join(root,'local/vite-server.mjs')],{cwd:root,env,stdio:'inherit'})];
let closing=false;const close=()=>{if(closing)return;closing=true;for(const child of children)child.kill();};
for(const child of children){child.on('error',e=>{console.error(e);close();process.exitCode=1});child.on('exit',code=>{if(!closing){close();process.exitCode=code??1;}});}
process.on('SIGINT',close);process.on('SIGTERM',close);

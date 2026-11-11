import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ts=require(process.argv[2]||'typescript');
const files=[];
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(e.name)&&!e.name.endsWith('.d.ts'))files.push(p);}}
for(const dir of ['app','components','src'])walk(dir);
let failures=0;
for(const file of files){const r=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});for(const d of r.diagnostics??[]){if(d.category===ts.DiagnosticCategory.Error){failures++;console.error(file+': '+ts.flattenDiagnosticMessageText(d.messageText,' '));}}}
console.log(`Syntax checked ${files.length} TypeScript/TSX files; errors=${failures}. This is not a full typecheck or framework build.`);
process.exitCode=failures?1:0;

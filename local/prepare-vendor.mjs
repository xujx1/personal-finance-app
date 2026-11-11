import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
export async function prepareVendor(modules){
 const root=fileURLToPath(new URL('../',import.meta.url));
 const requireVite=createRequire(fs.realpathSync(path.join(modules,'vite/package.json')));
 const esbuild=requireVite('esbuild');
 const requireModules=createRequire(path.join(path.dirname(modules),'package.json'));
 const react=requireModules.resolve('react'),dom=requireModules.resolve('react-dom'),client=requireModules.resolve('react-dom/client'),jsx=requireModules.resolve('react/jsx-runtime'),dev=requireModules.resolve('react/jsx-dev-runtime');
 const iconsPackage=JSON.parse(fs.readFileSync(path.join(modules,'lucide-react/package.json'),'utf8'));
 const imports={
  react:`import React from ${JSON.stringify(react)};export default React;export const {useState,useEffect,useRef,useId,useMemo,useCallback,useContext,createContext,createElement,forwardRef,Fragment,StrictMode,Children}=React;`,
  dom:`import Dom from ${JSON.stringify(dom)};export const {createPortal,flushSync}=Dom;`,
  client:`import Client from ${JSON.stringify(client)};export const {createRoot,hydrateRoot}=Client;`,
  jsx:`import Runtime from ${JSON.stringify(jsx)};export const {jsx,jsxs,Fragment}=Runtime;`,
  dev:`import Runtime from ${JSON.stringify(dev)};export const {jsxDEV,Fragment}=Runtime;`,
  icons:`export * from ${JSON.stringify(path.join(modules,'lucide-react',iconsPackage.module??iconsPackage.main))};`
 };
 const result=await esbuild.build({absWorkingDir:path.dirname(modules),entryPoints:Object.fromEntries(Object.keys(imports).map(k=>[k,'qa-entry:'+k])),outdir:'qa-vendor-output',write:false,bundle:true,splitting:true,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'local-vendor-entries',setup(build){build.onResolve({filter:/^qa-entry:/},args=>({path:args.path.slice(9),namespace:'qa-entry'}));build.onLoad({filter:/.*/,namespace:'qa-entry'},args=>({contents:imports[args.path],resolveDir:path.dirname(modules),loader:'js'}));}}]});
 const out=path.join(root,'.sites-runtime/local-vendor');fs.mkdirSync(out,{recursive:true});
 for(const file of result.outputFiles)fs.writeFileSync(path.join(out,path.basename(file.path)),file.contents);
 console.log('Offline third-party vendor prepared (no network requests).');
}

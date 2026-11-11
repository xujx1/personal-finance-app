import path from 'node:path';
import {pathToFileURL} from 'node:url';
import config from './vite.config.mjs';
const entry=path.join(process.env.LOCAL_TEST_MODULES,'vite/dist/node/index.js');
const {createServer}=await import(pathToFileURL(entry).href);
const server=await createServer({...config,configFile:false});
await server.listen();server.printUrls();
const close=async()=>{await server.close();process.exit(0)};process.on('SIGINT',close);process.on('SIGTERM',close);

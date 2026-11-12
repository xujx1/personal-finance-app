import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const deps=process.env.LOCAL_TEST_MODULES||path.join(root,'node_modules');
const vendor=path.join(root,'.sites-runtime/local-vendor');
export default {
 root:path.join(root,'local'),publicDir:path.join(root,'public'),configFile:false,
 resolve:{alias:[{find:'react/jsx-dev-runtime',replacement:path.join(vendor,'dev.js')},{find:'react/jsx-runtime',replacement:path.join(vendor,'jsx.js')},{find:/^react$/,replacement:path.join(vendor,'react.js')},{find:'react-dom/client',replacement:path.join(vendor,'client.js')},{find:/^react-dom$/,replacement:path.join(vendor,'dom.js')},{find:'lucide-react',replacement:path.join(vendor,'icons.js')}]},
 esbuild:{jsx:'automatic'},css:{postcss:{plugins:[]}},
 server:{host:'127.0.0.1',port:Number(process.env.LOCAL_UI_PORT??5173),strictPort:true,fs:{allow:[root,deps]},proxy:{'/api':{target:'http://127.0.0.1:'+(process.env.LOCAL_API_PORT??5174)},'/mcp':{target:'http://127.0.0.1:'+(process.env.LOCAL_API_PORT??5174)},'/auth/callback':{target:'http://127.0.0.1:'+(process.env.LOCAL_API_PORT??5174)}}},
 optimizeDeps:{noDiscovery:true,include:[]}
};

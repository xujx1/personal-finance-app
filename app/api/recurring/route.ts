import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createRecurringHandlers} from '../../../src/server/recurring-http';
const e=env as any;
const config=()=>({baseUrl:e.NEW_API_BASE_URL,model:e.NEW_API_MODEL,key:e.NEW_API_KEY});
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createRecurringHandlers({...d,getConfig:config}).GET());
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createRecurringHandlers({...d,getConfig:config}).POST(req));

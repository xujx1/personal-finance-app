import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createImageHandlers} from '../../../src/server/image-http';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createImageHandlers({...d,getConfig:()=>({baseUrl:e.NEW_API_BASE_URL,model:e.NEW_API_VISION_MODEL,key:e.NEW_API_KEY})}).GET());
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createImageHandlers({...d,getConfig:()=>({baseUrl:e.NEW_API_BASE_URL,model:e.NEW_API_VISION_MODEL,key:e.NEW_API_KEY})}).POST(req));

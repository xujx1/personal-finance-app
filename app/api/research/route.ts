import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createResearchHandlers} from '../../../src/server/research-http';
import {chatGPTService} from '../../../src/server/chatgpt-config';
const e=env as any;
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createResearchHandlers({...d,chatgpt:chatGPTService(env.DB,e),getConfig:()=>({baseUrl:e.NEW_API_BASE_URL,model:e.NEW_API_MODEL,key:e.NEW_API_KEY,searchKey:e.TAVILY_API_KEY})}).POST(req));

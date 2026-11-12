import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createAdvisorHandlers} from '../../../src/server/advisor-http';
import {chatGPTService} from '../../../src/server/chatgpt-config';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createAdvisorHandlers({...d,chatgpt:chatGPTService(env.DB,e),getConfig:()=>({baseUrl:e.NEW_API_BASE_URL,model:e.NEW_API_MODEL,key:e.NEW_API_KEY,dailyLimit:e.AI_ADVISOR_DAILY_LIMIT})}).GET());
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createAdvisorHandlers({...d,chatgpt:chatGPTService(env.DB,e),getConfig:()=>({baseUrl:e.NEW_API_BASE_URL,model:e.NEW_API_MODEL,key:e.NEW_API_KEY,dailyLimit:e.AI_ADVISOR_DAILY_LIMIT})}).POST(req));

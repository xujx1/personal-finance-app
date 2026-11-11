import {chatGPTService} from '../../../src/server/chatgpt-config';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {createAdvisorHandlers} from '../../../src/server/advisor-http';
const e=env as any;
const handlers=createAdvisorHandlers({getUser:getChatGPTUser,getDb:()=>env.DB,getOwner:()=>e.OWNER_SUBJECT_ID,chatgpt:chatGPTService(env.DB,e),getConfig:()=>({baseUrl:e.NEW_API_BASE_URL,model:e.NEW_API_MODEL,key:e.NEW_API_KEY})});
export const GET=handlers.GET;
export const POST=handlers.POST;

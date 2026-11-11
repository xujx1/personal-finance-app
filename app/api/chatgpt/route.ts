import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createChatGPTHandlers} from '../../../src/server/chatgpt-http';
import {chatGPTService} from '../../../src/server/chatgpt-config';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createChatGPTHandlers({...d,service:chatGPTService(env.DB,e)}).GET());
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createChatGPTHandlers({...d,service:chatGPTService(env.DB,e)}).POST(req));

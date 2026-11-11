import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createChatGPTHandlers} from '../../../src/server/chatgpt-http';
import {chatGPTService} from '../../../src/server/chatgpt-config';
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,env,d=>createChatGPTHandlers({...d,service:chatGPTService(env.DB,env)}).CALLBACK(req));

import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {retiredAIResponse} from '../../../src/server/retired-ai';
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,env,()=>retiredAIResponse());
export const POST=GET;

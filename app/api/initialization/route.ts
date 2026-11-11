import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createInitializationHandlers} from '../../../src/server/initialization-http';
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,env,d=>createInitializationHandlers(d).POST(req));

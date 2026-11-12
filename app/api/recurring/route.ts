import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createRecurringHandlers} from '../../../src/server/recurring-http';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createRecurringHandlers(d).GET());
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createRecurringHandlers(d).POST(req));

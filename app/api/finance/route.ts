import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createFinanceHandlers} from '../../../src/server/finance-http';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createFinanceHandlers({...d}).GET(req));
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createFinanceHandlers({...d}).POST(req));

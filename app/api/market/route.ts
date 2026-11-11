import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createMarketHandlers} from '../../../src/server/market-http';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createMarketHandlers({...d}).GET(req));

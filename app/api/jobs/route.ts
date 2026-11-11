import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createJobsHandlers} from '../../../src/server/jobs-http';
import {createMarketHandlers} from '../../../src/server/market-http';
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,env,d=>createJobsHandlers({...d,getQuotes:async()=>((await(await createMarketHandlers(d).GET(req)).json()) as any).quotes}).POST(req));

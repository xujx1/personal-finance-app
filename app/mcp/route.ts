import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../chatgpt-auth';
import {withFamilyRequest} from '../../src/server/family-route';
import {createMcpHandler} from '../../src/server/mcp-http';
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,env,d=>createMcpHandler({getDb:d.getDb,getIdentity:async()=>({id:d.user.userId,canWrite:d.scope.canWrite})})(req));

import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createSkillHandlers} from '../../../src/server/skill-http';
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,env,d=>createSkillHandlers(d).GET(req));

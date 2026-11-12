import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createReviewHandlers} from '../../../src/server/review-http';
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,env,d=>createReviewHandlers(d).GET(req));

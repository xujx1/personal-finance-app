import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createFxHandlers} from '../../../src/server/fx-http';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createFxHandlers({...d}).GET());

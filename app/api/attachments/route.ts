import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {withFamilyRequest} from '../../../src/server/family-route';
import {createAttachmentHandlers} from '../../../src/server/attachment-http';
const e=env as any;
export const GET=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createAttachmentHandlers({...d,getKey:()=>e.ATTACHMENT_KEY}).GET(req));
export const POST=(req:Request)=>withFamilyRequest(req,getChatGPTUser,e,d=>createAttachmentHandlers({...d,getKey:()=>e.ATTACHMENT_KEY}).POST(req));

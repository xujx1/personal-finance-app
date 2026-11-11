import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {createFinanceHandlers} from '../../../src/server/finance-http';
const handlers=createFinanceHandlers({getUser:getChatGPTUser,getDb:()=>env.DB,getOwner:()=>(env as any).OWNER_SUBJECT_ID});
export const GET=handlers.GET;
export const POST=handlers.POST;

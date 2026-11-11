import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {createFamilyHandlers} from '../../../src/server/family-route';
const h=createFamilyHandlers({getUser:getChatGPTUser,env});
export const GET=h.GET;
export const POST=h.POST;

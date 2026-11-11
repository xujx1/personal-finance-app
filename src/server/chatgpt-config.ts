import {createChatGPTService} from './chatgpt-service.mjs';
export const chatGPTService=(db:any,e:any)=>createChatGPTService({db,config:{tokenKey:e.CHATGPT_TOKEN_KEY,redirectUri:e.CHATGPT_REDIRECT_URI,clientId:e.CHATGPT_CLIENT_ID,clientSecret:e.CHATGPT_CLIENT_SECRET}});

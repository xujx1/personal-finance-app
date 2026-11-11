import {env} from 'cloudflare:workers';
import {createMcpHandler} from '../../src/server/mcp-http';
export const POST=createMcpHandler({getDb:()=>env.DB,getIdentity:async req=>{const id=req.headers.get('oai-authenticated-user-id');if(!id)return null;const owner=(env as any).OWNER_SUBJECT_ID;return {id,canWrite:!owner||id===owner};}});

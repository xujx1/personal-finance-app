import test from 'node:test';
import assert from 'node:assert/strict';
import {readChatCompletion} from '../src/server/chat-completions-stream.mjs';

const encoder=new TextEncoder();
const frame=value=>'data: '+JSON.stringify(value)+'\n\n';
const delta=content=>frame({choices:[{index:0,delta:{content},finish_reason:null}]});
const stop=frame({choices:[{index:0,delta:{},finish_reason:'stop'}]});
function response(raw, widths=[raw.length]){
 const bytes=encoder.encode(raw);let cursor=0,index=0;
 return new Response(new ReadableStream({pull(controller){if(cursor>=bytes.length){controller.close();return;}const end=Math.min(bytes.length,cursor+widths[index++%widths.length]);controller.enqueue(bytes.slice(cursor,end));cursor=end;}}),{headers:{'content-type':'text/event-stream; charset=utf-8'}});
}

test('chat completion decodes split UTF8, JSON fields and SSE frames while emitting only actual content chunks',async()=>{
 const seen=[];
 const raw=': keepalive\r\n\r\n'+frame({choices:[{index:0,delta:{role:'assistant'},finish_reason:null}]})+delta('你😀')+delta('\n好')+stop+frame({choices:[],usage:{completion_tokens:3}})+'data: [DONE]\n\n';
 const result=await readChatCompletion(response(raw,[1,2,5,3]),{onDelta:chunk=>seen.push(chunk)});
 assert.deepEqual(result,{text:'你😀\n好',streamed:true});
 assert.deepEqual(seen,['你😀','\n好']);
});

test('stop finish can accompany a final real delta and CRLF frames',async()=>{
 const seen=[];
 const raw=frame({choices:[{delta:{content:'最终内容'},finish_reason:'stop'}]}).replaceAll('\n','\r\n')+'data: [DONE]\r\n\r\n';
 assert.deepEqual(await readChatCompletion(response(raw,[7]),{onDelta:chunk=>seen.push(chunk)}),{text:'最终内容',streamed:true});
 assert.deepEqual(seen,['最终内容']);
});

test('EOF without DONE or without stop never yields a complete result',async()=>{
 for(const raw of [delta('部分内容'),delta('内容')+stop,delta('内容')+'data: [DONE]\n\n']){
  await assert.rejects(readChatCompletion(response(raw,[4])),/incomplete|truncated|complete|stop/i);
 }
});

test('length, tool call and refusal finishes cannot become a completed text result',async()=>{
 for(const reason of ['length','tool_calls','function_call','content_filter']){
  await assert.rejects(readChatCompletion(response(delta('不完整')+frame({choices:[{delta:{},finish_reason:reason}]})+'data: [DONE]\n\n')),/finish|length|tool|filter/i);
 }
 await assert.rejects(readChatCompletion(response(frame({choices:[{delta:{tool_calls:[{index:0,id:'call',function:{name:'unknown'}}]},finish_reason:null}]})+stop+'data: [DONE]\n\n')),/tool/i);
});

test('provider error objects and named error events reject instead of returning partial success',async()=>{
 for(const raw of [delta('部分')+frame({error:{message:'simulated failure'}}), 'event: error\ndata: {"message":"simulated failure"}\n\n']){
  await assert.rejects(readChatCompletion(response(raw,[3])),/error|failed|failure/i);
 }
});

test('malformed JSON or malformed content delta rejects',async()=>{
 await assert.rejects(readChatCompletion(response('data: {broken}\n\n')),/JSON|format|invalid/i);
 await assert.rejects(readChatCompletion(response(frame({choices:[{delta:{content:{text:'invalid'}},finish_reason:null}]})+stop+'data: [DONE]\n\n')),/content|format|invalid/i);
});

test('JSON provider fallback returns content without fake stream delta callbacks',async()=>{
 const seen=[];
 const result=await readChatCompletion(Response.json({choices:[{message:{content:'完整JSON返回'},finish_reason:'stop'}]}),{onDelta:chunk=>seen.push(chunk)});
 assert.deepEqual(result,{text:'完整JSON返回',streamed:false});assert.deepEqual(seen,[]);
 for(const value of [{choices:[]},{choices:[{message:{content:null}}]},{error:{message:'simulated error'}},{choices:[{message:{content:'partial'},finish_reason:'length'}]}]){
  await assert.rejects(readChatCompletion(Response.json(value)),/content|choice|error|finish|length|invalid/i);
 }
});

test('HTTP failure and unexpected content types never count as provider completion',async()=>{
 await assert.rejects(readChatCompletion(new Response('failed',{status:502,headers:{'content-type':'application/json'}})),/HTTP|request|failed/i);
 await assert.rejects(readChatCompletion(new Response('plain answer',{headers:{'content-type':'text/plain'}})),/content.type|format|unsupported/i);
});

test('abort stops an otherwise ignored pending response and cancels its reader',{timeout:1000},async()=>{
 const controller=new AbortController();let start,cancelled=false;const started=new Promise(resolve=>start=resolve);
 const ignored=new Response(new ReadableStream({pull(){start();},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});
 const reading=readChatCompletion(ignored,{signal:controller.signal});
 await started;controller.abort();
 await assert.rejects(reading,{name:'AbortError'});assert.equal(cancelled,true);
});

test('already aborted and callback-triggered aborts cannot publish a finished response',async()=>{
 const before=new AbortController();before.abort();const seen=[];
 await assert.rejects(readChatCompletion(response(delta('禁止回调')+stop+'data: [DONE]\n\n'),{signal:before.signal,onDelta:chunk=>seen.push(chunk)}),{name:'AbortError'});
 assert.deepEqual(seen,[]);
 const during=new AbortController();
 await assert.rejects(readChatCompletion(response(delta('第一段')+delta('第二段')+stop+'data: [DONE]\n\n'),{signal:during.signal,onDelta:chunk=>{seen.push(chunk);during.abort();}}),{name:'AbortError'});
 assert.deepEqual(seen,['第一段']);
});

test('stream and JSON output limits reject excessive content and unbounded frames',async()=>{
 const huge='x'.repeat(1024*1024+1);
 await assert.rejects(readChatCompletion(response(delta(huge)+stop+'data: [DONE]\n\n')),/limit|exceed|large/i);
 await assert.rejects(readChatCompletion(response('data: '+huge)),/limit|exceed|large/i);
 await assert.rejects(readChatCompletion(response(delta('x'.repeat(400000)).repeat(3)+stop+'data: [DONE]\n\n')),/limit|exceed|large/i);
 await assert.rejects(readChatCompletion(Response.json({choices:[{message:{content:huge}}]})),/limit|exceed|large/i);
});

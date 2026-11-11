const MAX_BYTES=1024*1024;
const encoder=new TextEncoder();

function finishReason(reason){
 if(reason!=null&&reason!=='stop')throw Object.assign(Error('Chat completion rejected finish reason: '+String(reason)),{code:reason==='length'?'OUTPUT_LIMIT':reason==='content_filter'?'OUTPUT_FILTERED':'FINISH_INVALID'});
}

export async function readChatCompletion(response,{onDelta,signal}={}){
 signal?.throwIfAborted();
 if(!response.ok)throw Error('Chat completion HTTP request failed: '+response.status);
 const contentType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
 const streamed=contentType==='text/event-stream';
 if(!streamed&&contentType!=='application/json')throw Error('Unsupported chat completion content type');
 if(!response.body)throw Error('Chat completion response body is missing');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 const abort=()=>{void reader.cancel(signal.reason).catch(()=>{});};
 signal?.addEventListener('abort',abort,{once:true});
 const read=async()=>{signal?.throwIfAborted();const chunk=await reader.read();signal?.throwIfAborted();return chunk;};
 try{
  if(!streamed){
   let raw='',bytes=0;
   while(true){const chunk=await read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>MAX_BYTES)throw Error('Chat completion response exceeds size limit');raw+=decoder.decode(chunk.value,{stream:true});}
   raw+=decoder.decode();signal?.throwIfAborted();
   const value=JSON.parse(raw);
   if(value?.error)throw Error('Chat completion provider error');
   const choice=value?.choices?.[0];
   if(!choice||typeof choice.message?.content!=='string')throw Error('Invalid chat completion message content');
   if(choice.message.tool_calls?.length||choice.message.function_call)throw Error('Chat completion tool calls are not supported');
   finishReason(choice.finish_reason);
   if(encoder.encode(choice.message.content).byteLength>MAX_BYTES)throw Error('Chat completion output exceeds size limit');
   signal?.throwIfAborted();return {text:choice.message.content,streamed:false};
  }
  let buffer='',eventType='',data=[],eventBytes=0,text='',outputBytes=0,stopped=false,done=false;
  const event=()=>{
   signal?.throwIfAborted();
   if(eventType==='error')throw Error('Chat completion provider error event');
   if(!data.length){eventType='';eventBytes=0;return;}
   const raw=data.join('\n');data=[];eventBytes=0;eventType='';
   if(raw.trim()==='[DONE]'){
    if(!stopped)throw Error('Chat completion incomplete: missing stop finish');
    done=true;return;
   }
   const value=JSON.parse(raw);
   if(!value||typeof value!=='object'||value.error)throw Error('Chat completion provider error or invalid event');
   if(!Array.isArray(value.choices))throw Error('Invalid chat completion choices');
   if(!value.choices.length)return; // Usage-only final events carry no content.
   const choice=value.choices.find(item=>item?.index===0)??(value.choices[0]?.index==null?value.choices[0]:null);
   if(!choice)return;
   const delta=choice.delta;
   if(!delta||typeof delta!=='object'||Array.isArray(delta))throw Error('Invalid chat completion delta format');
   if(delta.tool_calls?.length||delta.function_call)throw Error('Chat completion tool calls are not supported');
   finishReason(choice.finish_reason);
   if(delta.content!=null){
    if(typeof delta.content!=='string')throw Error('Invalid chat completion content delta');
    if(stopped&&delta.content)throw Error('Chat completion content arrived after stop finish');
    outputBytes+=encoder.encode(delta.content).byteLength;
    if(outputBytes>MAX_BYTES)throw Error('Chat completion output exceeds size limit');
    text+=delta.content;
    if(delta.content){signal?.throwIfAborted();onDelta?.(delta.content);signal?.throwIfAborted();}
   }
   if(choice.finish_reason==='stop')stopped=true;
  };
  const line=raw=>{
   const value=raw.endsWith('\r')?raw.slice(0,-1):raw;
   if(!value){event();return;}
   if(value.startsWith(':'))return;
   const separator=value.indexOf(':'),field=separator<0?value:value.slice(0,separator);
   let body=separator<0?'':value.slice(separator+1);if(body.startsWith(' '))body=body.slice(1);
   if(field==='event')eventType=body;
   if(field==='data'){eventBytes+=encoder.encode(body).byteLength;if(eventBytes>MAX_BYTES)throw Error('Chat completion event exceeds size limit');data.push(body);}
  };
  while(!done){
   const chunk=await read();
   if(chunk.done){buffer+=decoder.decode();if(buffer){line(buffer);buffer='';}if(!done)event();break;}
   buffer+=decoder.decode(chunk.value,{stream:true});
   let newline;
   while(!done&&(newline=buffer.indexOf('\n'))>=0){const next=buffer.slice(0,newline);buffer=buffer.slice(newline+1);line(next);}
   if(buffer.length>MAX_BYTES)throw Error('Chat completion frame exceeds size limit');
  }
  signal?.throwIfAborted();
  if(!done||!stopped)throw Object.assign(Error('Chat completion stream truncated before completed stop and DONE'),{code:'STREAM_INTERRUPTED'});
  return {text,streamed:true};
 }finally{
  signal?.removeEventListener('abort',abort);
  await reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
}

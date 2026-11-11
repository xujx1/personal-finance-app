export function assistantStream(req:Request,run:(signal:AbortSignal,emit:(e:any)=>void)=>Promise<Response>){
 const cancel=new AbortController(),signal=AbortSignal.any([req.signal,cancel.signal]),enc=new TextEncoder();let closed=false,timer:ReturnType<typeof setInterval>|undefined;
 const stream=new ReadableStream<Uint8Array>({start(c){
  const emit=(e:any)=>{if(!closed&&!signal.aborted)c.enqueue(enc.encode('data: '+JSON.stringify(e)+'\n\n'))};
  timer=setInterval(()=>{if(!closed&&!signal.aborted)c.enqueue(enc.encode(': heartbeat\n\n'))},10000);
  void(async()=>{try{const r=await run(signal,emit),v:any=await r.json();signal.throwIfAborted();emit(r.ok?{type:'result',value:v}:{type:'error',error:v.error??'分析未完成',errorCode:v.errorCode??null})}catch(e:any){if(!signal.aborted)emit({type:'error',error:'分析连接未完成，请重试；未批准预算、未更改资产'})}finally{if(timer)clearInterval(timer);if(!closed){closed=true;c.close()}}})();
 },cancel(){closed=true;if(timer)clearInterval(timer);cancel.abort()}});
 return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}
